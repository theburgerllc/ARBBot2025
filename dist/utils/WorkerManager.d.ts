/// <reference types="node" />
import { EventEmitter } from 'events';
export interface WorkerMessage {
    type: 'scan' | 'execute' | 'report' | 'terminate';
    payload: any;
    id: string;
    timestamp: number;
}
export interface WorkerResponse {
    type: 'opportunity' | 'execution' | 'report' | 'error';
    payload: any;
    id: string;
    workerId: number;
    timestamp: number;
    latency: number;
}
export interface ArbitrageOpportunity {
    tokenA: string;
    tokenB: string;
    chainId: number;
    dexA: string;
    dexB: string;
    amountIn: string;
    amountOut: string;
    profit: string;
    gasEstimate: string;
    confidence: number;
    route: string[];
    priceImpact: number;
}
export interface WorkerPerformance {
    workerId: number;
    opportunitiesFound: number;
    executionsAttempted: number;
    executionsSuccessful: number;
    avgLatency: number;
    totalRevenue: string;
    totalGasUsed: string;
    uptime: number;
    errors: number;
}
export declare class WorkerManager extends EventEmitter {
    private readonly workerCount;
    private readonly scanIntervalMs;
    private readonly reportIntervalMs;
    private workers;
    private workerPerformance;
    private messageQueue;
    private isRunning;
    private scanInterval;
    private reportInterval;
    private startTime;
    constructor(workerCount?: number, scanIntervalMs?: number, reportIntervalMs?: number);
    private setupWorkers;
    private createWorker;
    private handleWorkerMessage;
    private handleWorkerError;
    private updateWorkerPerformance;
    start(): Promise<void>;
    stop(): Promise<void>;
    private terminateWorker;
    private broadcastScanRequest;
    private broadcastToWorkers;
    sendToWorker(workerId: number, message: WorkerMessage): Promise<WorkerResponse>;
    private generateMessageId;
    getWorkerPerformance(workerId?: number): WorkerPerformance | WorkerPerformance[];
    private generatePerformanceReport;
    private calculateSuccessRate;
    private calculateAverageLatency;
    getActiveWorkerCount(): number;
    getTotalOpportunities(): number;
    getTotalExecutions(): number;
    getUptime(): number;
}
