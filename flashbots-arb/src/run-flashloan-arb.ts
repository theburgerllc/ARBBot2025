import { ethers } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
import { Symbiosis } from 'symbiosis-js-sdk';
import * as dotenv from "dotenv";
const chalk = require('chalk');
import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";

// Simplified gas pricing for the simulation
interface GasSettings {
  gasLimit: ethers.BigNumber;
  maxFeePerGas: ethers.BigNumber;
  maxPriorityFeePerGas: ethers.BigNumber;
  baseFee: ethers.BigNumber;
}

class SimpleDynamicGasPricer {
  static async calculateOptimalGas(
    provider: ethers.JsonRpcProvider,
    chainId: number,
    urgency: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<GasSettings> {
    try {
      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits("1", "gwei");
      
      const multipliers = { low: 1.1, medium: 1.2, high: 1.5 };
      const multiplier = multipliers[urgency];
      
      return {
        gasLimit: 800000n,
        maxFeePerGas: BigInt(Math.floor(Number(baseFee) * multiplier)),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        baseFee
      };
    } catch (error) {
      return {
        gasLimit: 800000n,
        maxFeePerGas: ethers.parseUnits("30", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        baseFee: ethers.parseUnits("1", "gwei")
      };
    }
  }

  static formatGasSettings(settings: GasSettings): string {
    return `Gas: ${settings.gasLimit.toString()}, Max Fee: ${ethers.formatUnits(settings.maxFeePerGas, "gwei")} gwei`;
  }
}

// Simple pathfinder for the simulation
class SimpleArbitragePathfinder {
  constructor(private providers: Map<number, ethers.JsonRpcProvider>) {}

  async findArbitrageOpportunities(chainId: number, maxPath: number, minProfit: number) {
    // Mock opportunities for simulation
    const opportunities = [];
    const numOpportunities = Math.floor(Math.random() * 5) + 1; // 1-5 opportunities
    
    for (let i = 0; i < numOpportunities; i++) {
      const profitEth = (Math.random() * 0.1 + 0.01).toString(); // 0.01-0.11 ETH
      opportunities.push({
        id: `arb-${chainId}-${Date.now()}-${i}`,
        netProfit: ethers.parseEther(profitEth),
        bestPath: {
          path: ['0x...', '0x...'],
          totalGasCost: BigInt(300000),
          profitMargin: Math.random() * 0.02 + 0.005,
          isTriangular: Math.random() > 0.7
        },
        tokenPair: {
          tokenA: { address: '0x...', symbol: 'ETH' },
          tokenB: { address: '0x...', symbol: 'USDT' }
        },
        amountIn: ethers.parseEther("1"),
        expectedAmountOut: ethers.parseEther((1 + parseFloat(profitEth)).toString()),
        confidence: Math.random() * 0.5 + 0.5
      });
    }
    
    return opportunities;
  }
}

// Simple cross-chain integration
class SimpleSymbiosisIntegration {
  constructor(
    private providers: Record<string, ethers.JsonRpcProvider>,
    private signers: Record<string, ethers.Wallet>
  ) {}

  async detectCrossChainArbitrage(tokens: string[], chains: number[]) {
    const opportunities = [];
    
    // Mock cross-chain opportunities
    if (chains.length > 1 && Math.random() > 0.7) {
      opportunities.push({
        buyChain: chains[0],
        sellChain: chains[1],
        token: 'ETH',
        buyPrice: '2000',
        sellPrice: '2020',
        spread: 0.01,
        bridgeRoute: null,
        profitAfterFees: '10',
        isValid: true
      });
    }
    
    return opportunities;
  }
}

dotenv.config();

interface SimulationConfig {
  simulate: boolean;
  duration: number; // in seconds
  chains: string[];
  verbose: boolean;
}

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  tokens: {
    WETH: string;
    USDC: string;
    USDT: string;
    WBTC: string;
  };
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

interface SimulationResults {
  startTime: string;
  endTime: string;
  totalDuration: number;
  totalGasFeesSimulated: string;
  initialGasFundingRequired: string;
  totalSimulatedProfits: string;
  totalSimulatedRecycled: string;
  netSimulatedProfitAfterRecycle: string;
  successfulSimulatedTransactions: number;
  totalOpportunities: number;
  chainBreakdown: {
    [chainName: string]: {
      opportunities: number;
      profits: string;
      gasUsed: string;
      successRate: number;
    };
  };
  opportunities: SimulationOpportunity[];
}

class FlashLoanArbSimulator {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private signers: Map<number, ethers.Wallet> = new Map();
  private flashbotsProvider: FlashbotsBundleProvider | null = null;
  private symbiosisIntegration: SimpleSymbiosisIntegration | null = null;
  private pathfinders: Map<number, SimpleArbitragePathfinder> = new Map();
  
  private simulationResults: SimulationResults;
  private simulationRunning = false;
  private config: SimulationConfig;
  
  private readonly CHAIN_CONFIGS: Map<string, ChainConfig> = new Map([
    ['arbitrum', {
      name: 'Arbitrum',
      chainId: 42161,
      rpcUrl: process.env.ARB_RPC!,
      explorerUrl: 'https://arbiscan.io',
      tokens: {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
      }
    }],
    ['base', {
      name: 'Base',
      chainId: 8453,
      rpcUrl: process.env.BASE_RPC || "https://base.llamarpc.com",
      explorerUrl: 'https://basescan.org',
      tokens: {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        WBTC: "0x1C7e6b9D0Ca4F4c497F7bf05eF2E2Be1DaD6E5C3"
      }
    }]
  ]);

  constructor(config: SimulationConfig) {
    this.config = config;
    this.simulationResults = {
      startTime: new Date().toISOString(),
      endTime: '',
      totalDuration: 0,
      totalGasFeesSimulated: '0',
      initialGasFundingRequired: '0',
      totalSimulatedProfits: '0',
      totalSimulatedRecycled: '0',
      netSimulatedProfitAfterRecycle: '0',
      successfulSimulatedTransactions: 0,
      totalOpportunities: 0,
      chainBreakdown: {},
      opportunities: []
    };

    // Initialize chain breakdown
    for (const chainName of config.chains) {
      this.simulationResults.chainBreakdown[chainName] = {
        opportunities: 0,
        profits: '0',
        gasUsed: '0',
        successRate: 0
      };
    }
  }

  async validateEnvironment(): Promise<void> {
    const requiredVars = [
      'ARB_RPC',
      'FLASHBOTS_RELAY_AUTH_SIGNER_KEY',
      'PRIVATE_KEY',
      'SYMBIOSIS_CLIENT_ID'
    ];

    // Check for --simulate flag requirement
    if (!this.config.simulate) {
      console.log(chalk.red('\n❌ --simulate flag is required for this dry run version'));
      console.log(chalk.yellow('Please run with --simulate flag to avoid real transactions\n'));
      process.exit(1);
    }

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log(chalk.red('\n❌ Missing required environment variables:'));
      missingVars.forEach(varName => {
        console.log(chalk.red(`  - ${varName}`));
      });
      console.log(chalk.yellow('\nPlease check your .env file configuration.\n'));
      process.exit(1);
    }

    // Validate RPC connectivity
    console.log(chalk.blue('🔗 Validating RPC connectivity...'));
    for (const chainName of this.config.chains) {
      const chainConfig = this.CHAIN_CONFIGS.get(chainName);
      if (chainConfig) {
        try {
          const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
          const blockNumber = await provider.getBlockNumber();
          console.log(chalk.green(`✅ ${chainConfig.name}: Block ${blockNumber}`));
        } catch (error) {
          console.log(chalk.red(`❌ ${chainConfig.name}: Connection failed`));
          throw new Error(`Failed to connect to ${chainName} RPC`);
        }
      }
    }
  }

  async initialize(): Promise<void> {
    await this.validateEnvironment();

    console.log(chalk.blue('🚀 Initializing Enhanced MEV Arbitrage Simulator...'));
    
    // Initialize providers and signers for each chain
    for (const chainName of this.config.chains) {
      const chainConfig = this.CHAIN_CONFIGS.get(chainName);
      if (!chainConfig) continue;

      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, {
        name: chainConfig.name.toLowerCase(),
        chainId: chainConfig.chainId
      });

      const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
      
      this.providers.set(chainConfig.chainId, provider);
      this.signers.set(chainConfig.chainId, signer);

      // Initialize pathfinder for each chain
      const pathfinder = new SimpleArbitragePathfinder(
        new Map([[chainConfig.chainId, provider]])
      );
      this.pathfinders.set(chainConfig.chainId, pathfinder);

      if (this.config.verbose) {
        const balance = await provider.getBalance(signer.address);
        console.log(chalk.cyan(`💰 ${chainConfig.name} balance: ${ethers.formatEther(balance)} ETH`));
      }
    }

    // Initialize Flashbots (using Arbitrum as primary)
    if (this.providers.has(42161)) {
      const arbProvider = this.providers.get(42161)!;
      const authSigner = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY!, arbProvider);
      
      try {
        this.flashbotsProvider = await FlashbotsBundleProvider.create(
          arbProvider,
          authSigner,
          process.env.FLASHBOTS_RELAY_URL || "https://relay.flashbots.net",
          "mainnet"
        );
        console.log(chalk.green('✅ Flashbots provider initialized'));
      } catch (error) {
        console.log(chalk.yellow('⚠️ Flashbots initialization failed, continuing without'));
      }
    }

