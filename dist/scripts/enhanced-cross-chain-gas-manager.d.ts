interface GasBalanceStatus {
    chain: string;
    address: string;
    balance: bigint;
    status: 'sufficient' | 'low' | 'critical' | 'excess';
    needsFunding: boolean;
    fundingAmount?: bigint;
}
interface BridgeOperation {
    fromChain: string;
    toChain: string;
    amount: bigint;
    estimatedFee: bigint;
    estimatedTime: string;
    success?: boolean;
    txHash?: string;
}
export declare class EnhancedCrossChainGasManager {
    private mainnetProvider;
    private executorWallet;
    private providers;
    private isRunning;
    private readonly CHAIN_CONFIGS;
    private readonly config;
    constructor();
    initialize(): Promise<void>;
    getAllGasBalances(): Promise<GasBalanceStatus[]>;
    executeAutomaticBridging(balances: GasBalanceStatus[]): Promise<BridgeOperation[]>;
    private bridgeFromMainnet;
    private bridgeToArbitrum;
    private bridgeToOptimism;
    private monitorBridgeCompletion;
    startAutomaticMonitoring(): Promise<void>;
    private logGasStatus;
    emergencyFundAll(): Promise<void>;
    stopMonitoring(): void;
    getStatus(): Promise<void>;
}
export default EnhancedCrossChainGasManager;
