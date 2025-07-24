"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainnetDataFetcher = void 0;
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
const chalk_1 = __importDefault(require("chalk"));
class MainnetDataFetcher {
    _arbProvider;
    _optProvider;
    priceCache = new Map();
    liquidityCache = new Map();
    // Router contract ABIs
    ROUTER_ABI = [
        "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
        "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)"
    ];
    // Uniswap V3 Quoter ABI for price quotes
    QUOTER_ABI = [
        "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)"
    ];
    ERC20_ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
    ];
    constructor() {
        this._arbProvider = new ethers_1.JsonRpcProvider(process.env.ARB_RPC);
        this._optProvider = new ethers_1.JsonRpcProvider(process.env.OPT_RPC);
    }
    // Helper function to validate and checksum addresses
    validateAndChecksumAddress(address) {
        try {
            return (0, ethers_1.getAddress)(address.toLowerCase());
        }
        catch (error) {
            console.warn(`Invalid address format: ${address}`);
            return address; // Return original if validation fails
        }
    }
    // Getter methods for provider access
    get arbProvider() { return this._arbProvider; }
    get optProvider() { return this._optProvider; }
    async fetchCurrentMarketData(chainId) {
        const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
        const chainName = chainId === 42161 ? 'Arbitrum' : 'Optimism';
        try {
            console.log(chalk_1.default.gray(`🔍 Fetching ${chainName} market data...`));
            // Get current block and gas data
            const [blockNumber, feeData, block] = await Promise.all([
                provider.getBlockNumber(),
                provider.getFeeData(),
                provider.getBlock('latest')
            ]);
            // Fetch real token prices from CoinGecko with rate limiting
            const tokenPrices = await this.fetchRealTokenPrices();
            // Get liquidity depths from DEXes
            const liquidityDepths = await this.fetchLiquidityDepths(chainId);
            // Get current DEX prices
            const dexPrices = await this.fetchDEXPrices(chainId);
            // Calculate network load indicator
            const networkLoad = await this.calculateNetworkLoad(provider, block);
            return {
                chainId,
                blockNumber,
                gasPrice: feeData.gasPrice || 0n,
                baseFeePerGas: block?.baseFeePerGas || 0n,
                timestamp: Date.now(),
                tokenPrices,
                liquidityDepths,
                dexPrices,
                networkLoad
            };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Error fetching ${chainName} market data:`), error);
            throw error;
        }
    }
    async scanRealArbitrageOpportunities(chainId) {
        const chainName = chainId === 42161 ? 'Arbitrum' : 'Optimism';
        console.log(chalk_1.default.blue(`🔍 Scanning real arbitrage opportunities on ${chainName}...`));
        try {
            const marketData = await this.fetchCurrentMarketData(chainId);
            const opportunities = [];
            // Define major trading pairs based on chain
            const tradingPairs = this.getTradingPairsForChain(chainId);
            // Analyze each trading pair
            for (const pair of tradingPairs) {
                try {
                    const opportunity = await this.analyzeTradingPair(pair, marketData);
                    if (opportunity && opportunity.netProfit > 0n && opportunity.spreadPercentage > 0.05) {
                        opportunities.push(opportunity);
                    }
                }
                catch (error) {
                    console.error(chalk_1.default.gray(`   Error analyzing ${pair.symbolA}/${pair.symbolB}:`), error);
                }
                // Rate limiting between pairs
                await this.sleep(100);
            }
            // Sort by profit margin (highest first)
            const sortedOpportunities = opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
            if (sortedOpportunities.length > 0) {
                console.log(chalk_1.default.green(`📊 Found ${sortedOpportunities.length} opportunities on ${chainName}`));
                sortedOpportunities.slice(0, 3).forEach((opp, i) => {
                    console.log(chalk_1.default.white(`   ${i + 1}. ${opp.tokenASymbol}/${opp.tokenBSymbol}: ${opp.spreadPercentage.toFixed(3)}% spread, ${(0, ethers_1.formatEther)(opp.netProfit)} ETH profit`));
                });
            }
            else {
                console.log(chalk_1.default.gray(`   No profitable opportunities detected on ${chainName}`));
            }
            return sortedOpportunities;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Error scanning opportunities on ${chainName}:`), error);
            return [];
        }
    }
    getTradingPairsForChain(chainId) {
        if (chainId === 42161) { // Arbitrum
            return [
                {
                    tokenA: process.env.ARB_WETH,
                    tokenB: process.env.ARB_USDC,
                    symbolA: 'WETH',
                    symbolB: 'USDC',
                    decimalsA: 18,
                    decimalsB: 6
                },
                {
                    tokenA: process.env.ARB_WETH,
                    tokenB: process.env.ARB_USDT,
                    symbolA: 'WETH',
                    symbolB: 'USDT',
                    decimalsA: 18,
                    decimalsB: 6
                },
                {
                    tokenA: process.env.ARB_USDC,
                    tokenB: process.env.ARB_USDT,
                    symbolA: 'USDC',
                    symbolB: 'USDT',
                    decimalsA: 6,
                    decimalsB: 6
                }
            ];
        }
        else { // Optimism
            return [
                {
                    tokenA: process.env.OPT_WETH,
                    tokenB: process.env.OPT_USDC,
                    symbolA: 'WETH',
                    symbolB: 'USDC',
                    decimalsA: 18,
                    decimalsB: 6
                },
                {
                    tokenA: process.env.OPT_WETH,
                    tokenB: process.env.OPT_USDT,
                    symbolA: 'WETH',
                    symbolB: 'USDT',
                    decimalsA: 18,
                    decimalsB: 6
                },
                {
                    tokenA: process.env.OPT_USDC,
                    tokenB: process.env.OPT_USDT,
                    symbolA: 'USDC',
                    symbolB: 'USDT',
                    decimalsA: 6,
                    decimalsB: 6
                }
            ];
        }
    }
    async analyzeTradingPair(pair, marketData) {
        try {
            // Get prices from different DEXes with error handling
            const pricePromises = [
                this.getUniswapV2Price(pair.tokenA, pair.tokenB, marketData.chainId, pair.decimalsA),
                this.getSushiswapPrice(pair.tokenA, pair.tokenB, marketData.chainId, pair.decimalsA),
                this.getBalancerPrice(pair.tokenA, pair.tokenB, marketData.chainId, pair.decimalsA)
            ];
            const [uniswapPrice, sushiPrice, balancerPrice] = await Promise.allSettled(pricePromises);
            // Extract successful price results
            const uniswapPriceResult = uniswapPrice.status === 'fulfilled' ? uniswapPrice.value : null;
            const sushiPriceResult = sushiPrice.status === 'fulfilled' ? sushiPrice.value : null;
            const balancerPriceResult = balancerPrice.status === 'fulfilled' ? balancerPrice.value : null;
            // Count available price sources
            const availablePrices = [uniswapPriceResult, sushiPriceResult, balancerPriceResult].filter(p => p !== null);
            if (availablePrices.length < 2) {
                console.log(`   ℹ️  Insufficient price sources for ${pair.symbolA}/${pair.symbolB} (only ${availablePrices.length} available)`);
                return null;
            }
            // Build prices array with available data
            const prices = [];
            if (uniswapPriceResult)
                prices.push({ dex: 'uniswap', price: uniswapPriceResult });
            if (sushiPriceResult)
                prices.push({ dex: 'sushi', price: sushiPriceResult });
            if (balancerPriceResult)
                prices.push({ dex: 'balancer', price: balancerPriceResult });
            // Log which DEXes have prices available
            console.log(`   📊 Available prices: ${prices.map(p => `${p.dex}=${(0, ethers_1.formatEther)(p.price)}`).join(', ')}`);
            if (prices.length < 2)
                return null;
            // Sort to find price spread
            prices.sort((a, b) => Number(a.price - b.price));
            const lowPrice = prices[0].price;
            const highPrice = prices[prices.length - 1].price;
            const lowDex = prices[0].dex;
            const highDex = prices[prices.length - 1].dex;
            const priceSpread = highPrice - lowPrice;
            const spreadPercentage = Number(priceSpread * 10000n / lowPrice) / 100;
            // Only consider opportunities with >0.1% spread
            if (spreadPercentage < 0.1)
                return null;
            // Calculate optimal trade size based on liquidity and spread
            const baseTradeSize = pair.symbolA === 'WETH' ? (0, ethers_1.parseEther)("0.5") : (0, ethers_1.parseUnits)("1000", pair.decimalsA);
            const tradeSize = await this.calculateOptimalTradeSize(baseTradeSize, pair, marketData);
            // Estimate gas cost for L2 (much lower than mainnet)
            const estimatedGasCost = await this.estimateL2GasCost(marketData.chainId, marketData.gasPrice);
            // Calculate profits
            const grossProfit = (tradeSize * priceSpread) / lowPrice;
            const netProfit = grossProfit > estimatedGasCost ? grossProfit - estimatedGasCost : 0n;
            const profitMargin = tradeSize > 0n ? Number(netProfit * 10000n / tradeSize) / 100 : 0;
            // Get liquidity data
            const liquidityA = marketData.liquidityDepths.get(pair.tokenA) || (0, ethers_1.parseEther)("100");
            const liquidityB = marketData.liquidityDepths.get(pair.tokenB) || (0, ethers_1.parseEther)("100000");
            // Calculate price impact
            const priceImpact = Number(tradeSize * 10000n / (liquidityA + liquidityB)) / 100;
            // Calculate volatility index (simplified)
            const volatilityIndex = this.calculateVolatilityIndex(pair.symbolA, spreadPercentage);
            return {
                id: `${pair.symbolA}_${pair.symbolB}_${marketData.chainId}_${Date.now()}`,
                tokenA: pair.tokenA,
                tokenB: pair.tokenB,
                tokenASymbol: pair.symbolA,
                tokenBSymbol: pair.symbolB,
                uniswapV2Price: uniswapPriceResult || 0n,
                sushiswapPrice: sushiPriceResult || 0n,
                balancerPrice: balancerPriceResult || 0n,
                priceSpread,
                spreadPercentage,
                recommendedTradeSize: tradeSize,
                estimatedProfit: grossProfit,
                estimatedGasCost,
                netProfit,
                profitMargin,
                liquidityDepthA: liquidityA,
                liquidityDepthB: liquidityB,
                maxTradeSize: liquidityA > liquidityB ? liquidityB : liquidityA,
                priceImpact,
                chainId: marketData.chainId,
                blockNumber: marketData.blockNumber,
                timestamp: marketData.timestamp,
                confidence: this.calculateConfidence(spreadPercentage, profitMargin, liquidityA, liquidityB),
                volatilityIndex,
                optimalDexA: lowDex,
                optimalDexB: highDex,
                executionComplexity: this.determineExecutionComplexity(priceImpact, volatilityIndex, spreadPercentage)
            };
        }
        catch (error) {
            console.error(`Error analyzing trading pair ${pair.symbolA}/${pair.symbolB}:`, error);
            return null;
        }
    }
    async fetchRealTokenPrices() {
        const cacheKey = 'token_prices';
        const cached = this.priceCache.get(cacheKey);
        // Use cache if less than 60 seconds old
        if (cached && (Date.now() - cached.timestamp) < 60000) {
            return new Map([['cached', cached.price]]);
        }
        try {
            const response = await axios_1.default.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: 'ethereum,usd-coin,tether,dai',
                    vs_currencies: 'usd'
                },
                timeout: 10000
            });
            const prices = new Map();
            if (response.data.ethereum?.usd) {
                prices.set('WETH', (0, ethers_1.parseUnits)(response.data.ethereum.usd.toFixed(18), 18));
            }
            if (response.data['usd-coin']?.usd) {
                prices.set('USDC', (0, ethers_1.parseUnits)(response.data['usd-coin'].usd.toFixed(6), 6));
            }
            if (response.data.tether?.usd) {
                prices.set('USDT', (0, ethers_1.parseUnits)(response.data.tether.usd.toFixed(6), 6));
            }
            if (response.data.dai?.usd) {
                prices.set('DAI', (0, ethers_1.parseUnits)(response.data.dai.usd.toFixed(18), 18));
            }
            // Cache the results
            this.priceCache.set(cacheKey, { price: (0, ethers_1.parseEther)("1"), timestamp: Date.now() });
            return prices;
        }
        catch (error) {
            console.error('Error fetching real token prices:', error);
            // Return fallback prices
            return new Map([
                ['WETH', (0, ethers_1.parseEther)("2500")],
                ['USDC', (0, ethers_1.parseUnits)("1", 6)],
                ['USDT', (0, ethers_1.parseUnits)("1", 6)],
                ['DAI', (0, ethers_1.parseEther)("1")]
            ]);
        }
    }
    async getUniswapV2Price(tokenA, tokenB, chainId, decimalsA) {
        try {
            const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
            const quoterAddress = chainId === 42161 ? process.env.ARB_UNI_V3_QUOTER : process.env.OPT_UNI_V3_QUOTER;
            // Use Uniswap V3 Quoter for price quotes since V3 Router doesn't have getAmountsOut
            const quoter = new ethers_1.Contract(quoterAddress, this.QUOTER_ABI, provider);
            const amountIn = (0, ethers_1.parseUnits)("1", decimalsA);
            // Fix: Validate and checksum addresses
            const tokenInAddress = this.validateAndChecksumAddress(tokenA);
            const tokenOutAddress = this.validateAndChecksumAddress(tokenB);
            // Use 0.3% fee tier (3000) as default - most common tier
            const fee = 3000;
            const sqrtPriceLimitX96 = 0; // No price limit
            // Add timeout protection
            const amountOut = await Promise.race([
                quoter.quoteExactInputSingle(tokenInAddress, tokenOutAddress, fee, amountIn, sqrtPriceLimitX96),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Uniswap call timeout')), 5000))
            ]);
            return amountOut;
        }
        catch (error) {
            if (error.code === 'CALL_EXCEPTION') {
                console.log(`   ℹ️  Uniswap: No pool for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)} on chain ${chainId}`);
            }
            else if (error.message?.includes('timeout')) {
                console.log(`   ⚠️  Uniswap: Timeout fetching price for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)}`);
            }
            else {
                console.log(`   ⚠️  Uniswap error for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)}:`, error.message);
            }
            // Try 0.05% fee tier as fallback
            try {
                const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
                const quoterAddress = chainId === 42161 ? process.env.ARB_UNI_V3_QUOTER : process.env.OPT_UNI_V3_QUOTER;
                const quoter = new ethers_1.Contract(quoterAddress, this.QUOTER_ABI, provider);
                const amountIn = (0, ethers_1.parseUnits)("1", decimalsA);
                const tokenInAddress = this.validateAndChecksumAddress(tokenA);
                const tokenOutAddress = this.validateAndChecksumAddress(tokenB);
                const fee = 500; // 0.05% fee tier
                const amountOut = await Promise.race([
                    quoter.quoteExactInputSingle(tokenInAddress, tokenOutAddress, fee, amountIn, 0),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Uniswap fallback timeout')), 3000))
                ]);
                return amountOut;
            }
            catch (fallbackError) {
                if (fallbackError.code === 'CALL_EXCEPTION') {
                    console.log(`   ℹ️  Uniswap: No pools available for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)} on chain ${chainId}`);
                }
                else {
                    console.log(`   ⚠️  Uniswap fallback error for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)}:`, fallbackError.message);
                }
                return null;
            }
        }
    }
    async getSushiswapPrice(tokenA, tokenB, chainId, decimalsA) {
        try {
            const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
            const routerAddress = chainId === 42161 ? process.env.ARB_SUSHI_ROUTER : process.env.OPT_SUSHI_ROUTER;
            // First, check if the pair exists on SushiSwap
            const pairExists = await this.checkSushiswapPairExists(tokenA, tokenB, chainId);
            if (!pairExists) {
                console.log(`   ℹ️  No SushiSwap pool for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)} on chain ${chainId}`);
                return null;
            }
            const routerABI = [
                "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
            ];
            const router = new ethers_1.Contract(routerAddress, routerABI, provider);
            const amountIn = (0, ethers_1.parseUnits)("1", decimalsA);
            // Validate and checksum addresses
            const path = [
                this.validateAndChecksumAddress(tokenA),
                this.validateAndChecksumAddress(tokenB)
            ];
            // Add timeout and retry logic
            const amounts = await Promise.race([
                router.getAmountsOut(amountIn, path),
                new Promise((_, reject) => setTimeout(() => reject(new Error('SushiSwap call timeout')), 5000))
            ]);
            if (amounts && amounts.length > 1 && amounts[1] > 0n) {
                return amounts[1]; // Output amount
            }
            else {
                console.log(`   ⚠️  SushiSwap returned zero liquidity for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)}`);
                return null;
            }
        }
        catch (error) {
            // Enhanced error handling with specific error types
            if (error.code === 'CALL_EXCEPTION') {
                console.log(`   ℹ️  SushiSwap: No pool exists for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)} on chain ${chainId}`);
            }
            else if (error.message?.includes('timeout')) {
                console.log(`   ⚠️  SushiSwap: Timeout fetching price for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)}`);
            }
            else {
                console.log(`   ⚠️  SushiSwap: Error fetching price for ${this.getTokenSymbol(tokenA)}/${this.getTokenSymbol(tokenB)}:`, error.message);
            }
            return null;
        }
    }
    // Add this new method to check if a SushiSwap pair exists
    async checkSushiswapPairExists(tokenA, tokenB, chainId) {
        try {
            const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
            // SushiSwap Factory addresses
            const factoryAddress = chainId === 42161
                ? '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' // Arbitrum SushiSwap Factory
                : '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'; // Optimism SushiSwap Factory
            const factoryABI = [
                "function getPair(address tokenA, address tokenB) external view returns (address pair)"
            ];
            const factory = new ethers_1.Contract(factoryAddress, factoryABI, provider);
            const pairAddress = await factory.getPair(this.validateAndChecksumAddress(tokenA), this.validateAndChecksumAddress(tokenB));
            // Check if pair exists (not zero address)
            return pairAddress !== '0x0000000000000000000000000000000000000000';
        }
        catch (error) {
            // If we can't check the factory, assume pair doesn't exist
            return false;
        }
    }
    // Add helper method for token symbols (for better logging)
    getTokenSymbol(address) {
        const symbolMap = {
            [process.env.ARB_WETH]: 'WETH',
            [process.env.ARB_USDC]: 'USDC',
            [process.env.ARB_USDT]: 'USDT',
            [process.env.OPT_WETH]: 'WETH',
            [process.env.OPT_USDC]: 'USDC',
            [process.env.OPT_USDT]: 'USDT'
        };
        return symbolMap[address] || address.slice(0, 6) + '...';
    }
    async getBalancerPrice(tokenA, tokenB, chainId, decimalsA) {
        try {
            // Simplified Balancer price estimation
            // In a real implementation, you'd query Balancer's SOR (Smart Order Router)
            // Fix: Validate and checksum addresses for future compatibility
            const validatedTokenA = this.validateAndChecksumAddress(tokenA);
            const validatedTokenB = this.validateAndChecksumAddress(tokenB);
            const basePrice = (0, ethers_1.parseUnits)("1000", 6); // Fallback USDC price
            return basePrice;
        }
        catch (error) {
            console.error('Error getting Balancer price:', error);
            return null;
        }
    }
    async fetchLiquidityDepths(chainId) {
        const depths = new Map();
        try {
            // Simulate liquidity depth fetching with reasonable values
            const tokens = chainId === 42161 ?
                [process.env.ARB_WETH, process.env.ARB_USDC, process.env.ARB_USDT] :
                [process.env.OPT_WETH, process.env.OPT_USDC, process.env.OPT_USDT];
            for (const token of tokens) {
                if (token) {
                    // Simulate liquidity based on token type
                    if (token.includes('WETH') || token === process.env.ARB_WETH || token === process.env.OPT_WETH) {
                        depths.set(token, (0, ethers_1.parseEther)("1000")); // 1000 ETH liquidity
                    }
                    else {
                        depths.set(token, (0, ethers_1.parseUnits)("2000000", 6)); // 2M USDC/USDT liquidity
                    }
                }
            }
        }
        catch (error) {
            console.error('Error fetching liquidity depths:', error);
        }
        return depths;
    }
    async fetchDEXPrices(chainId) {
        const dexPrices = new Map();
        // Initialize DEX price maps
        dexPrices.set('uniswap', new Map());
        dexPrices.set('sushiswap', new Map());
        dexPrices.set('balancer', new Map());
        return dexPrices;
    }
    async calculateNetworkLoad(provider, block) {
        try {
            if (!block)
                return 0.5; // Default moderate load
            const gasUsed = block.gasUsed || 0n;
            const gasLimit = block.gasLimit || 1n;
            return Number(gasUsed * 100n / gasLimit) / 100;
        }
        catch (error) {
            return 0.5; // Default moderate load
        }
    }
    async calculateOptimalTradeSize(baseSize, pair, marketData) {
        // Adjust trade size based on spread and liquidity
        const spreadFactor = Math.max(0.5, Math.min(2.0, 1.0)); // Simplified
        return BigInt(Math.floor(Number(baseSize) * spreadFactor));
    }
    async estimateL2GasCost(chainId, gasPrice) {
        // L2 gas costs are much lower than mainnet
        const baseGas = chainId === 42161 ? 150000n : 120000n; // Arbitrum vs Optimism
        const effectiveGasPrice = gasPrice > 0n ? gasPrice : (0, ethers_1.parseUnits)("0.1", 9); // 0.1 gwei minimum
        return baseGas * effectiveGasPrice;
    }
    calculateVolatilityIndex(symbol, spread) {
        // Simplified volatility calculation
        const baseVolatility = symbol === 'WETH' ? 0.3 : 0.1;
        return baseVolatility + (spread / 100) * 0.5;
    }
    calculateConfidence(spread, margin, liquidityA, liquidityB) {
        let confidence = 0;
        // Spread confidence (higher spread = higher confidence)
        confidence += Math.min(spread * 10, 0.4); // Max 0.4 from spread
        // Profit margin confidence
        confidence += Math.min(Math.abs(margin) * 5, 0.3); // Max 0.3 from margin
        // Liquidity confidence
        const totalLiquidity = Number((0, ethers_1.formatEther)(liquidityA + liquidityB));
        confidence += Math.min(totalLiquidity / 1000000, 0.3); // Max 0.3 from liquidity
        return Math.min(Math.max(confidence, 0.1), 1.0); // Clamp between 0.1 and 1.0
    }
    determineExecutionComplexity(priceImpact, volatility, spread) {
        if (priceImpact < 0.1 && volatility < 0.2 && spread > 0.2)
            return 'simple';
        if (priceImpact < 0.5 && volatility < 0.5)
            return 'complex';
        return 'advanced';
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MainnetDataFetcher = MainnetDataFetcher;
