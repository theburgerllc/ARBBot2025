import { ethers } from 'ethers';
import { SymbiosisIntegration, CrossChainArbitrageOpp } from './SymbiosisIntegration';

export interface FlashLoanProvider {
  name: string;
  chainId: number;
  address: string;
  maxLoanAmount: string;
  feePercentage: number;
  isAvailable: boolean;
}

export interface CrossRollupFlashLoanParams {
  primaryChain: number;
  secondaryChain: number;
  flashLoanProvider: FlashLoanProvider;
  bridgeRoute: any;
  arbitrageOpportunity: CrossChainArbitrageOpp;
  minSpread: number;
}

export interface FlashLoanExecution {
  success: boolean;
  txHash?: string;
  profit?: string;
  gasUsed?: string;
  bridgeTime?: number;
  error?: string;
}

export class CrossRollupFlashLoan {
  private readonly MIN_CROSS_CHAIN_SPREAD = 0.02; // 2%
  private readonly MAX_BRIDGE_TIME = 300; // 5 minutes
  private readonly FLASH_LOAN_FEE_BUFFER = 0.001; // 0.1% buffer

  private balancerVaults: Record<number, string> = {
    1: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Ethereum
    10: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Optimism
    42161: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Arbitrum
    8453: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Base
    137: '0xBA12222222228d8Ba445958a75a0704d566BF2C8' // Polygon
  };

  private aaveV3Pools: Record<number, string> = {
    1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum
    10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Optimism
    42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Arbitrum
    8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', // Base
    137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' // Polygon
  };

  constructor(
    private readonly providers: Record<string, ethers.JsonRpcProvider>,
    private readonly signers: Record<string, ethers.Wallet>,
    private readonly symbiosisIntegration: SymbiosisIntegration
  ) {}

  async detectCrossRollupOpportunity(
    tokenAddress: string,
    chainA: number,
    chainB: number,
    testAmount: string
  ): Promise<CrossRollupFlashLoanParams | null> {
    try {
      // Get price difference between chains
      const priceDifference = await this.calculatePriceDifference(
        tokenAddress,
        chainA,
        chainB,
        testAmount
      );

      if (priceDifference.spread < this.MIN_CROSS_CHAIN_SPREAD) {
        return null;
      }

      // Find available flash loan provider
      const flashLoanProvider = await this.findBestFlashLoanProvider(
        tokenAddress,
        chainA,
        testAmount
      );

      if (!flashLoanProvider) {
        return null;
      }

      // Get bridge route
      const bridgeRoute = await this.symbiosisIntegration.findCrossChainRoute(
        chainA,
        chainB,
        tokenAddress,
        tokenAddress,
        testAmount
      );

      if (!bridgeRoute || bridgeRoute.estimatedTime > this.MAX_BRIDGE_TIME) {
        return null;
      }

      // Create arbitrage opportunity
      const arbitrageOpportunity: CrossChainArbitrageOpp = {
        buyChain: chainA,
        sellChain: chainB,
        token: tokenAddress,
        buyPrice: priceDifference.buyPrice,
        sellPrice: priceDifference.sellPrice,
        spread: priceDifference.spread,
        bridgeRoute,
        profitAfterFees: priceDifference.netProfit,
        isValid: true
      };

      return {
        primaryChain: chainA,
        secondaryChain: chainB,
        flashLoanProvider,
        bridgeRoute,
        arbitrageOpportunity,
        minSpread: this.MIN_CROSS_CHAIN_SPREAD
      };
    } catch (error) {
      console.error('Error detecting cross-rollup opportunity:', error);
      return null;
    }
  }

  private async calculatePriceDifference(
    tokenAddress: string,
    chainA: number,
    chainB: number,
    amount: string
  ): Promise<{
    buyPrice: string;
    sellPrice: string;
    spread: number;
    netProfit: string;
  }> {
    try {
      // Get token prices on both chains using Symbiosis or fallback to DEX quotes
      const [priceA, priceB] = await Promise.all([
        this.getTokenPrice(tokenAddress, chainA),
        this.getTokenPrice(tokenAddress, chainB)
      ]);

      const buyPrice = priceA < priceB ? priceA : priceB;
      const sellPrice = priceA < priceB ? priceB : priceA;
      const spread = (sellPrice - buyPrice) / buyPrice;

      // Calculate net profit after bridge fees
      const bridgeFee = await this.symbiosisIntegration.getBridgeFee(
        chainA,
        chainB,
        tokenAddress,
        amount
      );

      const grossProfit = (sellPrice - buyPrice) * parseFloat(amount);
      const netProfit = grossProfit - parseFloat(bridgeFee);

      return {
        buyPrice: buyPrice.toString(),
        sellPrice: sellPrice.toString(),
        spread,
        netProfit: netProfit.toString()
      };
    } catch (error) {
      console.error('Error calculating price difference:', error);
      throw error;
    }
  }

