/**
 * Market Analyzer - Unified Market Condition Analysis
 * Consolidates market data from multiple sources for optimization decisions
 */
import { JsonRpcProvider } from "ethers";
import { MarketConditions, MarketRegime, MarketAnalysis } from "./types";
export declare class MarketAnalyzer {
    private providers;
    private priceHistory;
    private gasHistory;
    private blockTimes;
    private currentRegime;
    constructor(providers: Map<number, JsonRpcProvider>);
    analyzeMarketConditions(chainId: number): Promise<MarketConditions>;
    performMarketAnalysis(chainId: number): Promise<MarketAnalysis>;
    private calculateVolatility;
    private estimateLiquidity;
    private updateGasHistory;
    private calculateNetworkCongestion;
    private estimateCompetitionLevel;
    private categorizeTimeOfDay;
    private detectMarketTrend;
    private updateMarketRegime;
    private generateRecommendation;
    private calculateConfidence;
    private generateReasoning;
    private optimizeParameters;
    private assessRisk;
    private getDefaultMarketConditions;
    getCurrentRegime(): MarketRegime;
}
