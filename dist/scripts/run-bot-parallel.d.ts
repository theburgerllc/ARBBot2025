#!/usr/bin/env node
interface BotConfig {
    workers: number;
    duration: number;
    simulate: boolean;
    verbose: boolean;
    crossChain: boolean;
    triangular: boolean;
    minProfitThreshold: number;
    maxGasPrice: string;
    slippageTolerance: number;
    scanInterval: number;
    reportInterval: number;
}
declare class ParallelArbitrageBot {
    private workerManager;
    private performanceReporter;
    private config;
    private stats;
    private isRunning;
    constructor(config: BotConfig);
    private initializeStats;
    private setupEventHandlers;
    private executeOpportunities;
    private simulateExecution;
    private updateStats;
    start(): Promise<void>;
    private gracefulShutdown;
    private generateFinalReport;
}
export { ParallelArbitrageBot, BotConfig };
