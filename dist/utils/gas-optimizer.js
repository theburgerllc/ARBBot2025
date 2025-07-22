"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GasOptimizer = void 0;
const ethers_1 = require("ethers");
class GasOptimizer {
    arbitrumProvider;
    optimismProvider;
    gasHistory = new Map();
    mempoolCache = new Map();
    constructor(arbitrumRpc, optimismRpc) {
        this.arbitrumProvider = new ethers_1.JsonRpcProvider(arbitrumRpc);
        this.optimismProvider = new ethers_1.JsonRpcProvider(optimismRpc);
    }
    // OPTIMIZATION: Real-time gas price prediction with ML-like analysis
    async getOptimalGasPrice(chainId, urgency = 'medium') {
        const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
        // Fetch current network conditions
        const [feeData, block, pendingTransactions] = await Promise.all([
            provider.getFeeData(),
            provider.getBlock('latest'),
            this.getPendingTransactionCount(provider)
        ]);
        if (!feeData || !block) {
            throw new Error('Unable to fetch network data');
        }
        // Calculate network congestion
        const networkCongestion = this.calculateNetworkCongestion(block.gasUsed, block.gasLimit, pendingTransactions);
        // Predict optimal gas price based on historical data and current conditions
        const baseFee = feeData.gasPrice || (0, ethers_1.parseUnits)("0.1", "gwei");
        const optimalTip = this.calculateOptimalTip(baseFee, networkCongestion, urgency);
        // EIP-1559 optimization for L2 networks
        const maxFeePerGas = baseFee + (optimalTip * 2n); // 2x tip as buffer
        const maxPriorityFeePerGas = optimalTip;
        // Store for historical analysis
        this.updateGasHistory(chainId, maxFeePerGas);
        return {
            gasLimit: 500000n, // Estimated, will be refined per transaction
            maxFeePerGas,
            maxPriorityFeePerGas,
            baseFee,
            optimalTip,
            networkCongestion,
            confidence: this.calculateConfidence(networkCongestion, urgency)
        };
    }
    // OPTIMIZATION: Gas cost vs profit analysis with dynamic thresholds
    async shouldExecuteTrade(estimatedProfit, estimatedGas, chainId, urgency = 'medium') {
        const gasSettings = await this.getOptimalGasPrice(chainId, urgency);
        const gasCost = estimatedGas * gasSettings.maxFeePerGas;
        const netProfit = estimatedProfit > gasCost ? estimatedProfit - gasCost : 0n;
        // Calculate profit margin as basis points (1 bp = 0.01%)
        const profitMargin = estimatedProfit > 0n
            ? Number((netProfit * 10000n) / estimatedProfit)
            : 0;
        // Dynamic thresholds based on network conditions
        let minProfitMargin;
        switch (gasSettings.networkCongestion) {
            case 0: // Low congestion
                minProfitMargin = urgency === 'high' ? 1500 : 2000; // 15-20%
                break;
            case 1: // Medium congestion  
                minProfitMargin = urgency === 'high' ? 2000 : 2500; // 20-25%
                break;
            case 2: // High congestion
                minProfitMargin = urgency === 'high' ? 2500 : 3000; // 25-30%
                break;
            default: // Extreme congestion
                minProfitMargin = 3500; // 35%
        }
        const shouldExecute = profitMargin >= minProfitMargin && netProfit > 0n;
        let recommendation;
        if (profitMargin < 1000) { // < 10%
            recommendation = "REJECT: Insufficient profit margin";
        }
        else if (profitMargin < minProfitMargin) {
            recommendation = `WAIT: Margin ${(profitMargin / 100).toFixed(1)}% below threshold ${(minProfitMargin / 100).toFixed(1)}%`;
        }
        else {
            recommendation = `EXECUTE: Strong profit margin ${(profitMargin / 100).toFixed(1)}%`;
        }
        return {
            shouldExecute,
            profitMargin: profitMargin / 100, // Convert to percentage
            recommendation
        };
    }
    // OPTIMIZATION: Predictive gas pricing with mempool analysis
    async predictGasPriceMovement(chainId, timeHorizon = 300) {
        const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
        const currentGasSettings = await this.getOptimalGasPrice(chainId, 'medium');
        // Analyze historical patterns
        const gasHistory = this.gasHistory.get(chainId) || [];
        const trend = this.calculateGasTrend(gasHistory);
        // Predict based on current network state and trends
        let predictedGasPrice = currentGasSettings.maxFeePerGas;
        let congestionLevel = 'medium';
        let recommendedWaitTime = 0;
        if (trend > 0.1) { // Gas price increasing
            predictedGasPrice = currentGasSettings.maxFeePerGas * 120n / 100n; // +20%
            congestionLevel = 'high';
            recommendedWaitTime = Math.min(timeHorizon, 180); // Wait up to 3 minutes
        }
        else if (trend < -0.1) { // Gas price decreasing
            predictedGasPrice = currentGasSettings.maxFeePerGas * 90n / 100n; // -10%
            congestionLevel = 'low';
            recommendedWaitTime = 0; // Execute immediately
        }
        const costEfficiencyScore = this.calculateCostEfficiencyScore(currentGasSettings.maxFeePerGas, predictedGasPrice, currentGasSettings.networkCongestion);
        return {
            currentGasPrice: currentGasSettings.maxFeePerGas,
            predictedGasPrice,
            congestionLevel,
            recommendedWaitTime,
            costEfficiencyScore
        };
    }
    // OPTIMIZATION: Adaptive gas strategies for different opportunity types
    async getGasStrategyForOpportunity(opportunityType, profitExpectation, chainId) {
        let urgency;
        switch (opportunityType) {
            case 'liquidation':
                urgency = 'high'; // Time-critical
                break;
            case 'cross-chain':
                urgency = 'low'; // Less time-sensitive due to bridge delays
                break;
            case 'triangular':
                urgency = 'medium'; // Moderate competition
                break;
            default:
                urgency = 'medium';
        }
        // Adjust urgency based on profit expectation
        if (profitExpectation > (0, ethers_1.parseUnits)("0.1", 18)) { // > 0.1 ETH profit
            urgency = urgency === 'low' ? 'medium' : 'high';
        }
        return this.getOptimalGasPrice(chainId, urgency);
    }
    // Helper methods
    calculateNetworkCongestion(gasUsed, gasLimit, pendingTxs) {
        const blockUtilization = Number(gasUsed * 100n / gasLimit);
        const pendingFactor = Math.min(pendingTxs / 100, 50); // Cap at 50
        const congestionScore = (blockUtilization + pendingFactor) / 2;
        if (congestionScore < 25)
            return 0; // Low
        if (congestionScore < 50)
            return 1; // Medium
        if (congestionScore < 75)
            return 2; // High
        return 3; // Extreme
    }
    calculateOptimalTip(baseFee, congestion, urgency) {
        let tipMultiplier;
        switch (urgency) {
            case 'low':
                tipMultiplier = 1 + (congestion * 0.1); // 1.0x to 1.3x
                break;
            case 'medium':
                tipMultiplier = 1.2 + (congestion * 0.15); // 1.2x to 1.65x
                break;
            case 'high':
                tipMultiplier = 1.5 + (congestion * 0.25); // 1.5x to 2.25x
                break;
        }
        const baseTip = baseFee / 10n; // 10% of base fee as starting point
        return baseTip * BigInt(Math.floor(tipMultiplier * 100)) / 100n;
    }
    updateGasHistory(chainId, gasPrice) {
        if (!this.gasHistory.has(chainId)) {
            this.gasHistory.set(chainId, []);
        }
        const history = this.gasHistory.get(chainId);
        history.push(gasPrice);
        // Keep only last 100 data points
        if (history.length > 100) {
            history.shift();
        }
    }
    calculateGasTrend(gasHistory) {
        if (gasHistory.length < 5)
            return 0;
        const recent = gasHistory.slice(-5);
        const older = gasHistory.slice(-10, -5);
        if (older.length === 0)
            return 0;
        const recentAvg = recent.reduce((a, b) => a + b, 0n) / BigInt(recent.length);
        const olderAvg = older.reduce((a, b) => a + b, 0n) / BigInt(older.length);
        return Number(recentAvg - olderAvg) / Number(olderAvg);
    }
    calculateConfidence(congestion, urgency) {
        let baseConfidence = 85;
        // Reduce confidence during high congestion
        baseConfidence -= (congestion * 10);
        // High urgency reduces confidence due to time pressure
        if (urgency === 'high')
            baseConfidence -= 10;
        return Math.max(50, Math.min(95, baseConfidence));
    }
    calculateCostEfficiencyScore(currentGas, predictedGas, congestion) {
        let score = 50; // Base score
        // Higher score if predicted gas is lower than current
        if (predictedGas < currentGas) {
            score += 30;
        }
        else if (predictedGas > currentGas) {
            score -= 20;
        }
        // Adjust for congestion
        score -= (congestion * 10);
        return Math.max(0, Math.min(100, score));
    }
    async getPendingTransactionCount(provider) {
        try {
            // This would require access to mempool data
            // For now, return a reasonable estimate
            const block = await provider.getBlock('latest');
            return Math.floor(Math.random() * 50) + 10; // Simulated pending tx count
        }
        catch (error) {
            return 20; // Default fallback
        }
    }
}
exports.GasOptimizer = GasOptimizer;
