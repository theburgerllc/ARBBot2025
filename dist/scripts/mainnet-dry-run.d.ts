import { RealArbitrageOpportunity } from "../utils/mainnet-data-fetcher";
export interface DryRunResults {
    totalOpportunitiesDetected: number;
    profitableOpportunities: number;
    totalEstimatedProfit: bigint;
    averageProfitMargin: number;
    successfulOptimizations: number;
    phase3Features: {
        dynamicSlippageUsed: number;
        adaptiveThresholdsUsed: number;
        riskAssessmentsPerformed: number;
        riskAssessmentsBlocked: number;
        oracleValidationsPerformed: number;
        oracleValidationsBlocked: number;
    };
    gasCostAnalysis: {
        totalEstimatedGasCost: bigint;
        averageGasCostPerTrade: bigint;
        gasEfficiencyRatio: number;
    };
    riskMetrics: {
        highRiskOpportunities: number;
        mediumRiskOpportunities: number;
        lowRiskOpportunities: number;
        riskManagerBlocks: number;
        circuitBreakerTriggers: number;
        averageConfidence: number;
    };
    performanceMetrics: {
        avgProcessingTimeMs: number;
        opportunitiesPerMinute: number;
        systemLoad: number;
        peakMemoryUsageMB: number;
        totalCycles: number;
    };
    chainResults: Map<number, {
        opportunities: number;
        profit: bigint;
        avgConfidence: number;
    }>;
    timeSeriesData: {
        timestamp: number;
        opportunities: number;
        profit: bigint;
        confidence: number;
    }[];
    executionDetails: {
        startTime: number;
        endTime: number;
        durationHours: number;
        configurationUsed: any;
    };
}
export interface CycleResults {
    cycleNumber: number;
    timestamp: number;
    chainId: number;
    opportunitiesFound: number;
    bestOpportunity?: RealArbitrageOpportunity;
    phase3Validations: {
        riskPassed: boolean;
        oraclePassed: boolean;
        slippageOptimized: boolean;
        thresholdOptimized: boolean;
    };
}
declare class DryRunOrchestrator {
    private dataFetcher;
    private dynamicSlippage;
    private adaptiveProfit;
    private riskManager;
    private oracleValidator;
    private productionMonitor;
    private results;
    private startTime;
    private cycleResults;
    private processingTimes;
    constructor();
    executeDryRun(): Promise<DryRunResults>;
    private performCycleAnalysis;
    private analyzeOpportunityWithPhase3;
    private generateFinalReport;
    private calculateFinalMetrics;
    private displayProfitabilityAnalysis;
    private displayPhase3Performance;
    private displayGasEfficiencyAnalysis;
    private displayRiskManagementAnalysis;
    private displayPerformanceMetrics;
    private displayChainSpecificResults;
    private generateProductionRecommendations;
    private getStatusEmoji;
    private createLogDirectory;
    private saveDetailedLogs;
    private updateTimeSeriesData;
    private updateSystemResourceMetrics;
    private updatePerformanceMetrics;
    private initializePhase3Modules;
    private initializeResults;
    private sleep;
}
export { DryRunOrchestrator };
