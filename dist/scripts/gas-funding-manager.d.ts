interface GasFundingStats {
    wallet: string;
    percentage: number;
    totalTransferred: bigint;
    currentGasBalance: bigint;
    contractProfits: {
        [token: string]: bigint;
    };
}
export declare class GasFundingManager {
    private provider;
    private wallet;
    private contract;
    private config;
    private isRunning;
    constructor();
    initialize(contractAddress: string): Promise<void>;
    setupGasFunding(): Promise<void>;
    getGasFundingStats(): Promise<GasFundingStats>;
    monitorGasFunding(): Promise<void>;
    private logGasFundingStatus;
    private checkManualWithdrawal;
    emergencyDisableGasFunding(): Promise<void>;
    adjustFundingPercentage(newPercentage: number): Promise<void>;
    stopMonitoring(): void;
}
export default GasFundingManager;
