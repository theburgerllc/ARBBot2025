import { ethers } from 'ethers';
import { LiquidityFiltering } from './LiquidityFiltering';
import { DexIntegration } from './DexIntegration';
import { SymbiosisIntegration } from './SymbiosisIntegration';
import { GasOptimizer } from './GasOptimizer';
import { ArbitrageOpportunity } from './WorkerManager';

export interface ScanParams {
  chains: number[];
  tokens: string[];
  scanDepth: number;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: string;
  gasUsed?: string;
  error?: string;
}

export class ArbitrageWorker {
  private providers: Record<string, ethers.JsonRpcProvider> = {};
  private signers: Record<string, ethers.Wallet> = {};
  private liquidityFiltering!: LiquidityFiltering;
  private dexIntegrations: Record<number, DexIntegration> = {};
  private symbiosisIntegration!: SymbiosisIntegration;
  private gasOptimizer!: GasOptimizer;
  private opportunitiesFound = 0;
  private executionsAttempted = 0;
  private executionsSuccessful = 0;
  private totalProfit = '0';
  private totalGasUsed = '0';

  constructor(private readonly workerId: number) {
    this.initializeProviders();
    this.initializeSigners();
    this.initializeServices();
  }

  private initializeProviders(): void {
    this.providers = {
      arbitrum: new ethers.JsonRpcProvider(process.env.ARB_RPC || 'https://arb1.arbitrum.io/rpc'),
      optimism: new ethers.JsonRpcProvider(process.env.OPT_RPC || 'https://mainnet.optimism.io'),
      base: new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org'),
      ethereum: new ethers.JsonRpcProvider(process.env.ETH_RPC || 'https://cloudflare-eth.com'),
      polygon: new ethers.JsonRpcProvider(process.env.POLYGON_RPC || 'https://polygon-rpc.com')
    };
  }

  private initializeSigners(): void {
    const privateKey = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
    
    Object.entries(this.providers).forEach(([chain, provider]) => {
      this.signers[chain] = new ethers.Wallet(privateKey, provider);
    });
  }

  private initializeServices(): void {
    this.liquidityFiltering = new LiquidityFiltering(this.providers);
    this.symbiosisIntegration = new SymbiosisIntegration(this.providers, this.signers);
    this.gasOptimizer = new GasOptimizer(this.providers);

    // Initialize DEX integrations for each chain
    [42161, 10, 8453, 1, 137].forEach(chainId => {
      this.dexIntegrations[chainId] = new DexIntegration(this.providers, chainId);
    });
  }

