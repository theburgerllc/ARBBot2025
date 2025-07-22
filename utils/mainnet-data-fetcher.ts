import { JsonRpcProvider, Contract, formatEther, parseEther, formatUnits, parseUnits } from "ethers";
import axios from "axios";
import chalk from "chalk";

export interface MainnetMarketData {
  chainId: number;
  blockNumber: number;
  gasPrice: bigint;
  baseFeePerGas: bigint;
  timestamp: number;
  tokenPrices: Map<string, bigint>;
  liquidityDepths: Map<string, bigint>;
  dexPrices: Map<string, Map<string, bigint>>; // DEX -> TokenPair -> Price
  networkLoad: number;
}

export interface RealArbitrageOpportunity {
  id: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  
  // DEX Price Data
  uniswapV2Price: bigint;
  sushiswapPrice: bigint;
  balancerPrice: bigint;
  
  // Opportunity Metrics
  priceSpread: bigint;
  spreadPercentage: number;
  recommendedTradeSize: bigint;
  estimatedProfit: bigint;
  estimatedGasCost: bigint;
  netProfit: bigint;
  profitMargin: number;
  
  // Liquidity Analysis
  liquidityDepthA: bigint;
  liquidityDepthB: bigint;
  maxTradeSize: bigint;
  priceImpact: number;
  
  // Market Context
  chainId: number;
  blockNumber: number;
  timestamp: number;
  confidence: number; // 0-1 scale
  volatilityIndex: number;
  
  // Execution Data
  optimalDexA: string;
  optimalDexB: string;
  executionComplexity: 'simple' | 'complex' | 'advanced';
}

export class MainnetDataFetcher {
  private _arbProvider: JsonRpcProvider;
  private _optProvider: JsonRpcProvider;
  private priceCache = new Map<string, { price: bigint; timestamp: number }>();
  private liquidityCache = new Map<string, { depth: bigint; timestamp: number }>();
  
