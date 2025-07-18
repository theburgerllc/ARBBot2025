import { Symbiosis } from 'symbiosis-js-sdk';
import { ethers } from 'ethers';
import { ChainId } from 'symbiosis-js-sdk/dist/constants';

export interface CrossChainRoute {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  bridgeFee: string;
  estimatedTime: number;
  route: any;
}

export interface CrossChainArbitrageOpp {
  buyChain: number;
  sellChain: number;
  token: string;
  buyPrice: string;
  sellPrice: string;
  spread: number;
  bridgeRoute: CrossChainRoute;
  profitAfterFees: string;
  isValid: boolean;
}

export class SymbiosisIntegration {
  private symbiosis: Symbiosis;
  private readonly MIN_CROSS_CHAIN_SPREAD = 0.02; // 2% minimum spread
  private readonly MAX_BRIDGE_TIME = 300; // 5 minutes max bridge time
  
  constructor(
    private readonly providers: Record<string, ethers.JsonRpcProvider>,
    private readonly signers: Record<string, ethers.Wallet>
  ) {
    this.initializeSymbiosis();
  }

  private initializeSymbiosis(): void {
    try {
      // Initialize Symbiosis SDK with mainnet configuration
      this.symbiosis = new Symbiosis('mainnet', 'https://api.symbiosis.finance');
      
      // Set up supported chains
      const supportedChains = [
        ChainId.ETH_MAINNET,
        ChainId.ARBITRUM_MAINNET,
        ChainId.OPTIMISM_MAINNET,
        ChainId.BASE_MAINNET,
        ChainId.POLYGON_MAINNET,
        ChainId.AVALANCHE_MAINNET,
        ChainId.BSC_MAINNET
      ];

      console.log('Symbiosis initialized with supported chains:', supportedChains);
    } catch (error) {
      console.error('Failed to initialize Symbiosis:', error);
    }
  }

  async findCrossChainRoute(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amountIn: string
  ): Promise<CrossChainRoute | null> {
    try {
      // Get swapping route using Symbiosis SDK
      const route = await this.symbiosis.swapping({
        tokenAmountIn: {
          token: {
            address: fromToken,
            chainId: fromChainId
          },
          amount: amountIn
        },
        tokenOut: {
          address: toToken,
          chainId: toChainId
        },
        from: this.signers[this.getChainName(fromChainId)].address,
        to: this.signers[this.getChainName(toChainId)].address,
        slippage: 300, // 3% slippage
        deadline: Math.floor(Date.now() / 1000) + 1200 // 20 minutes deadline
      });

      if (!route) return null;

      // Calculate bridge fees and estimated time
      const bridgeFee = route.fees?.totalFeeInUsd || '0';
      const estimatedTime = route.estimatedTime || 180; // Default 3 minutes

      return {
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amountIn,
        amountOut: route.tokenAmountOut.amount,
        bridgeFee,
        estimatedTime,
        route
      };
    } catch (error) {
      console.error('Error finding cross-chain route:', error);
      return null;
    }
  }

  async detectCrossChainArbitrage(
    tokens: string[],
    chains: number[]
  ): Promise<CrossChainArbitrageOpp[]> {
    const opportunities: CrossChainArbitrageOpp[] = [];

    // Check all token pairs across all chain combinations
    for (const token of tokens) {
      for (let i = 0; i < chains.length; i++) {
        for (let j = 0; j < chains.length; j++) {
          if (i === j) continue;

          const buyChain = chains[i];
          const sellChain = chains[j];

          try {
            const opportunity = await this.checkCrossChainOpportunity(
              token,
              buyChain,
              sellChain
            );

            if (opportunity && opportunity.isValid) {
              opportunities.push(opportunity);
            }
          } catch (error) {
            console.debug(`Error checking cross-chain opportunity for ${token}:`, error);
          }
        }
      }
    }

    // Sort by profit descending
    opportunities.sort((a, b) => 
      parseFloat(b.profitAfterFees) - parseFloat(a.profitAfterFees)
    );

    return opportunities;
  }

  private async checkCrossChainOpportunity(
    token: string,
    buyChain: number,
    sellChain: number
  ): Promise<CrossChainArbitrageOpp | null> {
    try {
      // Get token prices on both chains
      const [buyPrice, sellPrice] = await Promise.all([
        this.getTokenPrice(token, buyChain),
        this.getTokenPrice(token, sellChain)
      ]);

      if (!buyPrice || !sellPrice) return null;

      // Calculate spread
      const spread = (parseFloat(sellPrice) - parseFloat(buyPrice)) / parseFloat(buyPrice);

      // Check if spread meets minimum threshold
      if (spread < this.MIN_CROSS_CHAIN_SPREAD) return null;

      // Get bridge route
      const bridgeAmount = ethers.parseUnits('1000', 18).toString(); // Test with 1000 tokens
      const bridgeRoute = await this.findCrossChainRoute(
        buyChain,
        sellChain,
        token,
        token,
        bridgeAmount
      );

      if (!bridgeRoute) return null;

      // Check if bridge time is acceptable
      if (bridgeRoute.estimatedTime > this.MAX_BRIDGE_TIME) return null;

      // Calculate profit after fees
      const buyAmount = parseFloat(bridgeAmount);
      const sellAmount = parseFloat(bridgeRoute.amountOut);
      const bridgeFee = parseFloat(bridgeRoute.bridgeFee);
      const profitAfterFees = (sellAmount - buyAmount - bridgeFee).toString();

      return {
        buyChain,
        sellChain,
        token,
        buyPrice,
        sellPrice,
        spread,
        bridgeRoute,
        profitAfterFees,
        isValid: parseFloat(profitAfterFees) > 0
      };
    } catch (error) {
      console.error('Error checking cross-chain opportunity:', error);
      return null;
    }
  }

