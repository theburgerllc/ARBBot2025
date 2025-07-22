"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerManager = void 0;
const worker_threads_1 = require("worker_threads");
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
class WorkerManager extends events_1.EventEmitter {
    workerCount;
    scanIntervalMs;
    reportIntervalMs;
    workers = new Map();
    workerPerformance = new Map();
    messageQueue = new Map();
    isRunning = false;
    scanInterval = null;
    reportInterval = null;
    startTime = 0;
    constructor(workerCount = 4, scanIntervalMs = 1000, reportIntervalMs = 60000) {
        super();
        this.workerCount = workerCount;
        this.scanIntervalMs = scanIntervalMs;
        this.reportIntervalMs = reportIntervalMs;
        this.setupWorkers();
    }
    setupWorkers() {
        for (let i = 0; i < this.workerCount; i++) {
            this.createWorker(i);
        }
    }
    createWorker(workerId) {
        try {
            const worker = new worker_threads_1.Worker(__filename, {
                workerData: { workerId, isWorker: true }
            });
            worker.on('message', (response) => {
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
        }
        catch (error) {
            console.error(`Failed to create worker ${workerId}:`, error);
        }
    }
    handleWorkerMessage(response) {
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
            const { resolve } = this.messageQueue.get(id);
            resolve(response);
            this.messageQueue.delete(id);
        }
    }
    handleWorkerError(workerId, error) {
        const performance = this.workerPerformance.get(workerId);
        if (performance) {
            performance.errors++;
            this.workerPerformance.set(workerId, performance);
        }
        this.emit('workerError', { workerId, error });
    }
    updateWorkerPerformance(workerId, messageType, latency) {
        const performance = this.workerPerformance.get(workerId);
        if (!performance)
            return;
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
    async start() {
        if (this.isRunning)
            return;
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
    async stop() {
        if (!this.isRunning)
            return;
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
        const terminationPromises = Array.from(this.workers.entries()).map(([workerId, worker]) => this.terminateWorker(workerId));
        await Promise.all(terminationPromises);
        console.log('Worker manager stopped');
    }
    async terminateWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            await worker.terminate();
            this.workers.delete(workerId);
        }
    }
    broadcastScanRequest() {
        const message = {
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
    broadcastToWorkers(message) {
        this.workers.forEach((worker, workerId) => {
            try {
                worker.postMessage(message);
            }
            catch (error) {
                console.error(`Failed to send message to worker ${workerId}:`, error);
            }
        });
    }
    async sendToWorker(workerId, message) {
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
                resolve: (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                },
                reject,
                timestamp: Date.now()
            });
            worker.postMessage(message);
        });
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getWorkerPerformance(workerId) {
        if (workerId !== undefined) {
            const performance = this.workerPerformance.get(workerId);
            if (!performance) {
                throw new Error(`Worker ${workerId} not found`);
            }
            return performance;
        }
        return Array.from(this.workerPerformance.values());
    }
    generatePerformanceReport() {
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
    calculateSuccessRate() {
        const total = Array.from(this.workerPerformance.values())
            .reduce((sum, p) => sum + p.executionsAttempted, 0);
        const successful = Array.from(this.workerPerformance.values())
            .reduce((sum, p) => sum + p.executionsSuccessful, 0);
        return total > 0 ? successful / total : 0;
    }
    calculateAverageLatency() {
        const performances = Array.from(this.workerPerformance.values());
        const totalLatency = performances.reduce((sum, p) => sum + p.avgLatency, 0);
        return performances.length > 0 ? totalLatency / performances.length : 0;
    }
    getActiveWorkerCount() {
        return this.workers.size;
    }
    getTotalOpportunities() {
        return Array.from(this.workerPerformance.values())
            .reduce((sum, p) => sum + p.opportunitiesFound, 0);
    }
    getTotalExecutions() {
        return Array.from(this.workerPerformance.values())
            .reduce((sum, p) => sum + p.executionsAttempted, 0);
    }
    getUptime() {
        return Date.now() - this.startTime;
    }
}
exports.WorkerManager = WorkerManager;
// Worker thread implementation
if (!worker_threads_1.isMainThread && worker_threads_1.workerData?.isWorker) {
    const { workerId } = worker_threads_1.workerData;
    // Import necessary modules for worker
    const { ArbitrageWorker } = require('./ArbitrageWorker');
    const worker = new ArbitrageWorker(workerId);
    worker_threads_1.parentPort?.on('message', async (message) => {
        const startTime = perf_hooks_1.performance.now();
        try {
            let response;
            switch (message.type) {
                case 'scan':
                    const opportunities = await worker.scanForOpportunities(message.payload);
                    response = {
                        type: 'opportunity',
                        payload: opportunities,
                        id: message.id,
                        workerId,
                        timestamp: Date.now(),
                        latency: perf_hooks_1.performance.now() - startTime
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
                        latency: perf_hooks_1.performance.now() - startTime
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
                        latency: perf_hooks_1.performance.now() - startTime
                    };
                    break;
                default:
                    throw new Error(`Unknown message type: ${message.type}`);
            }
            worker_threads_1.parentPort?.postMessage(response);
        }
        catch (error) {
            const errorResponse = {
                type: 'error',
                payload: { error: error.message, stack: error.stack },
                id: message.id,
                workerId,
                timestamp: Date.now(),
                latency: perf_hooks_1.performance.now() - startTime
            };
            worker_threads_1.parentPort?.postMessage(errorResponse);
        }
    });
    console.log(`Worker ${workerId} initialized`);
}
