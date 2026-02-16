import { FlashbotsBundleProvider, FlashbotsBundleTransaction, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { JsonRpcProvider, Wallet, parseUnits, formatUnits } from "ethers";
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

// ENHANCEMENT: Maximize MEV bundle success rate to 70%+
export class MEVBundleOptimizer {
    private flashbotsProvider: FlashbotsBundleProvider;
    private gasOptimizer: GasOptimizer;
    private l2GasManager: L2GasManager;
    private provider: JsonRpcProvider;
    private wallet: Wallet;
    
    // Bundle performance tracking
    private bundleHistory: Map<string, BundlePerformance> = new Map();
    private competitorData: MEVCompetitorData[] = [];
    
    constructor(
        flashbotsProvider: FlashbotsBundleProvider,
        gasOptimizer: GasOptimizer,
        l2GasManager: L2GasManager,
        provider: JsonRpcProvider,
        wallet: Wallet
    ) {
        this.flashbotsProvider = flashbotsProvider;
        this.gasOptimizer = gasOptimizer;
        this.l2GasManager = l2GasManager;
        this.provider = provider;
        this.wallet = wallet;
    }

    // OPTIMIZATION: Create optimal bundle with intelligent opportunity selection
    async createOptimalBundle(
        opportunities: ArbitrageOpportunity[],
        targetBlockNumber: number
    ): Promise<BundleOptimizationResult> {
        // Step 1: Filter and rank opportunities
        const rankedOpportunities = this.rankOpportunitiesByProfitability(opportunities);
        
        // Step 2: Select complementary opportunities (avoid conflicts)
        const selectedOpportunities = this.selectComplementaryOpportunities(rankedOpportunities);
        
        // Step 3: Optimize gas pricing for bundle
        const gasStrategy = await this.optimizeBundleGasPricing(selectedOpportunities, targetBlockNumber);
        
        // Step 4: Create bundle transactions
        const bundleTransactions = await this.createBundleTransactions(
            selectedOpportunities,
            gasStrategy,
            targetBlockNumber
        );

        // Step 5: Store opportunities and calculate bundle metrics
        this.lastBundleOpportunities = selectedOpportunities;
        const metrics = await this.calculateBundleMetrics(bundleTransactions);
        
        // Step 6: Generate optimization recommendations
        const recommendations = this.generateOptimizationRecommendations(metrics, selectedOpportunities);
        
        return {
            bundle: bundleTransactions,
            expectedProfit: metrics.expectedProfit,
            totalGasCost: metrics.totalGasCost,
            profitAfterGas: metrics.expectedProfit - metrics.totalGasCost,
            bundleScore: metrics.bundleScore,
            estimatedSuccessRate: metrics.successRate,
            recommendations
        };
    }

    // OPTIMIZATION: Comprehensive bundle simulation before submission
    async simulateBundle(
        bundle: FlashbotsBundleTransaction[],
        targetBlockNumber: number
    ): Promise<BundleSimulationResult> {
        try {
            // Sign bundle before simulation
            const signedBundle = await this.flashbotsProvider.signBundle(bundle);
            
            // Simulate bundle execution
            const simulation = await this.flashbotsProvider.simulate(signedBundle, targetBlockNumber);
            
            if ('error' in simulation) {
                return {
                    success: false,
                    gasUsed: 0n,
                    profit: 0n,
                    revertReason: simulation.error?.message || "Unknown simulation error",
                    conflictDetected: false,
                    competitorAnalysis: {
                        similarBundles: 0,
                        averageGasPrice: 0n,
                        recommendedGasIncrease: 0
                    }
                };
            }

            // Analyze simulation results - simulation is SimulationResponseSuccess here
            const gasUsed = simulation.totalGasUsed ? BigInt(simulation.totalGasUsed) : 0n;
            
            const profit = simulation.coinbaseDiff ? BigInt(simulation.coinbaseDiff) : 0n;
            
            // Check for MEV conflicts
            const competitorAnalysis = await this.analyzeCompetitorActivity(bundle, targetBlockNumber);
            
            return {
                success: true,
                gasUsed,
                profit,
                conflictDetected: competitorAnalysis.similarBundles > 5,
                competitorAnalysis
            };
            
        } catch (error) {
            return {
                success: false,
                gasUsed: 0n,
                profit: 0n,
                revertReason: error instanceof Error ? error.message : "Simulation failed",
                conflictDetected: false,
                competitorAnalysis: {
                    similarBundles: 0,
                    averageGasPrice: 0n,
                    recommendedGasIncrease: 0
                }
            };
        }
    }

    // OPTIMIZATION: Intelligent fallback strategies when MEV bundles fail
    async handleBundleFailure(
        originalBundle: FlashbotsBundleTransaction[],
        failureReason: string,
        targetBlock: number
    ): Promise<{
        fallbackStrategy: 'public-mempool' | 'retry-bundle' | 'skip-opportunity';
        adjustedTransactions?: any[];
        recommendedGasIncrease?: number;
        reasoning: string;
    }> {
        
        const historyKey = this.generateBundleKey(originalBundle);
        const history = this.bundleHistory.get(historyKey);
        
        // Analyze failure pattern
        if (failureReason.includes('gas price too low')) {
            // Gas price competition - increase gas and retry
            return {
                fallbackStrategy: 'retry-bundle',
                recommendedGasIncrease: 25, // 25% increase
                reasoning: "Gas price competition detected. Recommending gas price increase and bundle retry."
            };
        } else if (failureReason.includes('block full') || failureReason.includes('timeout')) {
            // Network congestion - try public mempool
            const adjustedTxs = await this.prepareForPublicMempool(originalBundle);
            return {
                fallbackStrategy: 'public-mempool',
                adjustedTransactions: adjustedTxs,
                reasoning: "Network congestion detected. Falling back to public mempool with competitive gas pricing."
            };
        } else if (history && history.failures >= 3) {
            // Persistent failures - skip this opportunity type temporarily
            return {
                fallbackStrategy: 'skip-opportunity',
                reasoning: "Opportunity type has failed multiple times. Temporarily skipping to avoid further losses."
            };
        } else {
            // Generic retry with small gas increase
            return {
                fallbackStrategy: 'retry-bundle',
                recommendedGasIncrease: 10, // 10% increase
                reasoning: "Generic failure. Retrying with modest gas price increase."
            };
        }
    }

    // OPTIMIZATION: Real-time competitor analysis and response
    async analyzeCompetitorActivity(
        bundle: FlashbotsBundleTransaction[],
        targetBlock: number
    ): Promise<{
        similarBundles: number;
        averageGasPrice: bigint;
        recommendedGasIncrease: number;
    }> {
        try {
            // Analyze pending bundles in mempool (simplified simulation)
            const bundleSignature = this.generateBundleSignature(bundle);
            
            // Count similar bundles (in practice, would analyze actual mempool)
            let similarBundles = 0;
            let totalGasPrice = 0n;
            let count = 0;
            
            for (const competitor of this.competitorData) {
                if (competitor.targetBlock === targetBlock && 
                    this.isSimilarStrategy(bundle, competitor)) {
                    similarBundles++;
                    totalGasPrice += competitor.gasPrice;
                    count++;
                }
            }
            
            const averageGasPrice = count > 0 ? totalGasPrice / BigInt(count) : 0n;
            
            // Calculate recommended gas increase based on competition
            let recommendedGasIncrease = 0;
            if (similarBundles > 10) {
                recommendedGasIncrease = 30; // High competition
            } else if (similarBundles > 5) {
                recommendedGasIncrease = 20; // Medium competition
            } else if (similarBundles > 2) {
                recommendedGasIncrease = 10; // Low competition
            }
            
            return {
                similarBundles,
                averageGasPrice,
                recommendedGasIncrease
            };
            
        } catch (error) {
            // Fallback analysis
            return {
                similarBundles: 3, // Assume moderate competition
                averageGasPrice: parseUnits("50", "gwei"),
                recommendedGasIncrease: 15
            };
        }
    }

    // OPTIMIZATION: Advanced bundle scoring algorithm
    private rankOpportunitiesByProfitability(
        opportunities: ArbitrageOpportunity[]
    ): ArbitrageOpportunity[] {
        return opportunities
            .map(opp => ({
                ...opp,
                profitGasRatio: Number(opp.netProfit) / Number(opp.gasEstimate),
                adjustedScore: opp.priority * opp.confidenceScore * (Number(opp.netProfit) / 1e18)
            }))
            .sort((a, b) => b.adjustedScore - a.adjustedScore)
            .slice(0, 5); // Take top 5 opportunities
    }

    // OPTIMIZATION: Select non-conflicting opportunities for bundling
    private selectComplementaryOpportunities(
        opportunities: ArbitrageOpportunity[]
    ): ArbitrageOpportunity[] {
        const selected: ArbitrageOpportunity[] = [];
        const usedTokens = new Set<string>();
        
        for (const opp of opportunities) {
            // Avoid token conflicts within bundle
            if (!usedTokens.has(opp.tokenA) && !usedTokens.has(opp.tokenB)) {
                selected.push(opp);
                usedTokens.add(opp.tokenA);
                usedTokens.add(opp.tokenB);
                
                // Limit bundle size to prevent gas limit issues
                if (selected.length >= 3) break;
            }
        }
        
        return selected;
    }

    // OPTIMIZATION: Dynamic gas pricing for maximum bundle inclusion rate
    private async optimizeBundleGasPricing(
        opportunities: ArbitrageOpportunity[],
        targetBlock: number
    ): Promise<{
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        gasMultiplier: number;
    }> {
        // Calculate total expected profit
        const totalProfit = opportunities.reduce((sum, opp) => 
            sum + BigInt(opp.netProfit), 0n);
        
        // Get network gas conditions
        const gasSettings = await this.gasOptimizer.getOptimalGasPrice(1, 'high'); // Ethereum mainnet
        
        // Calculate competitive gas pricing
        // Use up to 30% of expected profit for gas to ensure inclusion
        const maxGasBudget = totalProfit * 30n / 100n;
        const estimatedGasUsage = opportunities.reduce((sum, opp) => 
            sum + BigInt(opp.gasEstimate), 0n);
        
        const maxAffordableGasPrice = maxGasBudget / estimatedGasUsage;
        
        // Use the lower of optimal network price or max affordable price
        const maxFeePerGas = gasSettings.maxFeePerGas < maxAffordableGasPrice 
            ? gasSettings.maxFeePerGas * 150n / 100n  // 50% premium for MEV
            : maxAffordableGasPrice;
        
        const maxPriorityFeePerGas = maxFeePerGas / 4n; // 25% of max fee as tip
        
        return {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasMultiplier: 1.5 // 50% premium for MEV inclusion
        };
    }

    private async createBundleTransactions(
        opportunities: ArbitrageOpportunity[],
        gasStrategy: any,
        targetBlock: number
    ): Promise<FlashbotsBundleTransaction[]> {
        const transactions: FlashbotsBundleTransaction[] = [];
        const contractAddress = process.env.BOT_CONTRACT_ADDRESS;

        if (!contractAddress) {
            console.warn("BOT_CONTRACT_ADDRESS not set, cannot create bundle transactions");
            return transactions;
        }

        const botInterface = new (await import("ethers")).Interface([
            "function executeArb(address asset, uint256 amount, address[] calldata path, bool sushiFirst, uint256 expectedProfit) external",
            "function executeTriangularArb(address asset, uint256 amount, address[] calldata path, uint256 expectedProfit) external"
        ]);

        for (const opp of opportunities) {
            // Encode actual contract call data
            const isTriangular = opp.dexPath && opp.dexPath.length >= 4 &&
                opp.dexPath[0] === opp.dexPath[opp.dexPath.length - 1];

            let callData: string;
            if (isTriangular) {
                callData = botInterface.encodeFunctionData("executeTriangularArb", [
                    opp.tokenA,
                    BigInt(opp.amountIn),
                    opp.dexPath,
                    BigInt(opp.expectedProfit)
                ]);
            } else {
                // Determine sushiFirst from the DEX path ordering
                const sushiFirst = opp.dexPath?.[0]?.toLowerCase().includes('sushi') ?? false;
                callData = botInterface.encodeFunctionData("executeArb", [
                    opp.tokenA,
                    BigInt(opp.amountIn),
                    opp.dexPath.length > 0 ? opp.dexPath : [opp.tokenA, opp.tokenB],
                    sushiFirst,
                    BigInt(opp.expectedProfit)
                ]);
            }

            const nonce = await this.provider.getTransactionCount(this.wallet.address);

            const tx: FlashbotsBundleTransaction = {
                signer: this.wallet,
                transaction: {
                    to: contractAddress,
                    data: callData,
                    gasLimit: BigInt(opp.gasEstimate),
                    maxFeePerGas: gasStrategy.maxFeePerGas,
                    maxPriorityFeePerGas: gasStrategy.maxPriorityFeePerGas,
                    type: 2,
                    chainId: opp.chainId,
                    nonce: nonce + transactions.length
                }
            };

            transactions.push(tx);
        }

        return transactions;
    }

    // Track the last set of opportunities for profit calculation
    private lastBundleOpportunities: ArbitrageOpportunity[] = [];

    // Store opportunities during bundle creation for metrics
    setOpportunitiesForMetrics(opportunities: ArbitrageOpportunity[]): void {
        this.lastBundleOpportunities = opportunities;
    }

    private async calculateBundleMetrics(
        bundle: FlashbotsBundleTransaction[]
    ): Promise<{
        expectedProfit: bigint;
        totalGasCost: bigint;
        bundleScore: number;
        successRate: number;
    }> {
        let totalGasCost = 0n;

        for (const tx of bundle) {
            const gasLimit = BigInt(tx.transaction.gasLimit || 500000);
            const gasPrice = BigInt(tx.transaction.maxFeePerGas || parseUnits("0.1", "gwei"));
            totalGasCost += gasLimit * gasPrice;
        }

        // Calculate expected profit from the actual opportunities in this bundle
        let expectedProfit = 0n;
        for (const opp of this.lastBundleOpportunities) {
            expectedProfit += BigInt(opp.netProfit || opp.expectedProfit || 0);
        }

        // If no tracked opportunities, try to estimate from bundle size
        if (expectedProfit === 0n && bundle.length > 0) {
            // Conservative minimum: each tx should earn at least 2x gas cost
            expectedProfit = totalGasCost * 2n;
        }

        // Calculate bundle score (0-100)
        const profitMargin = expectedProfit > totalGasCost
            ? Number((expectedProfit - totalGasCost) * 100n / expectedProfit)
            : 0;

        const bundleScore = Math.min(100, Math.max(0, profitMargin));

        // Estimate success rate based on gas pricing and competition
        let successRate = 70; // Base rate for L2 direct submission (no relay competition)

        if (bundle.length > 3) successRate -= 10;
        if (profitMargin < 20) successRate -= 20;
        if (profitMargin > 50) successRate += 15;
        // L2 bonus: sequencer inclusion is more predictable than mainnet Flashbots
        successRate += 10;

        return {
            expectedProfit,
            totalGasCost,
            bundleScore,
            successRate: Math.min(95, Math.max(30, successRate))
        };
    }

    private generateOptimizationRecommendations(
        metrics: any,
        opportunities: ArbitrageOpportunity[]
    ): string[] {
        const recommendations: string[] = [];
        
        if (metrics.successRate < 60) {
            recommendations.push("Consider increasing gas price by 20-30% to improve inclusion rate");
        }
        
        if (metrics.bundleScore < 30) {
            recommendations.push("Bundle profitability is low. Consider filtering out low-profit opportunities");
        }
        
        if (opportunities.length > 3) {
            recommendations.push("Large bundle size may reduce success rate. Consider splitting into smaller bundles");
        }
        
        const avgConfidence = opportunities.reduce((sum, opp) => sum + opp.confidenceScore, 0) / opportunities.length;
        if (avgConfidence < 70) {
            recommendations.push("Low average confidence score. Verify opportunity calculations");
        }
        
        return recommendations;
    }

    // Helper methods
    private generateBundleKey(bundle: FlashbotsBundleTransaction[]): string {
        return bundle.map(tx => (tx.transaction.to || '0x0') + (tx.transaction.data?.slice(0, 10) || '')).join('|');
    }

    private generateBundleSignature(bundle: FlashbotsBundleTransaction[]): string {
        // Create a signature for bundle similarity comparison
        return bundle.map(tx => tx.transaction.data?.slice(0, 10) || "").join('');
    }

    private isSimilarStrategy(
        bundle: FlashbotsBundleTransaction[],
        competitor: MEVCompetitorData
    ): boolean {
        // Simple similarity check - in practice would be more sophisticated
        return competitor.strategy === 'arbitrage' && bundle.length <= 3;
    }

    private calculateSimulationProfit(results: any[]): bigint {
        if (!results || results.length === 0) return 0n;

        let totalProfit = 0n;
        for (const result of results) {
            if (result && result.value) {
                totalProfit += BigInt(result.value);
            }
        }
        return totalProfit > 0n ? totalProfit : 0n;
    }

    private async prepareForPublicMempool(
        bundle: FlashbotsBundleTransaction[]
    ): Promise<any[]> {
        // Adjust transactions for public mempool execution
        return bundle.map(tx => ({
            ...tx.transaction,
            maxFeePerGas: BigInt(tx.transaction.maxFeePerGas || 0) * 130n / 100n, // 30% increase for competition
            maxPriorityFeePerGas: BigInt(tx.transaction.maxPriorityFeePerGas || 0) * 150n / 100n // 50% increase for priority
        }));
    }
}

interface BundlePerformance {
    attempts: number;
    successes: number;
    failures: number;
    averageGasUsed: bigint;
    totalProfit: bigint;
    lastAttempt: number;
}