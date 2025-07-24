/**
 * Optimization Monitor - Logging and Monitoring Integration
 * Provides comprehensive monitoring and logging for the Market Optimization Protocol
 */
/// <reference types="node" />
import { EventEmitter } from "events";
import { OptimizedParameters, OptimizationResult, PerformanceMetrics } from "./types";
export interface OptimizationMetrics {
    timestamp: number;
    optimizationsPerformed: number;
    averageImprovement: number;
    parametersChanged: number;
    validationErrors: number;
    validationWarnings: number;
    uptime: number;
    successRate: number;
    profitImprovement: number;
    gasEfficiencyImprovement: number;
}
export interface AlertThresholds {
    maxValidationErrors: number;
    minSuccessRate: number;
    maxDowntime: number;
    minProfitImprovement: number;
    maxParameterChangeFrequency: number;
}
export declare class OptimizationMonitor extends EventEmitter {
    private logger;
    private metrics;
    private startTime;
    private alertThresholds;
    private currentPeriodMetrics;
    private logFilePath;
    private metricsCollectionInterval;
    constructor(logFilePath?: string);
    logOptimizationStart(chainId: number): void;
    logOptimizationComplete(result: OptimizationResult): void;
    logOptimizationError(error: Error, context: any): void;
    logParameterValidation(originalParameters: OptimizedParameters, validatedParameters: OptimizedParameters, warnings: string[], errors: string[]): void;
    logTradeExecution(approved: boolean, parameters: OptimizedParameters, profit: bigint, gasCost: bigint, executionTime: number): void;
    logPerformanceMetrics(metrics: PerformanceMetrics): void;
    logMarketConditions(conditions: any): void;
    logSystemHealth(status: 'healthy' | 'degraded' | 'critical', details: any): void;
    getCurrentMetrics(): OptimizationMetrics;
    getHistoricalMetrics(hours?: number): OptimizationMetrics[];
    generatePerformanceReport(): {
        summary: OptimizationMetrics;
        trends: any;
        recommendations: string[];
        alerts: any[];
    };
    private createEmptyMetrics;
    private formatParametersForLogging;
    private startMetricsCollection;
    private checkAlertThresholds;
    private updatePerformanceImprovements;
    private calculateTrends;
    private generateRecommendations;
    private getRecentAlerts;
    updateAlertThresholds(newThresholds: Partial<AlertThresholds>): void;
    exportMetrics(format?: 'json' | 'csv'): string;
    stop(): void;
}
