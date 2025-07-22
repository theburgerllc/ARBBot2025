import { FlashbotsBundleProvider, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
import { JsonRpcProvider, Wallet } from "ethers";
import { GasOptimizer } from "./gas-optimizer";
import { L2GasManager } from "./l2-gas-manager";
export interface ArbitrageOpportunity {
    id: string;
    tokenA: string;
    tokenB: string;
    amountIn: string;
    expectedProfit: string;
    netProfit: string;
    gasEstimate: string;
    priority: number;
    chainId: number;
    dexPath: string[];
    confidenceScore: number;
}
export interface BundleOptimizationResult {
    bundle: FlashbotsBundleTransaction[];
    expectedProfit: bigint;
    totalGasCost: bigint;
    profitAfterGas: bigint;
    bundleScore: number;
    estimatedSuccessRate: number;
    recommendations: string[];
}
export interface BundleSimulationResult {
    success: boolean;
    gasUsed: bigint;
    profit: bigint;
    revertReason?: string;
    conflictDetected: boolean;
    competitorAnalysis: {
        similarBundles: number;
        averageGasPrice: bigint;
        recommendedGasIncrease: number;
    };
}
export interface MEVCompetitorData {
    bundleHashes: string[];
    gasPrice: bigint;
    targetBlock: number;
    estimatedProfit: bigint;
    strategy: 'arbitrage' | 'sandwich' | 'liquidation';
}
export declare class MEVBundleOptimizer {
    private flashbotsProvider;
    private gasOptimizer;
    private l2GasManager;
    private provider;
    private wallet;
    private bundleHistory;
    private competitorData;
    constructor(flashbotsProvider: FlashbotsBundleProvider, gasOptimizer: GasOptimizer, l2GasManager: L2GasManager, provider: JsonRpcProvider, wallet: Wallet);
    createOptimalBundle(opportunities: ArbitrageOpportunity[], targetBlockNumber: number): Promise<BundleOptimizationResult>;
    simulateBundle(bundle: FlashbotsBundleTransaction[], targetBlockNumber: number): Promise<BundleSimulationResult>;
    handleBundleFailure(originalBundle: FlashbotsBundleTransaction[], failureReason: string, targetBlock: number): Promise<{
        fallbackStrategy: 'public-mempool' | 'retry-bundle' | 'skip-opportunity';
        adjustedTransactions?: any[];
        recommendedGasIncrease?: number;
        reasoning: string;
    }>;
    analyzeCompetitorActivity(bundle: FlashbotsBundleTransaction[], targetBlock: number): Promise<{
        similarBundles: number;
        averageGasPrice: bigint;
        recommendedGasIncrease: number;
    }>;
    private rankOpportunitiesByProfitability;
    private selectComplementaryOpportunities;
    private optimizeBundleGasPricing;
    private createBundleTransactions;
    private calculateBundleMetrics;
    private generateOptimizationRecommendations;
    private generateBundleKey;
    private generateBundleSignature;
    private isSimilarStrategy;
    private calculateSimulationProfit;
    private prepareForPublicMempool;
}
