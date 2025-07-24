"use strict";
/**
 * Market Optimization Engine - Central Coordination System
 * Coordinates all optimization components for maximum MEV profitability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketOptimizationEngine = void 0;
const ethers_1 = require("ethers");
const events_1 = require("events");
const winston = require("winston");
const market_analyzer_1 = require("./market-analyzer");
const performance_tracker_1 = require("./performance-tracker");
// Import existing optimization utilities
const adaptive_profit_manager_1 = require("../../utils/adaptive-profit-manager");
const gas_optimizer_1 = require("../../utils/gas-optimizer");
const dynamic_slippage_manager_1 = require("../../utils/dynamic-slippage-manager");
class MarketOptimizationEngine extends events_1.EventEmitter {
    providers;
    marketAnalyzer;
    performanceTracker;
    // Existing optimization components
    adaptiveProfitManager;
    gasOptimizer;
    slippageManager;
    config;
    state;
    customRules = [];
    marketProfiles = new Map();
    optimizationInterval = null;
    logger;
    constructor(providers, config) {
        super();
        this.providers = providers;
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'optimization.log' })
            ]
        });
        // Initialize components
        this.marketAnalyzer = new market_analyzer_1.MarketAnalyzer(providers);
        this.performanceTracker = new performance_tracker_1.PerformanceTracker();
        // Initialize existing optimizers
        this.adaptiveProfitManager = new adaptive_profit_manager_1.AdaptiveProfitManager(providers);
        this.gasOptimizer = new gas_optimizer_1.GasOptimizer(process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc", process.env.OPT_RPC || "https://mainnet.optimism.io");
        this.slippageManager = new dynamic_slippage_manager_1.DynamicSlippageManager(providers);
        // Configuration
        this.config = this.initializeConfig(config);
        this.state = this.initializeState();
        // Setup market profiles
        this.initializeMarketProfiles();
        this.logger.info('Market Optimization Engine initialized', {
            chainsConfigured: providers.size,
            optimizationEnabled: this.config.enabled
        });
    }
    async initializeOptimization(primaryChainId) {
        if (!this.config.enabled) {
            this.logger.info('Optimization disabled in configuration');
            return;
        }
        try {
            this.logger.info('Starting optimization initialization', { primaryChainId });
            // Perform initial market analysis
            const initialAnalysis = await this.marketAnalyzer.performMarketAnalysis(primaryChainId);
            this.logger.info('Initial market analysis complete', {
                recommendation: initialAnalysis.recommendation,
                confidence: initialAnalysis.confidence,
                regime: this.marketAnalyzer.getCurrentRegime().type
            });
            // Set initial optimized parameters
            this.state.currentParameters = initialAnalysis.suggestedParameters;
            this.state.currentRegime = this.marketAnalyzer.getCurrentRegime();
            // Start optimization loop
            this.startOptimizationLoop(primaryChainId);
            this.state.isRunning = true;
            this.emit('optimizationStarted', { chainId: primaryChainId, parameters: this.state.currentParameters });
            this.logger.info('Optimization engine started successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize optimization', { error: error.message });
            throw error;
        }
    }
    async optimizeParameters(chainId) {
        try {
            this.logger.info('Starting parameter optimization', { chainId });
            // Get current market analysis
            const marketAnalysis = await this.marketAnalyzer.performMarketAnalysis(chainId);
            // Get current performance metrics
            const performanceMetrics = this.performanceTracker.calculatePerformanceMetrics();
            // Store previous parameters for comparison
            const previousParameters = { ...this.state.currentParameters };
            // Apply optimization logic
            let optimizedParameters = await this.applyOptimizationLogic(marketAnalysis, performanceMetrics);
            // Apply custom rules
            optimizedParameters = this.applyCustomRules(optimizedParameters, marketAnalysis.conditions, performanceMetrics);
            // Apply safety bounds
            optimizedParameters = this.applySafetyBounds(optimizedParameters);
            // Calculate expected improvement
            const expectedImprovement = this.calculateExpectedImprovement(previousParameters, optimizedParameters, marketAnalysis);
            // Create optimization result
            const optimizationResult = {
                timestamp: Date.now(),
                previousParameters,
                newParameters: optimizedParameters,
                marketAnalysis,
                expectedImprovement,
                changesApplied: this.getParameterChanges(previousParameters, optimizedParameters),
                metricsSnapshot: performanceMetrics
            };
            // Update state
            this.state.currentParameters = optimizedParameters;
            this.state.totalOptimizations++;
            this.state.lastOptimization = Date.now();
            this.state.nextOptimization = Date.now() + this.config.frequency;
            this.state.adaptationHistory.push(optimizationResult);
            // Record optimization
            this.performanceTracker.recordOptimization(optimizationResult);
            // Emit optimization event
            this.emit('parametersOptimized', optimizationResult);
            this.logger.info('Parameter optimization complete', {
                expectedImprovement: `${expectedImprovement.toFixed(2)}%`,
                changes: optimizationResult.changesApplied,
                recommendation: marketAnalysis.recommendation
            });
            return optimizedParameters;
        }
        catch (error) {
            this.logger.error('Parameter optimization failed', { error: error.message, chainId });
            throw error;
        }
    }
    async applyOptimizationLogic(marketAnalysis, performanceMetrics) {
        const { conditions } = marketAnalysis;
        let optimizedParams = { ...marketAnalysis.suggestedParameters };
        // Apply adaptive profit management
        const profitThreshold = await this.adaptiveProfitManager.calculateOptimalThreshold(['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'], // WETH/USDC
        (0, ethers_1.parseEther)("1"), // 1 ETH trade size
        (0, ethers_1.parseEther)("0.001"), // Estimated gas cost
        42161 // Arbitrum chain ID
        );
        optimizedParams.minProfitThreshold = profitThreshold.minProfitWei;
        // Apply gas optimization
        const gasSettings = await this.gasOptimizer.getOptimalGasPrice(42161, 'medium');
        optimizedParams.gasSettings = {
            maxFeePerGas: gasSettings.maxFeePerGas,
            maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
            urgency: 'medium'
        };
        // Apply dynamic slippage management
        const slippageSettings = await this.slippageManager.calculateOptimalSlippage('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
        '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC
        optimizedParams.maxTradeSize, 42161 // Arbitrum chain ID
        );
        optimizedParams.slippageTolerance = slippageSettings.slippageBps;
        // Apply market profile adjustments
        optimizedParams = this.applyMarketProfile(optimizedParams, conditions);
        // Performance-based adjustments
        if (performanceMetrics.successRate < 0.6) {
            // Low success rate - make parameters more conservative
            optimizedParams.minProfitThreshold = optimizedParams.minProfitThreshold * BigInt(80) / BigInt(100);
            optimizedParams.slippageTolerance = Math.min(optimizedParams.slippageTolerance * 1.2, 1000); // Cap at 10%
        }
        else if (performanceMetrics.successRate > 0.8 && performanceMetrics.gasEfficiency > 2) {
            // High success rate and efficiency - be more aggressive
            optimizedParams.minProfitThreshold = optimizedParams.minProfitThreshold * BigInt(120) / BigInt(100);
            optimizedParams.maxTradeSize = optimizedParams.maxTradeSize * BigInt(110) / BigInt(100);
        }
        return optimizedParams;
    }
    applyMarketProfile(params, conditions) {
        // Select appropriate market profile
        let profile;
        for (const [, marketProfile] of Array.from(this.marketProfiles.entries())) {
            const { volatilityRange, liquidityRange, competitionRange } = marketProfile.conditions;
            if (conditions.volatility >= volatilityRange[0] && conditions.volatility <= volatilityRange[1] &&
                conditions.liquidity >= liquidityRange[0] && conditions.liquidity <= liquidityRange[1] &&
                conditions.competitionLevel >= competitionRange[0] && conditions.competitionLevel <= competitionRange[1]) {
                profile = marketProfile;
                break;
            }
        }
        if (profile) {
            this.logger.info('Applying market profile', { profile: profile.name });
            // Apply profile adjustments
            params.minProfitThreshold = params.minProfitThreshold *
                BigInt(Math.floor(profile.parameters.profitMultiplier * 100)) / BigInt(100);
            if (profile.parameters.gasUrgency === 'high') {
                params.gasSettings.urgency = 'high';
                params.gasSettings.maxFeePerGas = params.gasSettings.maxFeePerGas * BigInt(120) / BigInt(100);
            }
            else if (profile.parameters.gasUrgency === 'low') {
                params.gasSettings.urgency = 'low';
                params.gasSettings.maxFeePerGas = params.gasSettings.maxFeePerGas * BigInt(80) / BigInt(100);
            }
        }
        return params;
    }
    applyCustomRules(params, conditions, performance) {
        for (const rule of this.customRules) {
            if (rule.enabled && rule.condition(conditions, performance)) {
                this.logger.info('Applying custom optimization rule', { rule: rule.name });
                params = rule.action(params);
            }
        }
        return params;
    }
    applySafetyBounds(params) {
        const bounds = this.config.safetyBounds;
        // Apply safety bounds
        params.minProfitThreshold = this.clampBigInt(params.minProfitThreshold, bounds.minProfitThreshold, bounds.maxProfitThreshold);
        params.slippageTolerance = Math.max(bounds.minSlippage, Math.min(params.slippageTolerance, bounds.maxSlippage));
        params.maxTradeSize = this.clampBigInt(params.maxTradeSize, bounds.minTradeSize, bounds.maxTradeSize);
        return params;
    }
    calculateExpectedImprovement(previous, current, analysis) {
        let improvement = 0;
        // Profit threshold improvement
        const profitChange = (Number(current.minProfitThreshold) - Number(previous.minProfitThreshold)) /
            Number(previous.minProfitThreshold);
        if (profitChange < 0)
            improvement += Math.abs(profitChange) * 10; // Lower threshold = more opportunities
        // Slippage tolerance improvement
        const slippageChange = (current.slippageTolerance - previous.slippageTolerance) / previous.slippageTolerance;
        if (slippageChange > 0 && analysis.conditions.volatility > 0.6) {
            improvement += slippageChange * 5; // Higher slippage in volatile markets
        }
        // Gas efficiency improvement
        const gasChange = (Number(current.gasSettings.maxFeePerGas) - Number(previous.gasSettings.maxFeePerGas)) /
            Number(previous.gasSettings.maxFeePerGas);
        if (gasChange > 0 && analysis.conditions.competitionLevel > 0.7) {
            improvement += gasChange * 15; // Higher gas in competitive markets
        }
        return Math.min(improvement * 100, 50); // Cap at 50% expected improvement
    }
    // Utility methods
    clampBigInt(value, min, max) {
        return value < min ? min : (value > max ? max : value);
    }
    mapGasUrgency(urgency) {
        if (urgency > 0.8)
            return 'urgent';
        if (urgency > 0.6)
            return 'high';
        if (urgency > 0.3)
            return 'medium';
        return 'low';
    }
    getParameterChanges(previous, current) {
        const changes = [];
        if (previous.minProfitThreshold !== current.minProfitThreshold) {
            changes.push(`Profit threshold: ${(0, ethers_1.formatEther)(previous.minProfitThreshold)} → ${(0, ethers_1.formatEther)(current.minProfitThreshold)} ETH`);
        }
        if (previous.slippageTolerance !== current.slippageTolerance) {
            changes.push(`Slippage tolerance: ${previous.slippageTolerance}bp → ${current.slippageTolerance}bp`);
        }
        if (previous.maxTradeSize !== current.maxTradeSize) {
            changes.push(`Max trade size: ${(0, ethers_1.formatEther)(previous.maxTradeSize)} → ${(0, ethers_1.formatEther)(current.maxTradeSize)} ETH`);
        }
        if (previous.gasSettings.urgency !== current.gasSettings.urgency) {
            changes.push(`Gas urgency: ${previous.gasSettings.urgency} → ${current.gasSettings.urgency}`);
        }
        if (previous.riskLevel !== current.riskLevel) {
            changes.push(`Risk level: ${previous.riskLevel} → ${current.riskLevel}`);
        }
        return changes;
    }
    startOptimizationLoop(chainId) {
        if (this.optimizationInterval) {
            clearInterval(this.optimizationInterval);
        }
        this.optimizationInterval = setInterval(async () => {
            try {
                await this.optimizeParameters(chainId);
            }
            catch (error) {
                this.logger.error('Optimization loop error', { error: error.message });
            }
        }, this.config.frequency);
    }
    initializeConfig(config) {
        return {
            enabled: config?.enabled ?? (process.env.OPTIMIZATION_ENABLED === 'true'),
            frequency: config?.frequency ?? parseInt(process.env.OPTIMIZATION_FREQUENCY || '300000'), // 5 minutes
            minSampleSize: config?.minSampleSize ?? parseInt(process.env.MIN_SAMPLE_SIZE || '20'),
            volatilityWindow: config?.volatilityWindow ?? parseInt(process.env.VOLATILITY_WINDOW || '100'),
            performanceWindow: config?.performanceWindow ?? 24,
            adaptationSpeed: config?.adaptationSpeed ?? 0.5,
            safetyBounds: config?.safetyBounds ?? {
                minProfitThreshold: (0, ethers_1.parseEther)("0.001"),
                maxProfitThreshold: (0, ethers_1.parseEther)("1.0"),
                minSlippage: 10, // 0.1%
                maxSlippage: 1000, // 10%
                minTradeSize: (0, ethers_1.parseEther)("0.1"),
                maxTradeSize: (0, ethers_1.parseEther)("100")
            }
        };
    }
    initializeState() {
        return {
            isRunning: false,
            lastOptimization: 0,
            nextOptimization: 0,
            totalOptimizations: 0,
            currentRegime: {
                type: 'sideways',
                strength: 0.5,
                duration: 0,
                stability: 0.8
            },
            performanceMetrics: this.performanceTracker.calculatePerformanceMetrics(),
            currentParameters: this.getDefaultParameters(),
            adaptationHistory: []
        };
    }
    initializeMarketProfiles() {
        // Bull Market Profile
        this.marketProfiles.set('bull_market', {
            name: 'Bull Market',
            description: 'Aggressive growth market conditions',
            conditions: {
                volatilityRange: [0.3, 0.8],
                liquidityRange: [80, 300],
                competitionRange: [0.2, 0.7]
            },
            parameters: {
                profitMultiplier: 0.8, // Lower thresholds for more opportunities
                gasUrgency: 'high',
                riskTolerance: 0.8,
                adaptationSpeed: 0.7
            }
        });
        // Bear Market Profile
        this.marketProfiles.set('bear_market', {
            name: 'Bear Market',
            description: 'Conservative declining market conditions',
            conditions: {
                volatilityRange: [0.4, 0.9],
                liquidityRange: [30, 150],
                competitionRange: [0.1, 0.6]
            },
            parameters: {
                profitMultiplier: 1.3, // Higher thresholds for safety
                gasUrgency: 'low',
                riskTolerance: 0.4,
                adaptationSpeed: 0.3
            }
        });
        // High Volatility Profile
        this.marketProfiles.set('high_volatility', {
            name: 'High Volatility',
            description: 'Extreme price movement conditions',
            conditions: {
                volatilityRange: [0.8, 1.0],
                liquidityRange: [20, 200],
                competitionRange: [0.3, 1.0]
            },
            parameters: {
                profitMultiplier: 0.6, // Very aggressive in high volatility
                gasUrgency: 'high',
                riskTolerance: 0.9,
                adaptationSpeed: 0.9
            }
        });
    }
    getDefaultParameters() {
        return {
            minProfitThreshold: (0, ethers_1.parseEther)("0.01"),
            slippageTolerance: 50, // 0.5%
            maxTradeSize: (0, ethers_1.parseEther)("10"),
            gasSettings: {
                maxFeePerGas: (0, ethers_1.parseEther)("0.00002"), // 20 gwei
                maxPriorityFeePerGas: (0, ethers_1.parseEther)("0.000002"), // 2 gwei
                urgency: 'medium'
            },
            cooldownPeriod: 5000, // 5 seconds
            riskLevel: 'balanced'
        };
    }
    // Public API methods
    getCurrentParameters() {
        return { ...this.state.currentParameters };
    }
    getOptimizationStatus() {
        this.state.performanceMetrics = this.performanceTracker.calculatePerformanceMetrics();
        return { ...this.state };
    }
    recordTrade(trade) {
        this.performanceTracker.recordTrade(trade);
    }
    addCustomRule(rule) {
        this.customRules.push(rule);
        this.logger.info('Custom optimization rule added', { rule: rule.name });
    }
    removeCustomRule(ruleId) {
        this.customRules = this.customRules.filter(rule => rule.id !== ruleId);
        this.logger.info('Custom optimization rule removed', { ruleId });
    }
    stop() {
        if (this.optimizationInterval) {
            clearInterval(this.optimizationInterval);
            this.optimizationInterval = null;
        }
        this.state.isRunning = false;
        this.emit('optimizationStopped');
        this.logger.info('Optimization engine stopped');
    }
    async forceOptimization(chainId) {
        const optimizedParams = await this.optimizeParameters(chainId);
        // Get the latest optimization result from adaptation history
        return this.state.adaptationHistory[this.state.adaptationHistory.length - 1] || {
            timestamp: Date.now(),
            previousParameters: this.getDefaultParameters(),
            newParameters: optimizedParams,
            marketAnalysis: await this.marketAnalyzer.performMarketAnalysis(chainId),
            expectedImprovement: 0,
            changesApplied: [],
            metricsSnapshot: this.performanceTracker.calculatePerformanceMetrics()
        };
    }
}
exports.MarketOptimizationEngine = MarketOptimizationEngine;
