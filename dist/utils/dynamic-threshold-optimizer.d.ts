import { ethers } from 'ethers';
export interface MarketConditions {
    gasPrice: bigint;
    blockNumber: number;
    avgSpread: number;
    maxSpread: number;
    liquidityDepth: bigint;
    competitionLevel: number;
}
export interface DynamicThresholds {
    minSpreadBps: number;
    gasBufferMultiplier: number;
    slippageBuffer: number;
    minProfitWei: bigint;
    maxPositionSize: bigint;
}
export declare class DynamicThresholdOptimizer {
    private provider;
    private historicalSpreads;
    private historicalGasPrices;
    constructor(provider: ethers.JsonRpcProvider);
    analyzeCurrentMarketConditions(): Promise<MarketConditions>;
    getCurrentGasPrice(): Promise<bigint>;
    private estimateCompetitionLevel;
    calculateOptimalThresholds(conditions: MarketConditions): DynamicThresholds;
    private calculateBaseSpreadThreshold;
    private adjustForMarketConditions;
    private calculateGasBuffer;
    private calculateSlippageBuffer;
    private calculateMinProfit;
    private calculateMaxPosition;
    addSpreadObservation(spread: number): void;
    addGasPriceObservation(gasPrice: bigint): void;
    getRecommendedThresholds(): DynamicThresholds;
    logThresholdAnalysis(thresholds: DynamicThresholds, conditions: MarketConditions): void;
    private getThresholdRecommendation;
}