  // Router contract ABIs
  private readonly ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)"
  ];
  
  private readonly ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  constructor() {
    this._arbProvider = new JsonRpcProvider(process.env.ARB_RPC!);
    this._optProvider = new JsonRpcProvider(process.env.OPT_RPC!);
  }

  // Getter methods for provider access
  public get arbProvider() { return this._arbProvider; }
  public get optProvider() { return this._optProvider; }
  
  async fetchCurrentMarketData(chainId: number): Promise<MainnetMarketData> {
    const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
    const chainName = chainId === 42161 ? 'Arbitrum' : 'Optimism';
    
    try {
      console.log(chalk.gray(`🔍 Fetching ${chainName} market data...`));
      
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
      
    } catch (error) {
      console.error(chalk.red(`❌ Error fetching ${chainName} market data:`), error);
      throw error;
    }
  }
  
  async scanRealArbitrageOpportunities(chainId: number): Promise<RealArbitrageOpportunity[]> {
    const chainName = chainId === 42161 ? 'Arbitrum' : 'Optimism';
    console.log(chalk.blue(`🔍 Scanning real arbitrage opportunities on ${chainName}...`));
    
    try {
      const marketData = await this.fetchCurrentMarketData(chainId);
      const opportunities: RealArbitrageOpportunity[] = [];
      
      // Define major trading pairs based on chain
      const tradingPairs = this.getTradingPairsForChain(chainId);
      
      // Analyze each trading pair
      for (const pair of tradingPairs) {
        try {
          const opportunity = await this.analyzeTradingPair(pair, marketData);
          if (opportunity && opportunity.netProfit > 0n && opportunity.spreadPercentage > 0.05) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          console.error(chalk.gray(`   Error analyzing ${pair.symbolA}/${pair.symbolB}:`), error);
        }
        
        // Rate limiting between pairs
        await this.sleep(100);
      }
      
      // Sort by profit margin (highest first)
      const sortedOpportunities = opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
      
      if (sortedOpportunities.length > 0) {
        console.log(chalk.green(`📊 Found ${sortedOpportunities.length} opportunities on ${chainName}`));
        sortedOpportunities.slice(0, 3).forEach((opp, i) => {
          console.log(chalk.white(`   ${i+1}. ${opp.tokenASymbol}/${opp.tokenBSymbol}: ${opp.spreadPercentage.toFixed(3)}% spread, ${formatEther(opp.netProfit)} ETH profit`));
        });
      } else {
        console.log(chalk.gray(`   No profitable opportunities detected on ${chainName}`));
      }
      
      return sortedOpportunities;
      
    } catch (error) {
      console.error(chalk.red(`❌ Error scanning opportunities on ${chainName}:`), error);
      return [];
    }
  }
  
  private getTradingPairsForChain(chainId: number) {
    if (chainId === 42161) { // Arbitrum
      return [
        {
          tokenA: process.env.ARB_WETH!,
          tokenB: process.env.ARB_USDC!,
          symbolA: 'WETH',
          symbolB: 'USDC',
          decimalsA: 18,
          decimalsB: 6
        },
        {
          tokenA: process.env.ARB_WETH!,
          tokenB: process.env.ARB_USDT!,
          symbolA: 'WETH',
          symbolB: 'USDT',
          decimalsA: 18,
          decimalsB: 6
        },
        {
          tokenA: process.env.ARB_USDC!,
          tokenB: process.env.ARB_USDT!,
          symbolA: 'USDC',
          symbolB: 'USDT',
          decimalsA: 6,
          decimalsB: 6
        }
      ];
    } else { // Optimism
      return [
        {
          tokenA: process.env.OPT_WETH!,
          tokenB: process.env.OPT_USDC!,
          symbolA: 'WETH',
          symbolB: 'USDC',
          decimalsA: 18,
          decimalsB: 6
        },
        {
          tokenA: process.env.OPT_WETH!,
          tokenB: process.env.OPT_USDT!,
          symbolA: 'WETH',
          symbolB: 'USDT',
          decimalsA: 18,
          decimalsB: 6
        },
        {
          tokenA: process.env.OPT_USDC!,
          tokenB: process.env.OPT_USDT!,
          symbolA: 'USDC',
          symbolB: 'USDT',
          decimalsA: 6,
          decimalsB: 6
        }
      ];
    }
  }
  
  private async analyzeTradingPair(
    pair: { tokenA: string; tokenB: string; symbolA: string; symbolB: string; decimalsA: number; decimalsB: number },
    marketData: MainnetMarketData
  ): Promise<RealArbitrageOpportunity | null> {
    
    try {
      // Get prices from different DEXes with error handling
      const pricePromises = [
        this.getUniswapV2Price(pair.tokenA, pair.tokenB, marketData.chainId, pair.decimalsA),
        this.getSushiswapPrice(pair.tokenA, pair.tokenB, marketData.chainId, pair.decimalsA),
        this.getBalancerPrice(pair.tokenA, pair.tokenB, marketData.chainId, pair.decimalsA)
      ];
      
      const [uniswapPrice, sushiPrice, balancerPrice] = await Promise.allSettled(pricePromises);
      
      // Extract successful prices
      const uniPrice = uniswapPrice.status === 'fulfilled' ? uniswapPrice.value : null;
      const sushiPriceVal = sushiPrice.status === 'fulfilled' ? sushiPrice.value : null;
      const balancerPriceVal = balancerPrice.status === 'fulfilled' ? balancerPrice.value : null;
      
      if (!uniPrice || !sushiPriceVal) return null;
      
      // Find the best arbitrage direction
      const prices = [
        { dex: 'uniswap', price: uniPrice },
        { dex: 'sushiswap', price: sushiPriceVal },
        ...(balancerPriceVal ? [{ dex: 'balancer', price: balancerPriceVal }] : [])
      ].filter(p => p.price > 0n);
      
      if (prices.length < 2) return null;
      
      // Sort to find price spread
      prices.sort((a, b) => Number(a.price - b.price));
      const lowPrice = prices[0].price;
      const highPrice = prices[prices.length - 1].price;
      const lowDex = prices[0].dex;
      const highDex = prices[prices.length - 1].dex;
      
      const priceSpread = highPrice - lowPrice;
      const spreadPercentage = Number(priceSpread * 10000n / lowPrice) / 100; // Percentage
      
      // Only consider opportunities with meaningful spread
      if (spreadPercentage < 0.05) return null; // 0.05% minimum
      
      // Calculate optimal trade size based on liquidity and spread
      const baseTradeSize = pair.symbolA === 'WETH' ? parseEther("0.5") : parseUnits("1000", pair.decimalsA);
      const tradeSize = await this.calculateOptimalTradeSize(baseTradeSize, pair, marketData);
      
      // Estimate gas cost for L2 (much lower than mainnet)
      const estimatedGasCost = await this.estimateL2GasCost(marketData.chainId, marketData.gasPrice);
      
      // Calculate profits
      const grossProfit = (tradeSize * priceSpread) / lowPrice;
      const netProfit = grossProfit > estimatedGasCost ? grossProfit - estimatedGasCost : 0n;
      const profitMargin = tradeSize > 0n ? Number(netProfit * 10000n / tradeSize) / 100 : 0;
      
      // Get liquidity data
      const liquidityA = marketData.liquidityDepths.get(pair.tokenA) || parseEther("100");
      const liquidityB = marketData.liquidityDepths.get(pair.tokenB) || parseEther("100000");
      
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
        
        uniswapV2Price: uniPrice,
        sushiswapPrice: sushiPriceVal,
        balancerPrice: balancerPriceVal || 0n,
        
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
      
    } catch (error) {
      console.error(`Error analyzing trading pair ${pair.symbolA}/${pair.symbolB}:`, error);
      return null;
    }
  }
  
  private async fetchRealTokenPrices(): Promise<Map<string, bigint>> {
    const cacheKey = 'token_prices';
    const cached = this.priceCache.get(cacheKey);
    
    // Use cache if less than 60 seconds old
    if (cached && (Date.now() - cached.timestamp) < 60000) {
      return new Map([['cached', cached.price]]);
    }
    
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'ethereum,usd-coin,tether,dai',
          vs_currencies: 'usd'
        },
        timeout: 10000
      });
      
      const prices = new Map<string, bigint>();
      if (response.data.ethereum?.usd) {
        prices.set('WETH', parseUnits(response.data.ethereum.usd.toFixed(18), 18));
      }
      if (response.data['usd-coin']?.usd) {
        prices.set('USDC', parseUnits(response.data['usd-coin'].usd.toFixed(6), 6));
      }
      if (response.data.tether?.usd) {
        prices.set('USDT', parseUnits(response.data.tether.usd.toFixed(6), 6));
      }
      if (response.data.dai?.usd) {
        prices.set('DAI', parseUnits(response.data.dai.usd.toFixed(18), 18));
      }
      
      // Cache the results
      this.priceCache.set(cacheKey, { price: parseEther("1"), timestamp: Date.now() });
      
      return prices;
    } catch (error) {
      console.error('Error fetching real token prices:', error);
      // Return fallback prices
      return new Map([
        ['WETH', parseEther("2500")],
        ['USDC', parseUnits("1", 6)],
        ['USDT', parseUnits("1", 6)],
        ['DAI', parseEther("1")]
      ]);
    }
  }
  
  private async getUniswapV2Price(tokenA: string, tokenB: string, chainId: number, decimalsA: number): Promise<bigint | null> {
    try {
      const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
      const routerAddress = chainId === 42161 ? process.env.ARB_UNI_V2_ROUTER! : process.env.OPT_UNI_V2_ROUTER!;
      
      const router = new Contract(routerAddress, this.ROUTER_ABI, provider);
      const amountIn = parseUnits("1", decimalsA);
      const path = [tokenA, tokenB];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      return amounts[1]; // Output amount
      
    } catch (error) {
      console.error('Error getting Uniswap V2 price:', error);
      return null;
    }
  }
  
  private async getSushiswapPrice(tokenA: string, tokenB: string, chainId: number, decimalsA: number): Promise<bigint | null> {
    try {
      const provider = chainId === 42161 ? this._arbProvider : this._optProvider;
      const routerAddress = chainId === 42161 ? process.env.ARB_SUSHI_ROUTER! : process.env.OPT_SUSHI_ROUTER!;
      
      const router = new Contract(routerAddress, this.ROUTER_ABI, provider);
      const amountIn = parseUnits("1", decimalsA);
      const path = [tokenA, tokenB];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      return amounts[1]; // Output amount
      
    } catch (error) {
      console.error('Error getting Sushiswap price:', error);
      return null;
    }
  }
  
  private async getBalancerPrice(tokenA: string, tokenB: string, chainId: number, decimalsA: number): Promise<bigint | null> {
    try {
      // Simplified Balancer price estimation
      // In a real implementation, you'd query Balancer's SOR (Smart Order Router)
      const basePrice = parseUnits("1000", 6); // Fallback USDC price
      return basePrice;
    } catch (error) {
      console.error('Error getting Balancer price:', error);
      return null;
    }
  }
  
  private async fetchLiquidityDepths(chainId: number): Promise<Map<string, bigint>> {
    const depths = new Map<string, bigint>();
    
    try {
      // Simulate liquidity depth fetching with reasonable values
      const tokens = chainId === 42161 ? 
        [process.env.ARB_WETH!, process.env.ARB_USDC!, process.env.ARB_USDT!] :
        [process.env.OPT_WETH!, process.env.OPT_USDC!, process.env.OPT_USDT!];
      
      for (const token of tokens) {
        if (token) {
          // Simulate liquidity based on token type
          if (token.includes('WETH') || token === process.env.ARB_WETH || token === process.env.OPT_WETH) {
            depths.set(token, parseEther("1000")); // 1000 ETH liquidity
          } else {
            depths.set(token, parseUnits("2000000", 6)); // 2M USDC/USDT liquidity
          }
        }
      }
    } catch (error) {
      console.error('Error fetching liquidity depths:', error);
    }
    
    return depths;
  }
  
  private async fetchDEXPrices(chainId: number): Promise<Map<string, Map<string, bigint>>> {
    const dexPrices = new Map<string, Map<string, bigint>>();
    
    // Initialize DEX price maps
    dexPrices.set('uniswap', new Map());
    dexPrices.set('sushiswap', new Map());
    dexPrices.set('balancer', new Map());
    
    return dexPrices;
  }
  
  private async calculateNetworkLoad(provider: JsonRpcProvider, block: any): Promise<number> {
    try {
      if (!block) return 0.5; // Default moderate load
      
      const gasUsed = block.gasUsed || 0n;
      const gasLimit = block.gasLimit || 1n;
      
      return Number(gasUsed * 100n / gasLimit) / 100;
    } catch (error) {
      return 0.5; // Default moderate load
    }
  }
  
  private async calculateOptimalTradeSize(baseSize: bigint, pair: any, marketData: MainnetMarketData): Promise<bigint> {
    // Adjust trade size based on spread and liquidity
    const spreadFactor = Math.max(0.5, Math.min(2.0, 1.0)); // Simplified
    return BigInt(Math.floor(Number(baseSize) * spreadFactor));
  }
  
  private async estimateL2GasCost(chainId: number, gasPrice: bigint): Promise<bigint> {
    // L2 gas costs are much lower than mainnet
    const baseGas = chainId === 42161 ? 150000n : 120000n; // Arbitrum vs Optimism
    const effectiveGasPrice = gasPrice > 0n ? gasPrice : parseUnits("0.1", 9); // 0.1 gwei minimum
    
    return baseGas * effectiveGasPrice;
  }
  
  private calculateVolatilityIndex(symbol: string, spread: number): number {
    // Simplified volatility calculation
    const baseVolatility = symbol === 'WETH' ? 0.3 : 0.1;
    return baseVolatility + (spread / 100) * 0.5;
  }
  
  private calculateConfidence(spread: number, margin: number, liquidityA: bigint, liquidityB: bigint): number {
    let confidence = 0;
    
    // Spread confidence (higher spread = higher confidence)
    confidence += Math.min(spread * 10, 0.4); // Max 0.4 from spread
    
    // Profit margin confidence
    confidence += Math.min(Math.abs(margin) * 5, 0.3); // Max 0.3 from margin
    
    // Liquidity confidence
    const totalLiquidity = Number(formatEther(liquidityA + liquidityB));
    confidence += Math.min(totalLiquidity / 1000000, 0.3); // Max 0.3 from liquidity
    
    return Math.min(Math.max(confidence, 0.1), 1.0); // Clamp between 0.1 and 1.0
  }
  
  private determineExecutionComplexity(priceImpact: number, volatility: number, spread: number): 'simple' | 'complex' | 'advanced' {
    if (priceImpact < 0.1 && volatility < 0.2 && spread > 0.2) return 'simple';
    if (priceImpact < 0.5 && volatility < 0.5) return 'complex';
    return 'advanced';
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}