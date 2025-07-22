import { parseUnits, formatUnits } from "ethers";

export interface RiskMetrics {
    currentDrawdown: number;        // Current drawdown from peak
    dailyPnL: bigint;              // Today's P&L
    weeklyPnL: bigint;             // Weekly P&L
    consecutiveFailures: number;    // Failed trades in a row
    consecutiveSuccesses: number;   // Successful trades in a row
    gasToCapitalRatio: number;     // Gas spent vs available capital
    successRate1h: number;         // Success rate last hour
    successRate24h: number;        // Success rate last 24 hours
    avgProfitMargin: number;       // Average profit margin
    exposureByToken: Map<string, bigint>; // Exposure per token
    exposureByChain: Map<number, bigint>; // Exposure per chain
    peakBalance: bigint;           // All-time high balance
    currentBalance: bigint;        // Current balance
    totalTradesCount: number;      // Total trades executed
    profitableTradesCount: number; // Profitable trades count
}

export interface RiskLimits {
    maxDrawdownPercent: number;     // Max drawdown before pause
    maxDailyLossPercent: number;    // Max daily loss
    maxWeeklyLossPercent: number;   // Max weekly loss
    maxConsecutiveFailures: number; // Max failed trades
    maxGasRatio: number;           // Max gas/capital ratio
    minSuccessRate1h: number;      // Minimum 1h success rate
    minSuccessRate24h: number;     // Minimum 24h success rate
    minProfitMargin: number;       // Minimum profit margin
    maxSingleTradePercent: number; // Max single trade size
    maxTokenExposurePercent: number; // Max exposure to single token
    maxChainExposurePercent: number; // Max exposure to single chain
    cooldownPeriodMinutes: number;  // Cooldown after circuit breaker
}

export interface TradeRiskAssessment {
    approved: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    maxPosition: bigint;
    requiredConfidence: number;
    gasRatioCheck: boolean;
    exposureCheck: boolean;
    reasonsForRejection: string[];
}

export interface CircuitBreakerStatus {
    isActive: boolean;
    activatedAt?: number;
    reasons: string[];
    estimatedRecoveryTime?: number;
    canOverride: boolean;
    overrideConditions: string[];
}

// OPTIMIZATION: Advanced risk management with intelligent circuit breakers
export class AdvancedRiskManager {
    private riskMetrics!: RiskMetrics;
    private riskLimits: RiskLimits;
    private circuitBreakerStatus: CircuitBreakerStatus;
    private performanceHistory: Array<{ 
        timestamp: number; 
        profit: bigint; 
        gasCost: bigint;
        success: boolean;
        strategy: string;
        tokenPair: string;
        chainId: number;
        tradeSize: bigint;
    }> = [];
    private balanceHistory: Array<{ timestamp: number; balance: bigint }> = [];
    
    constructor(initialCapital: bigint) {
        this.riskLimits = {
            maxDrawdownPercent: 0.05,      // 5% max drawdown
            maxDailyLossPercent: 0.08,     // 8% max daily loss
            maxWeeklyLossPercent: 0.15,    // 15% max weekly loss
            maxConsecutiveFailures: 5,      // 5 consecutive failures
            maxGasRatio: 0.25,             // 25% max gas ratio
            minSuccessRate1h: 0.15,        // 15% minimum 1h success rate
            minSuccessRate24h: 0.20,       // 20% minimum 24h success rate
            minProfitMargin: 0.005,        // 0.5% minimum margin
            maxSingleTradePercent: 0.15,   // 15% max single trade
            maxTokenExposurePercent: 0.25, // 25% max token exposure
            maxChainExposurePercent: 0.40, // 40% max chain exposure
            cooldownPeriodMinutes: 30      // 30 minute cooldown
        };
        
        this.initializeMetrics(initialCapital);
        this.circuitBreakerStatus = {
            isActive: false,
            reasons: [],
            canOverride: false,
            overrideConditions: []
        };
    }
    
