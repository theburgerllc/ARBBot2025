export interface OptimalGasSettings {
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    baseFee: bigint;
    optimalTip: bigint;
    networkCongestion: number;
    confidence: number;
}
export interface GasPrediction {
    currentGasPrice: bigint;
    predictedGasPrice: bigint;
    congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
    recommendedWaitTime: number;
    costEfficiencyScore: number;
}
export declare class GasOptimizer {
    private arbitrumProvider;
    private optimismProvider;
    private gasHistory;
    private mempoolCache;
    constructor(arbitrumRpc: string, optimismRpc: string);
    getOptimalGasPrice(chainId: number, urgency?: 'low' | 'medium' | 'high'): Promise<OptimalGasSettings>;
    shouldExecuteTrade(estimatedProfit: bigint, estimatedGas: bigint, chainId: number, urgency?: 'low' | 'medium' | 'high'): Promise<{
        shouldExecute: boolean;
        profitMargin: number;
        recommendation: string;
    }>;
    predictGasPriceMovement(chainId: number, timeHorizon?: number): Promise<GasPrediction>;
    getGasStrategyForOpportunity(opportunityType: 'dual-dex' | 'triangular' | 'cross-chain' | 'liquidation', profitExpectation: bigint, chainId: number): Promise<OptimalGasSettings>;
    private calculateNetworkCongestion;
    private calculateOptimalTip;
    private updateGasHistory;
    private calculateGasTrend;
    private calculateConfidence;
    private calculateCostEfficiencyScore;
    private getPendingTransactionCount;
}
