#!/usr/bin/env ts-node
/**
 * Testnet Automation Script - ARBBot2025
 *
 * Automated testnet setup including:
 * - Faucet token requests
 * - RPC endpoint configuration
 * - Balance validation
 * - Cross-chain bridging
 */
interface TestnetConfig {
    name: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    faucetUrl: string;
    alternativeFaucets?: string[];
    bridgeUrl?: string;
    requiredBalance: string;
    priority: number;
    estimatedWaitTime: number;
    amount: string;
}
interface FaucetResult {
    success: boolean;
    txHash?: string;
    amount?: string;
    error?: string;
    waitTime?: number;
}
declare class TestnetAutomation {
    private browser;
    private page;
    private walletAddress;
    private readonly TESTNET_CONFIGS;
    constructor();
    initialize(): Promise<void>;
    checkAllBalances(): Promise<{
        [network: string]: string;
    }>;
    requestFromMultipleFaucets(config: TestnetConfig): Promise<FaucetResult>;
    requestFaucetTokens(config: TestnetConfig, retryCount?: number): Promise<FaucetResult>;
    private handleChainlinkFaucet;
    private handlePK910Faucet;
    private handleQuickNodeFaucet;
    private handleGenericFaucet;
    private handleAlchemyFaucet;
    private handleBitbondFaucet;
    private handleLearnWeb3Faucet;
    automateEthereumToBridging(): Promise<void>;
    updateEnvironmentFile(balances: {
        [network: string]: string;
    }): Promise<void>;
    generateReport(balances: {
        [network: string]: string;
    }, faucetResults: FaucetResult[]): Promise<void>;
    private generateRecommendations;
    cleanup(): Promise<void>;
    runFullAutomation(): Promise<void>;
}
export { TestnetAutomation };