    private initializeMetrics(initialCapital: bigint): void {
        this.riskMetrics = {
            currentDrawdown: 0,
            dailyPnL: 0n,
            weeklyPnL: 0n,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            gasToCapitalRatio: 0,
            successRate1h: 0,
            successRate24h: 0,
            avgProfitMargin: 0,
            exposureByToken: new Map(),
            exposureByChain: new Map(),
            peakBalance: initialCapital,
            currentBalance: initialCapital,
            totalTradesCount: 0,
            profitableTradesCount: 0
        };
        
        this.balanceHistory.push({
            timestamp: Date.now(),
            balance: initialCapital
        });
    }
    
    // MAIN FUNCTION: Assess trade risk before execution
    async assessTradeRisk(
        tokenPair: [string, string],
        tradeSize: bigint,
        estimatedProfit: bigint,
        estimatedGasCost: bigint,
        strategy: string,
        chainId: number,
        confidence: number = 0.7
    ): Promise<TradeRiskAssessment> {
        const warnings: string[] = [];
        const reasonsForRejection: string[] = [];
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        
        // Check if circuit breaker is active
        if (this.circuitBreakerStatus.isActive) {
            return {
                approved: false,
                riskLevel: 'critical',
                warnings: [],
                maxPosition: 0n,
                requiredConfidence: 1.0,
                gasRatioCheck: false,
                exposureCheck: false,
                reasonsForRejection: [`Trading paused: ${this.circuitBreakerStatus.reasons.join(', ')}`]
            };
        }
        
        // Calculate trade size as percentage of capital
        const tradePercent = Number(tradeSize) / Number(this.riskMetrics.currentBalance);
        
        if (tradePercent > this.riskLimits.maxSingleTradePercent) {
            reasonsForRejection.push(`Trade size too large: ${(tradePercent * 100).toFixed(1)}% > ${(this.riskLimits.maxSingleTradePercent * 100).toFixed(1)}%`);
            riskLevel = 'critical';
        } else if (tradePercent > this.riskLimits.maxSingleTradePercent * 0.8) {
            warnings.push(`Large trade size: ${(tradePercent * 100).toFixed(1)}%`);
            riskLevel = 'high';
        }
        
        // Check gas cost ratio
        const gasRatio = Number(estimatedGasCost) / Number(estimatedProfit);
        const gasRatioCheck = gasRatio <= this.riskLimits.maxGasRatio;
        
        if (!gasRatioCheck) {
            reasonsForRejection.push(`Gas ratio too high: ${(gasRatio * 100).toFixed(1)}% > ${(this.riskLimits.maxGasRatio * 100).toFixed(1)}%`);
            riskLevel = 'critical';
        } else if (gasRatio > this.riskLimits.maxGasRatio * 0.8) {
            warnings.push(`High gas ratio: ${(gasRatio * 100).toFixed(1)}%`);
            riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
        }
        
        // Check profit margin
        const profitMargin = Number(estimatedProfit) / Number(tradeSize);
        if (profitMargin < this.riskLimits.minProfitMargin) {
            warnings.push(`Low profit margin: ${(profitMargin * 100).toFixed(2)}%`);
            riskLevel = riskLevel === 'critical' ? 'critical' : 'medium';
        }
        
        // Check token exposure
        const tokenExposure = this.calculateTokenExposure(tokenPair, tradeSize);
        const exposureCheck = tokenExposure.withinLimits;
        
        if (!exposureCheck) {
            reasonsForRejection.push(`Token exposure limits exceeded: ${tokenExposure.message}`);
            riskLevel = 'critical';
        }
        
        // Check chain exposure
        const chainExposure = this.calculateChainExposure(chainId, tradeSize);
        if (!chainExposure.withinLimits) {
            reasonsForRejection.push(`Chain exposure limits exceeded: ${chainExposure.message}`);
            riskLevel = 'critical';
        }
        
        // Check consecutive failures
        if (this.riskMetrics.consecutiveFailures >= this.riskLimits.maxConsecutiveFailures - 1) {
            warnings.push(`High failure count: ${this.riskMetrics.consecutiveFailures}`);
            riskLevel = 'high';
        }
        
        // Check success rates
        if (this.riskMetrics.successRate1h < this.riskLimits.minSuccessRate1h && this.riskMetrics.totalTradesCount > 10) {
            warnings.push(`Low 1h success rate: ${(this.riskMetrics.successRate1h * 100).toFixed(1)}%`);
            riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
        }
        
        // Adjust required confidence based on risk level
        let requiredConfidence = confidence;
        switch (riskLevel) {
            case 'high':
                requiredConfidence = Math.max(0.8, confidence);
                break;
            case 'critical':
                requiredConfidence = 0.95;
                break;
        }
        
        // Calculate maximum safe position size
        const maxPositionFromCapital = this.riskMetrics.currentBalance * BigInt(Math.round(this.riskLimits.maxSingleTradePercent * 100)) / 100n;
        const maxPositionFromExposure = this.calculateMaxPositionFromExposure(tokenPair, chainId);
        const maxPosition = maxPositionFromCapital < maxPositionFromExposure ? maxPositionFromCapital : maxPositionFromExposure;
        
        return {
            approved: reasonsForRejection.length === 0 && riskLevel !== 'critical',
            riskLevel,
            warnings,
            maxPosition: maxPosition > 0n ? maxPosition : 0n,
            requiredConfidence,
            gasRatioCheck,
            exposureCheck,
            reasonsForRejection
        };
    }
    
