/**
 * Market Optimization Protocol - Type Definitions
 * Enhanced MEV Bot with Adaptive Intelligence
 */
export interface MarketConditions {
    volatility: number;
    liquidity: number;
    gasPrice: bigint;
    networkCongestion: number;
    competitionLevel: number;
    timeOfDay: 'quiet' | 'active' | 'peak';
    marketTrend: 'bull' | 'bear' | 'sideways';
    blockNumber: number;
    timestamp: number;
}
export interface OptimizedParameters {
    minProfitThreshold: bigint;
    slippageTolerance: number;
    maxTradeSize: bigint;
    gasSettings: {
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        urgency: 'low' | 'medium' | 'high' | 'urgent';
    };
    cooldownPeriod: number;
    riskLevel: 'conservative' | 'balanced' | 'aggressive';
}
export interface PerformanceMetrics {
    totalTrades: number;
    successfulTrades: number;
    successRate: number;
    totalProfit: bigint;
    avgProfitPerTrade: bigint;
    totalGasUsed: bigint;
    avgGasPerTrade: bigint;
    gasEfficiency: number;
    roi24h: number;
    opportunityCapture: number;
    avgExecutionTime: number;
    lastUpdated: number;
}
export interface OptimizationConfig {
    enabled: boolean;
    frequency: number;
    minSampleSize: number;
    volatilityWindow: number;
    performanceWindow: number;
    adaptationSpeed: number;
    safetyBounds: {
        minProfitThreshold: bigint;
        maxProfitThreshold: bigint;
        minSlippage: number;
        maxSlippage: number;
        minTradeSize: bigint;
        maxTradeSize: bigint;
    };
}
export interface MarketAnalysis {
    conditions: MarketConditions;
    recommendation: 'aggressive' | 'balanced' | 'conservative' | 'pause';
    confidence: number;
    reasoning: string[];
    suggestedParameters: OptimizedParameters;
    riskAssessment: {
        level: 'low' | 'medium' | 'high' | 'critical';
        factors: string[];
        mitigation: string[];
    };
}
export interface OptimizationResult {
    timestamp: number;
    previousParameters: OptimizedParameters;
    newParameters: OptimizedParameters;
    marketAnalysis: MarketAnalysis;
    expectedImprovement: number;
    changesApplied: string[];
    metricsSnapshot: PerformanceMetrics;
}
export interface MarketRegime {
    type: 'bull_market' | 'bear_market' | 'sideways' | 'high_volatility' | 'low_volatility';
    strength: number;
    duration: number;
    stability: number;
}
export interface OptimizationState {
    isRunning: boolean;
    lastOptimization: number;
    nextOptimization: number;
    totalOptimizations: number;
    currentRegime: MarketRegime;
    performanceMetrics: PerformanceMetrics;
    currentParameters: OptimizedParameters;
    adaptationHistory: OptimizationResult[];
}
export interface TradeContext {
    opportunity: {
        id: string;
        profit: bigint;
        gasEstimate: bigint;
        confidence: number;
    };
    marketConditions: MarketConditions;
    parameters: OptimizedParameters;
    timestamp: number;
}
export interface OptimizationEvent {
    type: 'parameter_change' | 'regime_change' | 'performance_update' | 'optimization_complete';
    timestamp: number;
    data: any;
    impact: 'low' | 'medium' | 'high';
}
export interface MarketProfile {
    name: string;
    description: string;
    conditions: {
        volatilityRange: [number, number];
        liquidityRange: [number, number];
        competitionRange: [number, number];
    };
    parameters: {
        profitMultiplier: number;
        gasUrgency: 'low' | 'medium' | 'high';
        riskTolerance: number;
        adaptationSpeed: number;
    };
}
export interface OptimizationRule {
    id: string;
    name: string;
    description: string;
    condition: (market: MarketConditions, performance: PerformanceMetrics) => boolean;
    action: (params: OptimizedParameters) => OptimizedParameters;
    priority: number;
    enabled: boolean;
}
