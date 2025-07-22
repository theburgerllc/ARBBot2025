import { JsonRpcProvider } from "ethers";
export interface PriceSource {
    name: string;
    price: bigint;
    timestamp: number;
    confidence: number;
    chainId: number;
    source: 'chainlink' | 'uniswap_twap' | 'band_protocol' | 'api3' | 'dex_spot' | 'coingecko';
    metadata?: any;
}
export interface PriceValidationResult {
    isValid: boolean;
    consensusPrice: bigint;
    dexPrice: bigint;
    deviation: number;
    deviationBps: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    sources: PriceSource[];
    manipulationScore: number;
    recommendation: 'execute' | 'caution' | 'reject';
}
export interface ManipulationIndicators {
    volumeSpike: boolean;
    priceGap: boolean;
    crossDEXDivergence: boolean;
    timeSeriesAnomaly: boolean;
    liquidityDrain: boolean;
}
export interface OracleConfig {
    deviationThresholds: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    minSources: number;
    twapPeriods: {
        short: number;
        medium: number;
        long: number;
    };
    confidenceWeights: Record<string, number>;
}
export declare class OraclePriceValidator {
    private providers;
    private config;
    private priceFeeds;
    private priceHistory;
    constructor(providers: Map<number, JsonRpcProvider>);
    validateTokenPrice(tokenA: string, tokenB: string, dexPrice: bigint, chainId: number, tradeSize?: bigint): Promise<PriceValidationResult>;
    private detectManipulationPatterns;
    private calculateManipulationScore;
    private generateRecommendation;
    private calculateConsensusPrice;
    private getChainlinkPrice;
    private getUniswapTWAP;
    private getBandProtocolPrice;
    private getAPI3Price;
    private getCoingeckoPrice;
    private checkVolumeSpike;
    private checkPriceGap;
    private checkCrossDEXDivergence;
    private checkTimeSeriesAnomalies;
    private checkLiquidityDrain;
    private initializePriceFeeds;
    private getChainlinkFeedAddress;
    private getUniswapV3PoolAddress;
    private tickToPrice;
    private getCoingeckoTokenId;
    private storePriceData;
    updateConfig(newConfig: Partial<OracleConfig>): void;
    getPriceHistory(tokenA: string, tokenB: string, chainId: number): Array<{
        price: bigint;
        timestamp: number;
    }>;
    clearPriceHistory(): void;
}
