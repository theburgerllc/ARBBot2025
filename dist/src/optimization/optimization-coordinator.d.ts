/**
 * Optimization Coordinator - Integration Layer
 * Bridges existing optimization components with the Market Optimization Engine
 */
import { JsonRpcProvider } from "ethers";
import { OptimizedParameters, OptimizationResult } from "./types";
import { OptimizationMonitor } from "./optimization-monitor";
import { AdaptiveProfitManager } from "../../utils/adaptive-profit-manager";
import { GasOptimizer } from "../../utils/gas-optimizer";
import { DynamicSlippageManager } from "../../utils/dynamic-slippage-manager";
import { MEVBundleOptimizer } from "../../utils/mev-bundle-optimizer";
import { AdvancedRiskManager } from "../../utils/advanced-risk-manager";
import { OraclePriceValidator } from "../../utils/oracle-price-validator";
export interface OptimizationConfig {
    enabled: boolean;
    frequency: number;
    primaryChainId: number;
    enableAdaptiveProfits: boolean;
    enableGasOptimization: boolean;
    enableSlippageOptimization: boolean;
    enableRiskManagement: boolean;
    enablePriceValidation: boolean;
    fallbackMode: boolean;
}
export interface OptimizationStatus {
    isRunning: boolean;
    lastOptimization: number;
    totalOptimizations: number;
    currentParameters: OptimizedParameters;
    performanceImprovement: number;
    errors: string[];
    warnings: string[];
}
export declare class OptimizationCoordinator {
    private marketOptimizer;
    private config;
    private providers;
    private logger;
    private parameterValidator;
    private monitor;
    private adaptiveProfitManager;
    private gasOptimizer;
    private slippageManager;
    private mevBundleOptimizer;
    private riskManager;
    private priceValidator;
    private status;
    private optimizationTimer;
    constructor(providers: Map<number, JsonRpcProvider>, existingOptimizers: {
        adaptiveProfitManager: AdaptiveProfitManager;
        gasOptimizer: GasOptimizer;
        slippageManager: DynamicSlippageManager;
        mevBundleOptimizer: MEVBundleOptimizer;
        riskManager: AdvancedRiskManager;
        priceValidator: OraclePriceValidator;
    }, config?: Partial<OptimizationConfig>);
    initialize(): Promise<void>;
    getOptimizedParameters(): Promise<OptimizedParameters>;
    forceOptimization(): Promise<OptimizationResult>;
    getOptimizationStatus(): OptimizationStatus;
    stop(): Promise<void>;
    validateTradeParameters(tokenA: string, tokenB: string, tradeSize: bigint, expectedProfit: bigint, chainId: number): Promise<{
        approved: boolean;
        optimizedParameters: OptimizedParameters;
        riskAssessment: any;
        priceValidation: any;
        warnings: string[];
    }>;
    private setupEventListeners;
    private startOptimizationLoop;
    private synchronizeOptimizers;
    private validateParameters;
    private getFallbackParameters;
    private calculatePerformanceImprovement;
    updateConfig(newConfig: Partial<OptimizationConfig>): void;
    getMonitor(): OptimizationMonitor;
    generatePerformanceReport(): any;
    updateValidationBounds(newBounds: any): void;
    getValidationBounds(): any;
    enableOptimization(): void;
    disableOptimization(): void;
}
