"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicGasPricer = void 0;
const ethers_1 = require("ethers");
class DynamicGasPricer {
    /**
     * Calculate optimal gas pricing based on L2 dynamics
     * Uses provider.getFeeData() and implements dynamic tip calculation
     */
    static async calculateOptimalGas(provider, chainId, urgency = 'medium') {
        try {
            // Fetch current fee data from provider
            const feeData = await provider.getFeeData();
            const block = await provider.getBlock('latest');
            if (!feeData || !block) {
                throw new Error('Unable to fetch fee data or latest block');
            }
            // Extract base fee and suggested priority fee
            const baseFee = feeData.gasPrice || (0, ethers_1.parseUnits)("0.1", "gwei");
            const suggestedTip = feeData.maxPriorityFeePerGas || (0, ethers_1.parseUnits)("0.01", "gwei");
            // Calculate network congestion based on gas usage
            const gasUsedPercentage = Number(block.gasUsed * 100n / block.gasLimit);
            const networkCongestion = gasUsedPercentage / 100;
            // Calculate optimal tip using L2-specific logic
            const optimalTip = DynamicGasPricer.calculateOptimalTip(baseFee, suggestedTip, chainId, networkCongestion, urgency);
            // Calculate max fee per gas
            const maxFeePerGas = baseFee + optimalTip;
            // Determine gas limit based on chain and urgency
            const gasLimit = DynamicGasPricer.getGasLimit(chainId, urgency);
            return {
                gasLimit,
                maxFeePerGas,
                maxPriorityFeePerGas: optimalTip,
                baseFee,
                optimalTip,
                networkCongestion
            };
        }
        catch (error) {
            console.error('Error calculating optimal gas:', error);
            // Fallback values for different chains
            return DynamicGasPricer.getFallbackGasSettings(chainId, urgency);
        }
    }
    /**
     * Calculate optimal tip based on L2 network characteristics
     * Implements: optimalTip = max(baseFee * 0.1, suggestedTip) with L2 adjustments
     */
    static calculateOptimalTip(baseFee, suggestedTip, chainId, networkCongestion, urgency) {
        // Base tip calculation: max(baseFee * 0.1, suggestedTip)
        const basePercentTip = baseFee * 10n / 100n; // 10% of base fee
        let optimalTip = baseFee > suggestedTip ? basePercentTip : suggestedTip;
        // L2-specific adjustments
        if (chainId === 42161) { // Arbitrum
            // Arbitrum typically has lower and more stable fees
            optimalTip = optimalTip * 80n / 100n; // 20% reduction
            // Minimum tip for Arbitrum (observed ~0.01 gwei)
            const minArbitrumTip = (0, ethers_1.parseUnits)("0.01", "gwei");
            optimalTip = optimalTip < minArbitrumTip ? minArbitrumTip : optimalTip;
        }
        else if (chainId === 10) { // Optimism
            // Optimism can have higher priority fees (~0.10 gwei observed)
            const minOptimismTip = (0, ethers_1.parseUnits)("0.10", "gwei");
            optimalTip = optimalTip < minOptimismTip ? minOptimismTip : optimalTip;
            // Boost for congestion on Optimism
            if (networkCongestion > 0.7) {
                optimalTip = optimalTip * 150n / 100n; // 50% increase
            }
        }
        // Network congestion multiplier
        const congestionMultiplier = Math.floor((1 + networkCongestion) * 100);
        optimalTip = optimalTip * BigInt(congestionMultiplier) / 100n;
        // Urgency multiplier
        const urgencyMultipliers = {
            'low': 80n, // 20% reduction
            'medium': 100n, // No change
            'high': 200n // 100% increase for MEV competition
        };
        optimalTip = optimalTip * urgencyMultipliers[urgency] / 100n;
        // Cap maximum tip to prevent excessive fees
        const maxTip = (0, ethers_1.parseUnits)("5", "gwei");
        return optimalTip > maxTip ? maxTip : optimalTip;
    }
    /**
     * Get appropriate gas limits for different chains and urgency levels
     */
    static getGasLimit(chainId, urgency) {
        const baseGasLimits = {
            42161: 800000n, // Arbitrum
            10: 1000000n, // Optimism
            1: 500000n // Mainnet fallback
        };
        const urgencyMultipliers = {
            'low': 100n,
            'medium': 120n,
            'high': 150n
        };
        const baseLimit = baseGasLimits[chainId] || baseGasLimits[1];
        const multiplier = urgencyMultipliers[urgency];
        return baseLimit * multiplier / 100n;
    }
    /**
     * Fallback gas settings when fee data is unavailable
     */
    static getFallbackGasSettings(chainId, urgency) {
        const fallbackSettings = {
            42161: {
                baseFee: (0, ethers_1.parseUnits)("0.1", "gwei"),
                optimalTip: (0, ethers_1.parseUnits)("0.01", "gwei")
            },
            10: {
                baseFee: (0, ethers_1.parseUnits)("0.001", "gwei"),
                optimalTip: (0, ethers_1.parseUnits)("0.10", "gwei")
            },
            1: {
                baseFee: (0, ethers_1.parseUnits)("20", "gwei"),
                optimalTip: (0, ethers_1.parseUnits)("2", "gwei")
            }
        };
        const settings = fallbackSettings[chainId] || fallbackSettings[1];
        const gasLimit = DynamicGasPricer.getGasLimit(chainId, urgency);
        return {
            gasLimit,
            maxFeePerGas: settings.baseFee + settings.optimalTip,
            maxPriorityFeePerGas: settings.optimalTip,
            baseFee: settings.baseFee,
            optimalTip: settings.optimalTip,
            networkCongestion: 0.5 // Default 50%
        };
    }
    /**
     * Format gas settings for logging
     */
    static formatGasSettings(settings) {
        return `Gas: ${(0, ethers_1.formatUnits)(settings.maxFeePerGas, 'gwei')} gwei (tip: ${(0, ethers_1.formatUnits)(settings.optimalTip, 'gwei')} gwei, congestion: ${(settings.networkCongestion * 100).toFixed(1)}%)`;
    }
}
exports.DynamicGasPricer = DynamicGasPricer;
