import chalk from "chalk";
import { formatEther, parseEther, parseUnits } from "ethers";
import fs from "fs/promises";
import path from "path";
import { MainnetDataFetcher, RealArbitrageOpportunity } from "../utils/mainnet-data-fetcher";
import { DynamicSlippageManager } from "../utils/dynamic-slippage-manager";
import { AdaptiveProfitManager } from "../utils/adaptive-profit-manager";
import { AdvancedRiskManager } from "../utils/advanced-risk-manager";
import { OraclePriceValidator } from "../utils/oracle-price-validator";
import { ProductionMonitor } from "../monitoring/production-monitor";
import dotenv from "dotenv";

// Load dry run environment
dotenv.config({ path: 'config/mainnet-dry-run.env' });

export interface DryRunResults {
  // Summary Statistics
  totalOpportunitiesDetected: number;
  profitableOpportunities: number;
  totalEstimatedProfit: bigint;
  averageProfitMargin: number;
  successfulOptimizations: number;
  
  // Phase 3 Features Performance
  phase3Features: {
    dynamicSlippageUsed: number;
    adaptiveThresholdsUsed: number;
    riskAssessmentsPerformed: number;
    riskAssessmentsBlocked: number;
    oracleValidationsPerformed: number;
    oracleValidationsBlocked: number;
  };
  
  // Gas Cost Analysis
  gasCostAnalysis: {
    totalEstimatedGasCost: bigint;
    averageGasCostPerTrade: bigint;
    gasEfficiencyRatio: number;
  };
  
  // Risk Metrics
  riskMetrics: {
    highRiskOpportunities: number;
    mediumRiskOpportunities: number;
    lowRiskOpportunities: number;
    riskManagerBlocks: number;
    circuitBreakerTriggers: number;
    averageConfidence: number;
  };
  
  // Performance Metrics
  performanceMetrics: {
    avgProcessingTimeMs: number;
    opportunitiesPerMinute: number;
    systemLoad: number;
    peakMemoryUsageMB: number;
    totalCycles: number;
  };
  
  // Chain-Specific Results
  chainResults: Map<number, {
    opportunities: number;
    profit: bigint;
    avgConfidence: number;
  }>;
  
  // Time-Series Data
  timeSeriesData: {
    timestamp: number;
    opportunities: number;
    profit: bigint;
    confidence: number;
  }[];
  
  // Execution Details
  executionDetails: {
    startTime: number;
    endTime: number;
    durationHours: number;
    configurationUsed: any;
  };
}

export interface CycleResults {
  cycleNumber: number;
  timestamp: number;
  chainId: number;
  opportunitiesFound: number;
  bestOpportunity?: RealArbitrageOpportunity;
  phase3Validations: {
    riskPassed: boolean;
    oraclePassed: boolean;
    slippageOptimized: boolean;
    thresholdOptimized: boolean;
  };
}

class DryRunOrchestrator {
  private dataFetcher: MainnetDataFetcher;
  private dynamicSlippage: DynamicSlippageManager | null = null;
  private adaptiveProfit: AdaptiveProfitManager | null = null;
  private riskManager: AdvancedRiskManager | null = null;
  private oracleValidator: OraclePriceValidator | null = null;
  private productionMonitor: ProductionMonitor | null = null;
  
  private results!: DryRunResults;
  private startTime: number = 0;
  private cycleResults: CycleResults[] = [];
  private processingTimes: number[] = [];
  
  constructor() {
    this.dataFetcher = new MainnetDataFetcher();
    this.initializePhase3Modules();
    this.initializeResults();
    try {
      this.productionMonitor = new ProductionMonitor();
    } catch (error) {
      console.warn('Warning: Could not initialize production monitor');
      this.productionMonitor = null;
    }
  }
  
