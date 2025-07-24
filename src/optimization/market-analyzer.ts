/**
 * Market Analyzer - Unified Market Condition Analysis
 * Consolidates market data from multiple sources for optimization decisions
 */

import { JsonRpcProvider, formatEther, parseEther } from "ethers";
import { MarketConditions, MarketRegime, MarketAnalysis, OptimizedParameters } from "./types";

export class MarketAnalyzer {
  private providers: Map<number, JsonRpcProvider>;
  private priceHistory: Map<string, number[]> = new Map();
  private gasHistory: bigint[] = [];
  private blockTimes: number[] = [];
  private currentRegime: MarketRegime;

  constructor(providers: Map<number, JsonRpcProvider>) {
    this.providers = providers;
    this.currentRegime = {
      type: 'sideways',
      strength: 0.5,
      duration: 0,
      stability: 0.8
    };
  }

  async analyzeMarketConditions(chainId: number): Promise<MarketConditions> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`No provider configured for chain ${chainId}`);
    }

    try {
      const [blockNumber, feeData, block] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
        provider.getBlock('latest')
      ]);

      if (!block) {
        throw new Error('Failed to fetch latest block');
      }

      // Calculate volatility from recent price movements
      const volatility = await this.calculateVolatility(chainId);
      
      // Estimate liquidity depth (simplified)
      const liquidity = await this.estimateLiquidity(chainId);
      
      // Analyze gas price trends
      const gasPrice = feeData.gasPrice || BigInt(0);
      this.updateGasHistory(gasPrice);
      
      // Calculate network congestion
      const networkCongestion = this.calculateNetworkCongestion(gasPrice);
      
      // Estimate MEV competition level
      const competitionLevel = this.estimateCompetitionLevel(gasPrice, block.timestamp);
      
      // Determine time of day category
      const timeOfDay = this.categorizeTimeOfDay();
      
      // Detect market trend
      const marketTrend = this.detectMarketTrend();

      return {
        volatility,
        liquidity,
        gasPrice,
        networkCongestion,
        competitionLevel,
        timeOfDay,
        marketTrend,
        blockNumber,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Market analysis failed for chain ${chainId}:`, error);
      // Return default conditions on error
      return this.getDefaultMarketConditions(chainId);
    }
  }

  async performMarketAnalysis(chainId: number): Promise<MarketAnalysis> {
    const conditions = await this.analyzeMarketConditions(chainId);
    
    // Update market regime
    this.updateMarketRegime(conditions);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(conditions);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(conditions);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(conditions, recommendation);
    
    // Create suggested parameters
    const suggestedParameters = this.optimizeParameters(conditions);
    
    // Assess risk
    const riskAssessment = this.assessRisk(conditions);

    return {
      conditions,
      recommendation,
      confidence,
      reasoning,
      suggestedParameters,
      riskAssessment
    };
  }

  private async calculateVolatility(chainId: number): Promise<number> {
    // Simplified volatility calculation
    // In production, this would analyze price movements across DEXs
    const recentGasPrices = this.gasHistory.slice(-20);
    if (recentGasPrices.length < 2) return 0.5;
    
    const prices = recentGasPrices.map(price => Number(formatEther(price)));
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / mean;
    
    return Math.min(volatility * 10, 1); // Normalize to 0-1 scale
  }

  private async estimateLiquidity(chainId: number): Promise<number> {
    // Simplified liquidity estimation
    // In production, this would query DEX liquidity pools
    const provider = this.providers.get(chainId);
    if (!provider) return 100;
    
    try {
      // Use block gas limit as a proxy for network activity/liquidity
      const block = await provider.getBlock('latest');
      if (!block) return 100;
      
      const gasUsedRatio = Number(block.gasUsed) / Number(block.gasLimit);
      return Math.max(50, 200 * (1 - gasUsedRatio)); // Higher activity = higher liquidity
    } catch {
      return 100; // Default liquidity estimate
    }
  }

  private updateGasHistory(gasPrice: bigint): void {
    this.gasHistory.push(gasPrice);
    if (this.gasHistory.length > 100) {
      this.gasHistory.shift(); // Keep last 100 gas prices
    }
  }

  private calculateNetworkCongestion(gasPrice: bigint): number {
    if (this.gasHistory.length < 5) return 0.5;
    
    const recentAvg = this.gasHistory.slice(-10).reduce((a, b) => a + b, BigInt(0)) / BigInt(10);
    const ratio = Number(gasPrice) / Number(recentAvg);
    
    return Math.min(Math.max(ratio - 1, 0), 1); // 0-1 scale
  }

  private estimateCompetitionLevel(gasPrice: bigint, blockTimestamp: number): number {
    // High gas prices during active hours suggest high MEV competition
    const timeOfDay = this.categorizeTimeOfDay();
    const gasLevel = this.calculateNetworkCongestion(gasPrice);
    
    let competition = gasLevel * 0.6; // Base competition from gas
    
    if (timeOfDay === 'peak') competition += 0.3;
    else if (timeOfDay === 'active') competition += 0.2;
    else competition += 0.1;
    
    return Math.min(competition, 1);
  }

  private categorizeTimeOfDay(): 'quiet' | 'active' | 'peak' {
    const hour = new Date().getUTCHours();
    
    // Peak hours: US market open + EU overlap (13:00-17:00 UTC)
    if (hour >= 13 && hour <= 17) return 'peak';
    
    // Active hours: EU/US business hours (7:00-22:00 UTC)
    if (hour >= 7 && hour <= 22) return 'active';
    
    // Quiet hours: Asian market primarily (22:00-7:00 UTC)
    return 'quiet';
  }

  private detectMarketTrend(): 'bull' | 'bear' | 'sideways' {
    // Simplified trend detection based on gas price trends
    if (this.gasHistory.length < 10) return 'sideways';
    
    const recent = this.gasHistory.slice(-5);
    const older = this.gasHistory.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, BigInt(0)) / BigInt(recent.length);
    const olderAvg = older.reduce((a, b) => a + b, BigInt(0)) / BigInt(older.length);
    
    const change = (Number(recentAvg) - Number(olderAvg)) / Number(olderAvg);
    
    if (change > 0.1) return 'bull';
    if (change < -0.1) return 'bear';
    return 'sideways';
  }

  private updateMarketRegime(conditions: MarketConditions): void {
    // Detect regime changes based on volatility and trend
    let newType = this.currentRegime.type;
    
    if (conditions.volatility > 0.8) {
      newType = 'high_volatility';
    } else if (conditions.volatility < 0.2) {
      newType = 'low_volatility';
    } else if (conditions.marketTrend === 'bull') {
      newType = 'bull_market';
    } else if (conditions.marketTrend === 'bear') {
      newType = 'bear_market';
    } else {
      newType = 'sideways';
    }
    
    if (newType !== this.currentRegime.type) {
      this.currentRegime = {
        type: newType,
        strength: conditions.volatility,
        duration: 0,
        stability: 0.5
      };
    } else {
      this.currentRegime.duration += 300000; // Add 5 minutes
      this.currentRegime.stability = Math.min(this.currentRegime.stability + 0.1, 1);
    }
  }

  private generateRecommendation(conditions: MarketConditions): 'aggressive' | 'balanced' | 'conservative' | 'pause' {
    const { volatility, liquidity, networkCongestion, competitionLevel } = conditions;
    
    // Calculate recommendation score
    let score = 0;
    
    // High volatility = more opportunities
    score += volatility * 0.3;
    
    // Good liquidity = safer trades
    score += Math.min(liquidity / 100, 1) * 0.2;
    
    // Low congestion = cheaper gas
    score += (1 - networkCongestion) * 0.3;
    
    // Low competition = better chances
    score += (1 - competitionLevel) * 0.2;
    
    if (score > 0.7) return 'aggressive';
    if (score > 0.4) return 'balanced';
    if (score > 0.2) return 'conservative';
    return 'pause';
  }

  private calculateConfidence(conditions: MarketConditions): number {
    // Confidence based on data recency and completeness
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence if gas history is limited
    if (this.gasHistory.length < 10) confidence -= 0.3;
    
    // Reduce confidence during high volatility
    confidence -= conditions.volatility * 0.2;
    
    // Increase confidence during stable periods
    confidence += this.currentRegime.stability * 0.2;
    
    return Math.max(0.1, Math.min(confidence, 1));
  }

  private generateReasoning(conditions: MarketConditions, recommendation: string): string[] {
    const reasoning: string[] = [];
    
    reasoning.push(`Market volatility: ${(conditions.volatility * 100).toFixed(1)}%`);
    reasoning.push(`Liquidity depth: ${conditions.liquidity.toFixed(1)} ETH`);
    reasoning.push(`Network congestion: ${(conditions.networkCongestion * 100).toFixed(1)}%`);
    reasoning.push(`MEV competition: ${(conditions.competitionLevel * 100).toFixed(1)}%`);
    reasoning.push(`Time period: ${conditions.timeOfDay}`);
    reasoning.push(`Market trend: ${conditions.marketTrend}`);
    reasoning.push(`Current regime: ${this.currentRegime.type}`);
    reasoning.push(`Recommendation: ${recommendation} trading approach`);
    
    return reasoning;
  }

  private optimizeParameters(conditions: MarketConditions): OptimizedParameters {
    const baseProfit = parseEther("0.01"); // 0.01 ETH base
    const { volatility, liquidity, networkCongestion, competitionLevel } = conditions;
    
    // Adjust profit threshold based on conditions
    let profitMultiplier = 1;
    profitMultiplier *= (1 - volatility * 0.5); // Lower threshold in high volatility
    profitMultiplier *= Math.max(0.5, liquidity / 100); // Higher threshold in low liquidity
    profitMultiplier *= (1 + networkCongestion * 0.5); // Higher threshold when gas is expensive
    
    const minProfitThreshold = baseProfit * BigInt(Math.floor(profitMultiplier * 100)) / BigInt(100);
    
    // Adjust slippage tolerance
    const baseSlippage = 50; // 0.5%
    const slippageTolerance = Math.floor(baseSlippage * (1 + volatility * 2)); // Higher slippage in volatile markets
    
    // Adjust trade size
    const baseTradeSize = parseEther("10");
    const maxTradeSize = baseTradeSize * BigInt(Math.floor(Math.max(0.1, liquidity / 100) * 100)) / BigInt(100);
    
    // Adjust gas settings
    const gasUrgency = competitionLevel > 0.7 ? 'high' : 
                      competitionLevel > 0.4 ? 'medium' : 'low';
    
    const baseGas = parseEther("0.00002"); // 20 gwei equivalent
    const gasMultiplier = 1 + competitionLevel;
    
    // Determine risk level
    const riskScore = volatility * 0.4 + (1 - liquidity / 100) * 0.3 + competitionLevel * 0.3;
    const riskLevel = riskScore > 0.7 ? 'conservative' : 
                      riskScore > 0.4 ? 'balanced' : 'aggressive';
    
    return {
      minProfitThreshold,
      slippageTolerance,
      maxTradeSize,
      gasSettings: {
        maxFeePerGas: baseGas * BigInt(Math.floor(gasMultiplier * 100)) / BigInt(100),
        maxPriorityFeePerGas: baseGas * BigInt(Math.floor(gasMultiplier * 50)) / BigInt(100),
        urgency: gasUrgency
      },
      cooldownPeriod: Math.floor(5000 * (1 + competitionLevel)), // 5-10 seconds
      riskLevel
    };
  }

  private assessRisk(conditions: MarketConditions): { level: 'low' | 'medium' | 'high' | 'critical'; factors: string[]; mitigation: string[] } {
    const { volatility, liquidity, networkCongestion, competitionLevel } = conditions;
    const factors: string[] = [];
    const mitigation: string[] = [];
    
    let riskScore = 0;
    
    if (volatility > 0.8) {
      riskScore += 0.3;
      factors.push('Extremely high market volatility');
      mitigation.push('Reduce trade sizes and increase profit thresholds');
    }
    
    if (liquidity < 50) {
      riskScore += 0.2;
      factors.push('Low liquidity conditions');
      mitigation.push('Limit trade sizes and increase slippage tolerance');
    }
    
    if (networkCongestion > 0.8) {
      riskScore += 0.2;
      factors.push('High network congestion');
      mitigation.push('Increase gas prices and reduce trade frequency');
    }
    
    if (competitionLevel > 0.8) {
      riskScore += 0.3;
      factors.push('Intense MEV competition');
      mitigation.push('Use higher gas prices and faster execution');
    }
    
    const level = riskScore > 0.8 ? 'critical' :
                  riskScore > 0.6 ? 'high' :
                  riskScore > 0.3 ? 'medium' : 'low';
    
    return { level, factors, mitigation };
  }

  private getDefaultMarketConditions(chainId: number): MarketConditions {
    return {
      volatility: 0.5,
      liquidity: 100,
      gasPrice: parseEther("0.00002"), // 20 gwei
      networkCongestion: 0.5,
      competitionLevel: 0.5,
      timeOfDay: 'active',
      marketTrend: 'sideways',
      blockNumber: 0,
      timestamp: Date.now()
    };
  }

  getCurrentRegime(): MarketRegime {
    return this.currentRegime;
  }
}