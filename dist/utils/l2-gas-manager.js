"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.L2GasManager = void 0;
const ethers_1 = require("ethers");
// OPTIMIZATION: L2-specific gas patterns for Arbitrum and Optimism
class L2GasManager {
    arbitrumProvider;
    optimismProvider;
    mainnetProvider;
    // Arbitrum system contracts
    ARB_SYS_ADDRESS = "0x0000000000000000000000000000000000000064";
    ARB_GAS_INFO_ADDRESS = "0x000000000000000000000000000000000000006C";
    // Optimism system contracts
    OPT_GAS_ORACLE_ADDRESS = "0x420000000000000000000000000000000000000F";
    constructor(arbitrumRpc, optimismRpc, mainnetRpc) {
        this.arbitrumProvider = new ethers_1.JsonRpcProvider(arbitrumRpc);
        this.optimismProvider = new ethers_1.JsonRpcProvider(optimismRpc);
        this.mainnetProvider = new ethers_1.JsonRpcProvider(mainnetRpc);
    }
    // OPTIMIZATION: Arbitrum gas cost calculation with L1 data costs
    async getArbitrumGasCost(txData, gasLimit = 500000n) {
        try {
            // Get Arbitrum gas pricing info
            const gasInfo = await this.getArbitrumGasInfo();
            // Calculate L1 data cost (compressed transaction data posted to L1)
            const compressedData = this.compressTransactionData(txData);
            const l1DataGas = BigInt(compressedData.length) * gasInfo.l1GasPerByte;
            const l1DataCost = l1DataGas * gasInfo.l1BaseFee;
            // Calculate L2 execution cost
            const l2ExecutionGas = gasLimit;
            const l2ExecutionCost = l2ExecutionGas * gasInfo.l2BaseFee;
            const totalCost = l1DataCost + l2ExecutionCost;
            return {
                l1DataCost,
                l2ExecutionCost,
                totalCost,
                l1DataGas,
                l2ExecutionGas,
                costBreakdown: {
                    l1Percentage: Number(l1DataCost * 100n / totalCost),
                    l2Percentage: Number(l2ExecutionCost * 100n / totalCost)
                }
            };
        }
        catch (error) {
            console.error('Error calculating Arbitrum gas cost:', error);
            // Fallback calculation
            const fallbackCost = gasLimit * (0, ethers_1.parseUnits)("0.1", "gwei");
            return {
                l1DataCost: fallbackCost / 3n,
                l2ExecutionCost: fallbackCost * 2n / 3n,
                totalCost: fallbackCost,
                l1DataGas: 21000n,
                l2ExecutionGas: gasLimit,
                costBreakdown: { l1Percentage: 33, l2Percentage: 67 }
            };
        }
    }
    // OPTIMIZATION: Optimism gas cost calculation with L1 security fee
    async getOptimismGasCost(txData, gasLimit = 500000n) {
        try {
            // Get Optimism gas pricing info
            const gasInfo = await this.getOptimismGasInfo();
            // Calculate L1 data cost (transaction data posted to L1 for security)
            const txDataLength = BigInt(txData.length);
            const l1Gas = (gasInfo.overhead + txDataLength * 16n) * BigInt(Math.floor(gasInfo.scalar * 1000000)) / 1000000n;
            const l1DataCost = l1Gas * gasInfo.l1BaseFee / 1000000n; // Scalar is scaled
            // Calculate L2 execution cost
            const l2ExecutionGas = gasLimit;
            const l2ExecutionCost = l2ExecutionGas * gasInfo.l2GasPrice;
            const totalCost = l1DataCost + l2ExecutionCost;
            return {
                l1DataCost,
                l2ExecutionCost,
                totalCost,
                l1DataGas: l1Gas,
                l2ExecutionGas,
                costBreakdown: {
                    l1Percentage: Number(l1DataCost * 100n / totalCost),
                    l2Percentage: Number(l2ExecutionCost * 100n / totalCost)
                }
            };
        }
        catch (error) {
            console.error('Error calculating Optimism gas cost:', error);
            // Fallback calculation
            const fallbackCost = gasLimit * (0, ethers_1.parseUnits)("0.001", "gwei"); // Optimism is cheaper
            return {
                l1DataCost: fallbackCost / 4n,
                l2ExecutionCost: fallbackCost * 3n / 4n,
                totalCost: fallbackCost,
                l1DataGas: 21000n,
                l2ExecutionGas: gasLimit,
                costBreakdown: { l1Percentage: 25, l2Percentage: 75 }
            };
        }
    }
    // OPTIMIZATION: Compare gas costs across chains for cross-chain arbitrage
    async compareL2GasCosts(txData, gasLimit = 500000n) {
        const [arbitrumCosts, optimismCosts] = await Promise.all([
            this.getArbitrumGasCost(txData, gasLimit),
            this.getOptimismGasCost(txData, gasLimit)
        ]);
        const cheaperChain = arbitrumCosts.totalCost < optimismCosts.totalCost ? 'arbitrum' : 'optimism';
        const savings = cheaperChain === 'arbitrum'
            ? optimismCosts.totalCost - arbitrumCosts.totalCost
            : arbitrumCosts.totalCost - optimismCosts.totalCost;
        const expensiveCost = cheaperChain === 'arbitrum' ? optimismCosts.totalCost : arbitrumCosts.totalCost;
        const savingsPercentage = Number(savings * 100n / expensiveCost);
        return {
            arbitrum: arbitrumCosts,
            optimism: optimismCosts,
            recommendation: {
                cheaperChain,
                savings,
                savingsPercentage
            }
        };
    }
    // OPTIMIZATION: Dynamic gas limit estimation based on L2 characteristics
    async estimateOptimalGasLimit(chainId, transactionType) {
        const baseGasLimits = {
            'simple-swap': 300000n,
            'flash-arbitrage': 600000n,
            'batch-arbitrage': 1200000n,
            'triangular-arbitrage': 800000n
        };
        let gasLimit = baseGasLimits[transactionType];
        // Adjust for chain-specific characteristics
        if (chainId === 42161) { // Arbitrum
            // Arbitrum has lower gas costs but may need more gas for complex operations
            gasLimit = gasLimit * 110n / 100n; // +10%
        }
        else if (chainId === 10) { // Optimism
            // Optimism is more predictable, can use standard limits
            gasLimit = gasLimit * 105n / 100n; // +5%
        }
        // Add safety margin
        return gasLimit * 120n / 100n; // +20% safety margin
    }
    // OPTIMIZATION: Gas price optimization based on L2 fee structures
    async optimizeGasPriceForL2(chainId, urgency = 'medium') {
        if (chainId === 42161) { // Arbitrum
            const gasInfo = await this.getArbitrumGasInfo();
            let multiplier;
            switch (urgency) {
                case 'low':
                    multiplier = 1.1;
                    break;
                case 'medium':
                    multiplier = 1.3;
                    break;
                case 'high':
                    multiplier = 1.6;
                    break;
            }
            const maxFeePerGas = gasInfo.arbGasPrice * BigInt(Math.floor(multiplier * 100)) / 100n;
            const maxPriorityFeePerGas = maxFeePerGas / 10n; // 10% of max fee as tip
            return {
                maxFeePerGas,
                maxPriorityFeePerGas,
                estimatedCost: maxFeePerGas * 500000n // Estimate for typical transaction
            };
        }
        else if (chainId === 10) { // Optimism
            const gasInfo = await this.getOptimismGasInfo();
            let multiplier;
            switch (urgency) {
                case 'low':
                    multiplier = 1.05;
                    break;
                case 'medium':
                    multiplier = 1.15;
                    break;
                case 'high':
                    multiplier = 1.25;
                    break;
            }
            const maxFeePerGas = gasInfo.l2GasPrice * BigInt(Math.floor(multiplier * 100)) / 100n;
            const maxPriorityFeePerGas = (0, ethers_1.parseUnits)("0.001", "gwei"); // Minimal tip for Optimism
            return {
                maxFeePerGas,
                maxPriorityFeePerGas,
                estimatedCost: maxFeePerGas * 500000n
            };
        }
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    // Helper methods for fetching L2-specific gas information
    async getArbitrumGasInfo() {
        try {
            // Create contract interface for Arbitrum gas info
            const gasInfoAbi = [
                "function getPricesInWei() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
                "function getL1BaseFeeEstimate() external view returns (uint256)"
            ];
            const gasInfoInterface = new ethers_1.Interface(gasInfoAbi);
            const gasInfoContract = { address: this.ARB_GAS_INFO_ADDRESS, interface: gasInfoInterface };
            // Call the gas info contract (simplified - in practice would use contract calls)
            const l1BaseFee = await this.mainnetProvider.getFeeData();
            return {
                arbGasPrice: (0, ethers_1.parseUnits)("0.1", "gwei"), // Typical Arbitrum gas price
                l1BaseFee: l1BaseFee.gasPrice || (0, ethers_1.parseUnits)("20", "gwei"),
                l1GasPerByte: 16n, // Standard L1 gas per byte
                l2BaseFee: (0, ethers_1.parseUnits)("0.1", "gwei"),
                compressionRatio: 3 // Arbitrum compresses data ~3x
            };
        }
        catch (error) {
            // Fallback values
            return {
                arbGasPrice: (0, ethers_1.parseUnits)("0.1", "gwei"),
                l1BaseFee: (0, ethers_1.parseUnits)("20", "gwei"),
                l1GasPerByte: 16n,
                l2BaseFee: (0, ethers_1.parseUnits)("0.1", "gwei"),
                compressionRatio: 3
            };
        }
    }
    async getOptimismGasInfo() {
        try {
            // Optimism gas oracle ABI (simplified)
            const gasOracleAbi = [
                "function l1BaseFee() external view returns (uint256)",
                "function overhead() external view returns (uint256)",
                "function scalar() external view returns (uint256)",
                "function getL1Fee(bytes memory) external view returns (uint256)"
            ];
            const l1BaseFee = await this.mainnetProvider.getFeeData();
            const l2GasPrice = await this.optimismProvider.getFeeData();
            return {
                l1BaseFee: l1BaseFee.gasPrice || (0, ethers_1.parseUnits)("20", "gwei"),
                l1GasPrice: l1BaseFee.gasPrice || (0, ethers_1.parseUnits)("20", "gwei"),
                l2GasPrice: l2GasPrice.gasPrice || (0, ethers_1.parseUnits)("0.001", "gwei"),
                overhead: 2100n, // Typical Optimism overhead
                scalar: 0.684 // Current scalar value (changes over time)
            };
        }
        catch (error) {
            // Fallback values
            return {
                l1BaseFee: (0, ethers_1.parseUnits)("20", "gwei"),
                l1GasPrice: (0, ethers_1.parseUnits)("20", "gwei"),
                l2GasPrice: (0, ethers_1.parseUnits)("0.001", "gwei"),
                overhead: 2100n,
                scalar: 0.684
            };
        }
    }
    compressTransactionData(txData) {
        // Simulate Arbitrum's compression (simplified)
        // In practice, this would use actual compression algorithms
        const compressedLength = Math.floor(txData.length / 3); // ~3x compression
        return txData.slice(0, compressedLength);
    }
    // OPTIMIZATION: Batch transaction gas optimization
    async optimizeBatchGasCosts(transactions, chainId) {
        const individual = [];
        let totalIndividualCost = 0n;
        // Calculate individual costs
        for (const tx of transactions) {
            const cost = chainId === 42161
                ? await this.getArbitrumGasCost(tx)
                : await this.getOptimismGasCost(tx);
            individual.push(cost);
            totalIndividualCost += cost.totalCost;
        }
        // Calculate batch cost (combines transaction data)
        const batchTxData = transactions.join('');
        const batchGasLimit = BigInt(transactions.length) * 500000n; // Estimate
        const batch = chainId === 42161
            ? await this.getArbitrumGasCost(batchTxData, batchGasLimit)
            : await this.getOptimismGasCost(batchTxData, batchGasLimit);
        // Apply batch discount (L1 data cost efficiency)
        batch.l1DataCost = batch.l1DataCost * 80n / 100n; // 20% discount for batching
        batch.totalCost = batch.l1DataCost + batch.l2ExecutionCost;
        const savings = totalIndividualCost - batch.totalCost;
        const savingsPercentage = Number(savings * 100n / totalIndividualCost);
        return {
            individual,
            batch,
            savings,
            savingsPercentage
        };
    }
}
exports.L2GasManager = L2GasManager;