    // OPTIMIZATION: Update metrics after trade execution
    async updateMetricsAndCheckLimits(tradeResult: {
        profit: bigint;
        gasCost: bigint;
        success: boolean;
        strategy: string;
        tokenPair: string;
        chainId: number;
        tradeSize: bigint;
    }): Promise<void> {
        const netProfit = tradeResult.profit - tradeResult.gasCost;
        
        // Update performance history
        this.performanceHistory.push({
            timestamp: Date.now(),
            profit: netProfit,
            gasCost: tradeResult.gasCost,
            success: tradeResult.success,
            strategy: tradeResult.strategy,
            tokenPair: tradeResult.tokenPair,
            chainId: tradeResult.chainId,
            tradeSize: tradeResult.tradeSize
        });
        
        // Update balance
        this.riskMetrics.currentBalance += netProfit;
        this.balanceHistory.push({
            timestamp: Date.now(),
            balance: this.riskMetrics.currentBalance
        });
        
        // Update peak balance
        if (this.riskMetrics.currentBalance > this.riskMetrics.peakBalance) {
            this.riskMetrics.peakBalance = this.riskMetrics.currentBalance;
        }
        
        // Keep only recent history (last 30 days)
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        this.performanceHistory = this.performanceHistory.filter(h => h.timestamp > thirtyDaysAgo);
        this.balanceHistory = this.balanceHistory.filter(h => h.timestamp > thirtyDaysAgo);
        
        // Update all metrics
        await this.recalculateAllMetrics();
        
        // Check circuit breaker conditions
        await this.checkCircuitBreakers();
    }
    
