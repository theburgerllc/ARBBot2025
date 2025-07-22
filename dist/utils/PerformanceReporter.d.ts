export interface OpportunityLog {
    timestamp: number;
    workerId: number;
    chain: string;
    route: string;
    tokens: string[];
    provider: string;
    netProfit: string;
    gasUsed: string;
    coinbaseDiff: string;
    latency: number;
}
export interface ExecutionLog {
    timestamp: number;
    workerId: number;
    success: boolean;
    txHash?: string;
    profit?: string;
    gasUsed?: string;
    error?: string;
    latency: number;
}
export interface PerformanceReport {
    timestamp: number;
    totalWorkers: number;
    activeWorkers: number;
    totalOpportunities: number;
    totalExecutions: number;
    successRate: number;
    avgLatency: number;
    workerDetails: any[];
}
export declare class PerformanceReporter {
    private readonly verbose;
    private opportunityLogs;
    private executionLogs;
    private performanceReports;
    private lastReportTime;
    private startTime;
    constructor(verbose?: boolean);
    logOpportunities(opportunities: any[]): void;
    logExecution(result: any): void;
    logPerformanceReport(report: PerformanceReport): void;
    private printOpportunityLog;
    private printExecutionLog;
    private generateMinuteReport;
    private formatRoute;
    private getTokenSymbol;
    private getChainName;
    private calculateCoinbaseDiff;
    getFinalSummary(): {
        totalOpportunities: number;
        totalExecutions: number;
        totalProfit: string;
        totalGasUsed: string;
        avgLatency: number;
        successRate: number;
        bestProfit: string;
        coinbaseDiff: string;
        runtime: number;
    };
    exportLogs(): {
        opportunities: OpportunityLog[];
        executions: ExecutionLog[];
        reports: PerformanceReport[];
    };
    clearLogs(): void;
    getStats(): {
        totalOpportunities: number;
        totalExecutions: number;
        successRate: number;
        avgLatency: number;
        memoryUsage: number;
    };
}
