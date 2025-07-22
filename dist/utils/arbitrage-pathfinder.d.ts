import { JsonRpcProvider } from "ethers";
import { DEXRouter } from "./dex-routers";
import { TokenPair } from "./volatile-tokens";
export interface ArbitrageEdge {
    from: string;
    to: string;
    router: DEXRouter;
    rate: number;
    fee: number;
    gaseCost: bigint;
    liquidityDepth: bigint;
    weight: number;
}
export interface ArbitragePath {
    path: string[];
    routers: DEXRouter[];
    edges: ArbitrageEdge[];
    totalRate: number;
    totalFees: number;
    totalGasCost: bigint;
    estimatedProfit: bigint;
    profitMargin: number;
    isTriangular: boolean;
    complexity: number;
}
export interface ArbitrageOpportunity {
    id: string;
    paths: ArbitragePath[];
    bestPath: ArbitragePath;
    tokenPair: TokenPair;
    amountIn: bigint;
    expectedAmountOut: bigint;
    netProfit: bigint;
    confidence: number;
    timeWindow: number;
}
export declare class EnhancedArbitragePathfinder {
    private providers;
    private routerCache;
    private tokenGraph;
    constructor(providers: Map<number, JsonRpcProvider>);
    /**
     * Enhanced Bellman-Ford algorithm for arbitrage detection
     * Finds both loops and non-loop paths with negative weights (profitable trades)
     */
    findArbitrageOpportunities(chainId: number, maxHops?: number, minProfitThreshold?: number): Promise<ArbitrageOpportunity[]>;
    /**
     * Build comprehensive token graph with all DEX routers
     */
    private buildTokenGraph;
    /**
     * Create arbitrage edge with rate calculation
     */
    private createArbitrageEdge;
    /**
     * Find direct arbitrage paths between two DEXes
     */
    private findDirectArbitragePaths;
    /**
     * Find triangular arbitrage loops using modified Bellman-Ford
     */
    private findTriangularArbitragePaths;
    /**
     * Find multi-hop paths using line graph transformation
     */
    private findMultiHopPaths;
    /**
     * Build line graph for advanced path finding
     */
    private buildLineGraph;
    /**
     * Find paths in line graph using BFS
     */
    private findPathsInLineGraph;
    /**
     * Calculate direct arbitrage path
     */
    private calculateDirectPath;
    /**
     * Extract triangular path from Bellman-Ford predecessors
     */
    private extractTriangularPath;
    /**
     * Calculate multi-hop path from line graph
     */
    private calculateMultiHopPath;
    /**
     * Select optimal path from multiple options
     */
    private selectOptimalPath;
    /**
     * Calculate confidence score for path
     */
    private calculateConfidence;
    /**
     * Estimate time window for opportunity
     */
    private estimateTimeWindow;
    /**
     * Helper methods
     */
    private calculateMockRate;
    private parseRouterFee;
    private estimateLiquidityDepth;
}
