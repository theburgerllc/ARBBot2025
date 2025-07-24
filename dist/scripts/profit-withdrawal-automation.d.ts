interface WithdrawalConfig {
    enabled: boolean;
    thresholds: {
        WETH: bigint;
        USDC: bigint;
        USDT: bigint;
        ARB: bigint;
    };
    emergencyThresholds: {
        WETH: bigint;
        USDC: bigint;
        USDT: bigint;
        ARB: bigint;
    };
    autoWithdrawInterval: number;
    maxGasPrice: bigint;
}
export declare class ProfitWithdrawalAutomation {
    private provider;
    private wallet;
    private contract;
    private config;
    private isRunning;
    private readonly tokens;
    constructor();
    initialize(contractAddress: string): Promise<void>;
    checkProfitBalances(): Promise<{
        [token: string]: bigint;
    }>;
    withdrawProfit(tokenSymbol: string, emergency?: boolean): Promise<boolean>;
    performAutomaticWithdrawals(): Promise<void>;
    startAutomaticWithdrawals(): Promise<void>;
    withdrawAllProfits(emergency?: boolean): Promise<void>;
    adjustThresholds(newThresholds: Partial<WithdrawalConfig['thresholds']>): Promise<void>;
    stopAutomaticWithdrawals(): void;
    getConfig(): WithdrawalConfig;
}
export default ProfitWithdrawalAutomation;
