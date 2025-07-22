export interface L2GasCosts {
    l1DataCost: bigint;
    l2ExecutionCost: bigint;
    totalCost: bigint;
    l1DataGas: bigint;
    l2ExecutionGas: bigint;
    costBreakdown: {
        l1Percentage: number;
        l2Percentage: number;
    };
}
export interface ArbitrumGasMetrics {
    arbGasPrice: bigint;
    l1BaseFee: bigint;
    l1GasPerByte: bigint;
    l2BaseFee: bigint;
    compressionRatio: number;
}
export interface OptimismGasMetrics {
    l1BaseFee: bigint;
    l1GasPrice: bigint;
    l2GasPrice: bigint;
    overhead: bigint;
    scalar: number;
}
export declare class L2GasManager {
    private arbitrumProvider;
    private optimismProvider;
    private mainnetProvider;
    private readonly ARB_SYS_ADDRESS;
    private readonly ARB_GAS_INFO_ADDRESS;
    private readonly OPT_GAS_ORACLE_ADDRESS;
    constructor(arbitrumRpc: string, optimismRpc: string, mainnetRpc: string);
    getArbitrumGasCost(txData: string, gasLimit?: bigint): Promise<L2GasCosts>;
    getOptimismGasCost(txData: string, gasLimit?: bigint): Promise<L2GasCosts>;
    compareL2GasCosts(txData: string, gasLimit?: bigint): Promise<{
        arbitrum: L2GasCosts;
        optimism: L2GasCosts;
        recommendation: {
            cheaperChain: 'arbitrum' | 'optimism';
            savings: bigint;
            savingsPercentage: number;
        };
    }>;
    estimateOptimalGasLimit(chainId: number, transactionType: 'simple-swap' | 'flash-arbitrage' | 'batch-arbitrage' | 'triangular-arbitrage'): Promise<bigint>;
    optimizeGasPriceForL2(chainId: number, urgency?: 'low' | 'medium' | 'high'): Promise<{
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        estimatedCost: bigint;
    }>;
    private getArbitrumGasInfo;
    private getOptimismGasInfo;
    private compressTransactionData;
    optimizeBatchGasCosts(transactions: string[], chainId: number): Promise<{
        individual: L2GasCosts[];
        batch: L2GasCosts;
        savings: bigint;
        savingsPercentage: number;
    }>;
}
