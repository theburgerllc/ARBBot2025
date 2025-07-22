export interface VolatileToken {
    symbol: string;
    address: string;
    chainId: number;
    volatility24h: number;
    volume24h: string;
    price: string;
    lastUpdate: number;
}
export interface TokenPair {
    tokenA: VolatileToken;
    tokenB: VolatileToken;
    expectedVolatility: number;
    liquidityScore: number;
}
export declare class VolatileTokenTracker {
    private static readonly VOLATILE_TOKENS;
    /**
     * Get high-volatility token pairs for arbitrage scanning
     * Prioritizes ETH-USDT, ETH-BTC, ARB-ETH with 0.05% average spreads
     */
    static getHighVolatilityPairs(chainId: number): TokenPair[];
    /**
     * Get expanded token universe including small-cap and meme coins
     * Carefully monitors liquidity and slippage
     */
    static getExpandedTokenUniverse(chainId: number): VolatileToken[];
    /**
     * Fetch real-time volatility data from external APIs
     */
    static fetchLiveVolatilityData(tokens: string[]): Promise<{
        [symbol: string]: number;
    }>;
    /**
     * Update token volatility with live data
     */
    static updateTokenVolatility(pairs: TokenPair[]): Promise<TokenPair[]>;
    private static createVolatileToken;
    private static calculateLiquidityScore;
    /**
     * Get the most volatile tokens for dynamic expansion
     */
    static getMostVolatileTokens(chainId: number, limit?: number): VolatileToken[];
    /**
     * Format volatility data for logging
     */
    static formatVolatilityInfo(pair: TokenPair): string;
}
