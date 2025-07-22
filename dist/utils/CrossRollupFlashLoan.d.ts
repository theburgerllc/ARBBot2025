import { ethers } from 'ethers';
import { SymbiosisIntegration, CrossChainArbitrageOpp } from './SymbiosisIntegration';
export interface FlashLoanProvider {
    name: string;
    chainId: number;
    address: string;
    maxLoanAmount: string;
    feePercentage: number;
    isAvailable: boolean;
}
export interface CrossRollupFlashLoanParams {
    primaryChain: number;
    secondaryChain: number;
    flashLoanProvider: FlashLoanProvider;
    bridgeRoute: any;
    arbitrageOpportunity: CrossChainArbitrageOpp;
    minSpread: number;
}
export interface FlashLoanExecution {
    success: boolean;
    txHash?: string;
    profit?: string;
    gasUsed?: string;
    bridgeTime?: number;
    error?: string;
}
export declare class CrossRollupFlashLoan {
    private readonly providers;
    private readonly signers;
    private readonly symbiosisIntegration;
    private readonly MIN_CROSS_CHAIN_SPREAD;
    private readonly MAX_BRIDGE_TIME;
    private readonly FLASH_LOAN_FEE_BUFFER;
    private balancerVaults;
    private aaveV3Pools;
    constructor(providers: Record<string, ethers.JsonRpcProvider>, signers: Record<string, ethers.Wallet>, symbiosisIntegration: SymbiosisIntegration);
    detectCrossRollupOpportunity(tokenAddress: string, chainA: number, chainB: number, testAmount: string): Promise<CrossRollupFlashLoanParams | null>;
    private calculatePriceDifference;
    private getTokenPrice;
    private findBestFlashLoanProvider;
    private getFlashLoanProviders;
    private getMaxFlashLoan;
    private getProviderContract;
    executeCrossRollupFlashLoan(params: CrossRollupFlashLoanParams): Promise<FlashLoanExecution>;
    private validateOpportunity;
    private initiateFlashLoan;
    private waitForTransaction;
    private getChainName;
    estimateGasForCrossRollupArbitrage(params: CrossRollupFlashLoanParams): Promise<{
        flashLoanGas: string;
        bridgeGas: string;
        totalGas: string;
        estimatedCost: string;
    }>;
    getAvailableFlashLoanProviders(chainId: number): Promise<FlashLoanProvider[]>;
    calculateMinimumProfitableSpread(chainA: number, chainB: number, tokenAddress: string, amount: string): Promise<number>;
}
