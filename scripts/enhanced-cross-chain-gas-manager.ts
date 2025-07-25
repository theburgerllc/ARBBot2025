import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  bridgeAddress?: string;
  minGasThreshold: bigint;
  targetGasBalance: bigint;
  maxGasBalance: bigint;
}

interface GasBalanceStatus {
  chain: string;
  address: string;
  balance: bigint;
  status: 'sufficient' | 'low' | 'critical' | 'excess';
  needsFunding: boolean;
  fundingAmount?: bigint;
}

interface BridgeOperation {
  fromChain: string;
  toChain: string;
  amount: bigint;
  estimatedFee: bigint;
  estimatedTime: string;
  success?: boolean;
  txHash?: string;
}

export class EnhancedCrossChainGasManager {
  private mainnetProvider: ethers.JsonRpcProvider;
  private executorWallet: ethers.Wallet;
  private providers: { [chain: string]: ethers.JsonRpcProvider } = {};
  private isRunning: boolean = false;
  
  private readonly CHAIN_CONFIGS: { [key: string]: ChainConfig } = {
    mainnet: {
      name: 'Ethereum Mainnet',
      chainId: 1,
      rpcUrl: process.env.MAINNET_RPC || 'https://eth.llamarpc.com',
      minGasThreshold: ethers.parseEther('0.05'), // 0.05 ETH minimum
      targetGasBalance: ethers.parseEther('0.2'), // 0.2 ETH target
      maxGasBalance: ethers.parseEther('1.0') // 1.0 ETH maximum
    },
    arbitrum: {
      name: 'Arbitrum One',
      chainId: 42161,
      rpcUrl: process.env.ARB_RPC!,
      bridgeAddress: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a', // Arbitrum Inbox
      minGasThreshold: ethers.parseEther('0.01'), // 0.01 ETH minimum
      targetGasBalance: ethers.parseEther('0.05'), // 0.05 ETH target
      maxGasBalance: ethers.parseEther('0.2') // 0.2 ETH maximum
    },
    optimism: {
      name: 'Optimism',
      chainId: 10,
      rpcUrl: process.env.OPT_RPC!,
      bridgeAddress: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // Optimism Portal
      minGasThreshold: ethers.parseEther('0.01'), // 0.01 ETH minimum
      targetGasBalance: ethers.parseEther('0.05'), // 0.05 ETH target
      maxGasBalance: ethers.parseEther('0.2') // 0.2 ETH maximum
    }
  };

  private readonly config = {
    monitoringInterval: 5 * 60 * 1000, // 5 minutes
    bridgeTimeout: 30 * 60 * 1000, // 30 minutes
    maxBridgeAttempts: 3,
    emergencyThreshold: ethers.parseEther('0.005'), // 0.005 ETH emergency threshold
    bridgeFeeBuffer: ethers.parseEther('0.01') // 0.01 ETH buffer for bridge fees
  };

  constructor() {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    // Initialize mainnet provider and wallet
    this.mainnetProvider = new ethers.JsonRpcProvider(this.CHAIN_CONFIGS.mainnet.rpcUrl);
    this.executorWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.mainnetProvider);

