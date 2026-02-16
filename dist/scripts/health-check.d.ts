declare class HealthChecker {
    private provider;
    private results;
    constructor();
    runHealthCheck(): Promise<void>;
    private checkRPCConnectivity;
    private checkWalletBalance;
    private checkContractDeployment;
    private checkMemoryUsage;
    private checkEnvironmentVariables;
    private displayResults;
    private getStatusColor;
}
export { HealthChecker };
