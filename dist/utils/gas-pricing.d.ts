import { JsonRpcProvider } from "ethers";
export interface GasSettings {
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    baseFee: bigint;
    optimalTip: bigint;
    networkCongestion: number;
}
export declare class DynamicGasPricer {
    /**
     * Calculate optimal gas pricing based on L2 dynamics
     * Uses provider.getFeeData() and implements dynamic tip calculation
     */
    static calculateOptimalGas(provider: JsonRpcProvider, chainId: number, urgency?: 'low' | 'medium' | 'high'): Promise<GasSettings>;
    /**
     * Calculate optimal tip based on L2 network characteristics
     * Implements: optimalTip = max(baseFee * 0.1, suggestedTip) with L2 adjustments
     */
    private static calculateOptimalTip;
    /**
     * Get appropriate gas limits for different chains and urgency levels
     */
    private static getGasLimit;
    /**
     * Fallback gas settings when fee data is unavailable
     */
    private static getFallbackGasSettings;
    /**
     * Format gas settings for logging
     */
    static formatGasSettings(settings: GasSettings): string;
}
