"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionMonitor = void 0;
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
const winston_1 = __importDefault(require("winston"));
class ProductionMonitor {
    metrics;
    alertThresholds;
    tradeHistory = [];
    logger;
    startTime;
    constructor() {
        this.startTime = Date.now();
        this.initializeMetrics();
        this.setupAlertThresholds();
        this.setupLogger();
        this.startMonitoring();
    }
    initializeMetrics() {
        this.metrics = {
            totalProfitETH: 0,
            dailyProfitETH: 0,
            hourlyProfitETH: 0,
            profitTargetProgress: 0,
            successRate24h: 0,
            avgExecutionTimeMs: 0,
            gasEfficiencyRatio: 0,
            mevBundleSuccessRate: 0,
            currentDrawdown: 0,
            riskScore: 0,
            consecutiveFailures: 0,
            circuitBreakerActive: false,
            systemUptimeHours: 0,
            lastErrorTimestamp: 0,
            memoryUsageMB: 0,
            networkLatencyMs: 0
        };
    }
    setupAlertThresholds() {
        this.alertThresholds = {
            criticalDrawdown: 0.05, // 5% drawdown
            lowSuccessRate: 0.15, // 15% success rate
            highMemoryUsage: 2000, // 2GB memory
            highLatency: 5000, // 5 second latency
            lowProfitProgress: 0.5 // 50% of expected monthly progress
        };
    }
    setupLogger() {
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                }),
                new winston_1.default.transports.File({ filename: 'monitoring.log' })
            ]
        });
    }
    startMonitoring() {
        // Start monitoring intervals
        setInterval(() => this.updateSystemMetrics(), 60000); // Every minute
        setInterval(() => this.checkCriticalAlerts(), 300000); // Every 5 minutes
        setInterval(() => this.generateHourlyReport(), 3600000); // Every hour
        setInterval(() => this.resetDailyMetrics(), 86400000); // Every 24 hours
        this.logger.info('🤖 Production monitoring initialized');
    }
    async updateSystemMetrics() {
        try {
            // Update memory usage
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            // Update system uptime
            this.metrics.systemUptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
            // Test network latency
            const start = Date.now();
            try {
                await axios_1.default.get('https://api.coingecko.com/api/v3/ping', { timeout: 5000 });
                this.metrics.networkLatencyMs = Date.now() - start;
            }
            catch (error) {
                this.metrics.networkLatencyMs = 10000; // Set high latency on failure
            }
            // Update profit target progress (assuming 15 ETH monthly target)
            const monthlyTarget = 15;
            const daysInMonth = 30;
            const currentDay = new Date().getDate();
            const expectedProgress = (currentDay / daysInMonth) * monthlyTarget;
            this.metrics.profitTargetProgress = expectedProgress > 0 ? this.metrics.totalProfitETH / expectedProgress : 0;
        }
        catch (error) {
            this.logger.error('Error updating system metrics:', error);
        }
    }
    async checkCriticalAlerts() {
        const alerts = [];
        // Check drawdown
        if (this.metrics.currentDrawdown > this.alertThresholds.criticalDrawdown) {
            alerts.push({
                title: 'Critical Drawdown Alert',
                message: `Current drawdown: ${(this.metrics.currentDrawdown * 100).toFixed(2)}%`,
                urgency: 'CRITICAL'
            });
        }
        // Check success rate
        if (this.metrics.successRate24h < this.alertThresholds.lowSuccessRate) {
            alerts.push({
                title: 'Low Success Rate Alert',
                message: `24h success rate: ${(this.metrics.successRate24h * 100).toFixed(1)}%`,
                urgency: 'HIGH'
            });
        }
        // Check memory usage
        if (this.metrics.memoryUsageMB > this.alertThresholds.highMemoryUsage) {
            alerts.push({
                title: 'High Memory Usage Alert',
                message: `Memory usage: ${this.metrics.memoryUsageMB}MB`,
                urgency: 'MEDIUM'
            });
        }
        // Check network latency
        if (this.metrics.networkLatencyMs > this.alertThresholds.highLatency) {
            alerts.push({
                title: 'High Network Latency Alert',
                message: `Network latency: ${this.metrics.networkLatencyMs}ms`,
                urgency: 'MEDIUM'
            });
        }
        // Send alerts
        for (const alert of alerts) {
            await this.sendAlert(alert);
        }
    }
    async sendAlert(alert) {
        const alertData = {
            ...alert,
            timestamp: new Date().toISOString(),
            metrics: this.metrics
        };
        // Send to multiple channels
        await Promise.allSettled([
            this.sendTelegramAlert(alertData),
            this.sendEmailAlert(alertData)
        ]);
        this.logger.error(`🚨 ${alert.title}: ${alert.message}`);
    }
    async sendTelegramAlert(alert) {
        try {
            if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
                return;
            }
            const message = `🤖 *ARBBot2025 Alert*\n\n*${alert.title}*\n${alert.message}\n\n💰 Daily Profit: ${alert.metrics.dailyProfitETH.toFixed(4)} ETH\n📊 Success Rate: ${(alert.metrics.successRate24h * 100).toFixed(1)}%\n⚡ Gas Efficiency: ${alert.metrics.gasEfficiencyRatio.toFixed(2)}:1`;
            await axios_1.default.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            });
        }
        catch (error) {
            this.logger.error('Failed to send Telegram alert:', error);
        }
    }
    async sendEmailAlert(alert) {
        try {
            if (!process.env.EMAIL_ALERT_ENDPOINT || !process.env.ALERT_EMAIL) {
                return;
            }
            await axios_1.default.post(process.env.EMAIL_ALERT_ENDPOINT, {
                to: process.env.ALERT_EMAIL,
                subject: `🚨 ARBBot2025 Critical Alert: ${alert.title}`,
                body: `
          Alert: ${alert.title}
          Message: ${alert.message}
          Urgency: ${alert.urgency}
          
          Current Metrics:
          - Daily Profit: ${alert.metrics.dailyProfitETH.toFixed(4)} ETH
          - Success Rate: ${(alert.metrics.successRate24h * 100).toFixed(1)}%
          - Gas Efficiency: ${alert.metrics.gasEfficiencyRatio.toFixed(2)}:1
          - Risk Score: ${alert.metrics.riskScore}/100
          
          Timestamp: ${alert.timestamp}
        `
            });
        }
        catch (error) {
            this.logger.error('Failed to send email alert:', error);
        }
    }
    async updateTradeMetrics(trade) {
        const tradeRecord = {
            ...trade,
            bundleAttempted: trade.bundleAttempted || false,
            timestamp: Date.now()
        };
        this.tradeHistory.push(tradeRecord);
        // Keep only last 10000 trades
        if (this.tradeHistory.length > 10000) {
            this.tradeHistory = this.tradeHistory.slice(-5000);
        }
        // Update financial metrics
        const profitETH = Number(ethers_1.ethers.formatEther(trade.profit));
        this.metrics.totalProfitETH += profitETH;
        this.metrics.dailyProfitETH += profitETH;
        this.metrics.hourlyProfitETH += profitETH;
        // Update performance metrics
        const recentTrades = this.getRecentTrades(24); // Last 24 hours
        if (recentTrades.length > 0) {
            this.metrics.successRate24h = recentTrades.filter(t => t.success).length / recentTrades.length;
            this.metrics.avgExecutionTimeMs = recentTrades.reduce((sum, t) => sum + t.executionTime, 0) / recentTrades.length;
            // Update gas efficiency
            const totalProfit = recentTrades.reduce((sum, t) => sum + Number(ethers_1.ethers.formatEther(t.profit)), 0);
            const totalGas = recentTrades.reduce((sum, t) => sum + Number(ethers_1.ethers.formatEther(t.gasCost)), 0);
            this.metrics.gasEfficiencyRatio = totalGas > 0 ? totalProfit / totalGas : 0;
            // Update MEV bundle success rate
            const bundleTrades = recentTrades.filter(t => t.bundleAttempted);
            this.metrics.mevBundleSuccessRate = bundleTrades.length > 0 ?
                bundleTrades.filter(t => t.bundleSuccess).length / bundleTrades.length : 0;
        }
        // Update consecutive failures
        if (trade.success) {
            this.metrics.consecutiveFailures = 0;
        }
        else {
            this.metrics.consecutiveFailures++;
        }
        // Update drawdown calculation
        this.updateDrawdown();
    }
    getRecentTrades(hours) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return this.tradeHistory.filter(trade => trade.timestamp > cutoff);
    }
    updateDrawdown() {
        if (this.tradeHistory.length < 2)
            return;
        let peak = 0;
        let currentValue = 0;
        let maxDrawdown = 0;
        for (const trade of this.tradeHistory) {
            currentValue += Number(ethers_1.ethers.formatEther(trade.profit));
            if (currentValue > peak) {
                peak = currentValue;
            }
            const drawdown = peak > 0 ? (peak - currentValue) / peak : 0;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        this.metrics.currentDrawdown = maxDrawdown;
    }
    async generateHourlyReport() {
        try {
            const report = {
                timestamp: new Date().toISOString(),
                hourlyProfit: this.metrics.hourlyProfitETH,
                totalProfit: this.metrics.totalProfitETH,
                successRate: this.metrics.successRate24h,
                gasEfficiency: this.metrics.gasEfficiencyRatio,
                systemHealth: this.getSystemHealthScore()
            };
            this.logger.info(`📊 Hourly Report: Profit: ${report.hourlyProfit.toFixed(4)} ETH, Success: ${(report.successRate * 100).toFixed(1)}%`);
            // Reset hourly metrics
            this.metrics.hourlyProfitETH = 0;
        }
        catch (error) {
            this.logger.error('Error generating hourly report:', error);
        }
    }
    resetDailyMetrics() {
        this.metrics.dailyProfitETH = 0;
        this.logger.info('📅 Daily metrics reset');
    }
    getSystemHealthScore() {
        let score = 100;
        // Deduct points for various issues
        if (this.metrics.successRate24h < 0.2)
            score -= 30;
        if (this.metrics.gasEfficiencyRatio < 2)
            score -= 20;
        if (this.metrics.currentDrawdown > 0.03)
            score -= 25;
        if (this.metrics.consecutiveFailures > 10)
            score -= 15;
        if (this.metrics.memoryUsageMB > 1500)
            score -= 10;
        return Math.max(0, score);
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getRecentTradeHistory(hours = 24) {
        return this.getRecentTrades(hours);
    }
    async generateDailyPerformanceReport() {
        const recentTrades = this.getRecentTrades(24);
        return {
            date: new Date().toISOString().split('T')[0],
            totalTrades: recentTrades.length,
            successfulTrades: recentTrades.filter(t => t.success).length,
            totalProfit: this.metrics.dailyProfitETH,
            avgExecutionTime: this.metrics.avgExecutionTimeMs,
            gasEfficiency: this.metrics.gasEfficiencyRatio,
            systemHealth: this.getSystemHealthScore(),
            uptime: this.metrics.systemUptimeHours
        };
    }
}
exports.ProductionMonitor = ProductionMonitor;
