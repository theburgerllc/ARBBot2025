import { Interface } from "ethers";
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
export declare class EnhancedDEXManager {
    private static readonly DEX_ROUTERS;
    /**
     * Get all available DEX routers for a chain, sorted by liquidity score
     */
    static getAllRouters(chainId: number): DEXRouter[];
    /**
     * Get routers filtered by type and minimum liquidity score
     */
    static getRoutersByType(chainId: number, types: DEXRouter['routerType'][], minLiquidityScore?: number): DEXRouter[];
    /**
     * Get optimal router combination for arbitrage
     * Prioritizes different fee structures and liquidity
     */
    static getArbitrageRouterPairs(chainId: number): {
        routerA: DEXRouter;
        routerB: DEXRouter;
    }[];
    /**
     * Get specialized routers for specific token types
     */
    static getSpecializedRouters(chainId: number, tokenType: 'STABLE' | 'VOLATILE' | 'EXOTIC'): DEXRouter[];
    /**
     * Estimate gas costs for different router combinations
     */
    static estimateArbitrageGasCost(routerA: DEXRouter, routerB: DEXRouter): bigint;
    /**
     * Get router interface for quote generation
     */
    static getRouterInterface(routerType: DEXRouter['routerType']): Interface;
    /**
     * Calculate expected slippage for router type and amount
     */
    static calculateExpectedSlippage(router: DEXRouter, amountIn: bigint, liquidityDepth: bigint): number;
    /**
     * Format DEX information for logging
     */
    static formatDEXInfo(router: DEXRouter): string;
    /**
     * Get coverage statistics for a chain
     */
    static getCoverageStats(chainId: number): {
        totalRouters: number;
        routerTypes: {
            [key: string]: number;
        };
        averageLiquidityScore: number;
        totalGasLimit: bigint;
    };
}
