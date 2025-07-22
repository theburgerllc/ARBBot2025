import { ethers } from 'ethers';
export interface GasStrategy {
    chainId: number;
    baseFee: string;
    priorityFee: string;
    maxFee: string;
    gasLimit: string;
    strategy: 'fast' | 'standard' | 'slow';
}
export declare class GasOptimizer {
    private readonly providers;
    private gasCache;
    private readonly cacheTimeout;
    constructor(providers: Record<string, ethers.JsonRpcProvider>);
    getCurrentGasPrice(chainId: number): Promise<number>;
    private getOptimalGasPrice;
    private getArbitrumGasPrice;
    private getOptimismGasPrice;
    private getBaseGasPrice;
    private getPolygonGasPrice;
    private getEthereumGasPrice;
    private getStandardGasPrice;
    private getFallbackGasPrice;
    getGasStrategy(chainId: number, priority?: 'fast' | 'standard' | 'slow'): Promise<GasStrategy>;
    private getDefaultGasLimit;
    private getFallbackGasStrategy;
    private getProvider;
    estimateGasForTx(chainId: number, to: string, data: string, value?: string): Promise<string>;
    calculateGasCost(chainId: number, gasUsed: string): Promise<string>;
    isGasPriceOptimal(chainId: number, currentGasPrice: number): Promise<boolean>;
    clearCache(): void;
    getCacheStats(): {
        entries: number;
        oldestEntry: number;
    };
}
