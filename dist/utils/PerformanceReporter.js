"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
const perf_hooks_1 = require("perf_hooks");
class PerformanceReporter {
    verbose;
    opportunityLogs = [];
    executionLogs = [];
    performanceReports = [];
    lastReportTime = 0;
    startTime = perf_hooks_1.performance.now();
    constructor(verbose = false) {
        this.verbose = verbose;
    }
    logOpportunities(opportunities) {
        const timestamp = Date.now();
        opportunities.forEach((opp, index) => {
            const log = {
                timestamp,
                workerId: opp.workerId || 0,
                chain: this.getChainName(opp.chainId),
                route: this.formatRoute(opp.route),
                tokens: opp.route || [opp.tokenA, opp.tokenB],
                provider: `${opp.dexA}/${opp.dexB}`,
                netProfit: opp.profit || '0',
                gasUsed: opp.gasEstimate || '0',
                coinbaseDiff: this.calculateCoinbaseDiff(opp.profit || '0'),
                latency: opp.latency || 0
            };
            this.opportunityLogs.push(log);
            if (this.verbose) {
                this.printOpportunityLog(log);
            }
        });
        // Keep only last 1000 logs to prevent memory issues
        if (this.opportunityLogs.length > 1000) {
            this.opportunityLogs = this.opportunityLogs.slice(-1000);
        }
    }
    logExecution(result) {
        const timestamp = Date.now();
        const log = {
            timestamp,
            workerId: result.workerId || 0,
            success: result.success || false,
            txHash: result.txHash,
            profit: result.profit,
            gasUsed: result.gasUsed,
            error: result.error,
            latency: result.latency || 0
        };
        this.executionLogs.push(log);
        if (this.verbose) {
            this.printExecutionLog(log);
        }
        // Keep only last 1000 logs
        if (this.executionLogs.length > 1000) {
            this.executionLogs = this.executionLogs.slice(-1000);
        }
    }
    logPerformanceReport(report) {
        this.performanceReports.push(report);
        // Generate per-minute summary
        const timeSinceLastReport = Date.now() - this.lastReportTime;
        if (timeSinceLastReport >= 60000) { // 1 minute
            this.generateMinuteReport(report);
            this.lastReportTime = Date.now();
        }
        // Keep only last 100 reports
        if (this.performanceReports.length > 100) {
            this.performanceReports = this.performanceReports.slice(-100);
        }
    }
    printOpportunityLog(log) {
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        const profitStr = parseFloat(log.netProfit).toFixed(6);
        const latencyStr = log.latency.toFixed(2);
        console.log(`${chalk_1.default.gray(timeStr)} ${chalk_1.default.blue(`W${log.workerId}`)} ` +
            `${chalk_1.default.green(log.chain)} ${chalk_1.default.yellow(log.route)} ` +
            `${chalk_1.default.cyan(log.provider)} ${chalk_1.default.green(`+${profitStr} ETH`)} ` +
            `${chalk_1.default.red(`${log.gasUsed} gas`)} ${chalk_1.default.magenta(`${latencyStr}ms`)}`);
    }
    printExecutionLog(log) {
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        const profitStr = log.profit ? parseFloat(log.profit).toFixed(6) : '0';
        const latencyStr = log.latency.toFixed(2);
        if (log.success) {
            console.log(`${chalk_1.default.gray(timeStr)} ${chalk_1.default.blue(`W${log.workerId}`)} ` +
                `${chalk_1.default.green('✅ SUCCESS')} ${chalk_1.default.green(`+${profitStr} ETH`)} ` +
                `${chalk_1.default.red(`${log.gasUsed} gas`)} ${chalk_1.default.magenta(`${latencyStr}ms`)} ` +
                `${chalk_1.default.gray(log.txHash?.slice(0, 10) + '...')}`);
        }
        else {
            console.log(`${chalk_1.default.gray(timeStr)} ${chalk_1.default.blue(`W${log.workerId}`)} ` +
                `${chalk_1.default.red('❌ FAILED')} ${chalk_1.default.red(log.error || 'Unknown error')} ` +
                `${chalk_1.default.magenta(`${latencyStr}ms`)}`);
        }
    }
    generateMinuteReport(report) {
        const runtime = (perf_hooks_1.performance.now() - this.startTime) / 1000;
        const minutesSinceStart = Math.floor(runtime / 60);
        // Calculate per-minute statistics
        const recentOpportunities = this.opportunityLogs.filter(log => Date.now() - log.timestamp < 60000);
        const recentExecutions = this.executionLogs.filter(log => Date.now() - log.timestamp < 60000);
        const successfulExecutions = recentExecutions.filter(log => log.success);
        const totalProfit = successfulExecutions.reduce((sum, log) => sum + parseFloat(log.profit || '0'), 0);
        const totalGasUsed = successfulExecutions.reduce((sum, log) => sum + parseFloat(log.gasUsed || '0'), 0);
        const avgLatency = recentOpportunities.length > 0
            ? recentOpportunities.reduce((sum, log) => sum + log.latency, 0) / recentOpportunities.length
            : 0;
        const coinbaseDiff = totalProfit * 0.1; // Estimate 10% MEV extraction
        console.log('');
        console.log(chalk_1.default.yellow('📊 Per-Minute Report'));
        console.log(chalk_1.default.yellow('=================='));
        console.log(`${chalk_1.default.cyan('Minute:')} ${minutesSinceStart}`);
        console.log(`${chalk_1.default.cyan('Active Workers:')} ${report.activeWorkers}/${report.totalWorkers}`);
        console.log(`${chalk_1.default.cyan('Opportunities:')} ${recentOpportunities.length}`);
        console.log(`${chalk_1.default.cyan('Executions:')} ${recentExecutions.length}`);
        console.log(`${chalk_1.default.cyan('Success Rate:')} ${(report.successRate * 100).toFixed(1)}%`);
        console.log(`${chalk_1.default.cyan('Total Profit:')} ${totalProfit.toFixed(6)} ETH`);
        console.log(`${chalk_1.default.cyan('Total Gas:')} ${totalGasUsed.toFixed(6)} ETH`);
        console.log(`${chalk_1.default.cyan('Net Profit:')} ${(totalProfit - totalGasUsed).toFixed(6)} ETH`);
        console.log(`${chalk_1.default.cyan('Coinbase Diff:')} ${coinbaseDiff.toFixed(6)} ETH`);
        console.log(`${chalk_1.default.cyan('Avg Latency:')} ${avgLatency.toFixed(2)}ms`);
        console.log('');
        // Worker breakdown
        if (this.verbose) {
            console.log(chalk_1.default.blue('Worker Breakdown:'));
            report.workerDetails.forEach((worker) => {
                console.log(`  Worker ${worker.workerId}: ` +
                    `${worker.opportunitiesFound} opps, ` +
                    `${worker.executionsAttempted} exec, ` +
                    `${(worker.successRate * 100).toFixed(1)}% success`);
            });
            console.log('');
        }
    }
    formatRoute(route) {
        if (!route || route.length === 0)
            return 'Unknown';
        if (route.length === 2) {
            return `${this.getTokenSymbol(route[0])}/${this.getTokenSymbol(route[1])}`;
        }
        else if (route.length > 2) {
            return `${this.getTokenSymbol(route[0])}→${this.getTokenSymbol(route[route.length - 1])}`;
        }
        return route.join('→');
    }
    getTokenSymbol(address) {
        // Common token mappings
        const tokenMap = {
            '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1': 'WETH',
            '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': 'USDC',
            '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f': 'WBTC',
            '0x912CE59144191C1204E64559FE8253a0e49E6548': 'ARB',
            '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': 'USDT',
            '0x4200000000000000000000000000000000000006': 'WETH',
            '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': 'USDC',
            '0x68f180fcCe6836688e9084f035309E29Bf0A2095': 'WBTC',
            '0x4200000000000000000000000000000000000042': 'OP',
            '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58': 'USDT'
        };
        return tokenMap[address] || address.slice(0, 6) + '...';
    }
    getChainName(chainId) {
        const chainNames = {
            1: 'ETH',
            10: 'OP',
            42161: 'ARB',
            8453: 'BASE',
            137: 'POLY'
        };
        return chainNames[chainId] || `Chain${chainId}`;
    }
    calculateCoinbaseDiff(profit) {
        // Estimate coinbase difference as 10% of profit
        return (parseFloat(profit) * 0.1).toFixed(6);
    }
    getFinalSummary() {
        const runtime = (perf_hooks_1.performance.now() - this.startTime) / 1000;
        const successfulExecutions = this.executionLogs.filter(log => log.success);
        const totalProfit = successfulExecutions.reduce((sum, log) => sum + parseFloat(log.profit || '0'), 0);
        const totalGasUsed = successfulExecutions.reduce((sum, log) => sum + parseFloat(log.gasUsed || '0'), 0);
        const avgLatency = this.opportunityLogs.length > 0
            ? this.opportunityLogs.reduce((sum, log) => sum + log.latency, 0) / this.opportunityLogs.length
            : 0;
        const successRate = this.executionLogs.length > 0
            ? successfulExecutions.length / this.executionLogs.length
            : 0;
        const bestProfit = Math.max(...successfulExecutions.map(log => parseFloat(log.profit || '0')));
        const coinbaseDiff = totalProfit * 0.1;
        return {
            totalOpportunities: this.opportunityLogs.length,
            totalExecutions: this.executionLogs.length,
            totalProfit: totalProfit.toFixed(6),
            totalGasUsed: totalGasUsed.toFixed(6),
            avgLatency: avgLatency,
            successRate: successRate,
            bestProfit: bestProfit.toFixed(6),
            coinbaseDiff: coinbaseDiff.toFixed(6),
            runtime: runtime
        };
    }
    exportLogs() {
        return {
            opportunities: [...this.opportunityLogs],
            executions: [...this.executionLogs],
            reports: [...this.performanceReports]
        };
    }
    clearLogs() {
        this.opportunityLogs = [];
        this.executionLogs = [];
        this.performanceReports = [];
    }
    getStats() {
        const successfulExecutions = this.executionLogs.filter(log => log.success);
        const avgLatency = this.opportunityLogs.length > 0
            ? this.opportunityLogs.reduce((sum, log) => sum + log.latency, 0) / this.opportunityLogs.length
            : 0;
        const memoryUsage = (this.opportunityLogs.length * 200 + // Rough estimate per log
            this.executionLogs.length * 150 +
            this.performanceReports.length * 500) / 1024 / 1024; // Convert to MB
        return {
            totalOpportunities: this.opportunityLogs.length,
            totalExecutions: this.executionLogs.length,
            successRate: this.executionLogs.length > 0 ? successfulExecutions.length / this.executionLogs.length : 0,
            avgLatency: avgLatency,
            memoryUsage: memoryUsage
        };
    }
}
exports.PerformanceReporter = PerformanceReporter;
