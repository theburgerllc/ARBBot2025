import { ethers } from "ethers";

export interface DEXRouter {
  name: string;
  address: string;
  chainId: number;
  routerType: 'UNISWAP_V2' | 'UNISWAP_V3' | 'CURVE' | 'GMX' | 'BALANCER';
  gasLimit: bigint;
  feeStructure: string;
  liquidityScore: number;
}

export interface DEXQuote {
  router: DEXRouter;
  amountOut: bigint;
  gasEstimate: bigint;
  slippage: number;
  path: string[];
  priceImpact: number;
}

export class EnhancedDEXManager {
  
  // Comprehensive DEX router database
  private static readonly DEX_ROUTERS = {
    // Arbitrum (42161)
    42161: [
      // Uniswap V2/V3
      {
        name: "Uniswap V2",
        address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
        routerType: 'UNISWAP_V2' as const,
        gasLimit: 300000n,
        feeStructure: "0.3%",
        liquidityScore: 9.0
      },
      {
        name: "Uniswap V3",
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
        routerType: 'UNISWAP_V3' as const,
        gasLimit: 350000n,
        feeStructure: "0.05%/0.3%/1%",
        liquidityScore: 9.5
      },
      
      // SushiSwap
      {
        name: "SushiSwap",
        address: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
        routerType: 'UNISWAP_V2' as const,
        gasLimit: 320000n,
        feeStructure: "0.3%",
        liquidityScore: 8.0
      },
      
      // Curve (Stable swaps + Crypto pools)
      {
        name: "Curve 2Pool",
        address: "0x7f90122BF0700F9E7e1F688fe926940E8839F353", // USDC/USDT
        routerType: 'CURVE' as const,
        gasLimit: 250000n,
        feeStructure: "0.04%",
        liquidityScore: 8.5
      },
      {
        name: "Curve 3Pool", 
        address: "0x960ea3e3C7FB317332d990873d354E18d7645590", // USDC/USDT/DAI
        routerType: 'CURVE' as const,
        gasLimit: 280000n,
        feeStructure: "0.04%",
        liquidityScore: 8.0
      },
      {
        name: "Curve TriCrypto",
        address: "0x960ea3e3C7FB317332d990873d354E18d7645590", // USDT/WBTC/WETH
        routerType: 'CURVE' as const,
        gasLimit: 400000n,
        feeStructure: "0.04-0.4%",
        liquidityScore: 7.5
      },
      
      // GMX (Perpetuals with spot trading)
      {
        name: "GMX Router",
        address: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
        routerType: 'GMX' as const,
        gasLimit: 500000n,
        feeStructure: "0.1-0.8%",
        liquidityScore: 6.0
      },
      
      // Balancer V2
      {
        name: "Balancer V2",
        address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        routerType: 'BALANCER' as const,
        gasLimit: 400000n,
        feeStructure: "0.1-1%",
        liquidityScore: 7.0
      },
      
      // Camelot (Native Arbitrum DEX)
      {
        name: "Camelot",
        address: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
        routerType: 'UNISWAP_V2' as const,
        gasLimit: 350000n,
        feeStructure: "0.3%",
        liquidityScore: 6.5
      }
    ],
    
    // Optimism (10)
    10: [
      // Uniswap V3
      {
        name: "Uniswap V3",
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        routerType: 'UNISWAP_V3' as const,
        gasLimit: 350000n,
        feeStructure: "0.05%/0.3%/1%",
        liquidityScore: 9.0
      },
      
      // Uniswap V2 style
      {
        name: "Uniswap V2",
        address: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
        routerType: 'UNISWAP_V2' as const,
        gasLimit: 300000n,
        feeStructure: "0.3%",
        liquidityScore: 8.5
      },
      
      // Curve
      {
        name: "Curve 3Pool",
        address: "0x1337BedC9D22ecbe766dF105c9623922A27963EC", // USDC/USDT/DAI
        routerType: 'CURVE' as const,
        gasLimit: 280000n,
        feeStructure: "0.04%",
        liquidityScore: 8.0
      },
      
      // Balancer V2
      {
        name: "Balancer V2",
        address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        routerType: 'BALANCER' as const,
        gasLimit: 400000n,
        feeStructure: "0.1-1%",
        liquidityScore: 7.5
      },
      
      // Velodrome (Native Optimism DEX)
      {
        name: "Velodrome",
        address: "0x9c12939390052919aF3155f41Bf4160Fd3666A6f",
        routerType: 'UNISWAP_V2' as const,
        gasLimit: 320000n,
        feeStructure: "0.02-0.05%",
        liquidityScore: 7.0
      }
    ]
  };

  /**
   * Get all available DEX routers for a chain, sorted by liquidity score
   */
  static getAllRouters(chainId: number): DEXRouter[] {
    const routers = (this.DEX_ROUTERS as any)[chainId] || [];
    return routers
      .map((router: any) => ({ ...router, chainId }))
      .sort((a: any, b: any) => b.liquidityScore - a.liquidityScore);
  }
  
  /**
   * Get routers filtered by type and minimum liquidity score
   */
  static getRoutersByType(
    chainId: number, 
    types: DEXRouter['routerType'][], 
    minLiquidityScore: number = 6.0
  ): DEXRouter[] {
    return this.getAllRouters(chainId)
      .filter(router => 
        types.includes(router.routerType) && 
        router.liquidityScore >= minLiquidityScore
      );
  }
  
