import { ethers } from "ethers";
import { CurveApi } from "@curvefi/api";
import { GMXReader } from "@gmx-io/sdk";
import axios from "axios";

export interface DexRoute {
  dexName: string;
  path: string[];
  amountIn: string;
  amountOut: string;
  gasEstimate: string;
  priceImpact: number;
  fee: number;
}

export interface QuoteResult {
  bestRoute: DexRoute;
  allRoutes: DexRoute[];
  executionTime: number;
}

export class DexIntegration {
  private curveApi: typeof CurveApi;
  private gmxReader: typeof GMXReader | null = null;
  
  constructor(
    private readonly providers: Record<string, ethers.JsonRpcProvider>,
    private readonly chainId: number
  ) {
    this.initializeCurve();
    this.initializeGMX();
  }

  private async initializeCurve(): Promise<void> {
    try {
      // Initialize Curve API with appropriate network
      const networkName = this.getNetworkName(this.chainId);
      this.curveApi = new CurveApi({
        network: networkName,
        chainId: this.chainId
      });
      await this.curveApi.init();
    } catch (error) {
      console.error('Failed to initialize Curve API:', error);
    }
  }

  private async initializeGMX(): Promise<void> {
    try {
      // Initialize GMX Reader for supported networks
      if (this.chainId === 42161 || this.chainId === 43114) { // Arbitrum or Avalanche
        const provider = this.providers[this.getNetworkName(this.chainId)];
        this.gmxReader = new GMXReader(provider, this.chainId);
        await this.gmxReader.init();
      }
    } catch (error) {
      console.error('Failed to initialize GMX SDK:', error);
    }
  }

  private getNetworkName(chainId: number): string {
    switch (chainId) {
      case 1: return 'ethereum';
      case 10: return 'optimism';
      case 42161: return 'arbitrum';
      case 8453: return 'base';
      case 137: return 'polygon';
      case 43114: return 'avalanche';
      default: return 'ethereum';
    }
  }

