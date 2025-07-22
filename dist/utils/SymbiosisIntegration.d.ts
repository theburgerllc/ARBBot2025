import { ethers } from 'ethers';
export interface CrossChainRoute {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amountIn: string;
    amountOut: string;
    bridgeFee: string;
    estimatedTime: number;
    route: any;
}
export interface CrossChainArbitrageOpp {
    buyChain: number;
    sellChain: number;
    token: string;
    buyPrice: string;
    sellPrice: string;
    spread: number;
    bridgeRoute: CrossChainRoute;
    profitAfterFees: string;
    isValid: boolean;
}
export declare class SymbiosisIntegration {
    private readonly providers;
    private readonly signers;
    private symbiosis;
    private readonly MIN_CROSS_CHAIN_SPREAD;
    private readonly MAX_BRIDGE_TIME;
    constructor(providers: Record<string, ethers.JsonRpcProvider>, signers: Record<string, ethers.Wallet>);
    private initializeSymbiosis;
    findCrossChainRoute(fromChainId: number, toChainId: number, fromToken: string, toToken: string, amountIn: string): Promise<CrossChainRoute | null>;
    detectCrossChainArbitrage(tokens: string[], chains: number[]): Promise<CrossChainArbitrageOpp[]>;
    private checkCrossChainOpportunity;
    private getTokenPrice;
    executeCrossChainArbitrage(opportunity: CrossChainArbitrageOpp, flashLoanAmount: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    private executeBuyOrder;
    private executeSellOrder;
    private executeBridge;
    private bridgeProfitsBack;
    private repayFlashLoan;
    private getChainName;
    getSymbiosisChainConfig(chainId: number): Promise<any>;
    getSupportedTokens(chainId: number): Promise<string[]>;
    estimateBridgeTime(fromChain: number, toChain: number): Promise<number>;
    getBridgeFee(fromChain: number, toChain: number, token: string, amount: string): Promise<string>;
}
