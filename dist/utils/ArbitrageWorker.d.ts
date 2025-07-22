import { ArbitrageOpportunity } from './WorkerManager';
export interface ScanParams {
    chains: number[];
    tokens: string[];
    scanDepth: number;
}
export interface ExecutionResult {
    success: boolean;
    txHash?: string;
    profit?: string;
    gasUsed?: string;
    error?: string;
}
export declare class ArbitrageWorker {
    private readonly workerId;
    private providers;
    private signers;
    private liquidityFiltering;
    private dexIntegrations;
    private symbiosisIntegration;
    private gasOptimizer;
    private opportunitiesFound;
    private executionsAttempted;
    private executionsSuccessful;
    private totalProfit;
    private totalGasUsed;
    constructor(workerId: number);
    private initializeProviders;
    private initializeSigners;
    private initializeServices;
    scanForOpportunities(params: ScanParams): Promise<ArbitrageOpportunity[]>;
    private scanChainForOpportunities;
    private checkArbitrageOpportunity;
    private scanTriangularArbitrage;
    private checkTriangularOpportunity;
    private scanCrossChainOpportunities;
    private calculateConfidence;
    executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult>;
    private validateOpportunity;
    private performArbitrage;
    private getChainName;
    generateReport(): Promise<any>;
}
