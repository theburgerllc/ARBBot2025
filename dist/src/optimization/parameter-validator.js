"use strict";
/**
 * Parameter Validator - Safety Bounds and Validation
 * Ensures all optimization parameters are within safe operational bounds
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParameterValidator = void 0;
const ethers_1 = require("ethers");
class ParameterValidator {
    bounds;
    constructor(customBounds) {
        this.bounds = {
            minProfitThreshold: {
                min: (0, ethers_1.parseEther)("0.0001"), // 0.0001 ETH minimum
                max: (0, ethers_1.parseEther)("10"), // 10 ETH maximum
                recommended: (0, ethers_1.parseEther)("0.01") // 0.01 ETH recommended
            },
            slippageTolerance: {
                min: 5, // 0.05% minimum
                max: 2000, // 20% maximum (extreme cases)
                recommended: 100 // 1% recommended
            },
            maxTradeSize: {
                min: (0, ethers_1.parseEther)("0.01"), // 0.01 ETH minimum
                max: (0, ethers_1.parseEther)("1000"), // 1000 ETH maximum
                recommended: (0, ethers_1.parseEther)("10") // 10 ETH recommended
            },
            gasSettings: {
                minFeePerGas: (0, ethers_1.parseEther)("0.000000001"), // 1 gwei minimum
                maxFeePerGas: (0, ethers_1.parseEther)("0.0001"), // 100 gwei maximum
                minPriorityFee: (0, ethers_1.parseEther)("0.000000001"), // 1 gwei minimum
                maxPriorityFee: (0, ethers_1.parseEther)("0.00001") // 10 gwei maximum
            },
            cooldownPeriod: {
                min: 1000, // 1 second minimum
                max: 300000, // 5 minutes maximum
                recommended: 5000 // 5 seconds recommended
            },
            ...customBounds
        };
    }
    validateParameters(parameters) {
        const errors = [];
        const warnings = [];
        let adjustedParameters = { ...parameters };
        let hasAdjustments = false;
        // Validate minimum profit threshold
        const profitValidation = this.validateProfitThreshold(parameters.minProfitThreshold);
        if (profitValidation.error) {
            errors.push(profitValidation.error);
        }
        if (profitValidation.warning) {
            warnings.push(profitValidation.warning);
        }
        if (profitValidation.adjustedValue !== undefined) {
            adjustedParameters.minProfitThreshold = profitValidation.adjustedValue;
            hasAdjustments = true;
        }
        // Validate slippage tolerance
        const slippageValidation = this.validateSlippageTolerance(parameters.slippageTolerance);
        if (slippageValidation.error) {
            errors.push(slippageValidation.error);
        }
        if (slippageValidation.warning) {
            warnings.push(slippageValidation.warning);
        }
        if (slippageValidation.adjustedValue !== undefined) {
            adjustedParameters.slippageTolerance = slippageValidation.adjustedValue;
            hasAdjustments = true;
        }
        // Validate max trade size
        const tradeSizeValidation = this.validateTradeSize(parameters.maxTradeSize);
        if (tradeSizeValidation.error) {
            errors.push(tradeSizeValidation.error);
        }
        if (tradeSizeValidation.warning) {
            warnings.push(tradeSizeValidation.warning);
        }
        if (tradeSizeValidation.adjustedValue !== undefined) {
            adjustedParameters.maxTradeSize = tradeSizeValidation.adjustedValue;
            hasAdjustments = true;
        }
        // Validate gas settings
        const gasValidation = this.validateGasSettings(parameters.gasSettings);
        if (gasValidation.error) {
            errors.push(gasValidation.error);
        }
        if (gasValidation.warning) {
            warnings.push(gasValidation.warning);
        }
        if (gasValidation.adjustedValue !== undefined) {
            adjustedParameters.gasSettings = gasValidation.adjustedValue;
            hasAdjustments = true;
        }
        // Validate cooldown period
        const cooldownValidation = this.validateCooldownPeriod(parameters.cooldownPeriod);
        if (cooldownValidation.error) {
            errors.push(cooldownValidation.error);
        }
        if (cooldownValidation.warning) {
            warnings.push(cooldownValidation.warning);
        }
        if (cooldownValidation.adjustedValue !== undefined) {
            adjustedParameters.cooldownPeriod = cooldownValidation.adjustedValue;
            hasAdjustments = true;
        }
        // Validate risk level
        const riskValidation = this.validateRiskLevel(parameters.riskLevel);
        if (riskValidation.error) {
            errors.push(riskValidation.error);
        }
        if (riskValidation.warning) {
            warnings.push(riskValidation.warning);
        }
        if (riskValidation.adjustedValue !== undefined) {
            adjustedParameters.riskLevel = riskValidation.adjustedValue;
            hasAdjustments = true;
        }
        // Cross-parameter validation
        const crossValidation = this.validateCrossParameterConstraints(adjustedParameters);
        errors.push(...crossValidation.errors);
        warnings.push(...crossValidation.warnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            adjustedParameters: hasAdjustments ? adjustedParameters : undefined
        };
    }
    validateProfitThreshold(threshold) {
        const bounds = this.bounds.minProfitThreshold;
        if (threshold < bounds.min) {
            return {
                error: `Profit threshold ${threshold.toString()} is below minimum ${bounds.min.toString()}`,
                adjustedValue: bounds.min
            };
        }
        if (threshold > bounds.max) {
            return {
                error: `Profit threshold ${threshold.toString()} exceeds maximum ${bounds.max.toString()}`,
                adjustedValue: bounds.max
            };
        }
        if (threshold < bounds.recommended) {
            return {
                warning: `Profit threshold ${threshold.toString()} is below recommended ${bounds.recommended.toString()}`
            };
        }
        return {};
    }
    validateSlippageTolerance(slippage) {
        const bounds = this.bounds.slippageTolerance;
        if (slippage < bounds.min) {
            return {
                error: `Slippage tolerance ${slippage}bps is below minimum ${bounds.min}bps`,
                adjustedValue: bounds.min
            };
        }
        if (slippage > bounds.max) {
            return {
                error: `Slippage tolerance ${slippage}bps exceeds maximum ${bounds.max}bps`,
                adjustedValue: bounds.max
            };
        }
        if (slippage > 500) { // 5%
            return {
                warning: `High slippage tolerance ${slippage}bps may result in poor execution`
            };
        }
        return {};
    }
    validateTradeSize(tradeSize) {
        const bounds = this.bounds.maxTradeSize;
        if (tradeSize < bounds.min) {
            return {
                error: `Trade size ${tradeSize.toString()} is below minimum ${bounds.min.toString()}`,
                adjustedValue: bounds.min
            };
        }
        if (tradeSize > bounds.max) {
            return {
                error: `Trade size ${tradeSize.toString()} exceeds maximum ${bounds.max.toString()}`,
                adjustedValue: bounds.max
            };
        }
        if (tradeSize > (0, ethers_1.parseEther)("50")) { // 50 ETH
            return {
                warning: `Large trade size ${tradeSize.toString()} may impact market liquidity`
            };
        }
        return {};
    }
    validateGasSettings(gasSettings) {
        const bounds = this.bounds.gasSettings;
        const adjustedSettings = { ...gasSettings };
        let hasAdjustments = false;
        const errors = [];
        const warnings = [];
        // Validate max fee per gas
        if (gasSettings.maxFeePerGas < bounds.minFeePerGas) {
            errors.push(`Max fee per gas ${gasSettings.maxFeePerGas.toString()} is below minimum ${bounds.minFeePerGas.toString()}`);
            adjustedSettings.maxFeePerGas = bounds.minFeePerGas;
            hasAdjustments = true;
        }
        if (gasSettings.maxFeePerGas > bounds.maxFeePerGas) {
            errors.push(`Max fee per gas ${gasSettings.maxFeePerGas.toString()} exceeds maximum ${bounds.maxFeePerGas.toString()}`);
            adjustedSettings.maxFeePerGas = bounds.maxFeePerGas;
            hasAdjustments = true;
        }
        // Validate max priority fee per gas
        if (gasSettings.maxPriorityFeePerGas < bounds.minPriorityFee) {
            errors.push(`Max priority fee ${gasSettings.maxPriorityFeePerGas.toString()} is below minimum ${bounds.minPriorityFee.toString()}`);
            adjustedSettings.maxPriorityFeePerGas = bounds.minPriorityFee;
            hasAdjustments = true;
        }
        if (gasSettings.maxPriorityFeePerGas > bounds.maxPriorityFee) {
            errors.push(`Max priority fee ${gasSettings.maxPriorityFeePerGas.toString()} exceeds maximum ${bounds.maxPriorityFee.toString()}`);
            adjustedSettings.maxPriorityFeePerGas = bounds.maxPriorityFee;
            hasAdjustments = true;
        }
        // Validate that max fee >= max priority fee
        if (adjustedSettings.maxFeePerGas < adjustedSettings.maxPriorityFeePerGas) {
            warnings.push('Max fee per gas should be >= max priority fee per gas');
            adjustedSettings.maxFeePerGas = adjustedSettings.maxPriorityFeePerGas;
            hasAdjustments = true;
        }
        // Validate urgency
        const validUrgencies = ['low', 'medium', 'high'];
        if (!validUrgencies.includes(gasSettings.urgency)) {
            errors.push(`Invalid gas urgency '${gasSettings.urgency}'. Must be one of: ${validUrgencies.join(', ')}`);
            adjustedSettings.urgency = 'medium';
            hasAdjustments = true;
        }
        return {
            error: errors.length > 0 ? errors.join('; ') : undefined,
            warning: warnings.length > 0 ? warnings.join('; ') : undefined,
            adjustedValue: hasAdjustments ? adjustedSettings : undefined
        };
    }
    validateCooldownPeriod(cooldown) {
        const bounds = this.bounds.cooldownPeriod;
        if (cooldown < bounds.min) {
            return {
                error: `Cooldown period ${cooldown}ms is below minimum ${bounds.min}ms`,
                adjustedValue: bounds.min
            };
        }
        if (cooldown > bounds.max) {
            return {
                error: `Cooldown period ${cooldown}ms exceeds maximum ${bounds.max}ms`,
                adjustedValue: bounds.max
            };
        }
        if (cooldown < 2000) { // 2 seconds
            return {
                warning: `Short cooldown period ${cooldown}ms may cause high gas usage`
            };
        }
        return {};
    }
    validateRiskLevel(riskLevel) {
        const validRiskLevels = ['conservative', 'balanced', 'aggressive'];
        if (!validRiskLevels.includes(riskLevel)) {
            return {
                error: `Invalid risk level '${riskLevel}'. Must be one of: ${validRiskLevels.join(', ')}`,
                adjustedValue: 'balanced'
            };
        }
        return {};
    }
    validateCrossParameterConstraints(parameters) {
        const errors = [];
        const warnings = [];
        // Check if profit threshold is reasonable relative to trade size
        const profitRatio = Number(parameters.minProfitThreshold) / Number(parameters.maxTradeSize);
        if (profitRatio < 0.001) { // < 0.1%
            warnings.push(`Low profit threshold relative to trade size (${(profitRatio * 100).toFixed(3)}%)`);
        }
        if (profitRatio > 0.1) { // > 10%
            warnings.push(`High profit threshold relative to trade size (${(profitRatio * 100).toFixed(1)}%)`);
        }
        // Check gas settings consistency
        const gasRatio = Number(parameters.gasSettings.maxPriorityFeePerGas) / Number(parameters.gasSettings.maxFeePerGas);
        if (gasRatio > 0.5) { // Priority fee > 50% of max fee
            warnings.push(`High priority fee ratio (${(gasRatio * 100).toFixed(1)}% of max fee)`);
        }
        // Check risk level consistency with other parameters
        if (parameters.riskLevel === 'conservative') {
            if (parameters.slippageTolerance > 200) { // > 2%
                warnings.push('High slippage tolerance for conservative risk level');
            }
            if (Number(parameters.maxTradeSize) > Number((0, ethers_1.parseEther)("5"))) { // > 5 ETH
                warnings.push('Large trade size for conservative risk level');
            }
        }
        else if (parameters.riskLevel === 'aggressive') {
            if (parameters.slippageTolerance < 50) { // < 0.5%
                warnings.push('Low slippage tolerance for aggressive risk level');
            }
            if (parameters.cooldownPeriod > 10000) { // > 10 seconds
                warnings.push('Long cooldown period for aggressive risk level');
            }
        }
        return { errors, warnings };
    }
    // Public utility methods
    getValidationBounds() {
        return { ...this.bounds };
    }
    updateBounds(newBounds) {
        this.bounds = { ...this.bounds, ...newBounds };
    }
    validateAndAdjust(parameters) {
        const validation = this.validateParameters(parameters);
        if (!validation.isValid && validation.adjustedParameters) {
            return validation.adjustedParameters;
        }
        return parameters;
    }
    createSafeParameters() {
        return {
            minProfitThreshold: this.bounds.minProfitThreshold.recommended,
            slippageTolerance: this.bounds.slippageTolerance.recommended,
            maxTradeSize: this.bounds.maxTradeSize.recommended,
            gasSettings: {
                maxFeePerGas: (0, ethers_1.parseEther)("0.00002"), // 20 gwei
                maxPriorityFeePerGas: (0, ethers_1.parseEther)("0.000002"), // 2 gwei
                urgency: 'medium'
            },
            cooldownPeriod: this.bounds.cooldownPeriod.recommended,
            riskLevel: 'balanced'
        };
    }
}
exports.ParameterValidator = ParameterValidator;
