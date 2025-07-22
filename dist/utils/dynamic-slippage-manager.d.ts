import { JsonRpcProvider } from "ethers";
export interface TokenVolatilityMetrics {
    symbol: string;
    address: string;
    volatility24h: number;
    liquidityDepth: bigint;
    averageSlippage: number;
    priceImpact: number;
    lastUpdate: number;
}
export interface DynamicSlippageConfig {
    baseSlippage: number;
    volatilityMultiplier: number;
    liquidityAdjustment: number;
    networkCongestionFactor: number;
    maxSlippage: number;
    minSlippage: number;
}
export interface SlippageCalculationResult {
    slippageBps: number;
    confidence: number;
    reasoning: string[];
    adjustments: {
        volatility: number;
        liquidity: number;
        congestion: number;
        final: number;
    };
}
export declare class DynamicSlippageManager {
    private providers;
    private volatilityCache;
    private config;
    private priceHistory;
    constructor(providers: Map<number, JsonRpcProvider>);
    calculateOptimalSlippage(tokenA: string, tokenB: string, tradeSize: bigint, chainId: number): Promise<SlippageCalculationResult>;
    private getTokenMetrics;
    private calculateVolatility;
    private estimateLiquidityDepth;
    private fetchPriceData;
    private getCurrentTokenPrice;
    private queryDEXLiquidity;
    private getNetworkCongestion;
    private calculateHistoricalSlippage;
    private estimatePriceImpact;
    private getTokenSymbol;
    updateSlippageConfig(newConfig: Partial<DynamicSlippageConfig>): void;
    getSlippageRecommendation(tokenA: string, tokenB: string, tradeSize: bigint, chainId: number, urgency?: 'low' | 'medium' | 'high'): Promise<{
        conservative: number;
        balanced: number;
        aggressive: number;
        recommended: number;
        reasoning: string;
    }>;
}
