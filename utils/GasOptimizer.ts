import { ethers } from 'ethers';

export interface GasStrategy {
  chainId: number;
  baseFee: string;
  priorityFee: string;
  maxFee: string;
  gasLimit: string;
  strategy: 'fast' | 'standard' | 'slow';
}

export class GasOptimizer {
  private gasCache: Map<number, { gasPrice: number; timestamp: number }> = new Map();
  private readonly cacheTimeout = 10000; // 10 seconds

  constructor(private readonly providers: Record<string, ethers.JsonRpcProvider>) {}

  async getCurrentGasPrice(chainId: number): Promise<number> {
    const cached = this.gasCache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.gasPrice;
    }

    try {
      const provider = this.getProvider(chainId);
      if (!provider) throw new Error(`No provider for chain ${chainId}`);

      const gasPrice = await this.getOptimalGasPrice(chainId, provider);
      
      this.gasCache.set(chainId, {
        gasPrice,
        timestamp: Date.now()
      });

      return gasPrice;
    } catch (error) {
      console.error(`Error getting gas price for chain ${chainId}:`, error);
      return this.getFallbackGasPrice(chainId);
    }
  }

  private async getOptimalGasPrice(chainId: number, provider: ethers.JsonRpcProvider): Promise<number> {
    switch (chainId) {
      case 42161: // Arbitrum
        return await this.getArbitrumGasPrice(provider);
      case 10: // Optimism
        return await this.getOptimismGasPrice(provider);
      case 8453: // Base
        return await this.getBaseGasPrice(provider);
      case 137: // Polygon
        return await this.getPolygonGasPrice(provider);
      case 1: // Ethereum
        return await this.getEthereumGasPrice(provider);
      default:
        return await this.getStandardGasPrice(provider);
    }
  }

  private async getArbitrumGasPrice(provider: ethers.JsonRpcProvider): Promise<number> {
    try {
      // Arbitrum: tip = 0 (full refund model)
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
      
      // Arbitrum refunds the tip, so we set it to 0
      return parseInt(baseFee.toString());
    } catch (error) {
      console.error('Error getting Arbitrum gas price:', error);
      return parseInt(ethers.parseUnits('0.1', 'gwei').toString());
    }
  }

  private async getOptimismGasPrice(provider: ethers.JsonRpcProvider): Promise<number> {
    try {
      // Optimism: tip = max(1 gwei, baseFee * 0.05), maxFee = baseFee * 1.5 + tip
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('0.001', 'gwei');
      
      const minTip = ethers.parseUnits('1', 'gwei');
      const calculatedTip = baseFee * 5n / 100n; // 5% of base fee
      const tip = calculatedTip > minTip ? calculatedTip : minTip;
      
      const maxFee = baseFee * 150n / 100n + tip; // 1.5x base fee + tip
      
      return parseInt(maxFee.toString());
    } catch (error) {
      console.error('Error getting Optimism gas price:', error);
      return parseInt(ethers.parseUnits('0.001', 'gwei').toString());
    }
  }

  private async getBaseGasPrice(provider: ethers.JsonRpcProvider): Promise<number> {
    try {
      // Base: similar to Optimism strategy
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('0.001', 'gwei');
      
      const minTip = ethers.parseUnits('1', 'gwei');
      const calculatedTip = baseFee * 5n / 100n;
      const tip = calculatedTip > minTip ? calculatedTip : minTip;
      
      const maxFee = baseFee * 150n / 100n + tip;
      
      return parseInt(maxFee.toString());
    } catch (error) {
      console.error('Error getting Base gas price:', error);
      return parseInt(ethers.parseUnits('0.001', 'gwei').toString());
    }
  }

  private async getPolygonGasPrice(provider: ethers.JsonRpcProvider): Promise<number> {
    try {
      // Polygon: standard EIP-1559 with higher base fees
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      
      const tip = ethers.parseUnits('30', 'gwei'); // Standard tip for Polygon
      const maxFee = baseFee * 2n + tip;
      
      return parseInt(maxFee.toString());
    } catch (error) {
      console.error('Error getting Polygon gas price:', error);
      return parseInt(ethers.parseUnits('30', 'gwei').toString());
    }
  }

  private async getEthereumGasPrice(provider: ethers.JsonRpcProvider): Promise<number> {
    try {
      // Ethereum: EIP-1559 with priority fee
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
      
      const maxFee = baseFee * 2n + priorityFee;
      
      return parseInt(maxFee.toString());
    } catch (error) {
      console.error('Error getting Ethereum gas price:', error);
      return parseInt(ethers.parseUnits('20', 'gwei').toString());
    }
  }

  private async getStandardGasPrice(provider: ethers.JsonRpcProvider): Promise<number> {
    try {
      const feeData = await provider.getFeeData();
      return parseInt((feeData.gasPrice || ethers.parseUnits('1', 'gwei')).toString());
    } catch (error) {
      console.error('Error getting standard gas price:', error);
      return parseInt(ethers.parseUnits('1', 'gwei').toString());
    }
  }

  private getFallbackGasPrice(chainId: number): number {
    const fallbackPrices: Record<number, string> = {
      1: '20', // Ethereum - 20 gwei
      10: '0.001', // Optimism - 0.001 gwei
      42161: '0.1', // Arbitrum - 0.1 gwei
      8453: '0.001', // Base - 0.001 gwei
      137: '30', // Polygon - 30 gwei
    };

    const fallbackPrice = fallbackPrices[chainId] || '1';
    return parseInt(ethers.parseUnits(fallbackPrice, 'gwei').toString());
  }

  async getGasStrategy(chainId: number, priority: 'fast' | 'standard' | 'slow' = 'standard'): Promise<GasStrategy> {
    try {
      const provider = this.getProvider(chainId);
      if (!provider) throw new Error(`No provider for chain ${chainId}`);

      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
      
      let priorityFee: bigint;
      let maxFee: bigint;
      
      switch (priority) {
        case 'fast':
          priorityFee = baseFee * 20n / 100n; // 20% of base fee
          maxFee = baseFee * 200n / 100n + priorityFee;
          break;
        case 'slow':
          priorityFee = baseFee * 5n / 100n; // 5% of base fee
          maxFee = baseFee * 110n / 100n + priorityFee;
          break;
        default: // standard
          priorityFee = baseFee * 10n / 100n; // 10% of base fee
          maxFee = baseFee * 150n / 100n + priorityFee;
      }

      // Apply chain-specific adjustments
      if (chainId === 42161) {
        // Arbitrum - set tip to 0
        priorityFee = 0n;
        maxFee = baseFee;
      } else if (chainId === 10 || chainId === 8453) {
        // Optimism/Base - ensure minimum tip
        const minTip = ethers.parseUnits('1', 'gwei');
        if (priorityFee < minTip) {
          priorityFee = minTip;
          maxFee = baseFee * 150n / 100n + priorityFee;
        }
      }

      return {
        chainId,
        baseFee: baseFee.toString(),
        priorityFee: priorityFee.toString(),
        maxFee: maxFee.toString(),
        gasLimit: this.getDefaultGasLimit(chainId),
        strategy: priority
      };
    } catch (error) {
      console.error(`Error getting gas strategy for chain ${chainId}:`, error);
      return this.getFallbackGasStrategy(chainId, priority);
    }
  }

  private getDefaultGasLimit(chainId: number): string {
    const defaultLimits: Record<number, string> = {
      1: '200000', // Ethereum
      10: '150000', // Optimism
      42161: '300000', // Arbitrum - higher due to L2 overhead
      8453: '150000', // Base
      137: '200000', // Polygon
    };

    return defaultLimits[chainId] || '200000';
  }

  private getFallbackGasStrategy(chainId: number, priority: 'fast' | 'standard' | 'slow'): GasStrategy {
    const fallbackPrice = this.getFallbackGasPrice(chainId);
    
    return {
      chainId,
      baseFee: fallbackPrice.toString(),
      priorityFee: (fallbackPrice * 0.1).toString(),
      maxFee: (fallbackPrice * 1.5).toString(),
      gasLimit: this.getDefaultGasLimit(chainId),
      strategy: priority
    };
  }

  private getProvider(chainId: number): ethers.JsonRpcProvider | null {
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      10: 'optimism',
      42161: 'arbitrum',
      8453: 'base',
      137: 'polygon'
    };

    const chainName = chainNames[chainId];
    return chainName ? this.providers[chainName] : null;
  }

  async estimateGasForTx(
    chainId: number,
    to: string,
    data: string,
    value: string = '0'
  ): Promise<string> {
    try {
      const provider = this.getProvider(chainId);
      if (!provider) throw new Error(`No provider for chain ${chainId}`);

      const gasEstimate = await provider.estimateGas({
        to,
        data,
        value: ethers.parseEther(value)
      });

      // Add 20% buffer for safety
      const bufferedGas = gasEstimate * 120n / 100n;
      return bufferedGas.toString();
    } catch (error) {
      console.error(`Error estimating gas for chain ${chainId}:`, error);
      return this.getDefaultGasLimit(chainId);
    }
  }

  async calculateGasCost(chainId: number, gasUsed: string): Promise<string> {
    try {
      const gasPrice = await this.getCurrentGasPrice(chainId);
      const cost = BigInt(gasUsed) * BigInt(gasPrice);
      return ethers.formatEther(cost);
    } catch (error) {
      console.error(`Error calculating gas cost for chain ${chainId}:`, error);
      return '0';
    }
  }

  async isGasPriceOptimal(chainId: number, currentGasPrice: number): Promise<boolean> {
    try {
      const optimalGasPrice = await this.getCurrentGasPrice(chainId);
      const difference = Math.abs(currentGasPrice - optimalGasPrice) / optimalGasPrice;
      
      // Consider optimal if within 10% of current optimal price
      return difference <= 0.1;
    } catch (error) {
      console.error('Error checking gas price optimality:', error);
      return false;
    }
  }

  clearCache(): void {
    this.gasCache.clear();
  }

  getCacheStats(): { entries: number; oldestEntry: number } {
    const now = Date.now();
    let oldestEntry = now;
    
    for (const [, data] of this.gasCache) {
      if (data.timestamp < oldestEntry) {
        oldestEntry = data.timestamp;
      }
    }
    
    return {
      entries: this.gasCache.size,
      oldestEntry: now - oldestEntry
    };
  }
}