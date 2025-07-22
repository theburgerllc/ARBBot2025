#!/usr/bin/env ts-node
/**
 * Enhanced Testnet Deployment Script - ARBBot2025
 *
 * Comprehensive deployment with:
 * - Automated testnet environment setup
 * - Balance validation and auto-funding
 * - Smart contract deployment with verification
 * - Post-deployment testing and validation
 */
interface DeploymentResult {
    contractAddress: string;
    deploymentBlock: number;
    gasUsed: string;
    gasPrice: string;
    transactionHash: string;
    verified: boolean;
}
declare class TestnetDeployer {
    private testnetConfigs;
    constructor();
    private initializeConfigs;
    validateEnvironment(networkName: string): Promise<void>;
    checkAndEnsureBalance(networkName: string): Promise<void>;
    private getFaucetUrl;
    deployContract(networkName: string): Promise<DeploymentResult>;
    postDeploymentValidation(networkName: string, result: DeploymentResult): Promise<void>;
    updateEnvironmentFile(networkName: string, result: DeploymentResult): Promise<void>;
    saveDeploymentReport(networkName: string, result: DeploymentResult): Promise<void>;
    deployToNetwork(networkName: string): Promise<DeploymentResult>;
    runPreDeploymentSetup(): Promise<void>;
}
export { TestnetDeployer };
