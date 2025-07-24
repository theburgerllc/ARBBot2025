export interface RiskMetrics {
    currentDrawdown: number;
    dailyPnL: bigint;
    weeklyPnL: bigint;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    gasToCapitalRatio: number;
    successRate1h: number;
    successRate24h: number;
    avgProfitMargin: number;
    exposureByToken: Map<string, bigint>;
    exposureByChain: Map<number, bigint>;
    peakBalance: bigint;
    currentBalance: bigint;
    totalTradesCount: number;
    profitableTradesCount: number;
}
export interface RiskLimits {
    maxDrawdownPercent: number;
    maxDailyLossPercent: number;
    maxWeeklyLossPercent: number;
    maxConsecutiveFailures: number;
    maxGasRatio: number;
    minSuccessRate1h: number;
    minSuccessRate24h: number;
    minProfitMargin: number;
    maxSingleTradePercent: number;
    maxTokenExposurePercent: number;
    maxChainExposurePercent: number;
    cooldownPeriodMinutes: number;
}
export interface TradeRiskAssessment {
    approved: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    maxPosition: bigint;
    requiredConfidence: number;
    gasRatioCheck: boolean;
    exposureCheck: boolean;
    reasonsForRejection: string[];
}
export interface CircuitBreakerStatus {
    isActive: boolean;
    activatedAt?: number;
    reasons: string[];
    estimatedRecoveryTime?: number;
    canOverride: boolean;
    overrideConditions: string[];
}
export declare class AdvancedRiskManager {
    private riskMetrics;
    private riskLimits;
    private circuitBreakerStatus;
    private performanceHistory;
    private balanceHistory;
    constructor(initialCapital: bigint);
    private initializeMetrics;
    assessTradeRisk(tokenPair: [string, string], tradeSize: bigint, estimatedProfit: bigint, estimatedGasCost: bigint, strategy: string, chainId: number, confidence?: number): Promise<TradeRiskAssessment>;
    updateMetricsAndCheckLimits(tradeResult: {
        profit: bigint;
        gasCost: bigint;
        success: boolean;
        strategy: string;
        tokenPair: string;
        chainId: number;
        tradeSize: bigint;
    }): Promise<void>;
    private recalculateAllMetrics;
    private calculateConsecutiveResults;
    private calculateCurrentDrawdown;
    private checkCircuitBreakers;
    private activateCircuitBreaker;
    private deactivateCircuitBreaker;
    private shouldResumeTradingOperations;
    private generateOverrideConditions;
    private calculateTokenExposure;
    private calculateChainExposure;
    private calculateMaxPositionFromExposure;
    private updateExposures;
    getCircuitBreakerStatus(): CircuitBreakerStatus;
    getRiskMetrics(): RiskMetrics;
    updateRiskLimits(newLimits: Partial<RiskLimits>): void;
    forceCircuitBreakerReset(): boolean;
    generateRiskReport(): {
        metrics: RiskMetrics;
        limits: RiskLimits;
        circuitBreaker: CircuitBreakerStatus;
        recommendations: string[];
        healthScore: number;
    };
}
