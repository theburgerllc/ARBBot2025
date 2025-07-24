"use strict";
/**
 * Performance Tracker - Optimization Metrics and Analysis
 * Tracks optimization effectiveness and trading performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceTracker = void 0;
class PerformanceTracker {
    tradeHistory = [];
    optimizationHistory = [];
    performanceWindow = 24 * 60 * 60 * 1000; // 24 hours
    maxHistorySize = 10000;
    constructor(performanceWindow = 24 * 60 * 60 * 1000) {
        this.performanceWindow = performanceWindow;
    }
    recordTrade(trade) {
        this.tradeHistory.push(trade);
        // Limit history size
        if (this.tradeHistory.length > this.maxHistorySize) {
            this.tradeHistory = this.tradeHistory.slice(-this.maxHistorySize);
        }
    }
    recordOptimization(result) {
        this.optimizationHistory.push(result);
        // Limit optimization history
        if (this.optimizationHistory.length > 1000) {
            this.optimizationHistory = this.optimizationHistory.slice(-1000);
        }
    }
    calculatePerformanceMetrics() {
        const now = Date.now();
        const windowStart = now - this.performanceWindow;
        // Filter trades within the performance window
        const recentTrades = this.tradeHistory.filter(trade => trade.timestamp >= windowStart);
        if (recentTrades.length === 0) {
            return this.getDefaultMetrics();
        }
        const successfulTrades = recentTrades.filter(trade => trade.success);
        const totalTrades = recentTrades.length;
        const successRate = successfulTrades.length / totalTrades;
        // Calculate profit metrics
        const totalProfit = successfulTrades.reduce((sum, trade) => sum + trade.profit, BigInt(0));
        const avgProfitPerTrade = totalTrades > 0 ?
            totalProfit / BigInt(totalTrades) : BigInt(0);
        // Calculate gas metrics
        const totalGasUsed = recentTrades.reduce((sum, trade) => sum + trade.gasUsed, BigInt(0));
        const avgGasPerTrade = totalTrades > 0 ?
            totalGasUsed / BigInt(totalTrades) : BigInt(0);
        // Calculate gas efficiency (profit per gas unit)
        const gasEfficiency = totalGasUsed > BigInt(0) ?
            Number(totalProfit) / Number(totalGasUsed) : 0;
        // Calculate 24-hour ROI (simplified)
        const roi24h = this.calculateROI(recentTrades);
        // Calculate opportunity capture rate
        const opportunityCapture = this.calculateOpportunityCapture(recentTrades);
        // Calculate average execution time
        const avgExecutionTime = recentTrades.length > 0 ?
            recentTrades.reduce((sum, trade) => sum + trade.executionTime, 0) / recentTrades.length : 0;
        return {
            totalTrades,
            successfulTrades: successfulTrades.length,
            successRate,
            totalProfit,
            avgProfitPerTrade,
            totalGasUsed,
            avgGasPerTrade,
            gasEfficiency,
            roi24h,
            opportunityCapture,
            avgExecutionTime,
            lastUpdated: now
        };
    }
    getOptimizationEffectiveness() {
        const optimizations = this.optimizationHistory;
        if (optimizations.length === 0) {
            return {
                totalOptimizations: 0,
                successfulOptimizations: 0,
                avgImprovement: 0,
                lastOptimization: 0
            };
        }
        // Count optimizations that led to improvement
        let successfulOptimizations = 0;
        let totalImprovement = 0;
        for (const optimization of optimizations) {
            if (optimization.expectedImprovement > 0) {
                successfulOptimizations++;
                totalImprovement += optimization.expectedImprovement;
            }
        }
        const avgImprovement = successfulOptimizations > 0 ?
            totalImprovement / successfulOptimizations : 0;
        return {
            totalOptimizations: optimizations.length,
            successfulOptimizations,
            avgImprovement,
            lastOptimization: optimizations[optimizations.length - 1]?.timestamp || 0
        };
    }
    getPerformanceTrends() {
        const now = Date.now();
        const currentWindow = now - this.performanceWindow / 2; // Last 12 hours
        const previousWindow = now - this.performanceWindow; // Previous 12 hours
        const currentTrades = this.tradeHistory.filter(trade => trade.timestamp >= currentWindow);
        const previousTrades = this.tradeHistory.filter(trade => trade.timestamp >= previousWindow && trade.timestamp < currentWindow);
        // Calculate trends
        const currentMetrics = this.calculateMetricsForTrades(currentTrades);
        const previousMetrics = this.calculateMetricsForTrades(previousTrades);
        const successRateTrend = previousMetrics.successRate > 0 ?
            (currentMetrics.successRate - previousMetrics.successRate) / previousMetrics.successRate : 0;
        const profitTrend = previousMetrics.avgProfitPerTrade > 0 ?
            (Number(currentMetrics.avgProfitPerTrade) - Number(previousMetrics.avgProfitPerTrade)) /
                Number(previousMetrics.avgProfitPerTrade) : 0;
        const gasEfficiencyTrend = previousMetrics.gasEfficiency > 0 ?
            (currentMetrics.gasEfficiency - previousMetrics.gasEfficiency) / previousMetrics.gasEfficiency : 0;
        return {
            successRateTrend,
            profitTrend,
            gasEfficiencyTrend
        };
    }
    getDetailedReport() {
        const performance = this.calculatePerformanceMetrics();
        const optimization = this.getOptimizationEffectiveness();
        const trends = this.getPerformanceTrends();
        const insights = this.generateInsights(performance, trends);
        const recommendations = this.generateRecommendations(performance, trends);
        return {
            performance,
            optimization,
            trends,
            insights,
            recommendations
        };
    }
    calculateROI(trades) {
        if (trades.length === 0)
            return 0;
        const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, BigInt(0));
        const totalGasCost = trades.reduce((sum, trade) => sum + (trade.gasUsed * trade.gasPrice), BigInt(0));
        if (totalGasCost === BigInt(0))
            return 0;
        return (Number(totalProfit) / Number(totalGasCost)) * 100;
    }
    calculateOpportunityCapture(trades) {
        // Simplified opportunity capture calculation
        // In practice, this would compare executed trades to detected opportunities
        const successfulTrades = trades.filter(trade => trade.success);
        return trades.length > 0 ? (successfulTrades.length / trades.length) * 100 : 0;
    }
    calculateMetricsForTrades(trades) {
        if (trades.length === 0) {
            return {
                successRate: 0,
                avgProfitPerTrade: BigInt(0),
                gasEfficiency: 0
            };
        }
        const successfulTrades = trades.filter(trade => trade.success);
        const successRate = successfulTrades.length / trades.length;
        const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, BigInt(0));
        const avgProfitPerTrade = totalProfit / BigInt(trades.length);
        const totalGasUsed = trades.reduce((sum, trade) => sum + trade.gasUsed, BigInt(0));
        const gasEfficiency = totalGasUsed > BigInt(0) ?
            Number(totalProfit) / Number(totalGasUsed) : 0;
        return {
            successRate,
            avgProfitPerTrade,
            gasEfficiency
        };
    }
    generateInsights(performance, trends) {
        const insights = [];
        // Success rate insights
        if (performance.successRate > 0.8) {
            insights.push(`Excellent success rate: ${(performance.successRate * 100).toFixed(1)}%`);
        }
        else if (performance.successRate < 0.5) {
            insights.push(`Low success rate: ${(performance.successRate * 100).toFixed(1)}% - consider adjusting parameters`);
        }
        // Profitability insights
        if (performance.roi24h > 50) {
            insights.push(`Strong ROI: ${performance.roi24h.toFixed(1)}% in 24h`);
        }
        else if (performance.roi24h < 10) {
            insights.push(`Low ROI: ${performance.roi24h.toFixed(1)}% - optimization needed`);
        }
        // Gas efficiency insights
        if (performance.gasEfficiency > 2) {
            insights.push(`Excellent gas efficiency: ${performance.gasEfficiency.toFixed(2)} profit/gas ratio`);
        }
        else if (performance.gasEfficiency < 0.5) {
            insights.push(`Poor gas efficiency: ${performance.gasEfficiency.toFixed(2)} - reduce gas costs or increase profit targets`);
        }
        // Trend insights
        if (trends.successRateTrend > 0.1) {
            insights.push(`Success rate improving: +${(trends.successRateTrend * 100).toFixed(1)}%`);
        }
        else if (trends.successRateTrend < -0.1) {
            insights.push(`Success rate declining: ${(trends.successRateTrend * 100).toFixed(1)}%`);
        }
        return insights;
    }
    generateRecommendations(performance, trends) {
        const recommendations = [];
        // Success rate recommendations
        if (performance.successRate < 0.6) {
            recommendations.push('Consider lowering profit thresholds or increasing slippage tolerance');
        }
        // Gas efficiency recommendations
        if (performance.gasEfficiency < 1) {
            recommendations.push('Optimize gas settings or increase minimum profit thresholds');
        }
        // Trend-based recommendations
        if (trends.profitTrend < -0.2) {
            recommendations.push('Profit trending down - consider more aggressive optimization');
        }
        if (trends.gasEfficiencyTrend < -0.1) {
            recommendations.push('Gas efficiency declining - review gas price strategy');
        }
        // Volume recommendations
        if (performance.totalTrades < 10) {
            recommendations.push('Low trade volume - consider lowering profit thresholds to capture more opportunities');
        }
        return recommendations;
    }
    getDefaultMetrics() {
        return {
            totalTrades: 0,
            successfulTrades: 0,
            successRate: 0,
            totalProfit: BigInt(0),
            avgProfitPerTrade: BigInt(0),
            totalGasUsed: BigInt(0),
            avgGasPerTrade: BigInt(0),
            gasEfficiency: 0,
            roi24h: 0,
            opportunityCapture: 0,
            avgExecutionTime: 0,
            lastUpdated: Date.now()
        };
    }
    // Utility methods for external access
    getRecentTrades(count = 100) {
        return this.tradeHistory.slice(-count);
    }
    getOptimizationHistory(count = 50) {
        return this.optimizationHistory.slice(-count);
    }
    clearHistory() {
        this.tradeHistory = [];
        this.optimizationHistory = [];
    }
}
exports.PerformanceTracker = PerformanceTracker;
