interface WalletValidationResult {
    address: string;
    isValid: boolean;
    balance: string;
    transactionCount: number;
    networkConnected: boolean;
    error?: string;
}
interface NetworkValidationResult {
    name: string;
    chainId: number;
    rpcUrl: string;
    connected: boolean;
    latestBlock: number;
    gasPrice: string;
    error?: string;
}
interface DeploymentDryRunResult {
    timestamp: string;
    walletValidation: {
        executor: WalletValidationResult;
        flashbots: WalletValidationResult;
    };
    networkValidation: {
        arbitrum: NetworkValidationResult;
        optimism: NetworkValidationResult;
    };
    configurationChecks: {
        environmentVariables: boolean;
        contractAddresses: boolean;
        routerAddresses: boolean;
        tokenAddresses: boolean;
    };
    deploymentReadiness: {
        ready: boolean;
        issues: string[];
        recommendations: string[];
    };
}
export declare class DeploymentDryRunner {
    private provider;
    private wallets;
    constructor();
    private initializeProviders;
    private initializeWallets;
    validateWallet(walletType: 'executor' | 'flashbots'): Promise<WalletValidationResult>;
    validateNetwork(networkName: 'arbitrum' | 'optimism'): Promise<NetworkValidationResult>;
    private testNetworkConnectivity;
    validateConfiguration(): DeploymentDryRunResult['configurationChecks'];
    generateDeploymentReadiness(walletValidation: DeploymentDryRunResult['walletValidation'], networkValidation: DeploymentDryRunResult['networkValidation'], configChecks: DeploymentDryRunResult['configurationChecks']): DeploymentDryRunResult['deploymentReadiness'];
    runComprehensiveDryRun(): Promise<DeploymentDryRunResult>;
    private logWalletValidation;
    private logNetworkValidation;
    private logConfigurationValidation;
    private logDeploymentReadiness;
    private saveResults;
    testDeploymentSimulation(): Promise<boolean>;
}
export default DeploymentDryRunner;