  private async getTokenPrice(tokenAddress: string, chainId: number): Promise<number> {
    try {
      // Try to get price from Symbiosis first
      const symbiosisPrice = await (this.symbiosisIntegration as any).getTokenPrice?.(tokenAddress, chainId);
      if (symbiosisPrice) {
        return parseFloat(symbiosisPrice);
      }

      // Fallback to simple price estimation (would need actual DEX integration)
      return 1.0; // Placeholder
    } catch (error) {
      console.error(`Error getting token price for ${tokenAddress} on chain ${chainId}:`, error);
      return 1.0;
    }
  }

  private async findBestFlashLoanProvider(
    tokenAddress: string,
    chainId: number,
    amount: string
  ): Promise<FlashLoanProvider | null> {
    const providers = await this.getFlashLoanProviders(chainId);
    
    for (const provider of providers) {
      try {
        const maxLoan = await this.getMaxFlashLoan(provider, tokenAddress);
        if (parseFloat(maxLoan) >= parseFloat(amount)) {
          return {
            ...provider,
            maxLoanAmount: maxLoan,
            isAvailable: true
          };
        }
      } catch (error) {
        console.debug(`Provider ${provider.name} not available:`, error);
      }
    }

    return null;
  }

  private async getFlashLoanProviders(chainId: number): Promise<FlashLoanProvider[]> {
    const providers: FlashLoanProvider[] = [];

    // Add Balancer if available
    if (this.balancerVaults[chainId]) {
      providers.push({
        name: 'Balancer',
        chainId,
        address: this.balancerVaults[chainId],
        maxLoanAmount: '0',
        feePercentage: 0, // Balancer has no flash loan fees
        isAvailable: false
      });
    }

    // Add Aave V3 if available
    if (this.aaveV3Pools[chainId]) {
      providers.push({
        name: 'AaveV3',
        chainId,
        address: this.aaveV3Pools[chainId],
        maxLoanAmount: '0',
        feePercentage: 0.05, // 0.05% fee
        isAvailable: false
      });
    }

    return providers;
  }

  private async getMaxFlashLoan(provider: FlashLoanProvider, tokenAddress: string): Promise<string> {
    try {
      const providerContract = this.getProviderContract(provider);
      
      if (provider.name === 'Balancer') {
        const maxLoan = await providerContract.maxFlashLoan(tokenAddress);
        return maxLoan.toString();
      } else if (provider.name === 'AaveV3') {
        const reserveData = await providerContract.getReserveData(tokenAddress);
        return reserveData.availableLiquidity?.toString() || '0';
      }

      return '0';
    } catch (error) {
      console.error(`Error getting max flash loan for ${provider.name}:`, error);
      return '0';
    }
  }

  private getProviderContract(provider: FlashLoanProvider): ethers.Contract {
    const providerName = this.getChainName(provider.chainId);
    const signer = this.signers[providerName];

    if (provider.name === 'Balancer') {
      const balancerABI = [
        'function flashLoan(address recipient, address[] tokens, uint256[] amounts, bytes userData) external',
        'function maxFlashLoan(address token) external view returns (uint256)'
      ];
      return new ethers.Contract(provider.address, balancerABI, signer);
    } else if (provider.name === 'AaveV3') {
      const aaveABI = [
        'function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes params, uint16 referralCode) external',
        'function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)'
      ];
      return new ethers.Contract(provider.address, aaveABI, signer);
    }

    throw new Error(`Unknown provider: ${provider.name}`);
  }

  async executeCrossRollupFlashLoan(params: CrossRollupFlashLoanParams): Promise<FlashLoanExecution> {
    const startTime = Date.now();
    
    try {
      // Pre-execution validation
      const isValid = await this.validateOpportunity(params);
      if (!isValid) {
        return {
          success: false,
          error: 'Opportunity no longer valid'
        };
      }

      // Execute flash loan
      const txHash = await this.initiateFlashLoan(params);
      const receipt = await this.waitForTransaction(txHash, params.primaryChain);

      if (!receipt.success) {
        return {
          success: false,
          error: 'Flash loan execution failed',
          txHash
        };
      }

      // Calculate execution metrics
      const executionTime = Date.now() - startTime;
      const bridgeTime = params.bridgeRoute.estimatedTime;

      return {
        success: true,
        txHash,
        profit: params.arbitrageOpportunity.profitAfterFees,
        gasUsed: receipt.gasUsed,
        bridgeTime,
      };
    } catch (error) {
      console.error('Error executing cross-rollup flash loan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async validateOpportunity(params: CrossRollupFlashLoanParams): Promise<boolean> {
    try {
      // Re-check price difference
      const freshPriceDiff = await this.calculatePriceDifference(
        params.arbitrageOpportunity.token,
        params.primaryChain,
        params.secondaryChain,
        params.bridgeRoute.amountIn
      );

      // Check if spread is still profitable
      if (freshPriceDiff.spread < params.minSpread) {
        return false;
      }

      // Check if flash loan is still available
      const maxLoan = await this.getMaxFlashLoan(
        params.flashLoanProvider,
        params.arbitrageOpportunity.token
      );

      if (parseFloat(maxLoan) < parseFloat(params.bridgeRoute.amountIn)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating opportunity:', error);
      return false;
    }
  }

  private async initiateFlashLoan(params: CrossRollupFlashLoanParams): Promise<string> {
    const { flashLoanProvider, arbitrageOpportunity, bridgeRoute } = params;
    
    const providerContract = this.getProviderContract(flashLoanProvider);
    const flashLoanAmount = bridgeRoute.amountIn;

    // Encode the cross-rollup arbitrage parameters
    const userData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'uint256', 'bytes'],
      [
        arbitrageOpportunity.token,
        arbitrageOpportunity.buyChain,
        arbitrageOpportunity.sellChain,
        ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(bridgeRoute)))
      ]
    );

