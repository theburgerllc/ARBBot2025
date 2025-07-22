"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DryRunMonitor = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DryRunMonitor {
    monitoringActive = false;
    stats = {
        startTime: Date.now(),
        currentTime: Date.now(),
        durationMinutes: 0,
        totalOpportunities: 0,
        profitableOpportunities: 0,
        currentProfit: '0.0000',
        lastCycleTime: 'N/A',
        memoryUsageMB: 0,
        systemStatus: 'idle'
    };
    async startMonitoring() {
        console.log(chalk_1.default.blue('🔍 ARBBot2025 Dry Run Monitor Starting...\n'));
        this.monitoringActive = true;
        // Display header
        this.displayHeader();
        // Start monitoring loop
        const monitorInterval = setInterval(async () => {
            if (!this.monitoringActive) {
                clearInterval(monitorInterval);
                return;
            }
            await this.updateStats();
            this.displayStats();
        }, 5000); // Update every 5 seconds
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log(chalk_1.default.yellow('\n📊 Monitoring stopped by user'));
            this.monitoringActive = false;
            clearInterval(monitorInterval);
            process.exit(0);
        });
    }
    displayHeader() {
        console.clear();
        console.log(chalk_1.default.blue('════════════════════════════════════════════════════════════════'));
        console.log(chalk_1.default.blue('                 ARBBot2025 DRY RUN MONITOR                    '));
        console.log(chalk_1.default.blue('════════════════════════════════════════════════════════════════'));
        console.log(chalk_1.default.gray('Press Ctrl+C to stop monitoring\n'));
    }
    async updateStats() {
        this.stats.currentTime = Date.now();
        this.stats.durationMinutes = (this.stats.currentTime - this.stats.startTime) / (1000 * 60);
        // Update memory usage
        const memUsage = process.memoryUsage();
        this.stats.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        // Try to read latest log data
        await this.parseLogFiles();
        // Check if dry run process is still running
        await this.checkProcessStatus();
    }
    async parseLogFiles() {
        try {
            // Check for recent dry run log files
            const logFiles = await this.getRecentLogFiles();
            if (logFiles.length > 0) {
                const latestLog = logFiles[0];
                await this.parseLogFile(latestLog);
            }
        }
        catch (error) {
            // Logs not available yet, continue monitoring
        }
    }
    async getRecentLogFiles() {
        try {
            const { stdout } = await execAsync('find logs -name "mainnet-dry-run-*.json" -mmin -5 2>/dev/null || echo ""');
            return stdout.trim().split('\n').filter(line => line.length > 0);
        }
        catch (error) {
            return [];
        }
    }
    async parseLogFile(logFile) {
        try {
            const content = fs_1.default.readFileSync(logFile, 'utf8');
            const logData = JSON.parse(content);
            if (logData.summary) {
                this.stats.totalOpportunities = logData.summary.totalOpportunitiesDetected || 0;
                this.stats.profitableOpportunities = logData.summary.profitableOpportunities || 0;
                // Convert BigInt to string for display
                const profitBigInt = BigInt(logData.summary.totalEstimatedProfit || '0');
                this.stats.currentProfit = (Number(profitBigInt) / 1e18).toFixed(4);
            }
            if (logData.cycleResults && logData.cycleResults.length > 0) {
                const lastCycle = logData.cycleResults[logData.cycleResults.length - 1];
                this.stats.lastCycleTime = new Date(lastCycle.timestamp).toLocaleTimeString();
            }
        }
        catch (error) {
            // Log parsing failed, continue with current stats
        }
    }
    async checkProcessStatus() {
        try {
            // Check if mainnet-dry-run process is running
            const { stdout } = await execAsync('pgrep -f "mainnet-dry-run" || echo "none"');
            if (stdout.trim() === 'none') {
                this.stats.systemStatus = 'idle';
            }
            else {
                this.stats.systemStatus = 'running';
            }
        }
        catch (error) {
            this.stats.systemStatus = 'error';
        }
    }
    displayStats() {
        // Clear previous stats (keep header)
        process.stdout.write('\x1b[8;1H'); // Move cursor to line 8
        process.stdout.write('\x1b[J'); // Clear from cursor to end
        const durationHours = this.stats.durationMinutes / 60;
        const successRate = this.stats.totalOpportunities > 0 ?
            (this.stats.profitableOpportunities / this.stats.totalOpportunities * 100) : 0;
        // Status indicator
        const statusEmoji = this.stats.systemStatus === 'running' ? '🟢' :
            this.stats.systemStatus === 'idle' ? '🟡' : '🔴';
        console.log(chalk_1.default.cyan('📊 REAL-TIME STATISTICS'));
        console.log(chalk_1.default.cyan('========================'));
        console.log(chalk_1.default.white(`System Status: ${statusEmoji} ${this.stats.systemStatus.toUpperCase()}`));
        console.log(chalk_1.default.white(`Duration: ${durationHours.toFixed(2)} hours (${this.stats.durationMinutes.toFixed(1)} minutes)`));
        console.log(chalk_1.default.white(`Last Cycle: ${this.stats.lastCycleTime}`));
        console.log('');
        console.log(chalk_1.default.green('💰 OPPORTUNITY TRACKING'));
        console.log(chalk_1.default.green('========================'));
        console.log(chalk_1.default.white(`Total Opportunities: ${this.stats.totalOpportunities}`));
        console.log(chalk_1.default.white(`Profitable Opportunities: ${this.stats.profitableOpportunities}`));
        console.log(chalk_1.default.white(`Success Rate: ${successRate.toFixed(1)}% ${this.getPerformanceEmoji(successRate, 20)}`));
        console.log(chalk_1.default.white(`Estimated Profit: ${this.stats.currentProfit} ETH`));
        if (durationHours > 0) {
            const hourlyRate = parseFloat(this.stats.currentProfit) / durationHours;
            const projectedDaily = hourlyRate * 24;
            const projectedMonthly = projectedDaily * 30;
            console.log(chalk_1.default.white(`Hourly Rate: ${hourlyRate.toFixed(4)} ETH/hour`));
            console.log(chalk_1.default.white(`Projected Daily: ${projectedDaily.toFixed(3)} ETH/day`));
            console.log(chalk_1.default.white(`Projected Monthly: ${projectedMonthly.toFixed(1)} ETH/month ${this.getPerformanceEmoji(projectedMonthly, 5)}`));
        }
        console.log('');
        console.log(chalk_1.default.gray('🖥️ SYSTEM RESOURCES'));
        console.log(chalk_1.default.gray('==================='));
        console.log(chalk_1.default.white(`Memory Usage: ${this.stats.memoryUsageMB}MB ${this.getResourceEmoji(this.stats.memoryUsageMB, 1000)}`));
        console.log(chalk_1.default.white(`CPU Load: ${this.getCPUUsage()}%`));
        console.log('');
        // Progress indicators
        this.displayProgressIndicators(durationHours);
        console.log(chalk_1.default.blue('────────────────────────────────────────────────────────────────'));
        console.log(chalk_1.default.gray(`Last Updated: ${new Date().toLocaleTimeString()}`));
        console.log(chalk_1.default.gray('Monitoring... Press Ctrl+C to stop'));
    }
    displayProgressIndicators(durationHours) {
        const targetDuration = parseFloat(process.env.DRY_RUN_DURATION_HOURS || '4');
        const progress = Math.min(durationHours / targetDuration * 100, 100);
        console.log(chalk_1.default.yellow('⏱️ PROGRESS TRACKING'));
        console.log(chalk_1.default.yellow('===================='));
        console.log(chalk_1.default.white(`Duration Progress: ${this.createProgressBar(progress, 30)} ${progress.toFixed(1)}%`));
        if (this.stats.totalOpportunities > 0) {
            const targetOpportunities = Math.max(50, this.stats.totalOpportunities); // Dynamic target
            const opportunityProgress = Math.min(this.stats.totalOpportunities / targetOpportunities * 100, 100);
            console.log(chalk_1.default.white(`Opportunity Progress: ${this.createProgressBar(opportunityProgress, 30)} ${opportunityProgress.toFixed(1)}%`));
        }
        console.log('');
    }
    createProgressBar(percentage, width) {
        const filled = Math.round(percentage / 100 * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    getPerformanceEmoji(value, threshold) {
        if (value >= threshold * 1.5)
            return '🔥'; // Excellent
        if (value >= threshold)
            return '✅'; // Good
        if (value >= threshold * 0.7)
            return '⚠️'; // Warning
        return '❌'; // Poor
    }
    getResourceEmoji(value, threshold) {
        if (value >= threshold * 2)
            return '🔴'; // High usage
        if (value >= threshold)
            return '🟡'; // Medium usage
        return '🟢'; // Low usage
    }
    getCPUUsage() {
        // Simplified CPU usage estimation based on memory growth
        const baseUsage = Math.min(this.stats.memoryUsageMB / 10, 100);
        return baseUsage.toFixed(1);
    }
}
exports.DryRunMonitor = DryRunMonitor;
// Command line interface
async function main() {
    const monitor = new DryRunMonitor();
    console.log(chalk_1.default.blue('🚀 Starting ARBBot2025 Dry Run Monitor...'));
    console.log(chalk_1.default.gray('This will monitor the dry run in real-time\n'));
    try {
        await monitor.startMonitoring();
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Monitoring failed:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
