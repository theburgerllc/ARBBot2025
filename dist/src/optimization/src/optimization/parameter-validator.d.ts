/**
 * Parameter Validator - Safety Bounds and Validation
 * Ensures all optimization parameters are within safe operational bounds
 */
import { OptimizedParameters } from "./types";
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    adjustedParameters?: OptimizedParameters;
}
export interface ValidationBounds {
    minProfitThreshold: {
        min: bigint;
        max: bigint;
        recommended: bigint;
    };
    slippageTolerance: {
        min: number;
        max: number;
        recommended: number;
    };
    maxTradeSize: {
        min: bigint;
        max: bigint;
        recommended: bigint;
    };
    gasSettings: {
        minFeePerGas: bigint;
        maxFeePerGas: bigint;
        minPriorityFee: bigint;
        maxPriorityFee: bigint;
    };
    cooldownPeriod: {
        min: number;
        max: number;
        recommended: number;
    };
}
export declare class ParameterValidator {
    private bounds;
    constructor(customBounds?: Partial<ValidationBounds>);
    validateParameters(parameters: OptimizedParameters): ValidationResult;
    private validateProfitThreshold;
    private validateSlippageTolerance;
    private validateTradeSize;
    private validateGasSettings;
    private validateCooldownPeriod;
    private validateRiskLevel;
    private validateCrossParameterConstraints;
    getValidationBounds(): ValidationBounds;
    updateBounds(newBounds: Partial<ValidationBounds>): void;
    validateAndAdjust(parameters: OptimizedParameters): OptimizedParameters;
    createSafeParameters(): OptimizedParameters;
}
