interface ContractDeploymentTest {
    contractName: string;
    deploymentGas: bigint;
    deploymentCost: bigint;
    contractAddress: string;
    verified: boolean;
    initializationSuccess: boolean;
}
export declare class EnhancedDeploymentValidator {
    private providers;
    private wallets;
    private results;
    constructor();
    private initializeProviders;
    private initializeWallets;
    private addResult;
    validatePreDeploymentChecks(): Promise<boolean>;
    simulateContractDeployment(dryRun?: boolean): Promise<ContractDeploymentTest | null>;
    validateContractInteractions(contractAddress: string): Promise<boolean>;
    validateSecurityConfiguration(): Promise<boolean>;
    generateComprehensiveReport(): Promise<void>;
    runFullValidation(dryRun?: boolean): Promise<boolean>;
}
export default EnhancedDeploymentValidator;