    let tx: ethers.ContractTransaction;

    if (flashLoanProvider.name === 'Balancer') {
      tx = await providerContract.flashLoan(
        flashLoanProvider.address, // recipient (our contract)
        [arbitrageOpportunity.token],
        [flashLoanAmount],
        userData
      );
    } else if (flashLoanProvider.name === 'AaveV3') {
      tx = await providerContract.flashLoanSimple(
        flashLoanProvider.address, // receiver
        arbitrageOpportunity.token,
        flashLoanAmount,
        userData,
        0 // referral code
      );
    } else {
      throw new Error(`Unknown flash loan provider: ${flashLoanProvider.name}`);
    }

    return tx.hash;
  }

  private async waitForTransaction(txHash: string, chainId: number): Promise<{
    success: boolean;
    gasUsed?: string;
    error?: string;
  }> {
    try {
      const provider = this.providers[this.getChainName(chainId)];
      const receipt = await provider.waitForTransaction(txHash);
      
      if (!receipt) {
        return { success: false, error: 'Transaction not found' };
      }

      if (receipt.status === 0) {
        return { success: false, error: 'Transaction reverted' };
      }

      return {
        success: true,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error waiting for transaction:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private getChainName(chainId: number): string {
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      10: 'optimism',
      42161: 'arbitrum',
      8453: 'base',
      137: 'polygon'
    };

    return chainNames[chainId] || 'ethereum';
  }

  async estimateGasForCrossRollupArbitrage(params: CrossRollupFlashLoanParams): Promise<{
    flashLoanGas: string;
    bridgeGas: string;
    totalGas: string;
    estimatedCost: string;
  }> {
    try {
      // Estimate gas for flash loan execution
      const flashLoanGas = '300000'; // Base estimate for flash loan
      
      // Estimate gas for bridge transaction
      const bridgeGas = '200000'; // Base estimate for bridge
      
      // Total gas estimate
      const totalGas = (parseInt(flashLoanGas) + parseInt(bridgeGas)).toString();
      
      // Estimate cost in ETH
      const gasPrice = await this.providers[this.getChainName(params.primaryChain)].getFeeData();
      const estimatedCost = ethers.formatEther(
        BigInt(totalGas) * (gasPrice.gasPrice || ethers.parseUnits('20', 'gwei'))
      );

      return {
        flashLoanGas,
        bridgeGas,
        totalGas,
        estimatedCost
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      return {
        flashLoanGas: '300000',
        bridgeGas: '200000',
        totalGas: '500000',
        estimatedCost: '0.01'
      };
    }
  }

  async getAvailableFlashLoanProviders(chainId: number): Promise<FlashLoanProvider[]> {
    const providers = await this.getFlashLoanProviders(chainId);
    
    // Check availability of each provider
    for (const provider of providers) {
      try {
        const contract = this.getProviderContract(provider);
        // Simple check - if we can create the contract, it's likely available
        provider.isAvailable = true;
      } catch (error) {
        provider.isAvailable = false;
      }
    }

    return providers.filter(p => p.isAvailable);
  }

  async calculateMinimumProfitableSpread(
    chainA: number,
    chainB: number,
    tokenAddress: string,
    amount: string
  ): Promise<number> {
    try {
      // Get gas costs for both chains
      const gasEstimate = await this.estimateGasForCrossRollupArbitrage({
        primaryChain: chainA,
        secondaryChain: chainB,
        flashLoanProvider: { name: 'Balancer', chainId: chainA, address: '', maxLoanAmount: '0', feePercentage: 0, isAvailable: true },
        bridgeRoute: { amountIn: amount, estimatedTime: 180 },
        arbitrageOpportunity: { token: tokenAddress } as any,
        minSpread: 0
      });

      // Get bridge fees
      const bridgeFee = await this.symbiosisIntegration.getBridgeFee(
        chainA,
        chainB,
        tokenAddress,
        amount
      );

      // Calculate minimum spread needed to cover costs
      const totalCosts = parseFloat(gasEstimate.estimatedCost) + parseFloat(bridgeFee);
      const minimumSpread = totalCosts / parseFloat(amount) + this.FLASH_LOAN_FEE_BUFFER;

      return Math.max(minimumSpread, this.MIN_CROSS_CHAIN_SPREAD);
    } catch (error) {
      console.error('Error calculating minimum profitable spread:', error);
      return this.MIN_CROSS_CHAIN_SPREAD;
    }
  }
}