    // Initialize providers for all chains
    for (const [chainName, config] of Object.entries(this.CHAIN_CONFIGS)) {
      this.providers[chainName] = new ethers.JsonRpcProvider(config.rpcUrl);
    }
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue('🚀 Enhanced Cross-Chain Gas Manager v2.0'));
    console.log(chalk.cyan(`👤 Executor Wallet: ${this.executorWallet.address}`));
    console.log(chalk.cyan(`⏱️ Monitor Interval: ${this.config.monitoringInterval / 1000 / 60} minutes`));
    
    // Verify wallet address across all chains
    console.log(chalk.yellow('\n🔍 Verifying wallet address across chains...'));
    for (const [chainName, config] of Object.entries(this.CHAIN_CONFIGS)) {
      try {
        const balance = await this.providers[chainName].getBalance(this.executorWallet.address);
        console.log(chalk.green(`✅ ${config.name}: ${ethers.formatEther(balance)} ETH`));
      } catch (error) {
        console.log(chalk.red(`❌ ${config.name}: Connection failed`));
        throw new Error(`Failed to connect to ${config.name}`);
      }
    }

    console.log(chalk.green('\n✅ Enhanced Cross-Chain Gas Manager initialized successfully'));
  }

  async getAllGasBalances(): Promise<GasBalanceStatus[]> {
    const balances: GasBalanceStatus[] = [];

    for (const [chainName, config] of Object.entries(this.CHAIN_CONFIGS)) {
      try {
        const balance = await this.providers[chainName].getBalance(this.executorWallet.address);
        
        let status: GasBalanceStatus['status'] = 'sufficient';
        let needsFunding = false;
        let fundingAmount: bigint | undefined;

        if (balance < config.minGasThreshold) {
          status = balance < this.config.emergencyThreshold ? 'critical' : 'low';
          needsFunding = true;
          fundingAmount = config.targetGasBalance - balance;
        } else if (balance > config.maxGasBalance) {
          status = 'excess';
        }

        balances.push({
          chain: chainName,
          address: this.executorWallet.address,
          balance,
          status,
          needsFunding,
          fundingAmount
        });
      } catch (error) {
        console.error(chalk.red(`❌ Error getting balance for ${config.name}:`, error));
      }
    }

    return balances;
  }

  async executeAutomaticBridging(balances: GasBalanceStatus[]): Promise<BridgeOperation[]> {
    const operations: BridgeOperation[] = [];
    
    // Find chains that need funding
    const chainsNeedingFunding = balances.filter(b => b.needsFunding && b.chain !== 'mainnet');
    
    if (chainsNeedingFunding.length === 0) {
      console.log(chalk.green('✅ All chains have sufficient gas balances'));
      return operations;
    }

    // Check mainnet balance for funding source
    const mainnetBalance = balances.find(b => b.chain === 'mainnet');
    if (!mainnetBalance) {
      console.log(chalk.red('❌ Cannot get mainnet balance'));
      return operations;
    }

    console.log(chalk.yellow(`\n🔄 Found ${chainsNeedingFunding.length} chain(s) needing funding`));

    for (const chainStatus of chainsNeedingFunding) {
      if (chainStatus.fundingAmount && chainStatus.chain !== 'mainnet') {
        const operation = await this.bridgeFromMainnet(
          chainStatus.chain,
          chainStatus.fundingAmount,
          chainStatus.status === 'critical'
        );
        
        if (operation) {
          operations.push(operation);
        }
      }
    }

    return operations;
  }

  private async bridgeFromMainnet(
    targetChain: string,
    amount: bigint,
    emergency: boolean = false
  ): Promise<BridgeOperation | null> {
    const targetConfig = this.CHAIN_CONFIGS[targetChain];
    if (!targetConfig) {
      console.log(chalk.red(`❌ Unknown target chain: ${targetChain}`));
      return null;
    }

    console.log(chalk.blue(`\n🌉 ${emergency ? 'EMERGENCY ' : ''}Bridging to ${targetConfig.name}`));
    console.log(chalk.cyan(`💰 Amount: ${ethers.formatEther(amount)} ETH`));

    try {
      // Check mainnet balance
      const mainnetBalance = await this.mainnetProvider.getBalance(this.executorWallet.address);
      const totalNeeded = amount + this.config.bridgeFeeBuffer;

      if (mainnetBalance < totalNeeded) {
        console.log(chalk.red(`❌ Insufficient mainnet balance. Need: ${ethers.formatEther(totalNeeded)} ETH, Have: ${ethers.formatEther(mainnetBalance)} ETH`));
        return null;
      }

      // Create bridge operation based on target chain
      let bridgeResult: BridgeOperation;

      if (targetChain === 'arbitrum') {
        bridgeResult = await this.bridgeToArbitrum(amount);
      } else if (targetChain === 'optimism') {
        bridgeResult = await this.bridgeToOptimism(amount);
      } else {
        console.log(chalk.red(`❌ Bridging to ${targetChain} not yet implemented`));
        return null;
      }

      if (bridgeResult.success) {
        console.log(chalk.green(`✅ Bridge transaction successful: ${bridgeResult.txHash}`));
        console.log(chalk.cyan(`⏱️ Estimated completion: ${bridgeResult.estimatedTime}`));
        
        // Start monitoring bridge completion
        this.monitorBridgeCompletion(bridgeResult);
      }

      return bridgeResult;

    } catch (error) {
      console.error(chalk.red(`❌ Bridge to ${targetConfig.name} failed:`), error);
      return null;
    }
  }

  private async bridgeToArbitrum(amount: bigint): Promise<BridgeOperation> {
    const operation: BridgeOperation = {
      fromChain: 'mainnet',
      toChain: 'arbitrum',
      amount,
      estimatedFee: ethers.parseEther('0.005'),
      estimatedTime: '10-15 minutes'
    };

    try {
      // Use Arbitrum's official bridge contract
      const arbitrumInbox = this.CHAIN_CONFIGS.arbitrum.bridgeAddress!;
      
      console.log(chalk.blue('📤 Submitting Arbitrum bridge transaction...'));
      
      // Simple ETH deposit to Arbitrum Inbox
      const tx = await this.executorWallet.sendTransaction({
        to: arbitrumInbox,
        value: amount,
        gasLimit: 200000,
        gasPrice: await this.mainnetProvider.getFeeData().then(fee => fee.gasPrice || ethers.parseUnits('20', 'gwei'))
      });

      await tx.wait();
      
      operation.success = true;
      operation.txHash = tx.hash;
      
      return operation;
    } catch (error) {
      console.error(chalk.red('❌ Arbitrum bridge failed:'), error);
      operation.success = false;
      return operation;
    }
  }

  private async bridgeToOptimism(amount: bigint): Promise<BridgeOperation> {
    const operation: BridgeOperation = {
      fromChain: 'mainnet',
      toChain: 'optimism',
      amount,
      estimatedFee: ethers.parseEther('0.005'),
      estimatedTime: '10-15 minutes'
    };

    try {
      // Use Optimism's official bridge contract
      const optimismPortal = this.CHAIN_CONFIGS.optimism.bridgeAddress!;
      
      console.log(chalk.blue('📤 Submitting Optimism bridge transaction...'));
      
      // Create bridge transaction data for Optimism Portal
      const bridgeData = '0x'; // Empty data for simple ETH deposit
      
      const tx = await this.executorWallet.sendTransaction({
        to: optimismPortal,
        value: amount,
        data: bridgeData,
        gasLimit: 150000,
        gasPrice: await this.mainnetProvider.getFeeData().then(fee => fee.gasPrice || ethers.parseUnits('20', 'gwei'))
      });

      await tx.wait();
      
      operation.success = true;
      operation.txHash = tx.hash;
      
      return operation;
    } catch (error) {
      console.error(chalk.red('❌ Optimism bridge failed:'), error);
      operation.success = false;
      return operation;
    }
  }

  private async monitorBridgeCompletion(operation: BridgeOperation): Promise<void> {
    if (!operation.txHash) return;

    console.log(chalk.blue(`\n⏳ Monitoring bridge completion for ${operation.toChain}...`));
    
    const targetProvider = this.providers[operation.toChain];
    const initialBalance = await targetProvider.getBalance(this.executorWallet.address);
    
    const startTime = Date.now();
    const checkInterval = 30000; // 30 seconds
    
    const monitor = async (): Promise<void> => {
      const currentBalance = await targetProvider.getBalance(this.executorWallet.address);
      
      if (currentBalance > initialBalance) {
        const received = currentBalance - initialBalance;
        console.log(chalk.green(`✅ Bridge completed! Received ${ethers.formatEther(received)} ETH on ${operation.toChain}`));
        return;
      }
      
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.bridgeTimeout) {
        console.log(chalk.yellow(`⏰ Bridge monitoring timeout for ${operation.toChain}. Please check manually.`));
        return;
      }
      
      const minutes = Math.floor(elapsed / 60000);
      console.log(chalk.gray(`⏳ Bridge pending... (${minutes} minutes elapsed)`));
      
      setTimeout(monitor, checkInterval);
    };
    
    setTimeout(monitor, checkInterval);
  }

  async startAutomaticMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Automatic monitoring already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.blue('\n🚀 Starting automatic cross-chain gas monitoring...'));
    console.log(chalk.cyan(`⏱️ Check interval: ${this.config.monitoringInterval / 1000 / 60} minutes`));

    const monitoringLoop = async (): Promise<void> => {
      try {
        console.log(chalk.blue('\n📊 Checking gas balances across all chains...'));
        
        const balances = await this.getAllGasBalances();
        this.logGasStatus(balances);
        
        // Execute automatic bridging if needed
        const operations = await this.executeAutomaticBridging(balances);
        
        if (operations.length > 0) {
          console.log(chalk.green(`✅ Executed ${operations.length} bridge operation(s)`));
        }

      } catch (error) {
        console.error(chalk.red('❌ Error in monitoring loop:'), error);
      }

      // Schedule next check
      if (this.isRunning) {
        const nextCheck = new Date(Date.now() + this.config.monitoringInterval);
        console.log(chalk.gray(`⏰ Next check: ${nextCheck.toLocaleTimeString()}`));
        setTimeout(monitoringLoop, this.config.monitoringInterval);
      }
    };

    // Start monitoring
    monitoringLoop();
  }

  private logGasStatus(balances: GasBalanceStatus[]): void {
    console.log(chalk.blue('\n💰 CROSS-CHAIN GAS STATUS'));
    console.log(chalk.blue('═══════════════════════════'));
    
    for (const balance of balances) {
      const config = this.CHAIN_CONFIGS[balance.chain];
      const color = balance.status === 'sufficient' ? chalk.green :
                   balance.status === 'low' ? chalk.yellow :
                   balance.status === 'critical' ? chalk.red : chalk.cyan;
      
      const statusIcon = balance.status === 'sufficient' ? '✅' :
                        balance.status === 'low' ? '⚠️' :
                        balance.status === 'critical' ? '🚨' : '📈';
      
      console.log(color(`${statusIcon} ${config.name}: ${ethers.formatEther(balance.balance)} ETH (${balance.status})`));
      
      if (balance.needsFunding && balance.fundingAmount) {
        console.log(chalk.yellow(`   → Needs ${ethers.formatEther(balance.fundingAmount)} ETH`));
      }
    }
    console.log('');
  }

  async emergencyFundAll(): Promise<void> {
    console.log(chalk.red('\n🚨 EMERGENCY FUNDING ALL CHAINS'));
    
    const balances = await this.getAllGasBalances();
    const operations: BridgeOperation[] = [];
    
    for (const balance of balances) {
      if (balance.chain !== 'mainnet' && balance.balance < this.CHAIN_CONFIGS[balance.chain].targetGasBalance) {
        const fundingAmount = this.CHAIN_CONFIGS[balance.chain].targetGasBalance - balance.balance;
        const operation = await this.bridgeFromMainnet(balance.chain, fundingAmount, true);
        if (operation) {
          operations.push(operation);
        }
      }
    }
    
    console.log(chalk.green(`✅ Emergency funding initiated for ${operations.length} chain(s)`));
  }

  stopMonitoring(): void {
    this.isRunning = false;
    console.log(chalk.yellow('⏹️ Cross-chain gas monitoring stopped'));
  }

  async getStatus(): Promise<void> {
    const balances = await this.getAllGasBalances();
    this.logGasStatus(balances);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new EnhancedCrossChainGasManager();
  
  try {
    await manager.initialize();

    switch (command) {
      case 'start':
        await manager.startAutomaticMonitoring();
        // Keep process alive
        process.on('SIGINT', () => {
          manager.stopMonitoring();
          process.exit(0);
        });
        break;

      case 'status':
        await manager.getStatus();
        break;

      case 'emergency':
        await manager.emergencyFundAll();
        break;

      default:
        console.log(chalk.blue('Enhanced Cross-Chain Gas Manager Commands:'));
        console.log(chalk.cyan('  start     - Start automatic monitoring and bridging'));
        console.log(chalk.cyan('  status    - Show current gas status across all chains'));
        console.log(chalk.cyan('  emergency - Emergency fund all chains to target levels'));
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

export default EnhancedCrossChainGasManager;