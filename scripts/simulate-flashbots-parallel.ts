#!/usr/bin/env node

import { program } from 'commander';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import { FlashbotsBundleProvider, SimulationResponse } from '@flashbots/ethers-provider-bundle';
import { WorkerManager } from '../utils/WorkerManager';
import { PerformanceReporter } from '../utils/PerformanceReporter';
import chalk from 'chalk';

config();

interface FlashbotsConfig {
  workers: number;
  bundleSize: number;
  simulate: boolean;
  verbose: boolean;
  duration: number;
  minProfitThreshold: number;
  maxGasPrice: string;
  targetChains: number[];
}

interface BundleResult {
  bundleHash: string;
  success: boolean;
  profit: string;
  gasUsed: string;
  coinbaseDiff: string;
  blockNumber: number;
  transactions: string[];
  error?: string;
}

interface SimulationStats {
  totalBundles: number;
  successfulBundles: number;
  totalProfit: string;
  totalGasUsed: string;
  avgCoinbaseDiff: string;
  blocksAttempted: number;
  blocksSuccessful: number;
  avgLatency: number;
  bestBundle: BundleResult | null;
}

class FlashbotsParallelSimulator {
  private workerManager: WorkerManager;
  private performanceReporter: PerformanceReporter;
  private flashbotsProvider!: FlashbotsBundleProvider;
  private config: FlashbotsConfig;
  private stats: SimulationStats = {} as SimulationStats;
  private isRunning = false;

  constructor(config: FlashbotsConfig) {
    this.config = config;
    this.workerManager = new WorkerManager(config.workers, 1000, 30000);
    this.performanceReporter = new PerformanceReporter(config.verbose);
    this.initializeStats();
    this.initializeFlashbots();
    this.setupEventHandlers();
  }

  private initializeStats(): void {
    this.stats = {
      totalBundles: 0,
      successfulBundles: 0,
      totalProfit: '0',
      totalGasUsed: '0',
      avgCoinbaseDiff: '0',
      blocksAttempted: 0,
      blocksSuccessful: 0,
      avgLatency: 0,
      bestBundle: null
    };
  }

