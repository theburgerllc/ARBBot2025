"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbitrageWorker = void 0;
const ethers_1 = require("ethers");
const LiquidityFiltering_1 = require("./LiquidityFiltering");
const DexIntegration_1 = require("./DexIntegration");
const SymbiosisIntegration_1 = require("./SymbiosisIntegration");
const GasOptimizer_1 = require("./GasOptimizer");
class ArbitrageWorker {
    workerId;
    providers = {};
    signers = {};
    liquidityFiltering;
    dexIntegrations = {};
    symbiosisIntegration;
    gasOptimizer;
    opportunitiesFound = 0;
    executionsAttempted = 0;
    executionsSuccessful = 0;
    totalProfit = '0';
    totalGasUsed = '0';
    constructor(workerId) {
        this.workerId = workerId;
        this.initializeProviders();
        this.initializeSigners();
        this.initializeServices();
    }
    initializeProviders() {
        this.providers = {
            arbitrum: new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC || 'https://arb1.arbitrum.io/rpc'),
            optimism: new ethers_1.ethers.JsonRpcProvider(process.env.OPT_RPC || 'https://mainnet.optimism.io'),
            base: new ethers_1.ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org'),
            ethereum: new ethers_1.ethers.JsonRpcProvider(process.env.ETH_RPC || 'https://cloudflare-eth.com'),
            polygon: new ethers_1.ethers.JsonRpcProvider(process.env.POLYGON_RPC || 'https://polygon-rpc.com')
        };
    }
    initializeSigners() {
        const privateKey = process.env.PRIVATE_KEY || ethers_1.ethers.Wallet.createRandom().privateKey;
        Object.entries(this.providers).forEach(([chain, provider]) => {
            this.signers[chain] = new ethers_1.ethers.Wallet(privateKey, provider);
        });
    }
    initializeServices() {
        this.liquidityFiltering = new LiquidityFiltering_1.LiquidityFiltering(this.providers);
        this.symbiosisIntegration = new SymbiosisIntegration_1.SymbiosisIntegration(this.providers, this.signers);
        this.gasOptimizer = new GasOptimizer_1.GasOptimizer(this.providers);
        // Initialize DEX integrations for each chain
        [42161, 10, 8453, 1, 137].forEach(chainId => {
            this.dexIntegrations[chainId] = new DexIntegration_1.DexIntegration(this.providers, chainId);
        });
    }
    async scanForOpportunities(params) {
        const opportunities = [];
        try {
            // Get dynamic token list if not provided
            let tokens = params.tokens;
            if (!tokens || tokens.length === 0) {
                const topTokens = await this.liquidityFiltering.getTopTokensForAllChains();
                tokens = Object.values(topTokens).flat().map(token => token.address);
            }
            // Scan for opportunities across all chains
            for (const chainId of params.chains) {
                const chainOpportunities = await this.scanChainForOpportunities(chainId, tokens, params.scanDepth);
                opportunities.push(...chainOpportunities);
            }
            // Scan for cross-chain opportunities
            const crossChainOpportunities = await this.scanCrossChainOpportunities(tokens, params.chains);
            opportunities.push(...crossChainOpportunities);
            this.opportunitiesFound += opportunities.length;
            return opportunities;
        }
        catch (error) {
            console.error(`Worker ${this.workerId} scan error:`, error);
            return [];
        }
    }
    async scanChainForOpportunities(chainId, tokens, depth) {
        const opportunities = [];
        const dexIntegration = this.dexIntegrations[chainId];
        if (!dexIntegration)
            return opportunities;
        // Scan token pairs for arbitrage opportunities
        for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
                const tokenA = tokens[i];
                const tokenB = tokens[j];
                try {
                    const opportunity = await this.checkArbitrageOpportunity(chainId, tokenA, tokenB, dexIntegration);
                    if (opportunity) {
                        opportunities.push(opportunity);
                    }
                }
                catch (error) {
                    console.debug(`Error checking opportunity ${tokenA}/${tokenB}:`, error);
                }
            }
        }
        // Scan for triangular arbitrage if depth > 2
        if (depth > 2) {
            const triangularOpportunities = await this.scanTriangularArbitrage(chainId, tokens, dexIntegration);
            opportunities.push(...triangularOpportunities);
        }
        return opportunities;
    }
    async checkArbitrageOpportunity(chainId, tokenA, tokenB, dexIntegration) {
        const testAmount = ethers_1.ethers.parseUnits('1000', 18).toString();
        try {
            // Get quotes from all DEXs
            const quotes = await dexIntegration.getAllRoutes(tokenA, tokenB, testAmount);
            if (quotes.allRoutes.length < 2)
                return null;
            // Find price discrepancy
            const sortedRoutes = quotes.allRoutes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));
            const bestRoute = sortedRoutes[0];
            const secondBestRoute = sortedRoutes[1];
            const priceDiff = parseFloat(bestRoute.amountOut) - parseFloat(secondBestRoute.amountOut);
            const profitPercentage = priceDiff / parseFloat(testAmount);
            // Check if opportunity meets minimum profit threshold
            if (profitPercentage < 0.005)
                return null; // 0.5% minimum profit
            // Calculate gas costs
            const gasPrice = await this.gasOptimizer.getCurrentGasPrice(chainId);
            const gasEstimate = parseInt(bestRoute.gasEstimate) + parseInt(secondBestRoute.gasEstimate);
            const gasCost = gasPrice * gasEstimate;
            // Calculate net profit
            const grossProfit = priceDiff;
            const netProfit = grossProfit - gasCost;
            if (netProfit <= 0)
                return null;
            return {
                tokenA,
                tokenB,
                chainId,
                dexA: bestRoute.dexName,
                dexB: secondBestRoute.dexName,
                amountIn: testAmount,
                amountOut: bestRoute.amountOut,
                profit: netProfit.toString(),
                gasEstimate: gasEstimate.toString(),
                confidence: this.calculateConfidence(bestRoute, secondBestRoute),
                route: [tokenA, tokenB],
                priceImpact: bestRoute.priceImpact
            };
        }
        catch (error) {
            console.debug(`Error checking arbitrage opportunity:`, error);
            return null;
        }
    }
    async scanTriangularArbitrage(chainId, tokens, dexIntegration) {
        const opportunities = [];
        // Check A -> B -> C -> A triangular paths
        for (let i = 0; i < tokens.length; i++) {
            for (let j = 0; j < tokens.length; j++) {
                for (let k = 0; k < tokens.length; k++) {
                    if (i === j || j === k || i === k)
                        continue;
                    const tokenA = tokens[i];
                    const tokenB = tokens[j];
                    const tokenC = tokens[k];
                    try {
                        const opportunity = await this.checkTriangularOpportunity(chainId, tokenA, tokenB, tokenC, dexIntegration);
                        if (opportunity) {
                            opportunities.push(opportunity);
                        }
                    }
                    catch (error) {
                        console.debug(`Error checking triangular opportunity:`, error);
                    }
                }
            }
        }
        return opportunities;
    }
    async checkTriangularOpportunity(chainId, tokenA, tokenB, tokenC, dexIntegration) {
        const testAmount = ethers_1.ethers.parseUnits('1000', 18).toString();
        try {
            // Get quotes for A -> B -> C -> A path
            const quoteAB = await dexIntegration.getAllRoutes(tokenA, tokenB, testAmount);
            const quoteBC = await dexIntegration.getAllRoutes(tokenB, tokenC, quoteAB.bestRoute.amountOut);
            const quoteCA = await dexIntegration.getAllRoutes(tokenC, tokenA, quoteBC.bestRoute.amountOut);
            const finalAmount = parseFloat(quoteCA.bestRoute.amountOut);
            const initialAmount = parseFloat(testAmount);
            const profit = finalAmount - initialAmount;
            const profitPercentage = profit / initialAmount;
            if (profitPercentage < 0.01)
                return null; // 1% minimum for triangular
            // Calculate total gas
            const totalGas = parseInt(quoteAB.bestRoute.gasEstimate) +
                parseInt(quoteBC.bestRoute.gasEstimate) +
                parseInt(quoteCA.bestRoute.gasEstimate);
            const gasPrice = await this.gasOptimizer.getCurrentGasPrice(chainId);
            const gasCost = gasPrice * totalGas;
            const netProfit = profit - gasCost;
            if (netProfit <= 0)
                return null;
            return {
                tokenA,
                tokenB,
                chainId,
                dexA: quoteAB.bestRoute.dexName,
                dexB: quoteBC.bestRoute.dexName,
                amountIn: testAmount,
                amountOut: quoteCA.bestRoute.amountOut,
                profit: netProfit.toString(),
                gasEstimate: totalGas.toString(),
                confidence: 0.8, // Lower confidence for triangular
                route: [tokenA, tokenB, tokenC, tokenA],
                priceImpact: (quoteAB.bestRoute.priceImpact + quoteBC.bestRoute.priceImpact + quoteCA.bestRoute.priceImpact) / 3
            };
        }
        catch (error) {
            console.debug(`Error in triangular arbitrage check:`, error);
            return null;
        }
    }
    async scanCrossChainOpportunities(tokens, chains) {
        const opportunities = [];
        try {
            const crossChainOpps = await this.symbiosisIntegration.detectCrossChainArbitrage(tokens, chains);
            // Convert to ArbitrageOpportunity format
            for (const opp of crossChainOpps) {
                if (opp.isValid) {
                    opportunities.push({
                        tokenA: opp.token,
                        tokenB: opp.token,
                        chainId: opp.buyChain,
                        dexA: `Chain${opp.buyChain}`,
                        dexB: `Chain${opp.sellChain}`,
                        amountIn: opp.bridgeRoute.amountIn,
                        amountOut: opp.bridgeRoute.amountOut,
                        profit: opp.profitAfterFees,
                        gasEstimate: '500000', // Higher gas for cross-chain
                        confidence: 0.7, // Lower confidence for cross-chain
                        route: [opp.token],
                        priceImpact: 0.1 // Estimate bridge impact
                    });
                }
            }
        }
        catch (error) {
            console.error('Error scanning cross-chain opportunities:', error);
        }
        return opportunities;
    }
    calculateConfidence(route1, route2) {
        // Calculate confidence based on liquidity, price impact, and gas efficiency
        const liquidityScore = Math.min(1, (parseFloat(route1.amountOut) + parseFloat(route2.amountOut)) / 2000000);
        const priceImpactScore = Math.max(0, 1 - (route1.priceImpact + route2.priceImpact) / 2);
        const gasEfficiencyScore = Math.max(0, 1 - (parseInt(route1.gasEstimate) + parseInt(route2.gasEstimate)) / 500000);
        return (liquidityScore + priceImpactScore + gasEfficiencyScore) / 3;
    }
    async executeArbitrage(opportunity) {
        this.executionsAttempted++;
        try {
            // Validate opportunity is still valid
            const isValid = await this.validateOpportunity(opportunity);
            if (!isValid) {
                return { success: false, error: 'Opportunity no longer valid' };
            }
            // Execute the arbitrage
            const result = await this.performArbitrage(opportunity);
            if (result.success) {
                this.executionsSuccessful++;
                this.totalProfit = (parseFloat(this.totalProfit) + parseFloat(result.profit || '0')).toString();
                this.totalGasUsed = (parseFloat(this.totalGasUsed) + parseFloat(result.gasUsed || '0')).toString();
            }
            return result;
        }
        catch (error) {
            console.error(`Worker ${this.workerId} execution error:`, error);
            return { success: false, error: error.message };
        }
    }
    async validateOpportunity(opportunity) {
        try {
            // Re-check the opportunity to ensure it's still valid
            const dexIntegration = this.dexIntegrations[opportunity.chainId];
            if (!dexIntegration)
                return false;
            const freshOpportunity = await this.checkArbitrageOpportunity(opportunity.chainId, opportunity.tokenA, opportunity.tokenB, dexIntegration);
            if (!freshOpportunity)
                return false;
            // Check if profit is still above threshold (allowing for some slippage)
            const profitReduction = parseFloat(opportunity.profit) - parseFloat(freshOpportunity.profit);
            const profitReductionPercentage = profitReduction / parseFloat(opportunity.profit);
            return profitReductionPercentage < 0.2; // Allow up to 20% profit reduction
        }
        catch (error) {
            console.error('Error validating opportunity:', error);
            return false;
        }
    }
    async performArbitrage(opportunity) {
        // This is a simplified execution - in reality would interact with flash loan contracts
        // and execute the actual trades
        try {
            const provider = this.providers[this.getChainName(opportunity.chainId)];
            const signer = this.signers[this.getChainName(opportunity.chainId)];
            // Simulate execution
            const tx = await signer.sendTransaction({
                to: opportunity.tokenA,
                value: 0,
                data: '0x',
                gasLimit: parseInt(opportunity.gasEstimate),
                gasPrice: await this.gasOptimizer.getCurrentGasPrice(opportunity.chainId)
            });
            const receipt = await tx.wait();
            return {
                success: true,
                txHash: tx.hash,
                profit: opportunity.profit,
                gasUsed: receipt?.gasUsed?.toString() || opportunity.gasEstimate
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    getChainName(chainId) {
        const chainNames = {
            1: 'ethereum',
            10: 'optimism',
            42161: 'arbitrum',
            8453: 'base',
            137: 'polygon'
        };
        return chainNames[chainId] || 'ethereum';
    }
    async generateReport() {
        return {
            workerId: this.workerId,
            opportunitiesFound: this.opportunitiesFound,
            executionsAttempted: this.executionsAttempted,
            executionsSuccessful: this.executionsSuccessful,
            successRate: this.executionsAttempted > 0 ? this.executionsSuccessful / this.executionsAttempted : 0,
            totalProfit: this.totalProfit,
            totalGasUsed: this.totalGasUsed,
            profitPerExecution: this.executionsSuccessful > 0 ?
                (parseFloat(this.totalProfit) / this.executionsSuccessful).toString() : '0'
        };
    }
}
exports.ArbitrageWorker = ArbitrageWorker;
