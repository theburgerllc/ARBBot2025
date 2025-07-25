import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';
import EnhancedCrossChainGasManager from './enhanced-cross-chain-gas-manager';

dotenv.config();

interface GasFundingConfig {
  enabled: boolean;
  gasFundingWallet: string;
  fundingPercentage: number; // 10 = 10%
  targetGasReserve: bigint; // Target ETH balance for gas wallet
  maxGasReserve: bigint; // Maximum ETH balance before stopping transfers
  monitoringInterval: number; // Minutes between checks
}

interface GasFundingStats {
  wallet: string;
  percentage: number;
  totalTransferred: bigint;
  currentGasBalance: bigint;
  contractProfits: { [token: string]: bigint };
}

export class GasFundingManager {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract!: ethers.Contract; // Initialized in init()
  private config: GasFundingConfig;
  private isRunning: boolean = false;
  private crossChainManager?: EnhancedCrossChainGasManager;

  constructor() {
    if (!process.env.ARB_RPC || !process.env.PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    // Default configuration - Updated for new wallet
    this.config = {
      enabled: true,
      gasFundingWallet: '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac', // New executor wallet
      fundingPercentage: 10, // 10% of profits
      targetGasReserve: ethers.parseEther('0.01'), // 0.01 ETH target
      maxGasReserve: ethers.parseEther('0.05'), // 0.05 ETH maximum
      monitoringInterval: 30 // Check every 30 minutes
    };
  }

  async initialize(contractAddress: string): Promise<void> {
    // Load contract ABI (simplified version for gas funding)
    const contractABI = [
      "function getGasFundingStats() external view returns (address wallet, uint256 percentage, uint256 totalTransferred)",
      "function setGasFundingWallet(address _gasFundingWallet) external",
      "function setGasFundingPercentage(uint256 _percentage) external",
      "function withdraw(address token) external",
      "function balanceOf(address) external view returns (uint256)",
      "event GasFundingTransfer(address indexed token, uint256 amount, address indexed gasFundingWallet)"
    ];

    this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
    
    // Initialize enhanced cross-chain gas manager
    try {
      this.crossChainManager = new EnhancedCrossChainGasManager();
      await this.crossChainManager.initialize();
      console.log(chalk.green('✅ Enhanced cross-chain gas manager integrated'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Cross-chain manager not available:', error));
    }
    
    console.log(chalk.green('🔧 Gas Funding Manager initialized'));
    console.log(chalk.cyan(`📍 Contract: ${contractAddress}`));
    console.log(chalk.cyan(`💰 Gas Wallet: ${this.config.gasFundingWallet}`));
    console.log(chalk.cyan(`📊 Funding: ${this.config.fundingPercentage}%`));
  }

  async setupGasFunding(): Promise<void> {
    try {
      console.log(chalk.yellow('⚙️ Setting up gas funding configuration...'));

      // Set gas funding wallet
      const setWalletTx = await this.contract.setGasFundingWallet(this.config.gasFundingWallet);
      await setWalletTx.wait();
      console.log(chalk.green(`✅ Gas funding wallet set: ${this.config.gasFundingWallet}`));

      // Set funding percentage (convert to basis points: 10% = 1000 bps)
      const percentageBps = this.config.fundingPercentage * 100;
      const setPercentageTx = await this.contract.setGasFundingPercentage(percentageBps);
      await setPercentageTx.wait();
      console.log(chalk.green(`✅ Gas funding percentage set: ${this.config.fundingPercentage}%`));

      console.log(chalk.green('🎯 Gas funding configuration complete!'));
    } catch (error) {
      console.error(chalk.red('❌ Error setting up gas funding:'), error);
      throw error;
    }
  }

  async getGasFundingStats(): Promise<GasFundingStats> {
    try {
      const [wallet, percentage, totalTransferred] = await this.contract.getGasFundingStats();
      const currentGasBalance = await this.provider.getBalance(this.config.gasFundingWallet);

      // Get contract balances for major tokens
      const tokens = {
        WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        USDC: '0xA0b86a33E6441Ee04b3B1dcF3a7F66EF56fF6fC0',
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
      };

      const contractProfits: { [token: string]: bigint } = {};
      
      for (const [symbol, address] of Object.entries(tokens)) {
        try {
          const tokenContract = new ethers.Contract(address, [
            "function balanceOf(address) external view returns (uint256)"
          ], this.provider);
          
          contractProfits[symbol] = await tokenContract.balanceOf(await this.contract.getAddress());
        } catch (error) {
          contractProfits[symbol] = 0n;
        }
      }

      return {
        wallet,
        percentage: Number(percentage) / 100, // Convert from basis points
        totalTransferred: BigInt(totalTransferred),
        currentGasBalance,
        contractProfits
      };
    } catch (error) {
      console.error(chalk.red('❌ Error getting gas funding stats:'), error);
      throw error;
    }
  }

  async monitorGasFunding(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Gas funding monitor already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.blue('🔍 Starting gas funding monitor...'));
    console.log(chalk.cyan(`⏱️ Check interval: ${this.config.monitoringInterval} minutes`));

    const monitoringLoop = async () => {
      try {
        const stats = await this.getGasFundingStats();
        this.logGasFundingStatus(stats);

        // Check if gas balance is too low
        if (stats.currentGasBalance < this.config.targetGasReserve) {
          console.log(chalk.yellow('🔽 Gas balance below target - checking cross-chain funding and manual withdrawal'));
          
          // Try cross-chain funding first
          if (this.crossChainManager) {
            try {
              console.log(chalk.blue('🌉 Triggering cross-chain gas funding...'));
              const allBalances = await this.crossChainManager.getAllGasBalances();
              const operations = await this.crossChainManager.executeAutomaticBridging(allBalances);
              
              if (operations.length > 0) {
                console.log(chalk.green(`✅ Initiated ${operations.length} cross-chain funding operation(s)`));
              } else {
                console.log(chalk.yellow('⚠️ No cross-chain funding needed, checking manual withdrawal'));
                await this.checkManualWithdrawal(stats);
              }
            } catch (error) {
              console.log(chalk.red('❌ Cross-chain funding failed, falling back to manual withdrawal'));
              await this.checkManualWithdrawal(stats);
            }
          } else {
            await this.checkManualWithdrawal(stats);
          }
        }

        // Check if gas balance is too high (pause auto-funding temporarily)
        if (stats.currentGasBalance > this.config.maxGasReserve) {
          console.log(chalk.blue('🔼 Gas balance above maximum - auto-funding is sufficient'));
        }

      } catch (error) {
        console.error(chalk.red('❌ Error in monitoring loop:'), error);
      }

      // Schedule next check
      if (this.isRunning) {
        setTimeout(monitoringLoop, this.config.monitoringInterval * 60 * 1000);
      }
    };

    // Start monitoring
    monitoringLoop();
  }

  private logGasFundingStatus(stats: GasFundingStats): void {
    console.log(chalk.blue('\n📊 GAS FUNDING STATUS'));
    console.log(chalk.blue('═══════════════════════'));
    console.log(chalk.cyan(`💰 Gas Wallet: ${stats.wallet}`));
    console.log(chalk.cyan(`📈 Funding Rate: ${stats.percentage}%`));
    console.log(chalk.cyan(`💎 Total Transferred: ${ethers.formatEther(stats.totalTransferred)} ETH equiv`));
    console.log(chalk.cyan(`⛽ Current Gas Balance: ${ethers.formatEther(stats.currentGasBalance)} ETH`));
    
    const targetStatus = stats.currentGasBalance >= this.config.targetGasReserve ? '✅' : '⚠️';
    console.log(chalk.cyan(`🎯 Target Status: ${targetStatus} (${ethers.formatEther(this.config.targetGasReserve)} ETH target)`));

    console.log(chalk.blue('\n💼 Contract Profit Balances:'));
    for (const [token, balance] of Object.entries(stats.contractProfits)) {
      if (balance > 0n) {
        const formatted = token === 'WETH' 
          ? ethers.formatEther(balance) 
          : ethers.formatUnits(balance, token === 'USDC' ? 6 : 18);
        console.log(chalk.green(`   ${token}: ${formatted}`));
      }
    }
    console.log('');
  }

  private async checkManualWithdrawal(stats: GasFundingStats): Promise<void> {
    // Check if there are significant profits to withdraw manually
    let hasSignificantProfits = false;
    
    for (const [token, balance] of Object.entries(stats.contractProfits)) {
      const threshold = token === 'WETH' 
        ? ethers.parseEther('0.005') // 0.005 ETH threshold
        : token === 'USDC' 
          ? 5000000n // 5 USDC (6 decimals)
          : ethers.parseEther('5'); // 5 tokens default

      if (balance > threshold) {
        hasSignificantProfits = true;
        console.log(chalk.yellow(`💡 Manual withdrawal opportunity: ${token} balance above threshold`));
      }
    }

    if (hasSignificantProfits) {
      console.log(chalk.yellow('🔔 Consider manual profit withdrawal to increase gas funding'));
      console.log(chalk.cyan('   Command: npm run withdraw-profits'));
    }
  }

  async emergencyDisableGasFunding(): Promise<void> {
    try {
      console.log(chalk.red('🚨 Emergency: Disabling gas funding...'));
      
      const disableTx = await this.contract.setGasFundingPercentage(0);
      await disableTx.wait();
      
      console.log(chalk.green('✅ Gas funding disabled successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Error disabling gas funding:'), error);
    }
  }

  async adjustFundingPercentage(newPercentage: number): Promise<void> {
    try {
      console.log(chalk.yellow(`🔧 Adjusting funding percentage to ${newPercentage}%...`));
      
      const percentageBps = newPercentage * 100; // Convert to basis points
      const adjustTx = await this.contract.setGasFundingPercentage(percentageBps);
      await adjustTx.wait();
      
      this.config.fundingPercentage = newPercentage;
      console.log(chalk.green(`✅ Funding percentage updated to ${newPercentage}%`));
    } catch (error) {
      console.error(chalk.red('❌ Error adjusting funding percentage:'), error);
    }
  }

  stopMonitoring(): void {
    this.isRunning = false;
    if (this.crossChainManager) {
      this.crossChainManager.stopMonitoring();
    }
    console.log(chalk.yellow('⏹️ Gas funding monitor stopped'));
  }

  async getCrossChainStatus(): Promise<void> {
    if (this.crossChainManager) {
      await this.crossChainManager.getStatus();
    } else {
      console.log(chalk.yellow('⚠️ Cross-chain manager not available'));
    }
  }

  async emergencyCrossChainFunding(): Promise<void> {
    if (this.crossChainManager) {
      console.log(chalk.red('🚨 Triggering emergency cross-chain funding...'));
      await this.crossChainManager.emergencyFundAll();
    } else {
      console.log(chalk.red('❌ Cross-chain manager not available for emergency funding'));
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new GasFundingManager();
  
  if (!process.env.BOT_CONTRACT_ADDRESS) {
    console.error(chalk.red('❌ BOT_CONTRACT_ADDRESS not set in environment'));
    process.exit(1);
  }

  try {
    await manager.initialize(process.env.BOT_CONTRACT_ADDRESS);

    switch (command) {
      case 'setup':
        await manager.setupGasFunding();
        break;

      case 'monitor':
        await manager.monitorGasFunding();
        // Keep process alive
        process.on('SIGINT', () => {
          manager.stopMonitoring();
          process.exit(0);
        });
        break;

      case 'status':
        const stats = await manager.getGasFundingStats();
        manager['logGasFundingStatus'](stats);
        break;

      case 'adjust':
        const percentage = parseInt(args[1]);
        if (isNaN(percentage) || percentage < 0 || percentage > 50) {
          console.error(chalk.red('❌ Invalid percentage. Must be 0-50'));
          process.exit(1);
        }
        await manager.adjustFundingPercentage(percentage);
        break;

      case 'disable':
        await manager.emergencyDisableGasFunding();
        break;

      case 'cross-chain-status':
        await manager.getCrossChainStatus();
        break;

      case 'emergency-cross-chain':
        await manager.emergencyCrossChainFunding();
        break;

      default:
        console.log(chalk.blue('Gas Funding Manager Commands:'));
        console.log(chalk.cyan('  setup                - Configure gas funding (run once)'));
        console.log(chalk.cyan('  monitor              - Start continuous monitoring'));
        console.log(chalk.cyan('  status               - Show current status'));
        console.log(chalk.cyan('  cross-chain-status   - Show cross-chain gas status'));
        console.log(chalk.cyan('  adjust X             - Set funding percentage to X%'));
        console.log(chalk.cyan('  disable              - Emergency disable gas funding'));
        console.log(chalk.cyan('  emergency-cross-chain - Emergency fund all chains'));
        break;
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default GasFundingManager;