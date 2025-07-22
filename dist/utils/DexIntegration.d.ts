import { ethers } from "ethers";
export interface DexRoute {
    dexName: string;
    path: string[];
    amountIn: string;
    amountOut: string;
    gasEstimate: string;
    priceImpact: number;
    fee: number;
}
export interface QuoteResult {
    bestRoute: DexRoute;
    allRoutes: DexRoute[];
    executionTime: number;
}
export declare class DexIntegration {
    private readonly providers;
    private readonly chainId;
    private curveApi;
    private gmxReader;
    constructor(providers: Record<string, ethers.JsonRpcProvider>, chainId: number);
    private initializeCurve;
    private initializeGMX;
    private getNetworkName;
    getCurveRoutes(tokenIn: string, tokenOut: string, amountIn: string): Promise<DexRoute[]>;
    getGMXRoutes(tokenIn: string, tokenOut: string, amountIn: string): Promise<DexRoute[]>;
    getUniswapV3Routes(tokenIn: string, tokenOut: string, amountIn: string): Promise<DexRoute[]>;
    private getUniswapV3QuoterAddress;
    getBalancerRoutes(tokenIn: string, tokenOut: string, amountIn: string): Promise<DexRoute[]>;
    getAllRoutes(tokenIn: string, tokenOut: string, amountIn: string): Promise<QuoteResult>;
    estimateGasForRoute(route: DexRoute): Promise<string>;
    validateRoute(route: DexRoute): Promise<boolean>;
    getOptimalSlippage(route: DexRoute): Promise<number>;
}
