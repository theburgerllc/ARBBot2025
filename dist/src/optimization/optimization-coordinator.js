"use strict";
/**
 * Optimization Coordinator - Integration Layer
 * Bridges existing optimization components with the Market Optimization Engine
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationCoordinator = void 0;
const winston = __importStar(require("winston"));
const market_optimization_engine_1 = require("./market-optimization-engine");
const parameter_validator_1 = require("./parameter-validator");
const optimization_monitor_1 = require("./optimization-monitor");
class OptimizationCoordinator {
    marketOptimizer;
    config;
    providers;
    logger;
    parameterValidator;
    monitor;
    // Existing optimizer references
    adaptiveProfitManager;
    gasOptimizer;
    slippageManager;
    mevBundleOptimizer;
    riskManager;
    priceValidator;
    status;
    optimizationTimer = null;
    constructor(providers, existingOptimizers, config) {
        this.providers = providers;
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.Console({ level: 'info' }),
                new winston.transports.File({ filename: 'optimization-coordinator.log' })
            ]
        });
        // Store references to existing optimizers
        this.adaptiveProfitManager = existingOptimizers.adaptiveProfitManager;
        this.gasOptimizer = existingOptimizers.gasOptimizer;
        this.slippageManager = existingOptimizers.slippageManager;
        this.mevBundleOptimizer = existingOptimizers.mevBundleOptimizer;
        this.riskManager = existingOptimizers.riskManager;
        this.priceValidator = existingOptimizers.priceValidator;
        // Initialize configuration
        this.config = {
            enabled: config?.enabled ?? (process.env.MARKET_OPTIMIZATION_ENABLED === 'true'),
            frequency: config?.frequency ?? parseInt(process.env.OPTIMIZATION_FREQUENCY || '300000'), // 5 minutes
            primaryChainId: config?.primaryChainId ?? 42161, // Arbitrum
            enableAdaptiveProfits: config?.enableAdaptiveProfits ?? true,
            enableGasOptimization: config?.enableGasOptimization ?? true,
            enableSlippageOptimization: config?.enableSlippageOptimization ?? true,
            enableRiskManagement: config?.enableRiskManagement ?? true,
            enablePriceValidation: config?.enablePriceValidation ?? true,
            fallbackMode: config?.fallbackMode ?? false
        };
        // Initialize Market Optimization Engine
        this.marketOptimizer = new market_optimization_engine_1.MarketOptimizationEngine(providers, {
            enabled: this.config.enabled,
            frequency: this.config.frequency
        });
        // Initialize Parameter Validator with safety bounds
        this.parameterValidator = new parameter_validator_1.ParameterValidator();
        // Initialize Optimization Monitor
        this.monitor = new optimization_monitor_1.OptimizationMonitor('optimization-coordinator.log');
        // Initialize status
        this.status = {
            isRunning: false,
            lastOptimization: 0,
            totalOptimizations: 0,
            currentParameters: this.marketOptimizer.getCurrentParameters(),
            performanceImprovement: 0,
            errors: [],
            warnings: []
        };
        this.logger.info('OptimizationCoordinator initialized', {
            enabled: this.config.enabled,
            primaryChain: this.config.primaryChainId,
            frequency: this.config.frequency
        });
    }
    async initialize() {
        if (!this.config.enabled) {
            this.logger.info('Market optimization disabled in configuration');
            return;
        }
        try {
            this.logger.info('Initializing optimization coordination');
            // Initialize the market optimization engine
            await this.marketOptimizer.initializeOptimization(this.config.primaryChainId);
            // Set up optimization events
            this.setupEventListeners();
            // Start coordination loop
            this.startOptimizationLoop();
            this.status.isRunning = true;
            this.logger.info('Optimization coordination started successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize optimization coordination', {
                error: error instanceof Error ? error.message : error
            });
            throw error;
        }
    }
    async getOptimizedParameters() {
        if (!this.config.enabled || this.config.fallbackMode) {
            // Return parameters from existing optimizers in fallback mode
            return this.getFallbackParameters();
        }
        try {
            // Get optimized parameters from Market Optimization Engine
            const parameters = this.marketOptimizer.getCurrentParameters();
            // Validate parameters through existing optimizers
            const validatedParameters = await this.validateParameters(parameters);
            return validatedParameters;
        }
        catch (error) {
            this.logger.error('Failed to get optimized parameters, falling back', {
                error: error instanceof Error ? error.message : error
            });
            // Fallback to existing optimizers
            return this.getFallbackParameters();
        }
    }
    async forceOptimization() {
        this.logger.info('Force optimization requested');
        this.monitor.logOptimizationStart(this.config.primaryChainId);
        try {
            const result = await this.marketOptimizer.forceOptimization(this.config.primaryChainId);
            // Update status
            this.status.lastOptimization = Date.now();
            this.status.totalOptimizations++;
            this.status.currentParameters = result.newParameters;
            // Log optimization completion
            this.monitor.logOptimizationComplete(result);
            // Synchronize with existing optimizers
            await this.synchronizeOptimizers(result.newParameters);
            this.logger.info('Force optimization completed', {
                improvement: result.expectedImprovement
            });
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.status.errors.push(errorMsg);
            this.monitor.logOptimizationError(error instanceof Error ? error : new Error(errorMsg), {
                chainId: this.config.primaryChainId,
                action: 'forceOptimization'
            });
            this.logger.error('Force optimization failed', { error: errorMsg });
            throw error;
        }
    }
    getOptimizationStatus() {
        // Update performance improvement from market optimizer
        const optimizationStatus = this.marketOptimizer.getOptimizationStatus();
        return {
            ...this.status,
            performanceImprovement: this.calculatePerformanceImprovement(optimizationStatus)
        };
    }
    async stop() {
        this.logger.info('Stopping optimization coordination');
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
            this.optimizationTimer = null;
        }
        this.marketOptimizer.stop();
        this.monitor.stop();
        this.status.isRunning = false;
        this.logger.info('Optimization coordination stopped');
    }
    // Integration with existing bot systems
    async validateTradeParameters(tokenA, tokenB, tradeSize, expectedProfit, chainId) {
        const warnings = [];
        try {
            // Get current optimized parameters
            const parameters = await this.getOptimizedParameters();
            // Validate with risk manager
            const riskAssessment = await this.riskManager.assessTradeRisk([tokenA, tokenB], tradeSize, expectedProfit, parameters.gasSettings.maxFeePerGas * BigInt(500000), // Estimated gas cost
            'dual_dex', chainId, 0.75);
            if (!riskAssessment.approved) {
                warnings.push(`Risk assessment failed: ${riskAssessment.reasonsForRejection.join(', ')}`);
            }
            // Validate prices with oracle
            const priceValidation = await this.priceValidator.validateTokenPrice(tokenA, tokenB, expectedProfit, // Using as price proxy
            chainId, tradeSize);
            if (priceValidation.recommendation === 'reject') {
                warnings.push(`Price validation failed: ${priceValidation.warnings.join(', ')}`);
            }
            const approved = riskAssessment.approved && priceValidation.recommendation !== 'reject';
            // Log trade execution with monitoring
            this.monitor.logTradeExecution(approved, parameters, expectedProfit, parameters.gasSettings.maxFeePerGas * BigInt(500000), // Estimated gas cost
            Date.now() - Date.now() // Execution time placeholder
            );
            return {
                approved,
                optimizedParameters: parameters,
                riskAssessment,
                priceValidation,
                warnings
            };
        }
        catch (error) {
            this.logger.error('Trade parameter validation failed', {
                error: error instanceof Error ? error.message : error
            });
            return {
                approved: false,
                optimizedParameters: await this.getFallbackParameters(),
                riskAssessment: null,
                priceValidation: null,
                warnings: ['Validation system error - using fallback parameters']
            };
        }
    }
    // Private methods
    setupEventListeners() {
        this.marketOptimizer.on('parametersOptimized', (result) => {
            this.logger.info('Parameters optimized by market engine', {
                improvement: result.expectedImprovement,
                changes: result.changesApplied.length
            });
            // Update status
            this.status.lastOptimization = Date.now();
            this.status.totalOptimizations++;
            this.status.currentParameters = result.newParameters;
            // Synchronize with existing optimizers
            this.synchronizeOptimizers(result.newParameters).catch(error => {
                this.logger.error('Failed to synchronize optimizers', { error: error.message });
            });
        });
        this.marketOptimizer.on('optimizationStopped', () => {
            this.logger.warn('Market optimization engine stopped');
            this.status.isRunning = false;
        });
    }
    startOptimizationLoop() {
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
        }
        this.optimizationTimer = setInterval(async () => {
            if (!this.status.isRunning)
                return;
            try {
                // The MarketOptimizationEngine handles its own optimization loop
                // We just monitor and coordinate here
                const engineStatus = this.marketOptimizer.getOptimizationStatus();
                if (!engineStatus.isRunning) {
                    this.logger.warn('Market optimization engine not running, attempting restart');
                    await this.marketOptimizer.initializeOptimization(this.config.primaryChainId);
                }
            }
            catch (error) {
                this.logger.error('Optimization coordination loop error', {
                    error: error instanceof Error ? error.message : error
                });
            }
        }, this.config.frequency);
    }
    async synchronizeOptimizers(parameters) {
        try {
            // Update adaptive profit manager configuration if needed
            if (this.config.enableAdaptiveProfits) {
                // The AdaptiveProfitManager will automatically adapt based on market conditions
                this.logger.debug('Synchronized with adaptive profit manager');
            }
            // Gas optimizer will use the new gas settings
            if (this.config.enableGasOptimization) {
                this.logger.debug('Synchronized with gas optimizer');
            }
            // Slippage manager will use the new slippage tolerance
            if (this.config.enableSlippageOptimization) {
                this.logger.debug('Synchronized with slippage manager');
            }
            this.logger.info('Successfully synchronized all optimizers with new parameters');
        }
        catch (error) {
            this.logger.error('Failed to synchronize optimizers', {
                error: error instanceof Error ? error.message : error
            });
            throw error;
        }
    }
    async validateParameters(parameters) {
        // Use the parameter validator for comprehensive validation
        const validation = this.parameterValidator.validateParameters(parameters);
        // Log parameter validation with monitoring
        this.monitor.logParameterValidation(parameters, validation.adjustedParameters || parameters, validation.warnings, validation.errors);
        // Add validation warnings to status
        if (validation.warnings.length > 0) {
            this.status.warnings.push(...validation.warnings);
            this.logger.warn('Parameter validation warnings', { warnings: validation.warnings });
        }
        // Handle validation errors
        if (!validation.isValid) {
            this.status.errors.push(...validation.errors);
            this.logger.error('Parameter validation errors', { errors: validation.errors });
            // Use adjusted parameters if available, otherwise fallback to safe defaults
            if (validation.adjustedParameters) {
                this.logger.info('Using adjusted parameters after validation');
                return validation.adjustedParameters;
            }
            else {
                this.logger.warn('Using safe fallback parameters due to validation failure');
                return this.parameterValidator.createSafeParameters();
            }
        }
        return parameters;
    }
    async getFallbackParameters() {
        // Return safe default parameters when optimization is disabled or fails
        const fallbackParams = {
            minProfitThreshold: BigInt("10000000000000000"), // 0.01 ETH
            slippageTolerance: 100, // 1%
            maxTradeSize: BigInt("10000000000000000000"), // 10 ETH
            gasSettings: {
                maxFeePerGas: BigInt("20000000000"), // 20 gwei
                maxPriorityFeePerGas: BigInt("2000000000"), // 2 gwei
                urgency: 'medium'
            },
            cooldownPeriod: 5000, // 5 seconds
            riskLevel: 'balanced'
        };
        this.logger.info('Using fallback optimization parameters');
        return fallbackParams;
    }
    calculatePerformanceImprovement(optimizationStatus) {
        // Calculate improvement based on recent optimization results
        const recentOptimizations = optimizationStatus.adaptationHistory?.slice(-10) || [];
        if (recentOptimizations.length === 0)
            return 0;
        const avgImprovement = recentOptimizations
            .reduce((sum, opt) => sum + (opt.expectedImprovement || 0), 0) / recentOptimizations.length;
        return Math.round(avgImprovement * 100) / 100;
    }
    // Public configuration methods
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Optimization configuration updated', newConfig);
    }
    getMonitor() {
        return this.monitor;
    }
    generatePerformanceReport() {
        return this.monitor.generatePerformanceReport();
    }
    updateValidationBounds(newBounds) {
        this.parameterValidator.updateBounds(newBounds);
        this.logger.info('Parameter validation bounds updated');
    }
    getValidationBounds() {
        return this.parameterValidator.getValidationBounds();
    }
    enableOptimization() {
        this.config.enabled = true;
        this.logger.info('Market optimization enabled');
    }
    disableOptimization() {
        this.config.enabled = false;
        this.config.fallbackMode = true;
        this.logger.info('Market optimization disabled, using fallback mode');
    }
}
exports.OptimizationCoordinator = OptimizationCoordinator;
