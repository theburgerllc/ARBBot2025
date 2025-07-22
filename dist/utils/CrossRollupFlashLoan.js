"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossRollupFlashLoan = void 0;
const ethers_1 = require("ethers");
class CrossRollupFlashLoan {
    providers;
    signers;
    symbiosisIntegration;
    MIN_CROSS_CHAIN_SPREAD = 0.02; // 2%
    MAX_BRIDGE_TIME = 300; // 5 minutes
    FLASH_LOAN_FEE_BUFFER = 0.001; // 0.1% buffer
    balancerVaults = {
        1: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Ethereum
        10: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Optimism
        42161: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Arbitrum
        8453: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Base
        137: '0xBA12222222228d8Ba445958a75a0704d566BF2C8' // Polygon
    };
    aaveV3Pools = {
        1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum
        10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Optimism
        42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Arbitrum
        8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', // Base
        137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' // Polygon
    };
    constructor(providers, signers, symbiosisIntegration) {
        this.providers = providers;
        this.signers = signers;
        this.symbiosisIntegration = symbiosisIntegration;
    }
    async detectCrossRollupOpportunity(tokenAddress, chainA, chainB, testAmount) {
        try {
            // Get price difference between chains
            const priceDifference = await this.calculatePriceDifference(tokenAddress, chainA, chainB, testAmount);
            if (priceDifference.spread < this.MIN_CROSS_CHAIN_SPREAD) {
                return null;
            }
            // Find available flash loan provider
            const flashLoanProvider = await this.findBestFlashLoanProvider(tokenAddress, chainA, testAmount);
            if (!flashLoanProvider) {
                return null;
            }
            // Get bridge route
            const bridgeRoute = await this.symbiosisIntegration.findCrossChainRoute(chainA, chainB, tokenAddress, tokenAddress, testAmount);
            if (!bridgeRoute || bridgeRoute.estimatedTime > this.MAX_BRIDGE_TIME) {
                return null;
            }
            // Create arbitrage opportunity
            const arbitrageOpportunity = {
                buyChain: chainA,
                sellChain: chainB,
                token: tokenAddress,
                buyPrice: priceDifference.buyPrice,
                sellPrice: priceDifference.sellPrice,
                spread: priceDifference.spread,
                bridgeRoute,
                profitAfterFees: priceDifference.netProfit,
                isValid: true
            };
            return {
                primaryChain: chainA,
                secondaryChain: chainB,
                flashLoanProvider,
                bridgeRoute,
                arbitrageOpportunity,
                minSpread: this.MIN_CROSS_CHAIN_SPREAD
            };
        }
        catch (error) {
            console.error('Error detecting cross-rollup opportunity:', error);
            return null;
        }
    }
    async calculatePriceDifference(tokenAddress, chainA, chainB, amount) {
        try {
            // Get token prices on both chains using Symbiosis or fallback to DEX quotes
            const [priceA, priceB] = await Promise.all([
                this.getTokenPrice(tokenAddress, chainA),
                this.getTokenPrice(tokenAddress, chainB)
            ]);
            const buyPrice = priceA < priceB ? priceA : priceB;
            const sellPrice = priceA < priceB ? priceB : priceA;
            const spread = (sellPrice - buyPrice) / buyPrice;
            // Calculate net profit after bridge fees
            const bridgeFee = await this.symbiosisIntegration.getBridgeFee(chainA, chainB, tokenAddress, amount);
            const grossProfit = (sellPrice - buyPrice) * parseFloat(amount);
            const netProfit = grossProfit - parseFloat(bridgeFee);
            return {
                buyPrice: buyPrice.toString(),
                sellPrice: sellPrice.toString(),
                spread,
                netProfit: netProfit.toString()
            };
        }
        catch (error) {
            console.error('Error calculating price difference:', error);
            throw error;
        }
    }
    async getTokenPrice(tokenAddress, chainId) {
        try {
            // Try to get price from Symbiosis first
            const symbiosisPrice = await this.symbiosisIntegration.getTokenPrice?.(tokenAddress, chainId);
            if (symbiosisPrice) {
                return parseFloat(symbiosisPrice);
            }
            // Fallback to simple price estimation (would need actual DEX integration)
            return 1.0; // Placeholder
        }
        catch (error) {
            console.error(`Error getting token price for ${tokenAddress} on chain ${chainId}:`, error);
            return 1.0;
        }
    }
    async findBestFlashLoanProvider(tokenAddress, chainId, amount) {
        const providers = await this.getFlashLoanProviders(chainId);
        for (const provider of providers) {
            try {
                const maxLoan = await this.getMaxFlashLoan(provider, tokenAddress);
                if (parseFloat(maxLoan) >= parseFloat(amount)) {
                    return {
                        ...provider,
                        maxLoanAmount: maxLoan,
                        isAvailable: true
                    };
                }
            }
            catch (error) {
                console.debug(`Provider ${provider.name} not available:`, error);
            }
        }
        return null;
    }
    async getFlashLoanProviders(chainId) {
        const providers = [];
        // Add Balancer if available
        if (this.balancerVaults[chainId]) {
            providers.push({
                name: 'Balancer',
                chainId,
                address: this.balancerVaults[chainId],
                maxLoanAmount: '0',
                feePercentage: 0, // Balancer has no flash loan fees
                isAvailable: false
            });
        }
        // Add Aave V3 if available
        if (this.aaveV3Pools[chainId]) {
            providers.push({
                name: 'AaveV3',
                chainId,
                address: this.aaveV3Pools[chainId],
                maxLoanAmount: '0',
                feePercentage: 0.05, // 0.05% fee
                isAvailable: false
            });
        }
        return providers;
    }
    async getMaxFlashLoan(provider, tokenAddress) {
        try {
            const providerContract = this.getProviderContract(provider);
            if (provider.name === 'Balancer') {
                const maxLoan = await providerContract.maxFlashLoan(tokenAddress);
                return maxLoan.toString();
            }
            else if (provider.name === 'AaveV3') {
                const reserveData = await providerContract.getReserveData(tokenAddress);
                return reserveData.availableLiquidity?.toString() || '0';
            }
            return '0';
        }
        catch (error) {
            console.error(`Error getting max flash loan for ${provider.name}:`, error);
            return '0';
        }
    }
    getProviderContract(provider) {
        const providerName = this.getChainName(provider.chainId);
        const signer = this.signers[providerName];
        if (provider.name === 'Balancer') {
            const balancerABI = [
                'function flashLoan(address recipient, address[] tokens, uint256[] amounts, bytes userData) external',
                'function maxFlashLoan(address token) external view returns (uint256)'
            ];
            return new ethers_1.ethers.Contract(provider.address, balancerABI, signer);
        }
        else if (provider.name === 'AaveV3') {
            const aaveABI = [
                'function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes params, uint16 referralCode) external',
                'function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)'
            ];
            return new ethers_1.ethers.Contract(provider.address, aaveABI, signer);
        }
        throw new Error(`Unknown provider: ${provider.name}`);
    }
    async executeCrossRollupFlashLoan(params) {
        const startTime = Date.now();
        try {
            // Pre-execution validation
            const isValid = await this.validateOpportunity(params);
            if (!isValid) {
                return {
                    success: false,
                    error: 'Opportunity no longer valid'
                };
            }
            // Execute flash loan
            const txHash = await this.initiateFlashLoan(params);
            const receipt = await this.waitForTransaction(txHash, params.primaryChain);
            if (!receipt.success) {
                return {
                    success: false,
                    error: 'Flash loan execution failed',
                    txHash
                };
            }
            // Calculate execution metrics
            const executionTime = Date.now() - startTime;
            const bridgeTime = params.bridgeRoute.estimatedTime;
            return {
                success: true,
                txHash,
                profit: params.arbitrageOpportunity.profitAfterFees,
                gasUsed: receipt.gasUsed,
                bridgeTime,
            };
        }
        catch (error) {
            console.error('Error executing cross-rollup flash loan:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    async validateOpportunity(params) {
        try {
            // Re-check price difference
            const freshPriceDiff = await this.calculatePriceDifference(params.arbitrageOpportunity.token, params.primaryChain, params.secondaryChain, params.bridgeRoute.amountIn);
            // Check if spread is still profitable
            if (freshPriceDiff.spread < params.minSpread) {
                return false;
            }
            // Check if flash loan is still available
            const maxLoan = await this.getMaxFlashLoan(params.flashLoanProvider, params.arbitrageOpportunity.token);
            if (parseFloat(maxLoan) < parseFloat(params.bridgeRoute.amountIn)) {
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Error validating opportunity:', error);
            return false;
        }
    }
    async initiateFlashLoan(params) {
        const { flashLoanProvider, arbitrageOpportunity, bridgeRoute } = params;
        const providerContract = this.getProviderContract(flashLoanProvider);
        const flashLoanAmount = bridgeRoute.amountIn;
        // Encode the cross-rollup arbitrage parameters
        const userData = ethers_1.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'uint256', 'bytes'], [
            arbitrageOpportunity.token,
            arbitrageOpportunity.buyChain,
            arbitrageOpportunity.sellChain,
            ethers_1.ethers.hexlify(ethers_1.ethers.toUtf8Bytes(JSON.stringify(bridgeRoute)))
        ]);
        let tx;
        if (flashLoanProvider.name === 'Balancer') {
            tx = await providerContract.flashLoan(flashLoanProvider.address, // recipient (our contract)
            [arbitrageOpportunity.token], [flashLoanAmount], userData);
        }
        else if (flashLoanProvider.name === 'AaveV3') {
            tx = await providerContract.flashLoanSimple(flashLoanProvider.address, // receiver
            arbitrageOpportunity.token, flashLoanAmount, userData, 0 // referral code
            );
        }
        else {
            throw new Error(`Unknown flash loan provider: ${flashLoanProvider.name}`);
        }
        return tx.hash;
    }
    async waitForTransaction(txHash, chainId) {
        try {
            const provider = this.providers[this.getChainName(chainId)];
            const receipt = await provider.waitForTransaction(txHash);
            if (!receipt) {
                return { success: false, error: 'Transaction not found' };
            }
            if (receipt.status === 0) {
                return { success: false, error: 'Transaction reverted' };
            }
            return {
                success: true,
                gasUsed: receipt.gasUsed.toString()
            };
        }
        catch (error) {
            console.error('Error waiting for transaction:', error);
            return { success: false, error: error.message };
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
    async estimateGasForCrossRollupArbitrage(params) {
        try {
            // Estimate gas for flash loan execution
            const flashLoanGas = '300000'; // Base estimate for flash loan
            // Estimate gas for bridge transaction
            const bridgeGas = '200000'; // Base estimate for bridge
            // Total gas estimate
            const totalGas = (parseInt(flashLoanGas) + parseInt(bridgeGas)).toString();
            // Estimate cost in ETH
            const gasPrice = await this.providers[this.getChainName(params.primaryChain)].getFeeData();
            const estimatedCost = ethers_1.ethers.formatEther(BigInt(totalGas) * (gasPrice.gasPrice || ethers_1.ethers.parseUnits('20', 'gwei')));
            return {
                flashLoanGas,
                bridgeGas,
                totalGas,
                estimatedCost
            };
        }
        catch (error) {
            console.error('Error estimating gas:', error);
            return {
                flashLoanGas: '300000',
                bridgeGas: '200000',
                totalGas: '500000',
                estimatedCost: '0.01'
            };
        }
    }
    async getAvailableFlashLoanProviders(chainId) {
        const providers = await this.getFlashLoanProviders(chainId);
        // Check availability of each provider
        for (const provider of providers) {
            try {
                const contract = this.getProviderContract(provider);
                // Simple check - if we can create the contract, it's likely available
                provider.isAvailable = true;
            }
            catch (error) {
                provider.isAvailable = false;
            }
        }
        return providers.filter(p => p.isAvailable);
    }
    async calculateMinimumProfitableSpread(chainA, chainB, tokenAddress, amount) {
        try {
            // Get gas costs for both chains
            const gasEstimate = await this.estimateGasForCrossRollupArbitrage({
                primaryChain: chainA,
                secondaryChain: chainB,
                flashLoanProvider: { name: 'Balancer', chainId: chainA, address: '', maxLoanAmount: '0', feePercentage: 0, isAvailable: true },
                bridgeRoute: { amountIn: amount, estimatedTime: 180 },
                arbitrageOpportunity: { token: tokenAddress },
                minSpread: 0
            });
            // Get bridge fees
            const bridgeFee = await this.symbiosisIntegration.getBridgeFee(chainA, chainB, tokenAddress, amount);
            // Calculate minimum spread needed to cover costs
            const totalCosts = parseFloat(gasEstimate.estimatedCost) + parseFloat(bridgeFee);
            const minimumSpread = totalCosts / parseFloat(amount) + this.FLASH_LOAN_FEE_BUFFER;
            return Math.max(minimumSpread, this.MIN_CROSS_CHAIN_SPREAD);
        }
        catch (error) {
            console.error('Error calculating minimum profitable spread:', error);
            return this.MIN_CROSS_CHAIN_SPREAD;
        }
    }
}
exports.CrossRollupFlashLoan = CrossRollupFlashLoan;
