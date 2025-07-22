import { JsonRpcProvider } from "ethers";
export interface MarketConditions {
    volatility: 'low' | 'medium' | 'high';
    liquidity: 'thin' | 'normal' | 'deep';
    competition: 'low' | 'medium' | 'high';
    networkCongestion: 'low' | 'medium' | 'high';
    timeOfDay: 'quiet' | 'active' | 'peak';
}
export interface ProfitThresholdConfig {
    baseThresholdBps: number;
    volatilityAdjustment: Record<string, number>;
    liquidityAdjustment: Record<string, number>;
    competitionAdjustment: Record<string, number>;
    timeAdjustment: Record<string, number>;
    gasRatioMax: number;
}
export interface ProfitThresholdResult {
    thresholdBps: number;
    minProfitWei: bigint;
    recommendation: 'aggressive' | 'balanced' | 'conservative';
    reasoning: string[];
    conditions: MarketConditions;
    gasRatioCheck: {
        ratio: number;
        withinLimits: boolean;
        requiredProfit: bigint;
    };
}
export interface PerformanceMetrics {
    successRate: number;
    avgProfitMargin: number;
    gasEfficiency: number;
    opportunityCapture: number;
}
export declare class AdaptiveProfitManager {
    private providers;
    private config;
    private recentProfits;
    private performanceHistory;
    constructor(providers: Map<number, JsonRpcProvider>);
    calculateOptimalThreshold(tokenPair: [string, string], tradeSize: bigint, estimatedGasCost: bigint, chainId: number): Promise<ProfitThresholdResult>;
    private assessMarketConditions;
    private assessVolatility;
    private assessLiquidity;
    private assessCompetition;
    private assessNetworkCongestion;
    private assessTimeOfDay;
    private applyMachineLearningAdjustment;
    private getRecentPerformanceForConditions;
    private conditionsMatch;
    private recordOpportunity;
    updateTradeOutcome(profit: bigint, actualGasCost: bigint, success: boolean, timestamp: number): void;
    getThresholdRecommendations(tokenPair: [string, string], tradeSize: bigint, estimatedGasCost: bigint, chainId: number): Promise<{
        conservative: ProfitThresholdResult;
        balanced: ProfitThresholdResult;
        aggressive: ProfitThresholdResult;
    }>;
    private getTokenVolatility;
    private estimateTotalLiquidity;
    getPerformanceReport(): {
        config: ProfitThresholdConfig;
        recentPerformance: PerformanceMetrics;
        suggestions: string[];
    };
    private calculateOpportunityCapture;
    private generateOptimizationSuggestions;
    optimizeConfig(newConfig: Partial<ProfitThresholdConfig>): void;
}
