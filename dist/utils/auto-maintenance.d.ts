import { ethers } from "ethers";
export declare class AutoMaintenanceManager {
    private scheduledTasks;
    private logger;
    private providers;
    constructor(providers?: {
        [chainId: number]: ethers.JsonRpcProvider;
    });
    private setupLogger;
    private setupMaintenanceTasks;
    private scheduleTask;
    private startMaintenanceScheduler;
    private checkAndRunScheduledTasks;
    private shouldRunTask;
    performDailyMaintenance(): Promise<void>;
    performWeeklyOptimization(): Promise<void>;
    performMonthlyAnalysis(): Promise<void>;
    private cleanOldLogs;
    private optimizeCache;
    private updateTokenPriceCache;
    private validateContractAddresses;
    private generateAndSendDailyReport;
    private sendDailyMaintenanceReport;
    private performDeepSystemOptimization;
    private analyzeStrategyPerformance;
    private optimizeGasStrategies;
    private optimizeRPCEndpoints;
    private calculateMonthlyMetrics;
    private analyzeRiskManagement;
    private analyzeCompetitivePosition;
    private generateMonthlyReport;
    private sendMonthlyReport;
    runDailyMaintenance(): Promise<void>;
    runWeeklyOptimization(): Promise<void>;
    runMonthlyAnalysis(): Promise<void>;
}