  async getCurveRoutes(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexRoute[]> {
    try {
      if (!this.curveApi) {
        console.warn('Curve API not initialized');
        return [];
      }

      // Get all available pools for the token pair
      const pools = await this.curveApi.getPools(tokenIn, tokenOut);
      const routes: DexRoute[] = [];

      for (const pool of pools) {
        try {
          // Get quote for each pool
          const quote = await this.curveApi.getQuote(
            pool.address,
            tokenIn,
            tokenOut,
            amountIn
          );

          if (quote && quote.amountOut) {
            routes.push({
              dexName: 'Curve',
              path: [tokenIn, tokenOut],
              amountIn: amountIn,
              amountOut: quote.amountOut,
              gasEstimate: quote.gasEstimate || '200000',
              priceImpact: quote.priceImpact || 0,
              fee: quote.fee || 0.04 // Default 0.04% fee
            });
          }
        } catch (poolError) {
          console.debug(`Failed to get quote for Curve pool ${pool.address}:`, poolError);
        }
      }

      return routes;
    } catch (error) {
      console.error('Error getting Curve routes:', error);
      return [];
    }
  }

  async getGMXRoutes(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexRoute[]> {
    try {
      if (!this.gmxReader) {
        console.warn('GMX SDK not initialized for this network');
        return [];
      }

      // Get GMX swap quote
      const quote = await this.gmxReader.getSwapQuote({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: amountIn,
        receiver: ethers.ZeroAddress // Will be replaced with actual receiver
      });

      if (quote && quote.amountOut) {
        return [{
          dexName: 'GMX',
          path: [tokenIn, tokenOut],
          amountIn: amountIn,
          amountOut: quote.amountOut,
          gasEstimate: quote.gasEstimate || '300000',
          priceImpact: quote.priceImpact || 0,
          fee: quote.fee || 0.3 // Default 0.3% fee
        }];
      }

      return [];
    } catch (error) {
      console.error('Error getting GMX routes:', error);
      return [];
    }
  }

  async getUniswapV3Routes(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexRoute[]> {
    try {
      // Use Uniswap V3 quoter for multiple fee tiers
      const quoterAddress = this.getUniswapV3QuoterAddress(this.chainId);
      if (!quoterAddress) return [];

      const provider = this.providers[this.getNetworkName(this.chainId)];
      const quoterABI = [
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
      ];

      const quoter = new ethers.Contract(quoterAddress, quoterABI, provider);
      const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
      const routes: DexRoute[] = [];

      for (const fee of feeTiers) {
        try {
          const amountOut = await quoter.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            0
          );

          if (amountOut > 0) {
            routes.push({
              dexName: 'UniswapV3',
              path: [tokenIn, tokenOut],
              amountIn: amountIn,
              amountOut: amountOut.toString(),
              gasEstimate: '150000',
              priceImpact: 0, // Would need additional calculation
              fee: fee / 10000 // Convert to percentage
            });
          }
        } catch (quoteError) {
          console.debug(`Failed to get Uniswap V3 quote for fee tier ${fee}:`, quoteError);
        }
      }

      return routes;
    } catch (error) {
      console.error('Error getting Uniswap V3 routes:', error);
      return [];
    }
  }

  private getUniswapV3QuoterAddress(chainId: number): string | null {
    const quoterAddresses: Record<number, string> = {
      1: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Ethereum
      10: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Optimism
      42161: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Arbitrum
      8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // Base
      137: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6' // Polygon
    };

    return quoterAddresses[chainId] || null;
  }

  async getBalancerRoutes(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexRoute[]> {
    try {
      // Query Balancer SOR (Smart Order Router) API
      const sorUrl = `https://api.balancer.fi/graphql`;
      const query = `
        query {
          swaps(
            where: {
              tokenIn: "${tokenIn}",
              tokenOut: "${tokenOut}",
              amount: "${amountIn}"
            }
          ) {
            tokenAmountOut
            swapAmount
            returnAmount
            marketSp
            swaps {
              poolId
              assetInIndex
              assetOutIndex
              amount
              userData
            }
          }
        }
      `;

      const response = await axios.post(sorUrl, { query });
      
      if (response.data?.data?.swaps?.[0]) {
        const swap = response.data.data.swaps[0];
        return [{
          dexName: 'Balancer',
          path: [tokenIn, tokenOut],
          amountIn: amountIn,
          amountOut: swap.returnAmount,
          gasEstimate: '250000',
          priceImpact: 0, // Would need additional calculation
          fee: 0.25 // Average Balancer fee
        }];
      }

      return [];
    } catch (error) {
      console.error('Error getting Balancer routes:', error);
      return [];
    }
  }

  async getAllRoutes(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<QuoteResult> {
    const startTime = Date.now();
    
    // Get routes from all DEXs in parallel
    const [curveRoutes, gmxRoutes, uniswapV3Routes, balancerRoutes] = await Promise.all([
      this.getCurveRoutes(tokenIn, tokenOut, amountIn),
      this.getGMXRoutes(tokenIn, tokenOut, amountIn),
      this.getUniswapV3Routes(tokenIn, tokenOut, amountIn),
      this.getBalancerRoutes(tokenIn, tokenOut, amountIn)
    ]);

    const allRoutes = [
      ...curveRoutes,
      ...gmxRoutes,
      ...uniswapV3Routes,
      ...balancerRoutes
    ];

    // Find best route by output amount
    const bestRoute = allRoutes.reduce((best, current) => {
      if (!best) return current;
      
      const bestAmount = ethers.getBigInt(best.amountOut);
      const currentAmount = ethers.getBigInt(current.amountOut);
      
      return currentAmount > bestAmount ? current : best;
    }, null as DexRoute | null);

    const executionTime = Date.now() - startTime;

    return {
      bestRoute: bestRoute || {
        dexName: 'None',
        path: [tokenIn, tokenOut],
        amountIn: amountIn,
        amountOut: '0',
        gasEstimate: '0',
        priceImpact: 0,
        fee: 0
      },
      allRoutes,
      executionTime
    };
  }

  async estimateGasForRoute(route: DexRoute): Promise<string> {
    try {
      // Implementation would depend on the specific DEX
      // For now, return the stored gas estimate
      return route.gasEstimate;
    } catch (error) {
      console.error('Error estimating gas for route:', error);
      return '200000'; // Default fallback
    }
  }

  async validateRoute(route: DexRoute): Promise<boolean> {
    try {
      // Basic validation - check if tokens are valid addresses
      const tokenIn = route.path[0];
      const tokenOut = route.path[route.path.length - 1];
      
      return ethers.isAddress(tokenIn) && ethers.isAddress(tokenOut);
    } catch (error) {
      console.error('Error validating route:', error);
      return false;
    }
  }

  async getOptimalSlippage(route: DexRoute): Promise<number> {
    // Dynamic slippage based on DEX and market conditions
    switch (route.dexName) {
      case 'Curve':
        return 0.1; // 0.1% for stable swaps
      case 'GMX':
        return 0.5; // 0.5% for GMX
      case 'UniswapV3':
        return 0.3; // 0.3% for Uniswap V3
      case 'Balancer':
        return 0.2; // 0.2% for Balancer
      default:
        return 0.5; // Default 0.5%
    }
  }
}