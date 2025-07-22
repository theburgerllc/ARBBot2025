#!/usr/bin/env ts-node
/**
 * Simple Testnet Deployment Script - ARBBot2025
 *
 * Simplified deployment without Hardhat dependency conflicts:
 * - Direct ethers.js provider connection
 * - Contract deployment via bytecode and ABI
 * - Testnet environment setup and validation
 */
interface DeploymentResult {
    contractAddress: string;
    deploymentBlock: number;
    gasUsed: string;
    gasPrice: string;
    transactionHash: string;
}
declare class SimpleTestnetDeployer {
    private configs;
    constructor();
    private initializeConfigs;
    validateEnvironment(networkName: string): Promise<void>;
    checkBalance(networkName: string): Promise<void>;
    getContractArtifacts(): Promise<{
        bytecode: string;
        abi: any[];
    }>;
    deployContract(networkName: string): Promise<DeploymentResult>;
    saveDeploymentReport(networkName: string, result: DeploymentResult): Promise<void>;
    deployToNetwork(networkName: string): Promise<DeploymentResult>;
}
export { SimpleTestnetDeployer };