  async executeDryRun(): Promise<DryRunResults> {
    console.log(chalk.blue('\n🚀 ARBBot2025 Mainnet Dry Run with Real-World Data\n'));
    console.log(chalk.blue('================================================================\n'));
    
    this.startTime = Date.now();
    const durationHours = Number(process.env.DRY_RUN_DURATION_HOURS) || 4;
    const endTime = this.startTime + (durationHours * 60 * 60 * 1000);
    const cycleIntervalMs = (Number(process.env.DRY_RUN_CYCLE_INTERVAL_SEC) || 30) * 1000;
    
    console.log(chalk.cyan(`⏱️ Duration: ${durationHours} hours`));
    console.log(chalk.cyan(`🔄 Cycle Interval: ${cycleIntervalMs/1000} seconds`));
    console.log(chalk.cyan(`🎯 Objective: Validate all Phase 1-4 optimizations`));
    console.log(chalk.cyan(`📊 Real Data Sources: Arbitrum & Optimism mainnet`));
    console.log(chalk.cyan(`💰 Target Success Rate: >20%`));
    console.log(chalk.cyan(`⚡ Target Gas Efficiency: >2:1 ratio\n`));
    
    await this.createLogDirectory();
    
    let cycleCount = 0;
    const totalExpectedCycles = Math.floor((endTime - this.startTime) / cycleIntervalMs);
    
    console.log(chalk.gray(`Expected ${totalExpectedCycles} total cycles\n`));
    
    while (Date.now() < endTime) {
      cycleCount++;
      const progress = (cycleCount / totalExpectedCycles * 100).toFixed(1);
      
      console.log(chalk.blue(`\n${'='.repeat(60)}`));
      console.log(chalk.blue(`🔄 Cycle ${cycleCount}/${totalExpectedCycles} (${progress}%)`));
      console.log(chalk.gray(`⏰ ${new Date().toISOString()}`));
      console.log(chalk.blue(`${'='.repeat(60)}`));
      
      try {
        // Test both chains in parallel for efficiency
        const [arbResults, optResults] = await Promise.allSettled([
          this.performCycleAnalysis(42161, cycleCount), // Arbitrum
          this.performCycleAnalysis(10, cycleCount)     // Optimism
        ]);
        
        // Log cycle summary
        const arbSuccess = arbResults.status === 'fulfilled';
        const optSuccess = optResults.status === 'fulfilled';
        
        console.log(chalk.white(`\n📊 Cycle ${cycleCount} Summary:`));
        console.log(chalk.white(`   Arbitrum: ${arbSuccess ? '✅' : '❌'} ${arbSuccess ? (arbResults.value?.opportunitiesFound || 0) + ' opportunities' : 'failed'}`));
        console.log(chalk.white(`   Optimism: ${optSuccess ? '✅' : '❌'} ${optSuccess ? (optResults.value?.opportunitiesFound || 0) + ' opportunities' : 'failed'}`));
        
        // Update time series data
        this.updateTimeSeriesData(cycleCount);
        
        // Brief pause between cycles (for rate limiting)
        const sleepTime = Math.max(1000, cycleIntervalMs - 5000); // Ensure some sleep time
        if (sleepTime > 0) {
          console.log(chalk.gray(`   💤 Waiting ${sleepTime/1000}s for next cycle...`));
          await this.sleep(sleepTime);
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Error in cycle ${cycleCount}:`), error);
        this.results.riskMetrics.circuitBreakerTriggers++;
      }
      
      // Update performance metrics
      this.results.performanceMetrics.totalCycles = cycleCount;
      this.updateSystemResourceMetrics();
    }
    
    this.results.executionDetails.endTime = Date.now();
    this.results.executionDetails.durationHours = (this.results.executionDetails.endTime - this.startTime) / (1000 * 60 * 60);
    
    await this.generateFinalReport();
    await this.saveDetailedLogs();
    
    return this.results;
  }
  
  private async performCycleAnalysis(chainId: number, cycleNumber: number): Promise<CycleResults> {
    const chainName = chainId === 42161 ? 'Arbitrum' : 'Optimism';
    const processingStart = Date.now();
    
    console.log(chalk.yellow(`\n🔍 Analyzing ${chainName} (Chain ${chainId})...`));
    
    const cycleResult: CycleResults = {
      cycleNumber,
      timestamp: Date.now(),
      chainId,
      opportunitiesFound: 0,
      phase3Validations: {
        riskPassed: false,
        oraclePassed: false,
        slippageOptimized: false,
        thresholdOptimized: false
      }
    };
    
    try {
      // PHASE 1: Scan for real arbitrage opportunities
      console.log(chalk.gray(`   📡 Fetching real-time market data...`));
      const opportunities = await this.dataFetcher.scanRealArbitrageOpportunities(chainId);
      
      this.results.totalOpportunitiesDetected += opportunities.length;
      cycleResult.opportunitiesFound = opportunities.length;
      
      if (opportunities.length === 0) {
        console.log(chalk.gray(`   📊 No arbitrage opportunities detected`));
        return cycleResult;
      }
      
      console.log(chalk.green(`   📊 Found ${opportunities.length} potential opportunities`));
      
      // Update chain-specific results
      if (!this.results.chainResults.has(chainId)) {
        this.results.chainResults.set(chainId, { opportunities: 0, profit: 0n, avgConfidence: 0 });
      }
      const chainStats = this.results.chainResults.get(chainId)!;
      chainStats.opportunities += opportunities.length;
      
      // PHASE 2: Analyze top opportunities with Phase 3 optimizations
      const maxAnalyze = Math.min(5, opportunities.length);
      const topOpportunities = opportunities.slice(0, maxAnalyze);
      
      for (let i = 0; i < topOpportunities.length; i++) {
        const opportunity = topOpportunities[i];
        console.log(chalk.cyan(`\n   🎯 Analyzing opportunity ${i+1}/${maxAnalyze}: ${opportunity.tokenASymbol}/${opportunity.tokenBSymbol}`));
        
        const analysisResult = await this.analyzeOpportunityWithPhase3(opportunity, cycleNumber);
        
        if (i === 0 && analysisResult.approved) {
          cycleResult.bestOpportunity = opportunity;
          cycleResult.phase3Validations = analysisResult.validations;
        }
        
        // Update chain confidence
        chainStats.avgConfidence = (chainStats.avgConfidence + opportunity.confidence) / 2;
      }
      
    } catch (error) {
      console.error(chalk.red(`   ❌ Error analyzing ${chainName}:`), error);
      throw error;
    } finally {
      // Update performance metrics
      const processingTime = Date.now() - processingStart;
      this.processingTimes.push(processingTime);
      this.updatePerformanceMetrics();
      
      console.log(chalk.gray(`   ⏱️ Processed in ${processingTime}ms`));
    }
    
    this.cycleResults.push(cycleResult);
    return cycleResult;
  }
  
  private async analyzeOpportunityWithPhase3(
    opportunity: RealArbitrageOpportunity, 
    cycleNumber: number
  ): Promise<{
    approved: boolean;
    validations: {
      riskPassed: boolean;
      oraclePassed: boolean;
      slippageOptimized: boolean;
      thresholdOptimized: boolean;
    };
  }> {
    
    console.log(chalk.white(`      💰 Spread: ${opportunity.spreadPercentage.toFixed(3)}%`));
    console.log(chalk.white(`      📈 Est. Profit: ${formatEther(opportunity.estimatedProfit)} ETH`));
    console.log(chalk.white(`      🎯 Confidence: ${(opportunity.confidence * 100).toFixed(1)}%`));
    console.log(chalk.white(`      ⚡ Complexity: ${opportunity.executionComplexity}`));
    
    const validations = {
      riskPassed: false,
      oraclePassed: false,
      slippageOptimized: false,
      thresholdOptimized: false
    };
    
    try {
      // PHASE 3A: Advanced Risk Assessment
      console.log(chalk.blue(`      🛡️ Risk Assessment...`));
      if (!this.riskManager) {
        console.log(chalk.yellow('         ⚠️ Risk manager not available, skipping'));
        return { approved: false, validations };
      }
      const riskAssessment = await this.riskManager.assessTradeRisk(
        [opportunity.tokenA, opportunity.tokenB],
        opportunity.recommendedTradeSize,
        opportunity.estimatedProfit,
        opportunity.estimatedGasCost,
        opportunity.executionComplexity === 'simple' ? 'dual_dex' : 'triangular',
        opportunity.chainId,
        opportunity.confidence
      );
      
      this.results.phase3Features.riskAssessmentsPerformed++;
      
      if (!riskAssessment.approved) {
        console.log(chalk.yellow(`         ⚠️ Risk Manager BLOCKED: ${riskAssessment.reasonsForRejection.join(', ')}`));
        this.results.riskMetrics.riskManagerBlocks++;
        this.results.phase3Features.riskAssessmentsBlocked++;
        return { approved: false, validations };
      }
      
      validations.riskPassed = true;
      console.log(chalk.green(`         ✅ Risk Level: ${riskAssessment.riskLevel.toUpperCase()}`));
      
      // Update risk metrics
      switch (riskAssessment.riskLevel) {
        case 'low': this.results.riskMetrics.lowRiskOpportunities++; break;
        case 'medium': this.results.riskMetrics.mediumRiskOpportunities++; break;
        case 'high': this.results.riskMetrics.highRiskOpportunities++; break;
      }
      
      // PHASE 3B: Oracle Price Validation
      console.log(chalk.blue(`      🔮 Oracle Validation...`));
      if (!this.oracleValidator) {
        console.log(chalk.yellow('         ⚠️ Oracle validator not available, skipping'));
        return { approved: false, validations };
      }
      const priceValidation = await this.oracleValidator.validateTokenPrice(
        opportunity.tokenA,
        opportunity.tokenB,
        opportunity.uniswapV2Price,
        opportunity.chainId,
        opportunity.recommendedTradeSize
      );
      
      this.results.phase3Features.oracleValidationsPerformed++;
      
      if (!priceValidation.isValid || priceValidation.recommendation === 'reject') {
        console.log(chalk.red(`         🚨 Oracle BLOCKED: ${priceValidation.warnings.join(', ')}`));
        this.results.phase3Features.oracleValidationsBlocked++;
        return { approved: false, validations };
      }
      
      validations.oraclePassed = true;
      console.log(chalk.green(`         ✅ Price Valid (${((priceValidation as any).confidence * 100 || 50).toFixed(1)}% confidence)`));
      
      // PHASE 3C: Dynamic Slippage Optimization
      console.log(chalk.blue(`      🎯 Dynamic Slippage...`));
      if (!this.dynamicSlippage) {
        console.log(chalk.yellow('         ⚠️ Dynamic slippage not available, using defaults'));
        validations.slippageOptimized = false;
      } else {
        const slippageConfig = await this.dynamicSlippage.calculateOptimalSlippage(
        opportunity.tokenA,
        opportunity.tokenB,
        opportunity.recommendedTradeSize,
        opportunity.chainId
        );
        
        this.results.phase3Features.dynamicSlippageUsed++;
        validations.slippageOptimized = true;
        
        console.log(chalk.green(`         ✅ Optimal Slippage: ${slippageConfig.slippageBps} bps`));
        console.log(chalk.gray(`            Reasoning: ${slippageConfig.reasoning.slice(0, 2).join(', ')}`));
      }
      
      // PHASE 3D: Adaptive Profit Threshold
      console.log(chalk.blue(`      💰 Adaptive Threshold...`));
      if (!this.adaptiveProfit) {
        console.log(chalk.yellow('         ⚠️ Adaptive profit not available, using static threshold'));
        validations.thresholdOptimized = false;
        return { approved: true, validations };
      }
      const profitConfig = await this.adaptiveProfit.calculateOptimalThreshold(
        [opportunity.tokenA, opportunity.tokenB],
        opportunity.recommendedTradeSize,
        opportunity.estimatedGasCost,
        opportunity.chainId
      );
      
      this.results.phase3Features.adaptiveThresholdsUsed++;
      validations.thresholdOptimized = true;
      
      const meetsThreshold = opportunity.netProfit >= profitConfig.minProfitWei;
      console.log(chalk.green(`         ✅ Threshold: ${profitConfig.thresholdBps} bps (${profitConfig.recommendation})`));
      console.log(chalk.white(`            Meets Threshold: ${meetsThreshold ? '✅ YES' : '❌ NO'}`));
      
      if (meetsThreshold) {
        this.results.successfulOptimizations++;
        this.results.profitableOpportunities++;
        this.results.totalEstimatedProfit += opportunity.netProfit;
        this.results.gasCostAnalysis.totalEstimatedGasCost += opportunity.estimatedGasCost;
        
        // Update chain profit
        const chainStats = this.results.chainResults.get(opportunity.chainId)!;
        chainStats.profit += opportunity.netProfit;
        
        // Update monitor if available
        if (this.productionMonitor) {
          await this.productionMonitor.updateTradeMetrics({
          success: true,
          profit: opportunity.netProfit,
          gasCost: opportunity.estimatedGasCost,
          executionTime: 2000, // Simulated 2s execution
          bundleSuccess: true,
          bundleAttempted: true
        });
        }
        
        console.log(chalk.green(`         🚀 WOULD EXECUTE: ${formatEther(opportunity.netProfit)} ETH profit`));
      } else {
        console.log(chalk.yellow(`         ⏭️ SKIP: Below adaptive threshold`));
      }
      
    } catch (error) {
      console.error(chalk.red(`      ❌ Phase 3 analysis failed:`), error);
      return { approved: false, validations };
    }
    
    return { approved: true, validations };
  }
  
  private async generateFinalReport(): Promise<void> {
    const durationMs = Date.now() - this.startTime;
    const durationHours = durationMs / (1000 * 60 * 60);
    
    console.log(chalk.blue('\n\n📊 ARBBot2025 Mainnet Dry Run - Final Results'));
    console.log(chalk.blue('================================================================\n'));
    
    // Calculate final metrics
    this.calculateFinalMetrics(durationHours);
    
    // Display comprehensive results
    await this.displayProfitabilityAnalysis();
    await this.displayPhase3Performance();
    await this.displayGasEfficiencyAnalysis();
    await this.displayRiskManagementAnalysis();
    await this.displayPerformanceMetrics(durationHours);
    await this.displayChainSpecificResults();
    
    // Generate production recommendations
    await this.generateProductionRecommendations();
    
    console.log(chalk.blue('\n================================================================'));
    console.log(chalk.green('✅ Mainnet Dry Run Complete - Detailed logs saved'));
    console.log(chalk.blue('================================================================\n'));
  }
  
  private calculateFinalMetrics(durationHours: number): void {
    // Average profit margin
    if (this.results.profitableOpportunities > 0) {
      this.results.averageProfitMargin = Number(this.results.totalEstimatedProfit) / 
        this.results.profitableOpportunities / 1e18 * 100;
    }
    
    // Gas efficiency
    if (this.results.profitableOpportunities > 0) {
      this.results.gasCostAnalysis.averageGasCostPerTrade = 
        this.results.gasCostAnalysis.totalEstimatedGasCost / BigInt(this.results.profitableOpportunities);
      
      this.results.gasCostAnalysis.gasEfficiencyRatio = 
        Number(this.results.totalEstimatedProfit) > 0 ?
        Number(this.results.totalEstimatedProfit) / Number(this.results.gasCostAnalysis.totalEstimatedGasCost) : 0;
    }
    
    // Performance metrics
    if (this.processingTimes.length > 0) {
      this.results.performanceMetrics.avgProcessingTimeMs = 
        this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }
    
    this.results.performanceMetrics.opportunitiesPerMinute = 
      (this.results.totalOpportunitiesDetected / Math.max(durationHours * 60, 1));
    
    // Average confidence
    let totalConfidence = 0;
    let validOpportunities = 0;
    
    this.results.chainResults.forEach(chain => {
      if (chain.opportunities > 0) {
        totalConfidence += chain.avgConfidence * chain.opportunities;
        validOpportunities += chain.opportunities;
      }
    });
    
    this.results.riskMetrics.averageConfidence = validOpportunities > 0 ? 
      totalConfidence / validOpportunities : 0;
  }
  
  private async displayProfitabilityAnalysis(): Promise<void> {
    console.log(chalk.green('💰 PROFITABILITY ANALYSIS'));
    console.log(chalk.green('========================\n'));
    
    const successRate = this.results.totalOpportunitiesDetected > 0 ? 
      (this.results.profitableOpportunities / this.results.totalOpportunitiesDetected * 100) : 0;
    
    const hourlyProfitRate = this.results.executionDetails.durationHours > 0 ?
      Number(formatEther(this.results.totalEstimatedProfit)) / this.results.executionDetails.durationHours : 0;
    
    const projectedMonthlyProfit = hourlyProfitRate * 24 * 30;
    
    console.log(chalk.white(`Total Opportunities Detected: ${this.results.totalOpportunitiesDetected}`));
    console.log(chalk.white(`Profitable Opportunities: ${this.results.profitableOpportunities}`));
    console.log(chalk.white(`Success Rate: ${successRate.toFixed(2)}% ${this.getStatusEmoji(successRate, 20)}`));
    console.log(chalk.white(`Total Estimated Profit: ${formatEther(this.results.totalEstimatedProfit)} ETH`));
    console.log(chalk.white(`Average Profit Margin: ${this.results.averageProfitMargin.toFixed(3)}%`));
    console.log(chalk.white(`Hourly Profit Rate: ${hourlyProfitRate.toFixed(4)} ETH/hour`));
    console.log(chalk.white(`Projected Monthly Profit: ${projectedMonthlyProfit.toFixed(2)} ETH 🎯\n`));
  }
  
  private async displayPhase3Performance(): Promise<void> {
    console.log(chalk.magenta('🚀 PHASE 3 OPTIMIZATION PERFORMANCE'));
    console.log(chalk.magenta('================================\n'));
    
    const phase3 = this.results.phase3Features;
    const riskSuccessRate = phase3.riskAssessmentsPerformed > 0 ? 
      ((phase3.riskAssessmentsPerformed - phase3.riskAssessmentsBlocked) / phase3.riskAssessmentsPerformed * 100) : 0;
    const oracleSuccessRate = phase3.oracleValidationsPerformed > 0 ?
      ((phase3.oracleValidationsPerformed - phase3.oracleValidationsBlocked) / phase3.oracleValidationsPerformed * 100) : 0;
    
    console.log(chalk.white(`Dynamic Slippage Optimizations: ${phase3.dynamicSlippageUsed}`));
    console.log(chalk.white(`Adaptive Threshold Calculations: ${phase3.adaptiveThresholdsUsed}`));
    console.log(chalk.white(`Risk Assessments Performed: ${phase3.riskAssessmentsPerformed}`));
    console.log(chalk.white(`Risk Assessment Success Rate: ${riskSuccessRate.toFixed(1)}% ${this.getStatusEmoji(riskSuccessRate, 70)}`));
    console.log(chalk.white(`Oracle Validations Performed: ${phase3.oracleValidationsPerformed}`));
    console.log(chalk.white(`Oracle Validation Success Rate: ${oracleSuccessRate.toFixed(1)}% ${this.getStatusEmoji(oracleSuccessRate, 80)}`));
    console.log(chalk.white(`Successful Phase 3 Optimizations: ${this.results.successfulOptimizations}\n`));
  }
  
  private async displayGasEfficiencyAnalysis(): Promise<void> {
    console.log(chalk.cyan('⚡ GAS EFFICIENCY ANALYSIS'));
    console.log(chalk.cyan('=========================\n'));
    
    const gasRatio = this.results.gasCostAnalysis.gasEfficiencyRatio;
    
    console.log(chalk.white(`Total Estimated Gas Cost: ${formatEther(this.results.gasCostAnalysis.totalEstimatedGasCost)} ETH`));
    console.log(chalk.white(`Average Gas Cost per Trade: ${formatEther(this.results.gasCostAnalysis.averageGasCostPerTrade)} ETH`));
    console.log(chalk.white(`Gas Efficiency Ratio: ${gasRatio.toFixed(2)}:1 ${this.getStatusEmoji(gasRatio, 2)}`));
    console.log(chalk.white(`Gas Cost as % of Profit: ${gasRatio > 0 ? (100/gasRatio).toFixed(1) : 'N/A'}%\n`));
  }
  
  private async displayRiskManagementAnalysis(): Promise<void> {
    console.log(chalk.yellow('🛡️ RISK MANAGEMENT ANALYSIS'));
    console.log(chalk.yellow('==========================\n'));
    
    const risk = this.results.riskMetrics;
    const totalRiskAssessments = risk.lowRiskOpportunities + risk.mediumRiskOpportunities + risk.highRiskOpportunities;
    
    console.log(chalk.white(`Low Risk Opportunities: ${risk.lowRiskOpportunities} (${totalRiskAssessments > 0 ? (risk.lowRiskOpportunities/totalRiskAssessments*100).toFixed(1) : 0}%)`));
    console.log(chalk.white(`Medium Risk Opportunities: ${risk.mediumRiskOpportunities} (${totalRiskAssessments > 0 ? (risk.mediumRiskOpportunities/totalRiskAssessments*100).toFixed(1) : 0}%)`));
    console.log(chalk.white(`High Risk Opportunities: ${risk.highRiskOpportunities} (${totalRiskAssessments > 0 ? (risk.highRiskOpportunities/totalRiskAssessments*100).toFixed(1) : 0}%)`));
    console.log(chalk.white(`Risk Manager Blocks: ${risk.riskManagerBlocks}`));
    console.log(chalk.white(`Circuit Breaker Triggers: ${risk.circuitBreakerTriggers}`));
    console.log(chalk.white(`Average Confidence Score: ${(risk.averageConfidence * 100).toFixed(1)}%\n`));
  }
  
  private async displayPerformanceMetrics(durationHours: number): Promise<void> {
    console.log(chalk.gray('📈 SYSTEM PERFORMANCE METRICS'));
    console.log(chalk.gray('=============================\n'));
    
    const perf = this.results.performanceMetrics;
    
    console.log(chalk.white(`Total Execution Time: ${durationHours.toFixed(2)} hours`));
    console.log(chalk.white(`Total Analysis Cycles: ${perf.totalCycles}`));
    console.log(chalk.white(`Average Processing Time: ${perf.avgProcessingTimeMs.toFixed(0)}ms`));
    console.log(chalk.white(`Opportunities per Minute: ${perf.opportunitiesPerMinute.toFixed(2)}`));
    console.log(chalk.white(`Peak Memory Usage: ${perf.peakMemoryUsageMB.toFixed(0)}MB`));
    console.log(chalk.white(`System Load: ${(perf.systemLoad * 100).toFixed(1)}%\n`));
  }
  
  private async displayChainSpecificResults(): Promise<void> {
    console.log(chalk.blue('⛓️ CHAIN-SPECIFIC RESULTS'));
    console.log(chalk.blue('========================\n'));
    
    this.results.chainResults.forEach((stats, chainId) => {
      const chainName = chainId === 42161 ? 'Arbitrum' : 'Optimism';
      console.log(chalk.white(`${chainName} (${chainId}):`));
      console.log(chalk.white(`  Opportunities: ${stats.opportunities}`));
      console.log(chalk.white(`  Total Profit: ${formatEther(stats.profit)} ETH`));
      console.log(chalk.white(`  Avg Confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`));
    });
    console.log('');
  }
  
  private async generateProductionRecommendations(): Promise<void> {
    console.log(chalk.blue('💡 PRODUCTION DEPLOYMENT RECOMMENDATIONS'));
    console.log(chalk.blue('==========================================\n'));
    
    const successRate = this.results.totalOpportunitiesDetected > 0 ? 
      (this.results.profitableOpportunities / this.results.totalOpportunitiesDetected * 100) : 0;
    const gasEfficiency = this.results.gasCostAnalysis.gasEfficiencyRatio;
    const hourlyProfit = this.results.executionDetails.durationHours > 0 ?
      Number(formatEther(this.results.totalEstimatedProfit)) / this.results.executionDetails.durationHours : 0;
    
    const isReady = successRate >= 15 && gasEfficiency >= 1.8 && hourlyProfit >= 0.008;
    
    if (isReady) {
      console.log(chalk.green('🚀 READY FOR PRODUCTION DEPLOYMENT'));
      console.log(chalk.green('===================================='));
      console.log(chalk.green('All critical metrics meet production requirements!\n'));
      
      console.log(chalk.white('✅ Success Rate: '), chalk.green(`${successRate.toFixed(1)}% (>15% required)`));
      console.log(chalk.white('✅ Gas Efficiency: '), chalk.green(`${gasEfficiency.toFixed(2)}:1 (>1.8:1 required)`));
      console.log(chalk.white('✅ Hourly Profit: '), chalk.green(`${hourlyProfit.toFixed(4)} ETH/hour (>0.008 required)`));
      
      const projectedMonthly = hourlyProfit * 24 * 30;
      console.log(chalk.green(`\n🎯 Projected Monthly Profit: ${projectedMonthly.toFixed(2)} ETH`));
      
      if (projectedMonthly >= 15) {
        console.log(chalk.green('🌟 Exceeds target of 15 ETH/month - Excellent performance!'));
      } else if (projectedMonthly >= 5) {
        console.log(chalk.yellow('⚡ Meets minimum target of 5 ETH/month - Good performance'));
      }
      
    } else {
      console.log(chalk.yellow('⚠️ REQUIRES OPTIMIZATION BEFORE PRODUCTION'));
      console.log(chalk.yellow('==========================================\n'));
      
      if (successRate < 15) {
        console.log(chalk.red(`❌ Low Success Rate: ${successRate.toFixed(1)}% (minimum: 15%)`));
        console.log(chalk.white('   Recommendation: Lower profit thresholds or improve opportunity detection\n'));
      }
      
      if (gasEfficiency < 1.8) {
        console.log(chalk.red(`❌ Poor Gas Efficiency: ${gasEfficiency.toFixed(2)}:1 (minimum: 1.8:1)`));
        console.log(chalk.white('   Recommendation: Optimize gas usage or increase profit thresholds\n'));
      }
      
      if (hourlyProfit < 0.008) {
        console.log(chalk.red(`❌ Low Profitability: ${hourlyProfit.toFixed(4)} ETH/hour (minimum: 0.008)`));
        console.log(chalk.white('   Recommendation: Focus on higher-value opportunities\n'));
      }
    }
    
    console.log(chalk.cyan('🎯 NEXT STEPS:'));
    if (isReady) {
      console.log(chalk.white('1. Fund production wallet with 0.5-1.0 ETH for gas'));
      console.log(chalk.white('2. Deploy contracts to mainnet'));
      console.log(chalk.white('3. Start with conservative position sizes'));
      console.log(chalk.white('4. Monitor performance for first 24 hours'));
      console.log(chalk.white('5. Gradually increase position sizes based on performance'));
    } else {
      console.log(chalk.white('1. Optimize underperforming components'));
      console.log(chalk.white('2. Adjust configuration parameters'));
      console.log(chalk.white('3. Run focused dry runs on specific issues'));
      console.log(chalk.white('4. Repeat full validation once issues are resolved'));
    }
  }
  
  private getStatusEmoji(value: number, threshold: number): string {
    if (value >= threshold * 1.2) return '🟢';
    if (value >= threshold) return '🟡';
    return '🔴';
  }
  
  private async createLogDirectory(): Promise<void> {
    try {
      await fs.mkdir('logs', { recursive: true });
      await fs.mkdir('logs/dry-run', { recursive: true });
    } catch (error) {
      console.warn('Could not create log directories:', error);
    }
  }
  
  private async saveDetailedLogs(): Promise<void> {
    try {
      const logData = {
        summary: this.results,
        cycleResults: this.cycleResults,
        timeSeriesData: this.results.timeSeriesData,
        processingTimes: this.processingTimes,
        executionConfig: {
          durationHours: process.env.DRY_RUN_DURATION_HOURS,
          cycleIntervalSec: process.env.DRY_RUN_CYCLE_INTERVAL_SEC,
          phase3Enabled: process.env.ENABLE_DYNAMIC_SLIPPAGE === 'true'
        }
      };
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `logs/dry-run/mainnet-dry-run-${timestamp}.json`;
      
      await fs.writeFile(filename, JSON.stringify(logData, null, 2));
      console.log(chalk.gray(`📁 Detailed logs saved to: ${filename}`));
      
    } catch (error) {
      console.warn('Could not save detailed logs:', error);
    }
  }
  
  private updateTimeSeriesData(cycleNumber: number): void {
    const recentCycles = this.cycleResults.slice(-2); // Last 2 cycles
    const totalOpps = recentCycles.reduce((sum, cycle) => sum + cycle.opportunitiesFound, 0);
    const avgConfidence = recentCycles.length > 0 ?
      recentCycles.reduce((sum, cycle) => sum + (cycle.bestOpportunity?.confidence || 0), 0) / recentCycles.length : 0;
    
    this.results.timeSeriesData.push({
      timestamp: Date.now(),
      opportunities: totalOpps,
      profit: this.results.totalEstimatedProfit,
      confidence: avgConfidence
    });
    
    // Keep only last 100 data points
    if (this.results.timeSeriesData.length > 100) {
      this.results.timeSeriesData = this.results.timeSeriesData.slice(-100);
    }
  }
  
  private updateSystemResourceMetrics(): void {
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    this.results.performanceMetrics.peakMemoryUsageMB = Math.max(
      this.results.performanceMetrics.peakMemoryUsageMB,
      memUsageMB
    );
    
    this.results.performanceMetrics.systemLoad = memUsageMB / 1000; // Simplified system load
  }
  
  private updatePerformanceMetrics(): void {
    if (this.processingTimes.length > 0) {
      this.results.performanceMetrics.avgProcessingTimeMs = 
        this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }
  }
  
  private initializePhase3Modules(): void {
    try {
      // Initialize Phase 3 optimization modules
      try {
        // Create provider map for Phase 3 modules
        const providers = new Map<number, any>([
          [42161, this.dataFetcher['arbProvider'] as any],
          [10, this.dataFetcher['optProvider'] as any]
        ]);
        
        this.dynamicSlippage = new DynamicSlippageManager(providers);
        this.adaptiveProfit = new AdaptiveProfitManager();
        this.riskManager = new AdvancedRiskManager();
        this.oracleValidator = new OraclePriceValidator(providers);
        
        console.log(chalk.green('✅ Phase 3 optimization modules initialized'));
      } catch (error) {
        console.warn(chalk.yellow('⚠️ Some Phase 3 modules failed to initialize:'), error);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error initializing Phase 3 modules:'), error);
      throw error;
    }
  }
  
  private initializeResults(): void {
    this.results = {
      totalOpportunitiesDetected: 0,
      profitableOpportunities: 0,
      totalEstimatedProfit: 0n,
      averageProfitMargin: 0,
      successfulOptimizations: 0,
      
      phase3Features: {
        dynamicSlippageUsed: 0,
        adaptiveThresholdsUsed: 0,
        riskAssessmentsPerformed: 0,
        riskAssessmentsBlocked: 0,
        oracleValidationsPerformed: 0,
        oracleValidationsBlocked: 0
      },
      
      gasCostAnalysis: {
        totalEstimatedGasCost: 0n,
        averageGasCostPerTrade: 0n,
        gasEfficiencyRatio: 0
      },
      
      riskMetrics: {
        highRiskOpportunities: 0,
        mediumRiskOpportunities: 0,
        lowRiskOpportunities: 0,
        riskManagerBlocks: 0,
        circuitBreakerTriggers: 0,
        averageConfidence: 0
      },
      
      performanceMetrics: {
        avgProcessingTimeMs: 0,
        opportunitiesPerMinute: 0,
        systemLoad: 0,
        peakMemoryUsageMB: 0,
        totalCycles: 0
      },
      
      chainResults: new Map(),
      timeSeriesData: [],
      
      executionDetails: {
        startTime: Date.now(),
        endTime: 0,
        durationHours: 0,
        configurationUsed: {
          durationHours: process.env.DRY_RUN_DURATION_HOURS,
          cycleInterval: process.env.DRY_RUN_CYCLE_INTERVAL_SEC,
          phase3Enabled: true
        }
      }
    };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute the comprehensive mainnet dry run
async function main() {
  console.log(chalk.blue('🔄 Loading environment configuration...'));
  
  // Validate required environment variables
  const requiredEnvVars = ['ARB_RPC', 'OPT_RPC', 'DRY_RUN_DURATION_HOURS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(chalk.red(`❌ Missing required environment variables: ${missingVars.join(', ')}`));
    console.error(chalk.yellow('Load the configuration: source config/mainnet-dry-run.env'));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Environment configuration loaded'));
  
  const orchestrator = new DryRunOrchestrator();
  
  try {
    const results = await orchestrator.executeDryRun();
    
    // Determine exit code based on results
    const successRate = results.totalOpportunitiesDetected > 0 ? 
      (results.profitableOpportunities / results.totalOpportunitiesDetected * 100) : 0;
    const gasEfficiency = results.gasCostAnalysis.gasEfficiencyRatio;
    const isSuccessful = successRate >= 15 && gasEfficiency >= 1.8;
    
    console.log(chalk.green(`\n✅ Mainnet dry run completed ${isSuccessful ? 'successfully' : 'with recommendations'}!`));
    process.exit(isSuccessful ? 0 : 1);
    
  } catch (error) {
    console.error(chalk.red('\n❌ Mainnet dry run failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DryRunOrchestrator };