    // OPTIMIZATION: Comprehensive metrics recalculation
    private async recalculateAllMetrics(): Promise<void> {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        
        // Success rates
        const trades1h = this.performanceHistory.filter(h => h.timestamp > oneHourAgo);
        const trades24h = this.performanceHistory.filter(h => h.timestamp > oneDayAgo);
        
        this.riskMetrics.successRate1h = trades1h.length > 0 ? 
            trades1h.filter(h => h.success).length / trades1h.length : 0;
        this.riskMetrics.successRate24h = trades24h.length > 0 ? 
            trades24h.filter(h => h.success).length / trades24h.length : 0;
        
        // Consecutive failures/successes
        this.calculateConsecutiveResults();
        
        // P&L calculations
        const todaysTrades = this.performanceHistory.filter(h => h.timestamp > oneDayAgo);
        const weekTrades = this.performanceHistory.filter(h => h.timestamp > oneWeekAgo);
        
        this.riskMetrics.dailyPnL = todaysTrades.reduce((sum, h) => sum + h.profit, 0n);
        this.riskMetrics.weeklyPnL = weekTrades.reduce((sum, h) => sum + h.profit, 0n);
        
        // Drawdown calculation
        this.calculateCurrentDrawdown();
        
        // Gas ratio
        const recentTrades = this.performanceHistory.slice(-20);
        if (recentTrades.length > 0) {
            const totalGas = recentTrades.reduce((sum, h) => sum + Number(h.gasCost), 0);
            const totalProfit = recentTrades.reduce((sum, h) => sum + Number(h.profit), 0);
            this.riskMetrics.gasToCapitalRatio = totalProfit > 0 ? totalGas / Number(this.riskMetrics.currentBalance) : 0;
        }
        
        // Average profit margin
        const profitableTrades = this.performanceHistory.filter(h => h.profit > 0n);
        if (profitableTrades.length > 0) {
            const avgMargin = profitableTrades.reduce((sum, h) => 
                sum + (Number(h.profit) / Number(h.tradeSize)), 0) / profitableTrades.length;
            this.riskMetrics.avgProfitMargin = avgMargin;
        }
        
        // Trade counts
        this.riskMetrics.totalTradesCount = this.performanceHistory.length;
        this.riskMetrics.profitableTradesCount = profitableTrades.length;
        
        // Update exposures (simplified - in practice would track open positions)
        this.updateExposures();
    }
    
    private calculateConsecutiveResults(): void {
        let failures = 0;
        let successes = 0;
        
        // Count consecutive failures from most recent
        for (let i = this.performanceHistory.length - 1; i >= 0; i--) {
            if (!this.performanceHistory[i].success) {
                failures++;
            } else {
                break;
            }
        }
        
        // Count consecutive successes from most recent
        for (let i = this.performanceHistory.length - 1; i >= 0; i--) {
            if (this.performanceHistory[i].success) {
                successes++;
            } else {
                break;
            }
        }
        
        this.riskMetrics.consecutiveFailures = failures;
        this.riskMetrics.consecutiveSuccesses = successes;
    }
    
    private calculateCurrentDrawdown(): void {
        if (this.riskMetrics.peakBalance === 0n) {
            this.riskMetrics.currentDrawdown = 0;
            return;
        }
        
        const drawdownAmount = this.riskMetrics.peakBalance - this.riskMetrics.currentBalance;
        this.riskMetrics.currentDrawdown = Number(drawdownAmount) / Number(this.riskMetrics.peakBalance);
    }
    
