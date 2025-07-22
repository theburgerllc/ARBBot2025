#!/usr/bin/env node
interface FlashbotsConfig {
    workers: number;
    bundleSize: number;
    simulate: boolean;
    verbose: boolean;
    duration: number;
    minProfitThreshold: number;
    maxGasPrice: string;
    targetChains: number[];
}
declare class FlashbotsParallelSimulator {
    private workerManager;
    private performanceReporter;
    private flashbotsProvider;
    private config;
    private stats;
    private isRunning;
    constructor(config: FlashbotsConfig);
    private initializeStats;
    private initializeFlashbots;
    private setupEventHandlers;
    private processBundleOpportunities;
    private createBundles;
    private simulateBundle;
    private createBundleTransactions;
    private createArbitrageTransaction;
    private simulateFlashbotsBundle;
    private handleBundleExecution;
    private logBundleResult;
    start(): Promise<void>;
    private gracefulShutdown;
    private generateFinalReport;
}
export { FlashbotsParallelSimulator, FlashbotsConfig };
