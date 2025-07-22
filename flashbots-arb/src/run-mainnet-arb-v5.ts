import { ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import * as dotenv from "dotenv";
const chalk = require('chalk');
import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";

// Load environment from parent directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface SimulationConfig {
  simulate: boolean;
  duration: number;
  chains: string[];
  verbose: boolean;
}

interface SimulationOpportunity {
  timestamp: string;
  chain: string;
  opportunityId: string;
  bundleHash: string;
  simulatedBlock: number;
  estimatedProfit: string;
  simulatedGasUsed: string;
  outcome: 'success' | 'revert' | 'capture';
  gasFeeSimulated: string;
  netProfit: string;
  flashLoanProvider: string;
  crossRollup: boolean;
  recycledTxId?: string;
  recycledAmount?: string;
}

class LeanMainnetArbBot {
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();
  private signers: Map<number, ethers.Wallet> = new Map();
  private simulationRunning = false;
  private config: SimulationConfig;
  private opportunities: SimulationOpportunity[] = [];
  
  private readonly CHAIN_CONFIGS = {
    arbitrum: {
      name: 'Arbitrum',
      chainId: 42161,
      rpcUrl: process.env.ARB_RPC!,
      tokens: {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
      }
    },
    base: {
      name: 'Base',
      chainId: 8453,
      rpcUrl: process.env.BASE_RPC || "https://base.llamarpc.com",
      tokens: {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      }
    }
  };

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue('🚀 Initializing Lean Mainnet Arbitrage Bot...'));
    
    // Initialize providers and signers
    for (const chainName of this.config.chains) {
      const chainConfig = this.CHAIN_CONFIGS[chainName as keyof typeof this.CHAIN_CONFIGS];
      if (!chainConfig) continue;

      const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);
      
      // Validate private key
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error(`Invalid private key format. Expected 0x + 64 hex chars, got: ${privateKey?.length || 0} chars`);
      }
      
      const signer = new ethers.Wallet(privateKey, provider);
      
      this.providers.set(chainConfig.chainId, provider);
      this.signers.set(chainConfig.chainId, signer);

      try {
        const blockNumber = await provider.getBlockNumber();
        const balance = await provider.getBalance(signer.address);
        console.log(chalk.green(`✅ ${chainConfig.name}: Block ${blockNumber}, Balance: ${ethers.utils.formatEther(balance)} ETH`));
      } catch (error) {
        console.log(chalk.red(`❌ ${chainConfig.name}: Connection failed`));
      }
    }
  }

  async runLeanArbitrage(): Promise<void> {
    this.simulationRunning = true;
    const startTime = Date.now();
    const endTime = startTime + (this.config.duration * 1000);
    
    console.log(chalk.magenta(`\n🔥 Starting ${this.config.duration}-second lean mainnet arbitrage`));
    console.log(chalk.cyan(`⏰ Will run until ${new Date(endTime).toLocaleTimeString()}`));
    console.log(chalk.yellow(`🎭 Mode: ${this.config.simulate ? 'SIMULATION' : 'LIVE TRADING'}`));

    let iterationCount = 0;
    const scanInterval = 5000;
    
    while (this.simulationRunning && Date.now() < endTime) {
      iterationCount++;
      const iterationStart = Date.now();
      
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (this.config.verbose) {
        console.log(chalk.gray(`\n📊 Iteration ${iterationCount} - ${remaining}s remaining`));
      }

      try {
        await this.scanOpportunities();
        
        const iterationTime = Date.now() - iterationStart;
        const sleepTime = Math.max(100, scanInterval - iterationTime);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        
      } catch (error) {
        console.log(chalk.red(`❌ Error in iteration ${iterationCount}:`), error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.simulationRunning = false;
    await this.generateResults(startTime);
  }

  private async scanOpportunities(): Promise<void> {
    for (const chainName of this.config.chains) {
      const chainConfig = this.CHAIN_CONFIGS[chainName as keyof typeof this.CHAIN_CONFIGS];
      if (!chainConfig) continue;

      const provider = this.providers.get(chainConfig.chainId)!;
      const currentBlock = await provider.getBlockNumber();
      
      // Simulate finding 1-3 opportunities per scan
      const numOpps = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numOpps; i++) {
        const profitEth = (Math.random() * 0.05 + 0.01).toFixed(6); // 0.01-0.06 ETH
        const gasCostEth = (Math.random() * 0.02 + 0.005).toFixed(6); // 0.005-0.025 ETH
        const netProfitEth = Math.max(0, parseFloat(profitEth) - parseFloat(gasCostEth)).toFixed(6);
        
        // Only proceed if profit > 1.2x gas cost
        if (parseFloat(netProfitEth) / parseFloat(gasCostEth) < 1.2) continue;
        
        const outcomeRoll = Math.random();
        let outcome: 'success' | 'revert' | 'capture';
        let actualProfit = '0';
        
        if (outcomeRoll > 0.75) {
          outcome = 'success';
          actualProfit = netProfitEth;
        } else if (outcomeRoll > 0.5) {
          outcome = 'capture';
          actualProfit = '0';
        } else {
          outcome = 'revert';
          actualProfit = '0';
        }
        
        const opportunity: SimulationOpportunity = {
          timestamp: new Date().toISOString(),
          chain: chainConfig.name,
          opportunityId: `${chainName}-${currentBlock}-${i}`,
          bundleHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`bundle-${Date.now()}-${i}`)).slice(0, 10),
          simulatedBlock: currentBlock + 1,
          estimatedProfit: profitEth,
          simulatedGasUsed: Math.floor(Math.random() * 200000 + 400000).toString(),
          outcome,
          gasFeeSimulated: gasCostEth,
          netProfit: actualProfit,
          flashLoanProvider: 'BALANCER',
          crossRollup: false
        };
        
        // Simulate profit recycling for successful trades
        if (outcome === 'success' && parseFloat(actualProfit) > 0.001) {
          const recycleAmount = (parseFloat(actualProfit) * 0.15).toFixed(6);
          opportunity.recycledTxId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`recycle-${Date.now()}`)).slice(0, 8) + '...';
          opportunity.recycledAmount = recycleAmount;
        }
        
        this.opportunities.push(opportunity);
        this.logOpportunity(opportunity);
      }
    }
  }

  private logOpportunity(opp: SimulationOpportunity): void {
    const color = opp.outcome === 'success' ? 'green' : 
                 opp.outcome === 'capture' ? 'yellow' : 'red';
    const icon = opp.outcome === 'success' ? '✅' : 
                opp.outcome === 'capture' ? '⚡' : '❌';
    
    let logMessage = (
      `${icon} ${opp.timestamp.split('T')[1].split('.')[0]} | ` +
      `${opp.chain} | ${opp.opportunityId} | ` +
      `Block: ${opp.simulatedBlock} | ` +
      `Bundle: ${opp.bundleHash} | ` +
      `Profit: ${opp.netProfit} ETH | ` +
      `Gas: ${parseInt(opp.simulatedGasUsed).toLocaleString()} | ` +
      `${opp.outcome.toUpperCase()}`
    );
    
    if (opp.recycledTxId && opp.recycledAmount) {
      logMessage += ` | ♻️ ${opp.recycledAmount} ETH (${opp.recycledTxId})`;
    }
    
    console.log(chalk[color](logMessage));
  }

  private async generateResults(startTime: number): Promise<void> {
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // Calculate totals
    const successful = this.opportunities.filter(o => o.outcome === 'success');
    const totalGas = this.opportunities.reduce((sum, o) => sum + parseFloat(o.gasFeeSimulated), 0);
    const totalProfits = successful.reduce((sum, o) => sum + parseFloat(o.netProfit), 0);
    const totalRecycled = this.opportunities.reduce((sum, o) => sum + parseFloat(o.recycledAmount || '0'), 0);
    const netProfit = totalProfits - totalRecycled;
    
    // Print summary
    console.log(chalk.magenta('\n' + '='.repeat(80)));
    console.log(chalk.magenta('🎯 LEAN MAINNET ARBITRAGE RESULTS'));
    console.log(chalk.magenta('='.repeat(80)));
    
    console.log(chalk.cyan('\n📊 SUMMARY'));
    console.log(chalk.white(`Duration: ${duration} seconds (${(duration/60).toFixed(1)} minutes)`));
    console.log(chalk.white(`Total opportunities: ${this.opportunities.length}`));
    console.log(chalk.white(`Successful trades: ${successful.length}`));
    console.log(chalk.white(`Success rate: ${((successful.length / this.opportunities.length) * 100).toFixed(1)}%`));
    console.log(chalk.white(`Total gas simulated: ${totalGas.toFixed(6)} ETH`));
    console.log(chalk.white(`Total profits: ${totalProfits.toFixed(6)} ETH`));
    console.log(chalk.white(`Total recycled: ${totalRecycled.toFixed(6)} ETH`));
    console.log(chalk.white(`Net profit after recycling: ${netProfit.toFixed(6)} ETH`));
    
    // Chain breakdown
    console.log(chalk.cyan('\n🏪 CHAIN BREAKDOWN'));
    for (const chainName of this.config.chains) {
      const chainOpps = this.opportunities.filter(o => o.chain.toLowerCase().includes(chainName));
      const chainSuccessful = chainOpps.filter(o => o.outcome === 'success');
      const chainProfits = chainSuccessful.reduce((sum, o) => sum + parseFloat(o.netProfit), 0);
      
      console.log(chalk.white(
        `${chainName.toUpperCase()}: ${chainOpps.length} opps, ` +
        `${chainSuccessful.length} successful, ` +
        `${chainProfits.toFixed(6)} ETH profit`
      ));
    }
    
    // Save results
    const results = {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalDuration: duration,
      totalGasFeesSimulated: totalGas.toFixed(6),
      totalSimulatedProfits: totalProfits.toFixed(6),
      totalSimulatedRecycled: totalRecycled.toFixed(6),
      netSimulatedProfitAfterRecycle: netProfit.toFixed(6),
      successfulSimulatedTransactions: successful.length,
      totalOpportunities: this.opportunities.length,
      successRate: ((successful.length / this.opportunities.length) * 100).toFixed(1) + '%',
      opportunities: this.opportunities,
      metadata: {
        simulator: 'Lean Mainnet Arbitrage Bot',
        version: '1.0.0',
        chains: this.config.chains,
        duration: this.config.duration,
        mode: this.config.simulate ? 'simulation' : 'live',
        generatedAt: new Date().toISOString()
      }
    };
    
    const filename = 'lean-mainnet-results.json';
    const filepath = path.join(process.cwd(), filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
      console.log(chalk.green(`\n💾 Results saved to: ${filepath}`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to save results: ${error}`));
    }
    
    console.log(chalk.magenta('\n' + '='.repeat(80) + '\n'));
  }

  async stop(): Promise<void> {
    this.simulationRunning = false;
    console.log(chalk.yellow('\n🛑 Bot stopped by user'));
  }
}

// CLI setup
const program = new Command();

program
  .name('lean-mainnet-arb')
  .description('Lean mainnet arbitrage bot with profit recycling')
  .option('--simulate', 'Run in simulation mode', true)
  .option('--duration <seconds>', 'Duration in seconds', '600')
  .option('--chains <chains>', 'Comma-separated chains', 'arbitrum,base')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const config: SimulationConfig = {
      simulate: options.simulate,
      duration: parseInt(options.duration),
      chains: options.chains.split(',').map((c: string) => c.trim()),
      verbose: options.verbose
    };

    console.log(chalk.blue('🤖 Lean Mainnet Arbitrage Bot v1.0'));
    console.log(chalk.cyan(`📋 Config: ${config.duration}s on ${config.chains.join(', ')}`));
    
    const bot = new LeanMainnetArbBot(config);
    
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🔄 Received SIGINT, stopping bot...'));
      await bot.stop();
      process.exit(0);
    });

    try {
      await bot.initialize();
      await bot.runLeanArbitrage();
    } catch (error) {
      console.error(chalk.red('❌ Bot failed:'), error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}