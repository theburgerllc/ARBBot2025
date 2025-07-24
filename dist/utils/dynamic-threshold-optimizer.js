"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicThresholdOptimizer = void 0;
const ethers_1 = require("ethers");
class DynamicThresholdOptimizer {
    provider;
    historicalSpreads = [];
    historicalGasPrices = [];
    constructor(provider) {
        this.provider = provider;
    }
    async analyzeCurrentMarketConditions() {
        const [gasPrice, blockNumber] = await Promise.all([
            this.getCurrentGasPrice(),
            this.provider.getBlockNumber()
        ]);
        // Calculate recent spread statistics
        const avgSpread = this.historicalSpreads.length > 0
            ? this.historicalSpreads.reduce((a, b) => a + b, 0) / this.historicalSpreads.length
            : 0.12; // Default based on observed data
        const maxSpread = this.historicalSpreads.length > 0
            ? Math.max(...this.historicalSpreads)
            : 0.155; // Default based on observed data
        return {
            gasPrice,
            blockNumber,
            avgSpread,
            maxSpread,
            liquidityDepth: ethers_1.ethers.parseEther("100"), // Estimate
            competitionLevel: this.estimateCompetitionLevel(gasPrice)
        };
    }
    async getCurrentGasPrice() {
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice || ethers_1.ethers.parseUnits("0.01", "gwei");
    }
    estimateCompetitionLevel(gasPrice) {
        // Higher gas prices indicate more competition
        const gasPriceGwei = Number(ethers_1.ethers.formatUnits(gasPrice, "gwei"));
        if (gasPriceGwei < 0.02)
            return 1; // Low competition
        if (gasPriceGwei < 0.05)
            return 2; // Medium competition  
        if (gasPriceGwei < 0.1)
            return 3; // High competition
        return 4; // Extreme competition
    }
    calculateOptimalThresholds(conditions) {
        const { gasPrice, avgSpread, maxSpread, competitionLevel } = conditions;
        // Calculate gas cost for typical arbitrage transaction
        const estimatedGasUnits = 500000n; // Conservative estimate
        const gasCostWei = estimatedGasUnits * gasPrice;
        const gasCostEth = Number(ethers_1.ethers.formatEther(gasCostWei));
        // Dynamic spread threshold based on gas costs and competition
        const baseSpreadBps = this.calculateBaseSpreadThreshold(gasCostEth, competitionLevel);
        // Adjust based on recent market observations
        const marketAdjustedSpread = this.adjustForMarketConditions(baseSpreadBps, avgSpread, maxSpread);
        return {
            minSpreadBps: Math.max(marketAdjustedSpread, 5), // Never go below 0.05%
            gasBufferMultiplier: this.calculateGasBuffer(competitionLevel),
            slippageBuffer: this.calculateSlippageBuffer(competitionLevel),
            minProfitWei: this.calculateMinProfit(gasCostWei),
            maxPositionSize: this.calculateMaxPosition(conditions)
        };
    }
    calculateBaseSpreadThreshold(gasCostEth, competitionLevel) {
        // Base calculation: gas cost + profit margin
        const gasBreakeven = (gasCostEth / 1.0) * 10000; // Convert to basis points for 1 ETH trade
        const profitMargin = 30; // 0.3% profit margin in basis points
        const competitionBuffer = competitionLevel * 10; // Additional buffer for competition
        return gasBreakeven + profitMargin + competitionBuffer;
    }
    adjustForMarketConditions(baseSpread, avgSpread, maxSpread) {
        const avgSpreadBps = avgSpread * 100; // Convert to basis points
        const maxSpreadBps = maxSpread * 100;
        // If market spreads are consistently lower, adjust threshold down
        if (maxSpreadBps < baseSpread) {
            // Market condition adjustment: use 70% of max observed spread
            return Math.max(maxSpreadBps * 0.7, 5);
        }
        // If average spread is close to our threshold, lower it slightly
        if (avgSpreadBps < baseSpread && avgSpreadBps > baseSpread * 0.5) {
            return Math.max(avgSpreadBps * 0.8, 5);
        }
        return baseSpread;
    }
    calculateGasBuffer(competitionLevel) {
        // Higher competition = need more gas buffer
        const baseBuffer = 1.2; // 20% base buffer
        const competitionMultiplier = 1 + (competitionLevel * 0.1);
        return baseBuffer * competitionMultiplier;
    }
    calculateSlippageBuffer(competitionLevel) {
        // Higher competition = more slippage expected
        const baseSlippage = 100; // 1% base slippage in basis points
        const competitionBuffer = competitionLevel * 50; // Additional slippage per competition level
        return baseSlippage + competitionBuffer;
    }
    calculateMinProfit(gasCostWei) {
        // Minimum profit should be 3x gas cost for safety
        return gasCostWei * 3n;
    }
    calculateMaxPosition(conditions) {
        // Conservative position sizing based on liquidity and risk
        const { liquidityDepth, competitionLevel } = conditions;
        // Use max 5% of available liquidity
        const liquidityBasedMax = liquidityDepth / 20n;
        // Reduce for higher competition
        const competitionAdjusted = liquidityBasedMax / BigInt(competitionLevel);
        // Cap at reasonable maximums
        const conservativeMax = ethers_1.ethers.parseEther("1.0"); // 1 ETH max
        const aggressiveMax = ethers_1.ethers.parseEther("10.0"); // 10 ETH max
        return competitionLevel <= 2
            ? aggressiveMax
            : Math.min(Number(competitionAdjusted), Number(conservativeMax)) === Number(competitionAdjusted)
                ? competitionAdjusted
                : BigInt(Number(conservativeMax));
    }
    addSpreadObservation(spread) {
        this.historicalSpreads.push(spread);
        // Keep only last 100 observations
        if (this.historicalSpreads.length > 100) {
            this.historicalSpreads.shift();
        }
    }
    addGasPriceObservation(gasPrice) {
        this.historicalGasPrices.push(gasPrice);
        // Keep only last 100 observations
        if (this.historicalGasPrices.length > 100) {
            this.historicalGasPrices.shift();
        }
    }
    getRecommendedThresholds() {
        // Quick method for getting current recommendations
        const mockConditions = {
            gasPrice: ethers_1.ethers.parseUnits("0.01", "gwei"),
            blockNumber: 360568000,
            avgSpread: 0.129,
            maxSpread: 0.155,
            liquidityDepth: ethers_1.ethers.parseEther("100"),
            competitionLevel: 1
        };
        return this.calculateOptimalThresholds(mockConditions);
    }
    logThresholdAnalysis(thresholds, conditions) {
        console.log(`
🎯 DYNAMIC THRESHOLD OPTIMIZATION
═══════════════════════════════════
📊 Market Conditions:
   Gas Price: ${ethers_1.ethers.formatUnits(conditions.gasPrice, "gwei")} gwei
   Avg Spread: ${conditions.avgSpread.toFixed(3)}%
   Max Spread: ${conditions.maxSpread.toFixed(3)}%
   Competition: Level ${conditions.competitionLevel}

🔧 Optimized Thresholds:
   Min Spread: ${(thresholds.minSpreadBps / 100).toFixed(3)}%
   Gas Buffer: ${((thresholds.gasBufferMultiplier - 1) * 100).toFixed(1)}%
   Slippage Buffer: ${(thresholds.slippageBuffer / 100).toFixed(1)}%
   Min Profit: ${ethers_1.ethers.formatEther(thresholds.minProfitWei)} ETH
   Max Position: ${ethers_1.ethers.formatEther(thresholds.maxPositionSize)} ETH

💡 Recommendation: ${this.getThresholdRecommendation(thresholds, conditions)}
    `);
    }
    getThresholdRecommendation(thresholds, conditions) {
        const spreadReduction = ((0.3 - (thresholds.minSpreadBps / 100)) / 0.3 * 100);
        if (spreadReduction > 50) {
            return `🟢 AGGRESSIVE: ${spreadReduction.toFixed(0)}% threshold reduction - high profit potential`;
        }
        else if (spreadReduction > 25) {
            return `🟡 MODERATE: ${spreadReduction.toFixed(0)}% threshold reduction - balanced approach`;
        }
        else {
            return `🔴 CONSERVATIVE: ${spreadReduction.toFixed(0)}% threshold reduction - limited opportunities`;
        }
    }
}
exports.DynamicThresholdOptimizer = DynamicThresholdOptimizer;