  /**
   * Get optimal router combination for arbitrage
   * Prioritizes different fee structures and liquidity
   */
  static getArbitrageRouterPairs(chainId: number): { routerA: DEXRouter; routerB: DEXRouter }[] {
    const routers = this.getAllRouters(chainId);
    const pairs: { routerA: DEXRouter; routerB: DEXRouter }[] = [];
    
    // Create all possible router combinations
    for (let i = 0; i < routers.length; i++) {
      for (let j = i + 1; j < routers.length; j++) {
        const routerA = routers[i];
        const routerB = routers[j];
        
        // Prioritize combinations with different fee structures
        const feeStructureDiff = routerA.feeStructure !== routerB.feeStructure;
        const bothHighLiquidity = routerA.liquidityScore >= 7.0 && routerB.liquidityScore >= 7.0;
        
        if (feeStructureDiff || bothHighLiquidity) {
          pairs.push({ routerA, routerB });
        }
      }
    }
    
    // Sort by combined liquidity score
    return pairs.sort((a, b) => {
      const scoreA = a.routerA.liquidityScore + a.routerB.liquidityScore;
      const scoreB = b.routerA.liquidityScore + b.routerB.liquidityScore;
      return scoreB - scoreA;
    });
  }
  
  /**
   * Get specialized routers for specific token types
   */
  static getSpecializedRouters(chainId: number, tokenType: 'STABLE' | 'VOLATILE' | 'EXOTIC'): DEXRouter[] {
    const allRouters = this.getAllRouters(chainId);
    
    switch (tokenType) {
      case 'STABLE':
        // Curve excels at stable swaps, Balancer for stable pools
        return allRouters.filter(r => 
          r.routerType === 'CURVE' || r.routerType === 'BALANCER'
        );
        
      case 'VOLATILE':
        // Uniswap V3 for concentrated liquidity, V2 for simplicity
        return allRouters.filter(r => 
          r.routerType === 'UNISWAP_V3' || r.routerType === 'UNISWAP_V2'
        );
        
      case 'EXOTIC':
        // All routers for maximum coverage
        return allRouters;
        
      default:
        return allRouters;
    }
  }
  
  /**
   * Estimate gas costs for different router combinations
   */
  static estimateArbitrageGasCost(routerA: DEXRouter, routerB: DEXRouter): bigint {
    // Base arbitrage transaction overhead
    const baseGas = 150000n;
    
    // Router-specific gas costs
    const gasA = routerA.gasLimit;
    const gasB = routerB.gasLimit;
    
    // Additional overhead for complex routers (Curve, GMX)
    const complexityMultiplier = 
      (routerA.routerType === 'CURVE' || routerA.routerType === 'GMX' ||
       routerB.routerType === 'CURVE' || routerB.routerType === 'GMX') ? 1.2 : 1.0;
    
    return BigInt(Math.floor(Number(baseGas + gasA + gasB) * complexityMultiplier));
  }
  
  /**
   * Get router interface for quote generation
   */
  static getRouterInterface(routerType: DEXRouter['routerType']): ethers.Interface {
    switch (routerType) {
      case 'UNISWAP_V2':
        return new ethers.Interface([
          "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)",
          "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)"
        ]);
        
      case 'UNISWAP_V3':
        return new ethers.Interface([
          "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)"
        ]);
        
      case 'CURVE':
        return new ethers.Interface([
          "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
          "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)"
        ]);
        
      case 'GMX':
        return new ethers.Interface([
          "function swap(address[] path, uint256 amountIn, uint256 minOut, address receiver) returns (uint256)"
        ]);
        
      case 'BALANCER':
        return new ethers.Interface([
          "function queryBatchSwap(uint8 kind, (bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, (address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds) view returns (int256[] assetDeltas)"
        ]);
        
      default:
        return new ethers.Interface([]);
    }
  }
  
  /**
   * Calculate expected slippage for router type and amount
   */
  static calculateExpectedSlippage(
    router: DEXRouter, 
    amountIn: bigint, 
    liquidityDepth: bigint
  ): number {
    const tradeSize = Number(amountIn) / Number(liquidityDepth);
    
    // Router-specific slippage models
    switch (router.routerType) {
      case 'CURVE':
        // Curve has lower slippage for stable swaps
        return Math.min(0.001, tradeSize * 0.1); // 0.1% max for stables
        
      case 'UNISWAP_V3':
        // V3 concentrated liquidity can have higher slippage
        return Math.min(0.02, tradeSize * 0.5);
        
      case 'GMX':
        // GMX has dynamic fees based on utilization
        return Math.min(0.008, tradeSize * 0.3);
        
      default:
        // Standard AMM slippage
        return Math.min(0.015, tradeSize * 0.4);
    }
  }
  
  /**
   * Format DEX information for logging
   */
  static formatDEXInfo(router: DEXRouter): string {
    return `${router.name} (${router.routerType}, liq: ${router.liquidityScore}, fee: ${router.feeStructure})`;
  }
  
  /**
   * Get coverage statistics for a chain
   */
  static getCoverageStats(chainId: number): {
    totalRouters: number;
    routerTypes: { [key: string]: number };
    averageLiquidityScore: number;
    totalGasLimit: bigint;
  } {
    const routers = this.getAllRouters(chainId);
    
    const routerTypes: { [key: string]: number } = {};
    let totalLiquidityScore = 0;
    let totalGasLimit = 0n;
    
    for (const router of routers) {
      routerTypes[router.routerType] = (routerTypes[router.routerType] || 0) + 1;
      totalLiquidityScore += router.liquidityScore;
      totalGasLimit += router.gasLimit;
    }
    
    return {
      totalRouters: routers.length,
      routerTypes,
      averageLiquidityScore: totalLiquidityScore / routers.length,
      totalGasLimit
    };
  }
}