    // OPTIMIZATION: Intelligent circuit breaker system
    private async checkCircuitBreakers(): Promise<void> {
        const newReasons: string[] = [];
        
        // Check drawdown
        if (this.riskMetrics.currentDrawdown > this.riskLimits.maxDrawdownPercent) {
            newReasons.push(`Drawdown limit exceeded: ${(this.riskMetrics.currentDrawdown * 100).toFixed(1)}%`);
        }
        
        // Check daily loss
        if (this.riskMetrics.dailyPnL < 0n) {
            const dailyLossPercent = Math.abs(Number(this.riskMetrics.dailyPnL)) / Number(this.riskMetrics.currentBalance);
            if (dailyLossPercent > this.riskLimits.maxDailyLossPercent) {
                newReasons.push(`Daily loss limit exceeded: ${(dailyLossPercent * 100).toFixed(1)}%`);
            }
        }
        
        // Check weekly loss
        if (this.riskMetrics.weeklyPnL < 0n) {
            const weeklyLossPercent = Math.abs(Number(this.riskMetrics.weeklyPnL)) / Number(this.riskMetrics.currentBalance);
            if (weeklyLossPercent > this.riskLimits.maxWeeklyLossPercent) {
                newReasons.push(`Weekly loss limit exceeded: ${(weeklyLossPercent * 100).toFixed(1)}%`);
            }
        }
        
        // Check consecutive failures
        if (this.riskMetrics.consecutiveFailures >= this.riskLimits.maxConsecutiveFailures) {
            newReasons.push(`Too many consecutive failures: ${this.riskMetrics.consecutiveFailures}`);
        }
        
        // Check success rates (only if we have enough data)
        if (this.riskMetrics.totalTradesCount >= 20) {
            if (this.riskMetrics.successRate1h < this.riskLimits.minSuccessRate1h) {
                newReasons.push(`1h success rate too low: ${(this.riskMetrics.successRate1h * 100).toFixed(1)}%`);
            }
            
            if (this.riskMetrics.successRate24h < this.riskLimits.minSuccessRate24h) {
                newReasons.push(`24h success rate too low: ${(this.riskMetrics.successRate24h * 100).toFixed(1)}%`);
            }
        }
        
        // Check gas efficiency
        if (this.riskMetrics.gasToCapitalRatio > this.riskLimits.maxGasRatio) {
            newReasons.push(`Gas to capital ratio too high: ${(this.riskMetrics.gasToCapitalRatio * 100).toFixed(1)}%`);
        }
        
        // Update circuit breaker status
        if (newReasons.length > 0) {
            if (!this.circuitBreakerStatus.isActive) {
                this.activateCircuitBreaker(newReasons);
            } else {
                // Update reasons if already active
                this.circuitBreakerStatus.reasons = newReasons;
            }
        } else if (this.circuitBreakerStatus.isActive) {
            // Check if conditions have improved enough to resume
            if (await this.shouldResumeTradingOperations()) {
                this.deactivateCircuitBreaker();
            }
        }
    }
    
    private activateCircuitBreaker(reasons: string[]): void {
        this.circuitBreakerStatus = {
            isActive: true,
            activatedAt: Date.now(),
            reasons,
            estimatedRecoveryTime: Date.now() + (this.riskLimits.cooldownPeriodMinutes * 60 * 1000),
            canOverride: false,
            overrideConditions: this.generateOverrideConditions(reasons)
        };
        
        console.log(`🚨 CIRCUIT BREAKER ACTIVATED: ${reasons.join(', ')}`);
        console.log(`⏰ Estimated recovery time: ${this.riskLimits.cooldownPeriodMinutes} minutes`);
    }
    
    private deactivateCircuitBreaker(): void {
        console.log(`✅ CIRCUIT BREAKER RESET: Trading resumed`);
        
        this.circuitBreakerStatus = {
            isActive: false,
            reasons: [],
            canOverride: false,
            overrideConditions: []
        };
    }
    
    private async shouldResumeTradingOperations(): Promise<boolean> {
        // Must wait for cooldown period
        if (this.circuitBreakerStatus.activatedAt && 
            Date.now() - this.circuitBreakerStatus.activatedAt < this.riskLimits.cooldownPeriodMinutes * 60 * 1000) {
            return false;
        }
        
        // More conservative conditions for resumption
        return this.riskMetrics.consecutiveFailures === 0 &&
               this.riskMetrics.currentDrawdown < this.riskLimits.maxDrawdownPercent * 0.7 &&
               (this.riskMetrics.totalTradesCount < 10 || this.riskMetrics.successRate1h > this.riskLimits.minSuccessRate1h * 1.2);
    }
    
    private generateOverrideConditions(reasons: string[]): string[] {
        return [
            "Manual confirmation from administrator",
            "Market conditions significantly improved",
            "Risk limits temporarily adjusted",
            "Emergency override with increased monitoring"
        ];
    }
    
    // Helper methods for exposure calculations
    private calculateTokenExposure(tokenPair: [string, string], tradeSize: bigint): { withinLimits: boolean; message: string } {
        // Simplified exposure calculation
        const maxTokenExposure = this.riskMetrics.currentBalance * BigInt(Math.round(this.riskLimits.maxTokenExposurePercent * 100)) / 100n;
        
        if (tradeSize <= maxTokenExposure) {
            return { withinLimits: true, message: "Token exposure OK" };
        } else {
            return { 
                withinLimits: false, 
                message: `Trade size ${formatUnits(tradeSize, 18)} exceeds max token exposure ${formatUnits(maxTokenExposure, 18)}` 
            };
        }
    }
    