  async scanForOpportunities(params: ScanParams): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    try {
      // Get dynamic token list if not provided
      let tokens = params.tokens;
      if (!tokens || tokens.length === 0) {
        const topTokens = await this.liquidityFiltering.getTopTokensForAllChains();
        tokens = Object.values(topTokens).flat().map(token => token.address);
      }

      // Scan for opportunities across all chains
      for (const chainId of params.chains) {
        const chainOpportunities = await this.scanChainForOpportunities(
          chainId,
          tokens,
          params.scanDepth
        );
        opportunities.push(...chainOpportunities);
      }

      // Scan for cross-chain opportunities
      const crossChainOpportunities = await this.scanCrossChainOpportunities(
        tokens,
        params.chains
      );
      opportunities.push(...crossChainOpportunities);

      this.opportunitiesFound += opportunities.length;
      return opportunities;
    } catch (error) {
      console.error(`Worker ${this.workerId} scan error:`, error);
      return [];
    }
  }

  private async scanChainForOpportunities(
    chainId: number,
    tokens: string[],
    depth: number
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const dexIntegration = this.dexIntegrations[chainId];
    
    if (!dexIntegration) return opportunities;

    // Scan token pairs for arbitrage opportunities
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const tokenA = tokens[i];
        const tokenB = tokens[j];
        
        try {
          const opportunity = await this.checkArbitrageOpportunity(
            chainId,
            tokenA,
            tokenB,
            dexIntegration
          );
          
          if (opportunity) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          console.debug(`Error checking opportunity ${tokenA}/${tokenB}:`, error);
        }
      }
    }

    // Scan for triangular arbitrage if depth > 2
    if (depth > 2) {
      const triangularOpportunities = await this.scanTriangularArbitrage(
        chainId,
        tokens,
        dexIntegration
      );
      opportunities.push(...triangularOpportunities);
    }

    return opportunities;
  }

  private async checkArbitrageOpportunity(
    chainId: number,
    tokenA: string,
    tokenB: string,
    dexIntegration: DexIntegration
  ): Promise<ArbitrageOpportunity | null> {
    const testAmount = ethers.parseUnits('1000', 18).toString();
    
    try {
      // Get quotes from all DEXs
      const quotes = await dexIntegration.getAllRoutes(tokenA, tokenB, testAmount);
      
      if (quotes.allRoutes.length < 2) return null;
      
      // Find price discrepancy
      const sortedRoutes = quotes.allRoutes.sort((a, b) => 
        parseFloat(b.amountOut) - parseFloat(a.amountOut)
      );
      
      const bestRoute = sortedRoutes[0];
      const secondBestRoute = sortedRoutes[1];
      
      const priceDiff = parseFloat(bestRoute.amountOut) - parseFloat(secondBestRoute.amountOut);
      const profitPercentage = priceDiff / parseFloat(testAmount);
      
      // Check if opportunity meets minimum profit threshold
      if (profitPercentage < 0.005) return null; // 0.5% minimum profit
      
      // Calculate gas costs
      const gasPrice = await this.gasOptimizer.getCurrentGasPrice(chainId);
      const gasEstimate = parseInt(bestRoute.gasEstimate) + parseInt(secondBestRoute.gasEstimate);
      const gasCost = gasPrice * gasEstimate;
      
      // Calculate net profit
      const grossProfit = priceDiff;
      const netProfit = grossProfit - gasCost;
      
      if (netProfit <= 0) return null;
      
      return {
        tokenA,
        tokenB,
        chainId,
        dexA: bestRoute.dexName,
        dexB: secondBestRoute.dexName,
        amountIn: testAmount,
        amountOut: bestRoute.amountOut,
        profit: netProfit.toString(),
        gasEstimate: gasEstimate.toString(),
        confidence: this.calculateConfidence(bestRoute, secondBestRoute),
        route: [tokenA, tokenB],
        priceImpact: bestRoute.priceImpact
      };
    } catch (error) {
      console.debug(`Error checking arbitrage opportunity:`, error);
      return null;
    }
  }

  private async scanTriangularArbitrage(
    chainId: number,
    tokens: string[],
    dexIntegration: DexIntegration
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // Check A -> B -> C -> A triangular paths
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        for (let k = 0; k < tokens.length; k++) {
          if (i === j || j === k || i === k) continue;
          
          const tokenA = tokens[i];
          const tokenB = tokens[j];
          const tokenC = tokens[k];
          
          try {
            const opportunity = await this.checkTriangularOpportunity(
              chainId,
              tokenA,
              tokenB,
              tokenC,
              dexIntegration
            );
            
            if (opportunity) {
              opportunities.push(opportunity);
            }
          } catch (error) {
            console.debug(`Error checking triangular opportunity:`, error);
          }
        }
      }
    }
    
    return opportunities;
  }

  private async checkTriangularOpportunity(
    chainId: number,
    tokenA: string,
    tokenB: string,
    tokenC: string,
    dexIntegration: DexIntegration
  ): Promise<ArbitrageOpportunity | null> {
    const testAmount = ethers.parseUnits('1000', 18).toString();
    
    try {
      // Get quotes for A -> B -> C -> A path
      const quoteAB = await dexIntegration.getAllRoutes(tokenA, tokenB, testAmount);
      const quoteBC = await dexIntegration.getAllRoutes(tokenB, tokenC, quoteAB.bestRoute.amountOut);
      const quoteCA = await dexIntegration.getAllRoutes(tokenC, tokenA, quoteBC.bestRoute.amountOut);
      
      const finalAmount = parseFloat(quoteCA.bestRoute.amountOut);
      const initialAmount = parseFloat(testAmount);
      
      const profit = finalAmount - initialAmount;
      const profitPercentage = profit / initialAmount;
      
      if (profitPercentage < 0.01) return null; // 1% minimum for triangular
      
      // Calculate total gas
      const totalGas = parseInt(quoteAB.bestRoute.gasEstimate) + 
                      parseInt(quoteBC.bestRoute.gasEstimate) + 
                      parseInt(quoteCA.bestRoute.gasEstimate);
      
      const gasPrice = await this.gasOptimizer.getCurrentGasPrice(chainId);
      const gasCost = gasPrice * totalGas;
      const netProfit = profit - gasCost;
      
      if (netProfit <= 0) return null;
      
      return {
        tokenA,
        tokenB,
        chainId,
        dexA: quoteAB.bestRoute.dexName,
        dexB: quoteBC.bestRoute.dexName,
        amountIn: testAmount,
        amountOut: quoteCA.bestRoute.amountOut,
        profit: netProfit.toString(),
        gasEstimate: totalGas.toString(),
        confidence: 0.8, // Lower confidence for triangular
        route: [tokenA, tokenB, tokenC, tokenA],
        priceImpact: (quoteAB.bestRoute.priceImpact + quoteBC.bestRoute.priceImpact + quoteCA.bestRoute.priceImpact) / 3
      };
    } catch (error) {
      console.debug(`Error in triangular arbitrage check:`, error);
      return null;
    }
  }

  private async scanCrossChainOpportunities(
    tokens: string[],
    chains: number[]
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    try {
      const crossChainOpps = await this.symbiosisIntegration.detectCrossChainArbitrage(
        tokens,
        chains
      );
      
      // Convert to ArbitrageOpportunity format
      for (const opp of crossChainOpps) {
        if (opp.isValid) {
          opportunities.push({
            tokenA: opp.token,
            tokenB: opp.token,
            chainId: opp.buyChain,
            dexA: `Chain${opp.buyChain}`,
            dexB: `Chain${opp.sellChain}`,
            amountIn: opp.bridgeRoute.amountIn,
            amountOut: opp.bridgeRoute.amountOut,
            profit: opp.profitAfterFees,
            gasEstimate: '500000', // Higher gas for cross-chain
            confidence: 0.7, // Lower confidence for cross-chain
            route: [opp.token],
            priceImpact: 0.1 // Estimate bridge impact
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cross-chain opportunities:', error);
    }
    
    return opportunities;
  }

  private calculateConfidence(route1: any, route2: any): number {
    // Calculate confidence based on liquidity, price impact, and gas efficiency
    const liquidityScore = Math.min(1, (parseFloat(route1.amountOut) + parseFloat(route2.amountOut)) / 2000000);
    const priceImpactScore = Math.max(0, 1 - (route1.priceImpact + route2.priceImpact) / 2);
    const gasEfficiencyScore = Math.max(0, 1 - (parseInt(route1.gasEstimate) + parseInt(route2.gasEstimate)) / 500000);
    
    return (liquidityScore + priceImpactScore + gasEfficiencyScore) / 3;
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    this.executionsAttempted++;
    
    try {
      // Validate opportunity is still valid
      const isValid = await this.validateOpportunity(opportunity);
      if (!isValid) {
        return { success: false, error: 'Opportunity no longer valid' };
      }
      
      // Execute the arbitrage
      const result = await this.performArbitrage(opportunity);
      
      if (result.success) {
        this.executionsSuccessful++;
        this.totalProfit = (parseFloat(this.totalProfit) + parseFloat(result.profit || '0')).toString();
        this.totalGasUsed = (parseFloat(this.totalGasUsed) + parseFloat(result.gasUsed || '0')).toString();
      }
      
      return result;
    } catch (error) {
      console.error(`Worker ${this.workerId} execution error:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async validateOpportunity(opportunity: ArbitrageOpportunity): Promise<boolean> {
    try {
      // Re-check the opportunity to ensure it's still valid
      const dexIntegration = this.dexIntegrations[opportunity.chainId];
      if (!dexIntegration) return false;
      
      const freshOpportunity = await this.checkArbitrageOpportunity(
        opportunity.chainId,
        opportunity.tokenA,
        opportunity.tokenB,
        dexIntegration
      );
      
      if (!freshOpportunity) return false;
      
      // Check if profit is still above threshold (allowing for some slippage)
      const profitReduction = parseFloat(opportunity.profit) - parseFloat(freshOpportunity.profit);
      const profitReductionPercentage = profitReduction / parseFloat(opportunity.profit);
      
      return profitReductionPercentage < 0.2; // Allow up to 20% profit reduction
    } catch (error) {
      console.error('Error validating opportunity:', error);
      return false;
    }
  }

  private async performArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    // This is a simplified execution - in reality would interact with flash loan contracts
    // and execute the actual trades
    
    try {
      const provider = this.providers[this.getChainName(opportunity.chainId)];
      const signer = this.signers[this.getChainName(opportunity.chainId)];
      
      // Simulate execution
      const tx = await signer.sendTransaction({
        to: opportunity.tokenA,
        value: 0,
        data: '0x',
        gasLimit: parseInt(opportunity.gasEstimate),
        gasPrice: await this.gasOptimizer.getCurrentGasPrice(opportunity.chainId)
      });
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        profit: opportunity.profit,
        gasUsed: receipt?.gasUsed?.toString() || opportunity.gasEstimate
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
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

  async generateReport(): Promise<any> {
    return {
      workerId: this.workerId,
      opportunitiesFound: this.opportunitiesFound,
      executionsAttempted: this.executionsAttempted,
      executionsSuccessful: this.executionsSuccessful,
      successRate: this.executionsAttempted > 0 ? this.executionsSuccessful / this.executionsAttempted : 0,
      totalProfit: this.totalProfit,
      totalGasUsed: this.totalGasUsed,
      profitPerExecution: this.executionsSuccessful > 0 ? 
        (parseFloat(this.totalProfit) / this.executionsSuccessful).toString() : '0'
    };
  }
}