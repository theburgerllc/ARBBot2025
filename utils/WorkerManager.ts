import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

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

export class WorkerManager extends EventEmitter {
  private workers: Map<number, Worker> = new Map();
  private workerPerformance: Map<number, WorkerPerformance> = new Map();
  private messageQueue: Map<string, { resolve: Function; reject: Function; timestamp: number }> = new Map();
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private reportInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  constructor(
    private readonly workerCount: number = 4,
    private readonly scanIntervalMs: number = 1000,
    private readonly reportIntervalMs: number = 60000
  ) {
    super();
    this.setupWorkers();
  }

  private setupWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      this.createWorker(i);
    }
  }

  private createWorker(workerId: number): void {
    try {
      const worker = new Worker(__filename, {
        workerData: { workerId, isWorker: true }
      });

      worker.on('message', (response: WorkerResponse) => {
        this.handleWorkerMessage(response);
      });

      worker.on('error', (error) => {
        console.error(`Worker ${workerId} error:`, error);
        this.handleWorkerError(workerId, error);
      });

      worker.on('exit', (code) => {
        console.log(`Worker ${workerId} exited with code ${code}`);
        if (this.isRunning) {
          // Restart worker if it crashes during operation
          setTimeout(() => this.createWorker(workerId), 1000);
        }
      });

      this.workers.set(workerId, worker);
      this.workerPerformance.set(workerId, {
        workerId,
        opportunitiesFound: 0,
        executionsAttempted: 0,
        executionsSuccessful: 0,
        avgLatency: 0,
        totalRevenue: '0',
        totalGasUsed: '0',
        uptime: 0,
        errors: 0
      });

      console.log(`Worker ${workerId} created successfully`);
    } catch (error) {
      console.error(`Failed to create worker ${workerId}:`, error);
    }
  }

  private handleWorkerMessage(response: WorkerResponse): void {
    const { type, payload, id, workerId, timestamp, latency } = response;

    // Update worker performance metrics
    this.updateWorkerPerformance(workerId, type, latency);

    // Handle message based on type
    switch (type) {
      case 'opportunity':
        this.emit('opportunity', payload);
        break;
      case 'execution':
        this.emit('execution', payload);
        break;
      case 'report':
        this.emit('report', payload);
        break;
      case 'error':
        this.emit('error', payload);
        break;
    }

    // Resolve pending message if exists
    if (this.messageQueue.has(id)) {
      const { resolve } = this.messageQueue.get(id)!;
      resolve(response);
      this.messageQueue.delete(id);
    }
  }

  private handleWorkerError(workerId: number, error: Error): void {
    const performance = this.workerPerformance.get(workerId);
    if (performance) {
      performance.errors++;
      this.workerPerformance.set(workerId, performance);
    }

    this.emit('workerError', { workerId, error });
  }

  private updateWorkerPerformance(workerId: number, messageType: string, latency: number): void {
    const performance = this.workerPerformance.get(workerId);
    if (!performance) return;

    switch (messageType) {
      case 'opportunity':
        performance.opportunitiesFound++;
        break;
      case 'execution':
        performance.executionsAttempted++;
        // Assume success for now - would need more detailed response
        performance.executionsSuccessful++;
        break;
    }

    // Update average latency
    const totalLatency = performance.avgLatency * performance.opportunitiesFound + latency;
    performance.avgLatency = totalLatency / (performance.opportunitiesFound + 1);

    // Update uptime
    performance.uptime = Date.now() - this.startTime;

    this.workerPerformance.set(workerId, performance);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();

    // Start scanning interval
    this.scanInterval = setInterval(() => {
      this.broadcastScanRequest();
    }, this.scanIntervalMs);

    // Start reporting interval
    this.reportInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, this.reportIntervalMs);

    console.log(`Worker manager started with ${this.workerCount} workers`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clear intervals
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.entries()).map(
      ([workerId, worker]) => this.terminateWorker(workerId)
    );

    await Promise.all(terminationPromises);
    console.log('Worker manager stopped');
  }

  private async terminateWorker(workerId: number): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(workerId);
    }
  }

  private broadcastScanRequest(): void {
    const message: WorkerMessage = {
      type: 'scan',
      payload: {
        chains: [42161, 10, 8453], // Arbitrum, Optimism, Base
        tokens: [], // Will be populated by LiquidityFiltering
        scanDepth: 3
      },
      id: this.generateMessageId(),
      timestamp: Date.now()
    };

    this.broadcastToWorkers(message);
  }

  private broadcastToWorkers(message: WorkerMessage): void {
    this.workers.forEach((worker, workerId) => {
      try {
        worker.postMessage(message);
      } catch (error) {
        console.error(`Failed to send message to worker ${workerId}:`, error);
      }
    });
  }

  async sendToWorker(workerId: number, message: WorkerMessage): Promise<WorkerResponse> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageQueue.delete(message.id);
        reject(new Error(`Worker ${workerId} timeout`));
      }, 30000); // 30 second timeout

      this.messageQueue.set(message.id, {
        resolve: (response: WorkerResponse) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject,
        timestamp: Date.now()
      });

      worker.postMessage(message);
    });
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getWorkerPerformance(workerId?: number): WorkerPerformance | WorkerPerformance[] {
    if (workerId !== undefined) {
      const performance = this.workerPerformance.get(workerId);
      if (!performance) {
        throw new Error(`Worker ${workerId} not found`);
      }
      return performance;
    }
    return Array.from(this.workerPerformance.values());
  }

  private generatePerformanceReport(): void {
    const report = {
      timestamp: Date.now(),
      totalWorkers: this.workerCount,
      activeWorkers: this.workers.size,
      totalOpportunities: Array.from(this.workerPerformance.values())
        .reduce((sum, p) => sum + p.opportunitiesFound, 0),
      totalExecutions: Array.from(this.workerPerformance.values())
        .reduce((sum, p) => sum + p.executionsAttempted, 0),
      successRate: this.calculateSuccessRate(),
      avgLatency: this.calculateAverageLatency(),
      workerDetails: Array.from(this.workerPerformance.values())
    };

    this.emit('performanceReport', report);
  }

  private calculateSuccessRate(): number {
    const total = Array.from(this.workerPerformance.values())
      .reduce((sum, p) => sum + p.executionsAttempted, 0);
    const successful = Array.from(this.workerPerformance.values())
      .reduce((sum, p) => sum + p.executionsSuccessful, 0);
    
    return total > 0 ? successful / total : 0;
  }

  private calculateAverageLatency(): number {
    const performances = Array.from(this.workerPerformance.values());
    const totalLatency = performances.reduce((sum, p) => sum + p.avgLatency, 0);
    return performances.length > 0 ? totalLatency / performances.length : 0;
  }

  getActiveWorkerCount(): number {
    return this.workers.size;
  }

  getTotalOpportunities(): number {
    return Array.from(this.workerPerformance.values())
      .reduce((sum, p) => sum + p.opportunitiesFound, 0);
  }

  getTotalExecutions(): number {
    return Array.from(this.workerPerformance.values())
      .reduce((sum, p) => sum + p.executionsAttempted, 0);
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Worker thread implementation
if (!isMainThread && workerData?.isWorker) {
  const { workerId } = workerData;
  
  // Import necessary modules for worker
  const { ArbitrageWorker } = require('./ArbitrageWorker');
  
  const worker = new ArbitrageWorker(workerId);
  
  parentPort?.on('message', async (message: WorkerMessage) => {
    const startTime = performance.now();
    
    try {
      let response: WorkerResponse;
      
      switch (message.type) {
        case 'scan':
          const opportunities = await worker.scanForOpportunities(message.payload);
          response = {
            type: 'opportunity',
            payload: opportunities,
            id: message.id,
            workerId,
            timestamp: Date.now(),
            latency: performance.now() - startTime
          };
          break;
          
        case 'execute':
          const result = await worker.executeArbitrage(message.payload);
          response = {
            type: 'execution',
            payload: result,
            id: message.id,
            workerId,
            timestamp: Date.now(),
            latency: performance.now() - startTime
          };
          break;
          
        case 'report':
          const report = await worker.generateReport();
          response = {
            type: 'report',
            payload: report,
            id: message.id,
            workerId,
            timestamp: Date.now(),
            latency: performance.now() - startTime
          };
          break;
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
      
      parentPort?.postMessage(response);
    } catch (error) {
      const errorResponse: WorkerResponse = {
        type: 'error',
        payload: { error: (error as Error).message, stack: (error as Error).stack },
        id: message.id,
        workerId,
        timestamp: Date.now(),
        latency: performance.now() - startTime
      };
      
      parentPort?.postMessage(errorResponse);
    }
  });
  
  console.log(`Worker ${workerId} initialized`);
}

