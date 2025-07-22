import { JsonRpcProvider } from "ethers";
import { EnhancedDEXManager, DEXRouter } from "../utils/dex-routers";
import { GasOptimizer } from "../utils/gas-optimizer";
export interface TriangularPath {
    path: [string, string, string];
    routers: [DEXRouter, DEXRouter, DEXRouter];
    inputAmount: bigint;
    expectedOutput: bigint;
    actualOutput: bigint;
    totalFees: bigint;
    gasEstimate: bigint;
    profitability: number;
    executionTime: number;
    riskScore: number;
}
export interface TriangularOpportunity {
    id: string;
    paths: TriangularPath[];
    bestPath: TriangularPath;
    chainId: number;
    timestamp: number;
    profitAfterGas: bigint;
    confidenceScore: number;
    recommendedAction: 'execute' | 'wait' | 'skip';
    reasoning: string;
}
export interface TriangularExecutionResult {
    success: boolean;
    txHash?: string;
    actualProfit: bigint;
    gasUsed: bigint;
    executionTime: number;
    slippage: number;
    errorMessage?: string;
}
export declare class TriangularArbManager {
    private provider;
    private dexManager;
    private gasOptimizer;
    private readonly PREFERRED_PATHS;
    private readonly TOKEN_ADDRESSES;
    constructor(provider: JsonRpcProvider, dexManager: EnhancedDEXManager, gasOptimizer: GasOptimizer);
    scanTriangularOpportunities(chainId: number, minProfitETH?: number, maxPathsToAnalyze?: number): Promise<TriangularOpportunity[]>;
    executeTriangularArb(opportunity: TriangularOpportunity, contractAddress: string): Promise<TriangularExecutionResult>;
    private generateTriangularPaths;
    private analyzeTriangularPath;
    private simulateTriangularPath;
    private simulateSwap;
    private estimateSlippage;
    private calculateRiskScore;
    private calculateConfidenceScore;
    private generateRecommendation;
    private prepareTriangularTxData;
    private calculateActualProfit;
    private calculateSlippage;
}
