#!/usr/bin/env node

import { program } from 'commander';
import { config } from 'dotenv';
import { WorkerManager } from '../utils/WorkerManager';
import { PerformanceReporter } from '../utils/PerformanceReporter';
import chalk from 'chalk';

// Load environment variables
config();

interface BotConfig {
  workers: number;
  duration: number;
  simulate: boolean;
  verbose: boolean;
  crossChain: boolean;
  triangular: boolean;
  minProfitThreshold: number;
  maxGasPrice: string;
  slippageTolerance: number;
  scanInterval: number;
  reportInterval: number;
}

interface ExecutionStats {
  startTime: number;
  endTime: number;
  totalOpportunities: number;
  totalExecutions: number;
  totalProfit: string;
  totalGasUsed: string;
  avgLatency: number;
  successRate: number;
  missedBlocks: number;
  bestProfitTx: string;
  coinbaseDiff: string;
}

class ParallelArbitrageBot {
  private workerManager: WorkerManager;
  private performanceReporter: PerformanceReporter;
  private config: BotConfig;
  private stats: ExecutionStats = {} as ExecutionStats;
  private isRunning = false;

  constructor(config: BotConfig) {
    this.config = config;
    this.workerManager = new WorkerManager(
      config.workers,
      config.scanInterval,
      config.reportInterval
    );
    this.performanceReporter = new PerformanceReporter(config.verbose);
    this.initializeStats();
    this.setupEventHandlers();
  }

  private initializeStats(): void {
    this.stats = {
      startTime: Date.now(),
      endTime: 0,
      totalOpportunities: 0,
      totalExecutions: 0,
      totalProfit: '0',
      totalGasUsed: '0',
      avgLatency: 0,
      successRate: 0,
      missedBlocks: 0,
      bestProfitTx: '',
      coinbaseDiff: '0'
    };
  }