  private async initializeFlashbots(): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC || 'https://cloudflare-eth.com');
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
      
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        signer,
        'https://relay.flashbots.net',
        'mainnet'
      );
      
      console.log(chalk.green('✅ Flashbots provider initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Flashbots provider:'), error);
      process.exit(1);
    }
  }

  private setupEventHandlers(): void {
    this.workerManager.on('opportunity', (opportunities) => {
      this.processBundleOpportunities(opportunities);
    });

    this.workerManager.on('execution', (result) => {
      this.handleBundleExecution(result);
    });

    this.workerManager.on('performanceReport', (report) => {
      this.performanceReporter.logPerformanceReport(report);
    });

    this.workerManager.on('error', (error) => {
      console.error(chalk.red('Worker error:'), error);
    });

    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  private async processBundleOpportunities(opportunities: any[]): Promise<void> {
    if (opportunities.length === 0) return;

    // Group opportunities into bundles
    const bundles = this.createBundles(opportunities);
    
    for (const bundle of bundles) {
      await this.simulateBundle(bundle);
    }
  }

  private createBundles(opportunities: any[]): any[][] {
    const bundles: any[][] = [];
    const sortedOpportunities = opportunities
      .filter(opp => parseFloat(opp.profit) >= this.config.minProfitThreshold)
      .sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit));

    for (let i = 0; i < sortedOpportunities.length; i += this.config.bundleSize) {
      const bundle = sortedOpportunities.slice(i, i + this.config.bundleSize);
      bundles.push(bundle);
    }

    return bundles;
  }

  private async simulateBundle(bundle: any[]): Promise<void> {
    try {
      const bundleTransactions = await this.createBundleTransactions(bundle);
      
      if (bundleTransactions.length === 0) return;

      const simulationResult = await this.simulateFlashbotsBundle(bundleTransactions);
      
      if (simulationResult.success) {
        this.stats.totalBundles++;
        this.stats.successfulBundles++;
        this.stats.totalProfit = (
          parseFloat(this.stats.totalProfit) + parseFloat(simulationResult.profit)
        ).toString();
        this.stats.totalGasUsed = (
          parseFloat(this.stats.totalGasUsed) + parseFloat(simulationResult.gasUsed)
        ).toString();
        
        // Update best bundle
        if (!this.stats.bestBundle || 
            parseFloat(simulationResult.profit) > parseFloat(this.stats.bestBundle.profit)) {
          this.stats.bestBundle = simulationResult;
        }
        
        if (this.config.verbose) {
          this.logBundleResult(simulationResult);
        }
      } else {
        this.stats.totalBundles++;
        
        if (this.config.verbose) {
          console.log(chalk.red(`❌ Bundle simulation failed: ${simulationResult.error}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error simulating bundle:'), error);
    }
  }

  private async createBundleTransactions(bundle: any[]): Promise<ethers.TransactionRequest[]> {
    const transactions: ethers.TransactionRequest[] = [];
    
    for (const opportunity of bundle) {
      try {
        const tx = await this.createArbitrageTransaction(opportunity);
        if (tx) {
          transactions.push(tx);
        }
      } catch (error) {
        console.debug('Error creating transaction:', error);
      }
    }
    
    return transactions;
  }

  private async createArbitrageTransaction(opportunity: any): Promise<ethers.TransactionRequest | null> {
    try {
      // Create a mock arbitrage transaction
      const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
      
      const gasPrice = await provider.getFeeData();
      
      return {
        to: opportunity.tokenA || ethers.ZeroAddress,
        value: 0,
        data: '0x',
        gasLimit: parseInt(opportunity.gasEstimate || '200000'),
        gasPrice: gasPrice.gasPrice,
        nonce: await signer.getNonce()
      };
    } catch (error) {
      console.debug('Error creating arbitrage transaction:', error);
      return null;
    }
  }

  private async simulateFlashbotsBundle(transactions: ethers.TransactionRequest[]): Promise<BundleResult> {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
      const currentBlock = await provider.getBlockNumber();
      const targetBlock = currentBlock + 1;
      
      // Create signed transactions
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
      const signedTransactions = await Promise.all(
        transactions.map(tx => signer.signTransaction(tx))
      );
      
      // Simulate the bundle
      const simulation = await this.flashbotsProvider.simulate(
        signedTransactions,
        targetBlock
      );

      if ((simulation as any).success) {
        const totalGasUsed = (simulation as any).results.reduce(
          (sum: number, result: any) => sum + (result.gasUsed || 0), 0
        );
        
        const gasPrice = transactions[0].gasPrice || ethers.parseUnits('20', 'gwei');
        const gasCost = totalGasUsed * Number(gasPrice);
        
        // Estimate profit (mock calculation)
        const estimatedProfit = transactions.length * 0.01; // 0.01 ETH per transaction
        const netProfit = estimatedProfit - Number(ethers.formatEther(gasCost));
        
        // Calculate coinbase difference
        const coinbaseDiff = (simulation as any).coinbaseDiff || '0';
        
        return {
          bundleHash: (simulation as any).bundleHash || `0x${Math.random().toString(16).slice(2)}`,
          success: true,
          profit: netProfit.toString(),
          gasUsed: ethers.formatEther(gasCost),
          coinbaseDiff: ethers.formatEther(coinbaseDiff),
          blockNumber: targetBlock,
          transactions: signedTransactions,
          error: undefined
        };
      } else {
        return {
          bundleHash: '',
          success: false,
          profit: '0',
          gasUsed: '0',
          coinbaseDiff: '0',
          blockNumber: targetBlock,
          transactions: signedTransactions,
          error: (simulation as any).error || 'Simulation failed'
        };
      }
    } catch (error) {
      return {
        bundleHash: '',
        success: false,
        profit: '0',
        gasUsed: '0',
        coinbaseDiff: '0',
        blockNumber: 0,
        transactions: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private handleBundleExecution(result: any): void {
    // Handle bundle execution results
    this.performanceReporter.logExecution(result);
  }

  private logBundleResult(result: BundleResult): void {
    const profitEth = parseFloat(result.profit).toFixed(6);
    const gasEth = parseFloat(result.gasUsed).toFixed(6);
    const coinbaseDiffEth = parseFloat(result.coinbaseDiff).toFixed(6);
    
    console.log(
      `${chalk.green('✅ Bundle:')} ${result.bundleHash.slice(0, 10)}... ` +
      `${chalk.green('Block:')} ${result.blockNumber} ` +
      `${chalk.green('Profit:')} ${profitEth} ETH ` +
      `${chalk.red('Gas:')} ${gasEth} ETH ` +
      `${chalk.yellow('CoinbaseDiff:')} ${coinbaseDiffEth} ETH ` +
      `${chalk.blue('TXs:')} ${result.transactions.length}`
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('Simulator is already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.green('🚀 Starting Flashbots Parallel Simulator'));
    console.log(chalk.blue('Configuration:'));
    console.log(chalk.blue(`  Workers: ${this.config.workers}`));
    console.log(chalk.blue(`  Bundle Size: ${this.config.bundleSize}`));
    console.log(chalk.blue(`  Duration: ${this.config.duration}s`));
    console.log(chalk.blue(`  Min Profit: ${this.config.minProfitThreshold} ETH`));
    console.log(chalk.blue(`  Simulation: ${this.config.simulate}`));
    console.log('');

    try {
      await this.workerManager.start();
      
      if (this.config.duration > 0) {
        setTimeout(() => {
          this.gracefulShutdown();
        }, this.config.duration * 1000);
      }
      
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });
      
    } catch (error) {
      console.error(chalk.red('Error starting simulator:'), error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    if (!this.isRunning) return;

    console.log(chalk.yellow('\n🛑 Shutting down simulator...'));
    this.isRunning = false;

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
    const totalProfit = parseFloat(this.stats.totalProfit);
    const totalGasUsed = parseFloat(this.stats.totalGasUsed);
    const netProfit = totalProfit - totalGasUsed;
    const successRate = this.stats.totalBundles > 0 
      ? (this.stats.successfulBundles / this.stats.totalBundles) * 100 
      : 0;
    
    console.log(chalk.green('\n📊 Final Flashbots Simulation Report'));
    console.log(chalk.green('===================================='));
    console.log(`${chalk.cyan('Total Bundles:')} ${this.stats.totalBundles}`);
    console.log(`${chalk.cyan('Successful Bundles:')} ${this.stats.successfulBundles}`);
    console.log(`${chalk.cyan('Success Rate:')} ${successRate.toFixed(1)}%`);
    console.log(`${chalk.cyan('Total Profit:')} ${totalProfit.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Total Gas Used:')} ${totalGasUsed.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Net Profit:')} ${netProfit.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Avg Coinbase Diff:')} ${this.stats.avgCoinbaseDiff} ETH`);
    console.log(`${chalk.cyan('Blocks Attempted:')} ${this.stats.blocksAttempted}`);
    console.log(`${chalk.cyan('Blocks Successful:')} ${this.stats.blocksSuccessful}`);
    
    if (this.stats.bestBundle) {
      console.log(`${chalk.cyan('Best Bundle Profit:')} ${this.stats.bestBundle.profit} ETH`);
      console.log(`${chalk.cyan('Best Bundle Hash:')} ${this.stats.bestBundle.bundleHash}`);
    }
    
    console.log('');
    console.log(chalk.green('✅ Flashbots simulation completed successfully'));
  }
}

// CLI configuration
program
  .name('simulate-flashbots-parallel')
  .description('Parallel Flashbots bundle simulation with MEV extraction')
  .version('2.0.0')
  .option('--workers <number>', 'Number of worker threads', '4')
  .option('--bundle-size <number>', 'Number of transactions per bundle', '3')
  .option('--simulate', 'Run in simulation mode only', true)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--duration <seconds>', 'Simulation duration in seconds', '300')
  .option('--min-profit <amount>', 'Minimum profit threshold in ETH', '0.01')
  .option('--max-gas <price>', 'Maximum gas price in gwei', '100')
  .parse();

async function main(): Promise<void> {
  const options = program.opts();
  
  if (!process.env.PRIVATE_KEY) {
    console.error(chalk.red('Error: PRIVATE_KEY environment variable is required'));
    process.exit(1);
  }

  if (!process.env.ETH_RPC) {
    console.error(chalk.red('Error: ETH_RPC environment variable is required'));
    process.exit(1);
  }

  const config: FlashbotsConfig = {
    workers: parseInt(options.workers),
    bundleSize: parseInt(options.bundleSize),
    simulate: options.simulate,
    verbose: options.verbose,
    duration: parseInt(options.duration),
    minProfitThreshold: parseFloat(options.minProfit),
    maxGasPrice: options.maxGas,
    targetChains: [1, 42161, 10] // Ethereum, Arbitrum, Optimism
  };

  const simulator = new FlashbotsParallelSimulator(config);
  await simulator.start();
}

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { FlashbotsParallelSimulator, FlashbotsConfig };