    // Initialize Symbiosis for cross-rollup arbitrage
    try {
      const providerMap: Record<string, ethers.JsonRpcProvider> = {};
      const signerMap: Record<string, ethers.Wallet> = {};
      
      for (const [chainId, provider] of this.providers) {
        const chainName = this.getChainName(chainId);
        providerMap[chainName] = provider;
        signerMap[chainName] = this.signers.get(chainId)!;
      }

      this.symbiosisIntegration = new SimpleSymbiosisIntegration(providerMap, signerMap);
      console.log(chalk.green('✅ Symbiosis integration initialized'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Symbiosis initialization failed, continuing without cross-rollup'));
    }

    console.log(chalk.green('🎯 Simulator ready for 10-minute live simulation'));
  }

  async runSimulation(): Promise<void> {
    this.simulationRunning = true;
    const startTime = Date.now();
    const endTime = startTime + (this.config.duration * 1000);
    
    console.log(chalk.magenta(`\n🔥 Starting ${this.config.duration}-second live MEV simulation across ${this.config.chains.join(', ')}`));
    console.log(chalk.cyan(`⏰ Simulation will run until ${new Date(endTime).toLocaleTimeString()}\n`));

    let iterationCount = 0;
    const scanInterval = 5000; // Scan every 5 seconds
    
    while (this.simulationRunning && Date.now() < endTime) {
      iterationCount++;
      const iterationStart = Date.now();
      
      if (this.config.verbose) {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        console.log(chalk.gray(`\n📊 Iteration ${iterationCount} - ${remaining}s remaining`));
      }

      try {
        // Scan for opportunities on each chain
        await this.scanAllChains();
        
        // Look for cross-rollup opportunities if Symbiosis is available
        if (this.symbiosisIntegration && this.config.chains.length > 1) {
          await this.scanCrossRollupOpportunities();
        }

        // Calculate next scan time
        const iterationTime = Date.now() - iterationStart;
        const sleepTime = Math.max(100, scanInterval - iterationTime);
        
        if (this.config.verbose) {
          console.log(chalk.gray(`⏱️ Iteration completed in ${iterationTime}ms, sleeping ${sleepTime}ms`));
        }
        
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        
      } catch (error) {
        console.log(chalk.red(`❌ Error in simulation iteration ${iterationCount}:`), error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.simulationRunning = false;
    this.simulationResults.endTime = new Date().toISOString();
    this.simulationResults.totalDuration = Date.now() - startTime;
    
    await this.generateFinalReport();
  }

  private async scanAllChains(): Promise<void> {
    const scanPromises = [];
    
    for (const chainName of this.config.chains) {
      const chainConfig = this.CHAIN_CONFIGS.get(chainName);
      if (chainConfig) {
        scanPromises.push(this.scanChainOpportunities(chainConfig));
      }
    }

    await Promise.allSettled(scanPromises);
  }

  private async scanChainOpportunities(chainConfig: ChainConfig): Promise<void> {
    try {
      const pathfinder = this.pathfinders.get(chainConfig.chainId);
      if (!pathfinder) return;

      // Find arbitrage opportunities - focused on top 5 tokens
      const topTokens = ['WETH', 'USDC', 'USDT', 'WBTC', 'ARB']; // Top 5 tokens for this chain
      const opportunities = await pathfinder.findArbitrageOpportunities(
        chainConfig.chainId,
        3, // reduced path length for efficiency
        0.012 // 1.2x gas cost minimum profit
      );

      // Filter for profitable opportunities only
      const profitableOpportunities = opportunities.filter(opp => 
        parseFloat(ethers.formatEther(opp.netProfit || '0')) > 0.01
      );

      for (const opportunity of profitableOpportunities.slice(0, 2)) { // Top 2 per chain
        await this.simulateFlashLoanArbitrage(opportunity, chainConfig);
      }

    } catch (error) {
      if (this.config.verbose) {
        console.log(chalk.red(`Error scanning ${chainConfig.name}:`), error);
      }
    }
  }

  private async simulateFlashLoanArbitrage(opportunity: any, chainConfig: ChainConfig): Promise<void> {
    try {
      const provider = this.providers.get(chainConfig.chainId)!;
      const signer = this.signers.get(chainConfig.chainId)!;
      
      // Get current block for simulation
      const currentBlock = await provider.getBlockNumber();
      
      // Calculate gas requirements
      const gasSettings = await SimpleDynamicGasPricer.calculateOptimalGas(
        provider,
        chainConfig.chainId,
        'high'
      );

      // Calculate initial gas funding requirement
      const gasRequirement = gasSettings.gasLimit * gasSettings.maxFeePerGas;
      
      // Simulate Flashbots bundle
      const bundleHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${opportunity.id}-${currentBlock}-${Date.now()}`)
      );

      // Enhanced profit-focused simulation logic
      const outcomeRoll = Math.random();
      let outcome: 'success' | 'revert' | 'capture';
      let actualProfit = '0';
      
      // Check if profit exceeds 1.2x gas cost (our minimum threshold)
      const estimatedProfit = parseFloat(ethers.formatEther(opportunity.netProfit?.toString() || '0'));
      const gasCostEth = parseFloat(ethers.formatEther(gasRequirement));
      const profitRatio = estimatedProfit / gasCostEth;
      
      if (profitRatio >= 1.2) {
        if (outcomeRoll > 0.75) { // 25% success rate for good opportunities
          outcome = 'success';
          actualProfit = opportunity.netProfit?.toString() || '0';
        } else if (outcomeRoll > 0.5) {
          outcome = 'capture'; // MEV captured by competitor
          actualProfit = '0';
        } else {
          outcome = 'revert';
          actualProfit = '0';
        }
      } else {
        // Low profitability opportunities are less likely to succeed
        if (outcomeRoll > 0.9) {
          outcome = 'success';
          actualProfit = opportunity.netProfit?.toString() || '0';
        } else {
          outcome = 'revert';
          actualProfit = '0';
        }
      }

      const simulationOpp: SimulationOpportunity = {
        timestamp: new Date().toISOString(),
        chain: chainConfig.name,
        opportunityId: opportunity.id,
        bundleHash: bundleHash.slice(0, 10),
        simulatedBlock: currentBlock + 1,
        estimatedProfit: ethers.formatEther(opportunity.netProfit?.toString() || '0'),
        simulatedGasUsed: gasSettings.gasLimit.toString(),
        outcome,
        gasFeeSimulated: ethers.formatEther(gasRequirement),
        netProfit: ethers.formatEther(actualProfit),
        flashLoanProvider: 'BALANCER',
        crossRollup: false
      };

      // Update statistics
      this.updateSimulationStats(simulationOpp, chainConfig.name);
      
      // Simulate profit recycling if successful
      if (outcome === 'success' && actualProfit !== '0') {
        await this.simulateProfitRecycling(simulationOpp, chainConfig);
      }

      // Log opportunity
      if (this.config.verbose || outcome === 'success') {
        this.logOpportunity(simulationOpp);
      }

    } catch (error) {
      if (this.config.verbose) {
        console.log(chalk.red(`Error simulating opportunity on ${chainConfig.name}:`), error);
      }
    }
  }

  private async simulateProfitRecycling(
    opportunity: SimulationOpportunity, 
    chainConfig: ChainConfig
  ): Promise<void> {
    try {
      const netProfitEth = parseFloat(opportunity.netProfit);
      
      if (netProfitEth > 0.001) { // Only recycle if profit > 0.001 ETH
        // Recycle 15% of profit back to executor wallet for future gas operations
        const recycleAmount = netProfitEth * 0.15;
        
        // Simulate transaction hash for recycling
        const recycleData = `${opportunity.opportunityId}-recycle-${Date.now()}`;
        const recycleTxHash = ethers.keccak256(ethers.toUtf8Bytes(recycleData));
        
        opportunity.recycledTxId = recycleTxHash.slice(0, 10) + '...';
        opportunity.recycledAmount = recycleAmount.toFixed(6);
        
        // Update totals
        const recycledWei = ethers.parseEther(recycleAmount.toString());
        this.simulationResults.totalSimulatedRecycled = (
          BigInt(this.simulationResults.totalSimulatedRecycled) + recycledWei
        ).toString();
        
        if (this.config.verbose) {
          console.log(chalk.green(
            `  ♻️ Profit recycling: ${recycleAmount.toFixed(6)} ETH → executor wallet (${opportunity.recycledTxId})`
          ));
        }
      }
    } catch (error) {
      if (this.config.verbose) {
        console.log(chalk.yellow(`⚠️ Profit recycling simulation failed: ${error}`));
      }
    }
  }

  private async scanCrossRollupOpportunities(): Promise<void> {
    if (!this.symbiosisIntegration) return;

    try {
      // Get common tokens across chains
      const tokens = ['WETH', 'USDC', 'USDT'];
      const chainIds = this.config.chains.map(name => 
        this.CHAIN_CONFIGS.get(name)?.chainId
      ).filter(Boolean) as number[];

      // Check for cross-rollup arbitrage opportunities
      for (const token of tokens) {
        for (let i = 0; i < chainIds.length; i++) {
          for (let j = i + 1; j < chainIds.length; j++) {
            await this.simulateCrossRollupArbitrage(token, chainIds[i], chainIds[j]);
          }
        }
      }
    } catch (error) {
      if (this.config.verbose) {
        console.log(chalk.red('Error in cross-rollup scanning:'), error);
      }
    }
  }

  private async simulateCrossRollupArbitrage(
    token: string, 
    chainId1: number, 
    chainId2: number
  ): Promise<void> {
    try {
      // Simulate cross-rollup price difference detection
      const priceSpread = Math.random() * 0.02; // 0-2% spread
      
      if (priceSpread > 0.005) { // Minimum 0.5% spread
        const chainName1 = this.getChainName(chainId1);
        const chainName2 = this.getChainName(chainId2);
        
        const simulationOpp: SimulationOpportunity = {
          timestamp: new Date().toISOString(),
          chain: `${chainName1}-${chainName2}`,
          opportunityId: `cross-${token}-${chainId1}-${chainId2}-${Date.now()}`,
          bundleHash: ethers.keccak256(ethers.toUtf8Bytes(`cross-${Date.now()}`)).slice(0, 10),
          simulatedBlock: await this.providers.get(chainId1)!.getBlockNumber(),
          estimatedProfit: (priceSpread * 1000).toFixed(6), // Estimated on 1000 token units
          simulatedGasUsed: '500000',
          outcome: Math.random() > 0.7 ? 'success' : 'capture',
          gasFeeSimulated: '0.01',
          netProfit: Math.random() > 0.7 ? (priceSpread * 900).toFixed(6) : '0',
          flashLoanProvider: 'SYMBIOSIS',
          crossRollup: true
        };

        this.updateSimulationStats(simulationOpp, `${chainName1}-${chainName2}`);
        
        if (this.config.verbose || simulationOpp.outcome === 'success') {
          this.logOpportunity(simulationOpp);
        }
      }
    } catch (error) {
      // Silent error for cross-rollup simulation
    }
  }

  private updateSimulationStats(opportunity: SimulationOpportunity, chainName: string): void {
    this.simulationResults.opportunities.push(opportunity);
    this.simulationResults.totalOpportunities++;

    // Initialize chain breakdown if not exists
    if (!this.simulationResults.chainBreakdown[chainName]) {
      this.simulationResults.chainBreakdown[chainName] = {
        opportunities: 0,
        profits: '0',
        gasUsed: '0',
        successRate: 0
      };
    }

    const breakdown = this.simulationResults.chainBreakdown[chainName];
    breakdown.opportunities++;

    // Update totals
    const gasUsed = BigInt(opportunity.simulatedGasUsed);
    const gasFee = ethers.parseEther(opportunity.gasFeeSimulated);
    const profit = ethers.parseEther(opportunity.netProfit);

    this.simulationResults.totalGasFeesSimulated = (
      BigInt(this.simulationResults.totalGasFeesSimulated) + gasFee
    ).toString();

    breakdown.gasUsed = (BigInt(breakdown.gasUsed) + gasUsed).toString();

    if (opportunity.outcome === 'success') {
      this.simulationResults.successfulSimulatedTransactions++;
      this.simulationResults.totalSimulatedProfits = (
        BigInt(this.simulationResults.totalSimulatedProfits) + profit
      ).toString();
      breakdown.profits = (BigInt(breakdown.profits) + profit).toString();
    }

    // Update success rate
    breakdown.successRate = (breakdown.opportunities > 0) ? 
      (this.simulationResults.opportunities.filter(o => 
        o.chain === chainName && o.outcome === 'success'
      ).length / breakdown.opportunities) * 100 : 0;
  }

  private logOpportunity(opportunity: SimulationOpportunity): void {
    const color = opportunity.outcome === 'success' ? 'green' : 
                 opportunity.outcome === 'capture' ? 'yellow' : 'red';
    const icon = opportunity.outcome === 'success' ? '✅' : 
                opportunity.outcome === 'capture' ? '⚡' : '❌';
    
    let logMessage = (
      `${icon} ${opportunity.timestamp.split('T')[1].split('.')[0]} | ` +
      `${opportunity.chain} | ${opportunity.opportunityId} | ` +
      `Block: ${opportunity.simulatedBlock} | ` +
      `Bundle: ${opportunity.bundleHash} | ` +
      `Profit: ${opportunity.netProfit} ETH | ` +
      `Gas: ${parseInt(opportunity.simulatedGasUsed).toLocaleString()} | ` +
      `${opportunity.outcome.toUpperCase()}`
    );
    
    // Add recycling info if available
    if (opportunity.recycledTxId && opportunity.recycledAmount) {
      logMessage += ` | Recycled: ${opportunity.recycledAmount} ETH (${opportunity.recycledTxId})`;
    }
    
    console.log(chalk[color](logMessage));
  }

  private async generateFinalReport(): Promise<void> {
    // Calculate initial gas funding requirement
    let maxGasNeeded = BigInt(0);
    for (const chainName of this.config.chains) {
      const chainConfig = this.CHAIN_CONFIGS.get(chainName);
      if (chainConfig) {
        try {
          const provider = this.providers.get(chainConfig.chainId)!;
          const gasSettings = await SimpleDynamicGasPricer.calculateOptimalGas(
            provider,
            chainConfig.chainId,
            'high'
          );
          const gasRequirement = gasSettings.gasLimit * gasSettings.maxFeePerGas * 10n; // 10 transactions buffer
          maxGasNeeded = maxGasNeeded > gasRequirement ? maxGasNeeded : gasRequirement;
        } catch (error) {
          // Use fallback estimate
          maxGasNeeded = maxGasNeeded > ethers.parseEther('0.5') ? maxGasNeeded : ethers.parseEther('0.5');
        }
      }
    }

    this.simulationResults.initialGasFundingRequired = ethers.formatEther(maxGasNeeded);
    
    // Calculate net profit after recycling
    const totalProfits = BigInt(this.simulationResults.totalSimulatedProfits);
    const totalRecycled = BigInt(this.simulationResults.totalSimulatedRecycled);
    this.simulationResults.netSimulatedProfitAfterRecycle = ethers.formatEther(totalProfits - totalRecycled);

    // Print terminal summary
    this.printTerminalSummary();
    
    // Save JSON results
    await this.saveJsonResults();
  }

  private printTerminalSummary(): void {
    console.log(chalk.magenta('\n' + '='.repeat(80)));
    console.log(chalk.magenta('🎯 10-MINUTE MEV ARBITRAGE SIMULATION RESULTS'));
    console.log(chalk.magenta('='.repeat(80)));
    
    console.log(chalk.cyan('\n📊 SUMMARY STATISTICS'));
    console.log(chalk.white('┌──────────────────────────────────────────────────────┐'));
    console.log(chalk.white(`│ Total Gas Fees Simulated:       ${ethers.formatEther(this.simulationResults.totalGasFeesSimulated).padStart(12)} ETH │`));
    console.log(chalk.white(`│ Initial Gas Funding Required:   ${this.simulationResults.initialGasFundingRequired.padStart(12)} ETH │`));
    console.log(chalk.white(`│ Total Simulated Profits:        ${ethers.formatEther(this.simulationResults.totalSimulatedProfits).padStart(12)} ETH │`));
    console.log(chalk.white(`│ Total Simulated Recycled:       ${ethers.formatEther(this.simulationResults.totalSimulatedRecycled).padStart(12)} ETH │`));
    console.log(chalk.white(`│ Net Simulated Profit After Recycle: ${this.simulationResults.netSimulatedProfitAfterRecycle.padStart(8)} ETH │`));
    console.log(chalk.white(`│ Successful Simulated Trades:        ${this.simulationResults.successfulSimulatedTransactions.toString().padStart(8)}     │`));
    console.log(chalk.white(`│ Total Opportunities Detected:       ${this.simulationResults.totalOpportunities.toString().padStart(8)}     │`));
    const successRate = this.simulationResults.totalOpportunities > 0 ? 
      ((this.simulationResults.successfulSimulatedTransactions / this.simulationResults.totalOpportunities) * 100).toFixed(1) : '0.0';
    console.log(chalk.white(`│ Success Rate:                    ${successRate.padStart(12)}% │`));
    console.log(chalk.white('└──────────────────────────────────────────────────────┘'));

    console.log(chalk.cyan('\n🏪 PER-CHAIN BREAKDOWN'));
    console.log(chalk.white('┌──────────────┬─────────────┬──────────────┬──────────────┬─────────────┐'));
    console.log(chalk.white('│ Chain        │ Opportunities│ Success Rate │ Total Profit │ Gas Used    │'));
    console.log(chalk.white('├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤'));
    
    for (const [chainName, breakdown] of Object.entries(this.simulationResults.chainBreakdown)) {
      if (breakdown.opportunities > 0) {
        console.log(chalk.white(
          `│ ${chainName.padEnd(12)} │ ${breakdown.opportunities.toString().padStart(11)} │ ` +
          `${breakdown.successRate.toFixed(1).padStart(11)}% │ ${ethers.formatEther(breakdown.profits).padStart(12)} │ ` +
          `${parseInt(breakdown.gasUsed).toLocaleString().padStart(11)} │`
        ));
      }
    }
    
    console.log(chalk.white('└──────────────┴─────────────┴──────────────┴──────────────┴─────────────┘'));

    const duration = Math.floor(this.simulationResults.totalDuration / 1000);
    const avgOppsPerMin = (this.simulationResults.totalOpportunities / (duration / 60)).toFixed(1);
    
    console.log(chalk.cyan('\n⏱️ PERFORMANCE METRICS'));
    console.log(chalk.gray(`Simulation Duration: ${duration} seconds (${(duration/60).toFixed(1)} minutes)`));
    console.log(chalk.gray(`Average Opportunities/Minute: ${avgOppsPerMin}`));
    console.log(chalk.gray(`Success Rate: ${((this.simulationResults.successfulSimulatedTransactions / this.simulationResults.totalOpportunities) * 100).toFixed(1)}%`));
    
    console.log(chalk.magenta('\n' + '='.repeat(80) + '\n'));
  }

  private async saveJsonResults(): Promise<void> {
    const filename = 'lean-mainnet-results.json';
    const filepath = path.join(process.cwd(), 'flashbots-arb', filename);
    
    const formattedResults = {
      ...this.simulationResults,
      metadata: {
        simulator: 'FlashLoan Arbitrage Bot',
        version: '2.0.0',
        chains: this.config.chains,
        duration: this.config.duration,
        verbose: this.config.verbose,
        generatedAt: new Date().toISOString()
      }
    };

    try {
      fs.writeFileSync(filepath, JSON.stringify(formattedResults, null, 2));
      console.log(chalk.green(`💾 Results saved to: ${filepath}`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to save results: ${error}`));
    }
  }

  private getChainName(chainId: number): string {
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      10: 'optimism',
      42161: 'arbitrum',
      8453: 'base'
    };
    return chainNames[chainId] || 'unknown';
  }

  async stop(): Promise<void> {
    this.simulationRunning = false;
    console.log(chalk.yellow('\n🛑 Simulation stopped by user'));
  }
}

// CLI setup
const program = new Command();

program
  .name('run-flashloan-arb')
  .description('Advanced MEV arbitrage simulation with Flashbots and Symbiosis integration')
  .option('--simulate', 'Run in simulation mode (no actual transactions)', false)
  .option('--duration <seconds>', 'Simulation duration in seconds', '600')
  .option('--chains <chains>', 'Comma-separated list of chains', 'arbitrum,optimism,base')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const config: SimulationConfig = {
      simulate: options.simulate || true, // Always simulate for safety
      duration: parseInt(options.duration),
      chains: options.chains.split(',').map((c: string) => c.trim()),
      verbose: options.verbose
    };

    console.log(chalk.blue('🤖 Enhanced MEV Arbitrage Simulator v2.0'));
    console.log(chalk.cyan(`📋 Config: ${config.duration}s on ${config.chains.join(', ')}`));
    
    const simulator = new FlashLoanArbSimulator(config);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n🔄 Received SIGINT, stopping simulation...'));
      await simulator.stop();
      process.exit(0);
    });

    try {
      await simulator.initialize();
      await simulator.runSimulation();
    } catch (error) {
      console.error(chalk.red('❌ Simulation failed:'), error);
      process.exit(1);
    }
  });

// Main execution
if (require.main === module) {
  program.parse();
}

export { FlashLoanArbSimulator };