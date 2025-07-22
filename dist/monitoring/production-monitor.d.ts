interface SystemMetrics {
    totalProfitETH: number;
    dailyProfitETH: number;
    hourlyProfitETH: number;
    profitTargetProgress: number;
    successRate24h: number;
    avgExecutionTimeMs: number;
    gasEfficiencyRatio: number;
    mevBundleSuccessRate: number;
    currentDrawdown: number;
    riskScore: number;
    consecutiveFailures: number;
    circuitBreakerActive: boolean;
    systemUptimeHours: number;
    lastErrorTimestamp: number;
    memoryUsageMB: number;
    networkLatencyMs: number;
}
interface TradeRecord {
    success: boolean;
    profit: bigint;
    gasCost: bigint;
    executionTime: number;
    bundleSuccess: boolean;
    bundleAttempted: boolean;
    timestamp: number;
}
export declare class ProductionMonitor {
    private metrics;
    private alertThresholds;
    private tradeHistory;
    private logger;
    private startTime;
    constructor();
    private initializeMetrics;
    private setupAlertThresholds;
    private setupLogger;
    private startMonitoring;
    private updateSystemMetrics;
    private checkCriticalAlerts;
    private sendAlert;
    private sendTelegramAlert;
    private sendEmailAlert;
    updateTradeMetrics(trade: {
        success: boolean;
        profit: bigint;
        gasCost: bigint;
        executionTime: number;
        bundleSuccess: boolean;
        bundleAttempted?: boolean;
    }): Promise<void>;
    private getRecentTrades;
    private updateDrawdown;
    private generateHourlyReport;
    private resetDailyMetrics;
    private getSystemHealthScore;
    getMetrics(): SystemMetrics;
    getRecentTradeHistory(hours?: number): TradeRecord[];
    generateDailyPerformanceReport(): Promise<any>;
}
export {};