  private async getTokenPrice(token: string, chainId: number): Promise<string | null> {
    try {
      // Use Symbiosis price oracle or fallback to external API
      const price = await this.symbiosis.getTokenPrice(token, chainId);
      return price?.toString() || null;
    } catch (error) {
      console.debug(`Error getting token price for ${token} on chain ${chainId}:`, error);
      return null;
    }
  }

  async executeCrossChainArbitrage(
    opportunity: CrossChainArbitrageOpp,
    flashLoanAmount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const { buyChain, sellChain, token, bridgeRoute } = opportunity;

      // Step 1: Get flash loan on buy chain
      const buyProvider = this.providers[this.getChainName(buyChain)];
      const buySigner = this.signers[this.getChainName(buyChain)];

      // Step 2: Buy token on buy chain
      const buyTx = await this.executeBuyOrder(token, flashLoanAmount, buyChain);
      await buyTx.wait();

      // Step 3: Bridge tokens to sell chain
      const bridgeTx = await this.executeBridge(bridgeRoute, buySigner);
      await bridgeTx.wait();

      // Step 4: Wait for bridge completion (simplified - in reality would need event listening)
      await new Promise(resolve => setTimeout(resolve, bridgeRoute.estimatedTime * 1000));

      // Step 5: Sell tokens on sell chain
      const sellTx = await this.executeSellOrder(token, bridgeRoute.amountOut, sellChain);
      await sellTx.wait();

      // Step 6: Bridge profits back to original chain
      const profitBridgeTx = await this.bridgeProfitsBack(
        sellChain,
        buyChain,
        opportunity.profitAfterFees
      );
      await profitBridgeTx.wait();

      // Step 7: Repay flash loan
      const repayTx = await this.repayFlashLoan(flashLoanAmount, buyChain);
      await repayTx.wait();

      return {
        success: true,
        txHash: sellTx.hash
      };
    } catch (error) {
      console.error('Error executing cross-chain arbitrage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async executeBuyOrder(
    token: string,
    amount: string,
    chainId: number
  ): Promise<ethers.ContractTransaction> {
    // Simplified buy order execution
    const provider = this.providers[this.getChainName(chainId)];
    const signer = this.signers[this.getChainName(chainId)];
    
    // This would integrate with the actual DEX contracts
    // For now, return a mock transaction
    return signer.sendTransaction({
      to: token,
      value: 0,
      data: '0x'
    });
  }

  private async executeSellOrder(
    token: string,
    amount: string,
    chainId: number
  ): Promise<ethers.ContractTransaction> {
    // Simplified sell order execution
    const provider = this.providers[this.getChainName(chainId)];
    const signer = this.signers[this.getChainName(chainId)];
    
    // This would integrate with the actual DEX contracts
    // For now, return a mock transaction
    return signer.sendTransaction({
      to: token,
      value: 0,
      data: '0x'
    });
  }

  private async executeBridge(
    route: CrossChainRoute,
    signer: ethers.Wallet
  ): Promise<ethers.ContractTransaction> {
    try {
      // Execute the bridge transaction using Symbiosis
      const tx = await this.symbiosis.execute(route.route, signer);
      return tx;
    } catch (error) {
      console.error('Error executing bridge:', error);
      throw error;
    }
  }

  private async bridgeProfitsBack(
    fromChain: number,
    toChain: number,
    amount: string
  ): Promise<ethers.ContractTransaction> {
    // Simplified profit bridging
    const signer = this.signers[this.getChainName(fromChain)];
    
    return signer.sendTransaction({
      to: ethers.ZeroAddress,
      value: 0,
      data: '0x'
    });
  }

  private async repayFlashLoan(
    amount: string,
    chainId: number
  ): Promise<ethers.ContractTransaction> {
    // Simplified flash loan repayment
    const signer = this.signers[this.getChainName(chainId)];
    
    return signer.sendTransaction({
      to: ethers.ZeroAddress,
      value: 0,
      data: '0x'
    });
  }

  private getChainName(chainId: number): string {
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      10: 'optimism',
      42161: 'arbitrum',
      8453: 'base',
      137: 'polygon',
      43114: 'avalanche',
      56: 'bsc'
    };

    return chainNames[chainId] || 'ethereum';
  }

  async getSymbiosisChainConfig(chainId: number): Promise<any> {
    try {
      return await this.symbiosis.chainConfig(chainId);
    } catch (error) {
      console.error('Error getting Symbiosis chain config:', error);
      return null;
    }
  }

  async getSupportedTokens(chainId: number): Promise<string[]> {
    try {
      const config = await this.getSymbiosisChainConfig(chainId);
      return config?.tokens?.map((token: any) => token.address) || [];
    } catch (error) {
      console.error('Error getting supported tokens:', error);
      return [];
    }
  }

  async estimateBridgeTime(fromChain: number, toChain: number): Promise<number> {
    try {
      // Get estimated bridge time from Symbiosis
      const estimate = await this.symbiosis.getBridgeTime(fromChain, toChain);
      return estimate || 180; // Default 3 minutes
    } catch (error) {
      console.error('Error estimating bridge time:', error);
      return 180; // Default fallback
    }
  }

  async getBridgeFee(
    fromChain: number,
    toChain: number,
    token: string,
    amount: string
  ): Promise<string> {
    try {
      const route = await this.findCrossChainRoute(
        fromChain,
        toChain,
        token,
        token,
        amount
      );
      
      return route?.bridgeFee || '0';
    } catch (error) {
      console.error('Error getting bridge fee:', error);
      return '0';
    }
  }
}