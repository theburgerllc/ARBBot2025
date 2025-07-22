"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveProfitManager = void 0;
const ethers_1 = require("ethers");
// OPTIMIZATION: Adaptive profit thresholds for maximum capture rate
class AdaptiveProfitManager {
    providers;
    config;
    recentProfits = [];
    performanceHistory = new Map();
    constructor(providers) {
        this.providers = providers;
        this.config = {
            baseThresholdBps: 30, // 0.3% base threshold
            volatilityAdjustment: {
                'low': 0.8, // Lower threshold in low volatility
                'medium': 1.0, // Normal threshold
                'high': 1.4 // Higher threshold in high volatility
            },
            liquidityAdjustment: {
                'thin': 1.5, // Higher threshold in thin liquidity
                'normal': 1.0,
                'deep': 0.9 // Lower threshold in deep liquidity
            },
            competitionAdjustment: {
                'low': 0.7, // Lower threshold with low competition
                'medium': 1.0,
                'high': 1.3 // Higher threshold with high competition
            },
            timeAdjustment: {
                'quiet': 0.8, // Lower threshold during quiet periods
                'active': 1.0,
                'peak': 1.2 // Higher threshold during peak times
            },
            gasRatioMax: 0.3 // Max 30% of profit on gas
        };
    }
    // MAIN FUNCTION: Calculate optimal profit threshold
    async calculateOptimalThreshold(tokenPair, tradeSize, estimatedGasCost, chainId) {
        const reasoning = [];
        // Assess current market conditions
        const conditions = await this.assessMarketConditions(tokenPair, chainId);
        reasoning.push(`Market conditions: V=${conditions.volatility}, L=${conditions.liquidity}, C=${conditions.competition}, T=${conditions.timeOfDay}`);
        // Calculate adaptive threshold
        let threshold = this.config.baseThresholdBps;
        // Apply volatility adjustment
        const volMultiplier = this.config.volatilityAdjustment[conditions.volatility];
        threshold *= volMultiplier;
        reasoning.push(`Volatility (${conditions.volatility}): ${volMultiplier}x`);
        // Apply liquidity adjustment
        const liqMultiplier = this.config.liquidityAdjustment[conditions.liquidity];
        threshold *= liqMultiplier;
        reasoning.push(`Liquidity (${conditions.liquidity}): ${liqMultiplier}x`);
        // Apply competition adjustment
        const compMultiplier = this.config.competitionAdjustment[conditions.competition];
        threshold *= compMultiplier;
        reasoning.push(`Competition (${conditions.competition}): ${compMultiplier}x`);
        // Apply time-of-day adjustment
        const timeMultiplier = this.config.timeAdjustment[conditions.timeOfDay];
        threshold *= timeMultiplier;
        reasoning.push(`Time (${conditions.timeOfDay}): ${timeMultiplier}x`);
        // Calculate minimum profit in wei from threshold
        const minProfitFromThreshold = (tradeSize * BigInt(Math.round(threshold))) / 10000n;
        // Ensure gas cost doesn't exceed maximum ratio
        const minProfitFromGas = estimatedGasCost * BigInt(Math.round(1 / this.config.gasRatioMax));
        const gasRatio = Number(estimatedGasCost) / Number(minProfitFromGas);
        // Use the higher of the two requirements
        const minProfitWei = minProfitFromThreshold > minProfitFromGas ? minProfitFromThreshold : minProfitFromGas;
        // Adjust based on learning from recent performance
        const learningAdjustment = await this.applyMachineLearningAdjustment(conditions);
        const finalThreshold = threshold * learningAdjustment;
        const finalMinProfit = (minProfitWei * BigInt(Math.round(learningAdjustment * 100))) / 100n;
        if (learningAdjustment !== 1.0) {
            reasoning.push(`ML adjustment: ${learningAdjustment.toFixed(2)}x based on recent performance`);
        }
        // Determine recommendation
        let recommendation;
        if (finalThreshold < 25)
            recommendation = 'aggressive';
        else if (finalThreshold > 50)
            recommendation = 'conservative';
        else
            recommendation = 'balanced';
        // Store for learning
        this.recordOpportunity(finalMinProfit, conditions, gasRatio);
        return {
            thresholdBps: Math.round(finalThreshold),
            minProfitWei: finalMinProfit,
            recommendation,
            reasoning,
            conditions,
            gasRatioCheck: {
                ratio: gasRatio,
                withinLimits: gasRatio <= this.config.gasRatioMax,
                requiredProfit: minProfitFromGas
            }
        };
    }
    // OPTIMIZATION: Comprehensive market condition assessment
    async assessMarketConditions(tokenPair, chainId) {
        const [volatility, liquidity, competition, congestion, timeOfDay] = await Promise.all([
            this.assessVolatility(tokenPair, chainId),
            this.assessLiquidity(tokenPair, chainId),
            this.assessCompetition(chainId),
            this.assessNetworkCongestion(chainId),
            this.assessTimeOfDay()
        ]);
        return {
            volatility,
            liquidity,
            competition,
            networkCongestion: congestion,
            timeOfDay
        };
    }
    async assessVolatility(tokenPair, chainId) {
        try {
            // Calculate combined volatility of token pair
            const volatilities = await Promise.all([
                this.getTokenVolatility(tokenPair[0], chainId),
                this.getTokenVolatility(tokenPair[1], chainId)
            ]);
            const avgVolatility = (volatilities[0] + volatilities[1]) / 2;
            if (avgVolatility < 0.02)
                return 'low'; // <2% daily volatility
            if (avgVolatility < 0.05)
                return 'medium'; // 2-5% daily volatility
            return 'high'; // >5% daily volatility
        }
        catch (error) {
            return 'medium'; // Default assumption
        }
    }
    async assessLiquidity(tokenPair, chainId) {
        try {
            // Estimate combined liquidity across major DEXs
            const totalLiquidity = await this.estimateTotalLiquidity(tokenPair, chainId);
            const liquidityETH = Number((0, ethers_1.formatUnits)(totalLiquidity, 18));
            if (liquidityETH < 50)
                return 'thin'; // <50 ETH total liquidity
            if (liquidityETH < 500)
                return 'normal'; // 50-500 ETH
            return 'deep'; // >500 ETH
        }
        catch (error) {
            return 'normal'; // Default assumption
        }
    }
    async assessCompetition(chainId) {
        try {
            // Estimate competition based on mempool activity and gas prices
            const provider = this.providers.get(chainId);
            if (!provider)
                return 'medium';
            const feeData = await provider.getFeeData();
            const gasPrice = Number((0, ethers_1.formatUnits)(feeData.gasPrice || 0n, "gwei"));
            // Higher gas prices generally indicate more competition
            if (gasPrice < 20)
                return 'low';
            if (gasPrice < 80)
                return 'medium';
            return 'high';
        }
        catch (error) {
            return 'medium';
        }
    }
    async assessNetworkCongestion(chainId) {
        try {
            const provider = this.providers.get(chainId);
            if (!provider)
                return 'medium';
            const feeData = await provider.getFeeData();
            const baseFee = Number((0, ethers_1.formatUnits)(feeData.gasPrice || 0n, "gwei"));
            // Network-specific thresholds
            let thresholds;
            if (chainId === 42161) { // Arbitrum
                thresholds = [0.1, 0.5];
            }
            else if (chainId === 10) { // Optimism
                thresholds = [0.01, 0.1];
            }
            else { // Ethereum mainnet
                thresholds = [20, 80];
            }
            if (baseFee < thresholds[0])
                return 'low';
            if (baseFee < thresholds[1])
                return 'medium';
            return 'high';
        }
        catch (error) {
            return 'medium';
        }
    }
    assessTimeOfDay() {
        const hour = new Date().getUTCHours();
        // Define activity periods (UTC)
        if (hour >= 2 && hour < 8)
            return 'quiet'; // Asian quiet period
        if (hour >= 13 && hour < 17)
            return 'peak'; // US market hours
        if (hour >= 8 && hour < 13)
            return 'active'; // European hours
        return 'active'; // Default to active
    }
    // OPTIMIZATION: Machine learning from recent performance
    async applyMachineLearningAdjustment(conditions) {
        const conditionKey = `${conditions.volatility}_${conditions.liquidity}_${conditions.competition}_${conditions.timeOfDay}`;
        const recentData = this.getRecentPerformanceForConditions(conditions);
        if (recentData.length < 5)
            return 1.0; // Need more data
        // Calculate performance metrics
        const successRate = recentData.filter(d => d.success).length / recentData.length;
        const avgGasRatio = recentData.reduce((sum, d) => sum + d.gasRatio, 0) / recentData.length;
        let adjustment = 1.0;
        // If success rate is low, make thresholds more aggressive (lower)
        if (successRate < 0.15) {
            adjustment *= 0.85; // 15% more aggressive
        }
        else if (successRate > 0.40) {
            adjustment *= 1.1; // 10% more conservative (higher thresholds)
        }
        // If gas ratios are consistently high, increase thresholds
        if (avgGasRatio > 0.25) {
            adjustment *= 1.15; // 15% higher thresholds to improve gas efficiency
        }
        return Math.max(0.5, Math.min(2.0, adjustment)); // Bound adjustments
    }
    getRecentPerformanceForConditions(conditions) {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return this.recentProfits
            .filter(p => p.timestamp > oneDayAgo)
            .filter(p => this.conditionsMatch(p.conditions, conditions))
            .map(p => ({
            profit: p.profit,
            success: p.success,
            gasRatio: p.gasRatio,
            timestamp: p.timestamp
        }));
    }
    conditionsMatch(a, b) {
        return a.volatility === b.volatility &&
            a.liquidity === b.liquidity &&
            a.competition === b.competition &&
            a.timeOfDay === b.timeOfDay;
    }
    // OPTIMIZATION: Record opportunity for learning
    recordOpportunity(profit, conditions, gasRatio) {
        this.recentProfits.push({
            profit,
            timestamp: Date.now(),
            conditions,
            success: profit > 0n, // Will be updated when trade executes
            gasRatio
        });
        // Keep only recent data (last 7 days)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        this.recentProfits = this.recentProfits.filter(p => p.timestamp > weekAgo);
    }
    // Update trade outcome for learning
    updateTradeOutcome(profit, actualGasCost, success, timestamp) {
        // Find the corresponding opportunity record
        const opportunity = this.recentProfits.find(p => Math.abs(p.timestamp - timestamp) < 60000 && // Within 1 minute
            p.profit === profit);
        if (opportunity) {
            opportunity.success = success;
            opportunity.gasRatio = Number(actualGasCost) / Number(profit);
        }
    }
    // OPTIMIZATION: Get threshold recommendations for different strategies
    async getThresholdRecommendations(tokenPair, tradeSize, estimatedGasCost, chainId) {
        const baseResult = await this.calculateOptimalThreshold(tokenPair, tradeSize, estimatedGasCost, chainId);
        // Create variations
        const conservative = {
            ...baseResult,
            thresholdBps: Math.round(baseResult.thresholdBps * 1.4),
            minProfitWei: (baseResult.minProfitWei * 140n) / 100n,
            recommendation: 'conservative'
        };
        const aggressive = {
            ...baseResult,
            thresholdBps: Math.round(baseResult.thresholdBps * 0.7),
            minProfitWei: (baseResult.minProfitWei * 70n) / 100n,
            recommendation: 'aggressive'
        };
        return {
            conservative,
            balanced: baseResult,
            aggressive
        };
    }
    // Helper methods for market assessment
    async getTokenVolatility(token, chainId) {
        // Placeholder - would calculate from historical price data
        return 0.03; // 3% default volatility
    }
    async estimateTotalLiquidity(tokenPair, chainId) {
        // Placeholder - would query multiple DEX pools
        return (0, ethers_1.parseUnits)("100", 18); // 100 ETH equivalent
    }
    // OPTIMIZATION: Export current configuration for optimization
    getPerformanceReport() {
        const recent = this.recentProfits.slice(-50); // Last 50 opportunities
        const performanceMetrics = {
            successRate: recent.length > 0 ? recent.filter(p => p.success).length / recent.length : 0,
            avgProfitMargin: recent.length > 0 ?
                recent.reduce((sum, p) => sum + Number(p.profit), 0) / (recent.length * 1e18) : 0,
            gasEfficiency: recent.length > 0 ?
                recent.reduce((sum, p) => sum + (1 / p.gasRatio), 0) / recent.length : 0,
            opportunityCapture: this.calculateOpportunityCapture()
        };
        const suggestions = this.generateOptimizationSuggestions(performanceMetrics);
        return {
            config: this.config,
            recentPerformance: performanceMetrics,
            suggestions
        };
    }
    calculateOpportunityCapture() {
        // Placeholder - would compare executed vs identified opportunities
        return 0.65; // 65% capture rate
    }
    generateOptimizationSuggestions(metrics) {
        const suggestions = [];
        if (metrics.successRate < 0.2) {
            suggestions.push("Success rate low - consider more aggressive thresholds");
        }
        if (metrics.gasEfficiency < 2.0) {
            suggestions.push("Gas efficiency poor - increase minimum profit thresholds");
        }
        if (metrics.opportunityCapture < 0.5) {
            suggestions.push("Low opportunity capture - consider more aggressive market conditions");
        }
        return suggestions;
    }
    // Update configuration based on performance
    optimizeConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}
exports.AdaptiveProfitManager = AdaptiveProfitManager;
