import '@nomicfoundation/hardhat-ethers';
interface ForkTestResult {
    network: string;
    forkBlock: number;
    deploymentSuccess: boolean;
    contractAddress: string;
    gasUsed: bigint;
    deploymentCost: bigint;
    verificationTests: {
        codeVerification: boolean;
        ownershipTest: boolean;
        gasFundingTest: boolean;
        balanceTest: boolean;
    };
    errors: string[];
}
export declare class ForkDeploymentTester {
    private forkProvider;
    private wallet;
    private results;
    initializeForkEnvironment(network: 'arbitrum' | 'optimism'): Promise<void>;
    private fundWalletOnFork;
    deployContractOnFork(network: 'arbitrum' | 'optimism'): Promise<ForkTestResult>;
    private runContractVerificationTests;
    testArbitrageSimulation(contractAddress: string): Promise<boolean>;
    generateForkTestReport(): Promise<void>;
    runCompleteForkTest(): Promise<boolean>;
}
export default ForkDeploymentTester;