    private calculateChainExposure(chainId: number, tradeSize: bigint): { withinLimits: boolean; message: string } {
        const currentChainExposure = this.riskMetrics.exposureByChain.get(chainId) || 0n;
        const newTotalExposure = currentChainExposure + tradeSize;
        const maxChainExposure = this.riskMetrics.currentBalance * BigInt(Math.round(this.riskLimits.maxChainExposurePercent * 100)) / 100n;
        
        if (newTotalExposure <= maxChainExposure) {
            return { withinLimits: true, message: "Chain exposure OK" };
        } else {
            return { 
                withinLimits: false, 
                message: `Chain exposure would exceed limit: ${formatUnits(newTotalExposure, 18)} > ${formatUnits(maxChainExposure, 18)}` 
            };
        }
    }
    
    private calculateMaxPositionFromExposure(tokenPair: [string, string], chainId: number): bigint {
        const maxTokenExposure = this.riskMetrics.currentBalance * BigInt(Math.round(this.riskLimits.maxTokenExposurePercent * 100)) / 100n;
        const maxChainExposure = this.riskMetrics.currentBalance * BigInt(Math.round(this.riskLimits.maxChainExposurePercent * 100)) / 100n;
        const currentChainExposure = this.riskMetrics.exposureByChain.get(chainId) || 0n;
        const availableChainExposure = maxChainExposure > currentChainExposure ? maxChainExposure - currentChainExposure : 0n;
        
        return maxTokenExposure < availableChainExposure ? maxTokenExposure : availableChainExposure;
    }
    
    private updateExposures(): void {
        // Simplified exposure tracking
        // In practice, would track actual open positions
        this.riskMetrics.exposureByToken.clear();
        this.riskMetrics.exposureByChain.clear();
    }
    
    // Public interface methods
    getCircuitBreakerStatus(): CircuitBreakerStatus {
        return { ...this.circuitBreakerStatus };
    }
    
    getRiskMetrics(): RiskMetrics {
        return { ...this.riskMetrics };
    }
    
    updateRiskLimits(newLimits: Partial<RiskLimits>): void {
        this.riskLimits = { ...this.riskLimits, ...newLimits };
    }
    
    forceCircuitBreakerReset(): boolean {
        if (this.circuitBreakerStatus.canOverride) {
            this.deactivateCircuitBreaker();
            return true;
        }
        return false;
    }
    
    // Generate comprehensive risk report
    generateRiskReport(): {
        metrics: RiskMetrics;
        limits: RiskLimits;
        circuitBreaker: CircuitBreakerStatus;
        recommendations: string[];
        healthScore: number; // 0-100
    } {
        const recommendations: string[] = [];
        let healthScore = 100;
        
        // Analyze metrics and generate recommendations
        if (this.riskMetrics.currentDrawdown > 0.03) {
            recommendations.push("Drawdown above 3% - consider reducing position sizes");
            healthScore -= 20;
        }
        
        if (this.riskMetrics.successRate24h < 0.30) {
            recommendations.push("Low success rate - review strategy parameters");
            healthScore -= 15;
        }
        
        if (this.riskMetrics.gasToCapitalRatio > 0.15) {
            recommendations.push("High gas costs - optimize gas usage or increase profit thresholds");
            healthScore -= 10;
        }
        
        if (this.riskMetrics.consecutiveFailures > 3) {
            recommendations.push("Multiple consecutive failures - investigate strategy issues");
            healthScore -= 15;
        }
        
        return {
            metrics: this.riskMetrics,
            limits: this.riskLimits,
            circuitBreaker: this.circuitBreakerStatus,
            recommendations,
            healthScore: Math.max(0, healthScore)
        };
    }
}