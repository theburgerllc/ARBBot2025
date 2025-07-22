import { ethers } from "ethers";
interface TokenMetrics {
    address: string;
    symbol: string;
    name: string;
    chainId: number;
    volume24h: number;
    volatility: number;
    liquidity: number;
    price: number;
    marketCap: number;
}
export declare class LiquidityFiltering {
    private readonly providers;
    private readonly chains;
    private readonly minLiquidity;
    private readonly minVolume24h;
    private readonly topTokensCount;
    constructor(providers: Record<string, ethers.JsonRpcProvider>);
    fetchTopTokensByVolatility(chainId: number): Promise<TokenMetrics[]>;
    private processDexScreenerData;
    private calculateVolatility;
    private isStablecoin;
    private getChainName;
    private getFallbackTokens;
    getTopTokensForAllChains(): Promise<Record<number, TokenMetrics[]>>;
    validateTokenLiquidity(tokenAddress: string, chainId: number): Promise<boolean>;
}
export {};
