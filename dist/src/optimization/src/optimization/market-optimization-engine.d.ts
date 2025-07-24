/**
 * Market Optimization Engine - Central Coordination System
 * Coordinates all optimization components for maximum MEV profitability
 */
/// <reference types="node" />
import { JsonRpcProvider } from "ethers";
import { EventEmitter } from "events";
import { OptimizedParameters, OptimizationConfig, OptimizationResult, OptimizationState, OptimizationRule } from "./types";
import { TradeRecord } from "./performance-tracker";
export declare class MarketOptimizationEngine extends EventEmitter {
    private providers;
    private marketAnalyzer;
    private performanceTracker;
    private adaptiveProfitManager;
    private gasOptimizer;
    private slippageManager;
    private config;
    private state;
    private customRules;
    private marketProfiles;
    private optimizationInterval;
    private logger;
    constructor(providers: Map<number, JsonRpcProvider>, config?: Partial<OptimizationConfig>);
    initializeOptimization(primaryChainId: number): Promise<void>;
    optimizeParameters(chainId: number): Promise<OptimizedParameters>;
    private applyOptimizationLogic;
    private applyMarketProfile;
    private applyCustomRules;
    private applySafetyBounds;
    private calculateExpectedImprovement;
    private clampBigInt;
    private mapGasUrgency;
    private getParameterChanges;
    private startOptimizationLoop;
    private initializeConfig;
    private initializeState;
    private initializeMarketProfiles;
    private getDefaultParameters;
    getCurrentParameters(): OptimizedParameters;
    getOptimizationStatus(): OptimizationState;
    recordTrade(trade: TradeRecord): void;
    addCustomRule(rule: OptimizationRule): void;
    removeCustomRule(ruleId: string): void;
    stop(): void;
    forceOptimization(chainId: number): Promise<OptimizationResult>;
}
