/**
 * Performance Tracker - Optimization Metrics and Analysis
 * Tracks optimization effectiveness and trading performance
 */
import { PerformanceMetrics, OptimizationResult } from "./types";
export interface TradeRecord {
    id: string;
    timestamp: number;
    success: boolean;
    profit: bigint;
    gasUsed: bigint;
    gasPrice: bigint;
    executionTime: number;
    parameters: any;
    marketConditions: any;
}
export declare class PerformanceTracker {
    private tradeHistory;
    private optimizationHistory;
    private performanceWindow;
    private maxHistorySize;
    constructor(performanceWindow?: number);
    recordTrade(trade: TradeRecord): void;
    recordOptimization(result: OptimizationResult): void;
    calculatePerformanceMetrics(): PerformanceMetrics;
    getOptimizationEffectiveness(): {
        totalOptimizations: number;
        successfulOptimizations: number;
        avgImprovement: number;
        lastOptimization: number;
    };
    getPerformanceTrends(): {
        successRateTrend: number;
        profitTrend: number;
        gasEfficiencyTrend: number;
    };
    getDetailedReport(): {
        performance: PerformanceMetrics;
        optimization: any;
        trends: any;
        insights: string[];
        recommendations: string[];
    };
    private calculateROI;
    private calculateOpportunityCapture;
    private calculateMetricsForTrades;
    private generateInsights;
    private generateRecommendations;
    private getDefaultMetrics;
    getRecentTrades(count?: number): TradeRecord[];
    getOptimizationHistory(count?: number): OptimizationResult[];
    clearHistory(): void;
}