  private setupEventHandlers(): void {
    // Handle opportunities found
    this.workerManager.on('opportunity', (opportunities) => {
      this.stats.totalOpportunities += opportunities.length;
      this.performanceReporter.logOpportunities(opportunities);
      
      // Execute profitable opportunities
      this.executeOpportunities(opportunities);
    });

    // Handle execution results
    this.workerManager.on('execution', (result) => {
      this.stats.totalExecutions++;
      if (result.success) {
        this.stats.totalProfit = (
          parseFloat(this.stats.totalProfit) + parseFloat(result.profit || '0')
        ).toString();
        this.stats.totalGasUsed = (
          parseFloat(this.stats.totalGasUsed) + parseFloat(result.gasUsed || '0')
        ).toString();
        
        // Track best profit transaction
        if (parseFloat(result.profit || '0') > parseFloat(this.stats.bestProfitTx || '0')) {
          this.stats.bestProfitTx = result.profit || '0';
        }
      }
      this.performanceReporter.logExecution(result);
    });

    // Handle performance reports
    this.workerManager.on('performanceReport', (report) => {
      this.updateStats(report);
      this.performanceReporter.logPerformanceReport(report);
    });

    // Handle errors
    this.workerManager.on('error', (error) => {
      console.error(chalk.red('Worker error:'), error);
    });

    // Handle worker errors
    this.workerManager.on('workerError', (error) => {
      console.error(chalk.red(`Worker ${error.workerId} error:`), error.error);
    });

    // Handle shutdown signals
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  private async executeOpportunities(opportunities: any[]): Promise<void> {
    const profitableOpportunities = opportunities.filter(opp => 
      parseFloat(opp.profit) >= this.config.minProfitThreshold
    );

    if (profitableOpportunities.length === 0) return;

    // Execute top opportunities in parallel
    const executionPromises = profitableOpportunities
      .slice(0, this.config.workers) // Limit to worker count
      .map(async (opportunity, index) => {
        const workerId = index % this.config.workers;
        
        if (this.config.simulate) {
          return this.simulateExecution(opportunity, workerId);
        } else {
          return this.workerManager.sendToWorker(workerId, {
            type: 'execute',
            payload: opportunity,
            id: `exec_${Date.now()}_${index}`,
            timestamp: Date.now()
          });
        }
      });

    await Promise.allSettled(executionPromises);
  }

  private async simulateExecution(opportunity: any, workerId: number): Promise<any> {
    // Simulate execution with random success/failure
    const success = Math.random() > 0.2; // 80% success rate
    const latency = Math.random() * 100 + 50; // 50-150ms latency
    
    return {
      type: 'execution',
      payload: {
        success,
        profit: success ? opportunity.profit : '0',
        gasUsed: success ? opportunity.gasEstimate : '0',
        txHash: success ? `0x${Math.random().toString(16).slice(2)}` : undefined,
        error: success ? undefined : 'Simulation failure'
      },
      workerId,
      timestamp: Date.now(),
      latency
    };
  }

  private updateStats(report: any): void {
    this.stats.avgLatency = report.avgLatency;
    this.stats.successRate = report.successRate;
    
    // Calculate coinbase difference (MEV extracted)
    const coinbaseDiff = parseFloat(this.stats.totalProfit) * 0.1; // Estimate 10% goes to coinbase
    this.stats.coinbaseDiff = coinbaseDiff.toString();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('Bot is already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.green('🚀 Starting Parallel Arbitrage Bot'));
    console.log(chalk.blue(`Configuration:`));
    console.log(chalk.blue(`  Workers: ${this.config.workers}`));
    console.log(chalk.blue(`  Duration: ${this.config.duration}s`));
    console.log(chalk.blue(`  Simulation: ${this.config.simulate}`));
    console.log(chalk.blue(`  Cross-chain: ${this.config.crossChain}`));
    console.log(chalk.blue(`  Triangular: ${this.config.triangular}`));
    console.log(chalk.blue(`  Min Profit: ${this.config.minProfitThreshold} ETH`));
    console.log(chalk.blue(`  Scan Interval: ${this.config.scanInterval}ms`));
    console.log('');

    try {
      await this.workerManager.start();
      
      // Run for specified duration
      if (this.config.duration > 0) {
        setTimeout(() => {
          this.gracefulShutdown();
        }, this.config.duration * 1000);
      }
      
      // Keep process alive
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });
      
    } catch (error) {
      console.error(chalk.red('Error starting bot:'), error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    if (!this.isRunning) return;

    console.log(chalk.yellow('\n🛑 Shutting down...'));
    this.isRunning = false;
    this.stats.endTime = Date.now();

    try {
      await this.workerManager.stop();
      this.generateFinalReport();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error during shutdown:'), error);
      process.exit(1);
    }
  }

  private generateFinalReport(): void {
    const runtime = (this.stats.endTime - this.stats.startTime) / 1000;
    const profitInEth = parseFloat(this.stats.totalProfit);
    const gasUsedInEth = parseFloat(this.stats.totalGasUsed);
    
    console.log(chalk.green('\n📊 Final Performance Report'));
    console.log(chalk.green('================================'));
    console.log(`${chalk.cyan('Runtime:')} ${runtime.toFixed(2)}s`);
    console.log(`${chalk.cyan('Found')} ${this.stats.totalOpportunities} ${chalk.cyan('opportunities; best')} ${this.stats.bestProfitTx} ${chalk.cyan('ETH profit; total coinbaseDiff:')} ${this.stats.coinbaseDiff} ${chalk.cyan('ETH; avg latency:')} ${this.stats.avgLatency.toFixed(2)} ${chalk.cyan('ms; missed blocks:')} ${this.stats.missedBlocks}.`);
    console.log('');
    console.log(chalk.blue('Detailed Statistics:'));
    console.log(`  Total Opportunities: ${this.stats.totalOpportunities}`);
    console.log(`  Total Executions: ${this.stats.totalExecutions}`);
    console.log(`  Success Rate: ${(this.stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Total Profit: ${profitInEth.toFixed(6)} ETH`);
    console.log(`  Total Gas Used: ${gasUsedInEth.toFixed(6)} ETH`);
    console.log(`  Net Profit: ${(profitInEth - gasUsedInEth).toFixed(6)} ETH`);
    console.log(`  Avg Latency: ${this.stats.avgLatency.toFixed(2)}ms`);
    console.log(`  Missed Blocks: ${this.stats.missedBlocks}`);
    console.log(`  Best Single Profit: ${this.stats.bestProfitTx} ETH`);
    console.log(`  Coinbase Diff: ${this.stats.coinbaseDiff} ETH`);
    console.log('');
    console.log(chalk.green('✅ Bot execution completed successfully'));
  }
}

// CLI configuration
program
  .name('run-bot-parallel')
  .description('High-frequency parallel arbitrage bot with cross-chain support')
  .version('2.0.0')
  .option('--simulate', 'Run in simulation mode (no real transactions)', false)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--cross-chain', 'Enable cross-chain arbitrage', false)
  .option('--triangular', 'Enable triangular arbitrage', false)
  .option('--workers <number>', 'Number of worker threads', '4')
  .option('--duration <seconds>', 'Run duration in seconds (0 = infinite)', '0')
  .option('--min-profit <amount>', 'Minimum profit threshold in ETH', '0.01')
  .option('--max-gas <price>', 'Maximum gas price in gwei', '50')
  .option('--slippage <percent>', 'Slippage tolerance in basis points', '300')
  .option('--scan-interval <ms>', 'Scan interval in milliseconds', '1000')
  .option('--report-interval <ms>', 'Report interval in milliseconds', '60000')
  .parse();

async function main(): Promise<void> {
  const options = program.opts();
  
  // Validate configuration
  if (!process.env.PRIVATE_KEY && !options.simulate) {
    console.error(chalk.red('Error: PRIVATE_KEY environment variable is required for live execution'));
    process.exit(1);
  }

  if (!process.env.ARB_RPC || !process.env.OPT_RPC) {
    console.error(chalk.red('Error: ARB_RPC and OPT_RPC environment variables are required'));
    process.exit(1);
  }

  const config: BotConfig = {
    workers: parseInt(options.workers),
    duration: parseInt(options.duration),
    simulate: options.simulate,
    verbose: options.verbose,
    crossChain: options.crossChain,
    triangular: options.triangular,
    minProfitThreshold: parseFloat(options.minProfit),
    maxGasPrice: options.maxGas,
    slippageTolerance: parseInt(options.slippage),
    scanInterval: parseInt(options.scanInterval),
    reportInterval: parseInt(options.reportInterval)
  };

  const bot = new ParallelArbitrageBot(config);
  await bot.start();
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

// Run the bot
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { ParallelArbitrageBot, BotConfig };