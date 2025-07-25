import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

interface WithdrawalConfig {
  enabled: boolean;
  thresholds: {
    WETH: bigint;
    USDC: bigint;
    USDT: bigint;
    ARB: bigint;
  };
  emergencyThresholds: {
    WETH: bigint;
    USDC: bigint;
    USDT: bigint;
    ARB: bigint;
  };
  autoWithdrawInterval: number; // Hours between automatic withdrawals
  maxGasPrice: bigint; // Maximum gas price for withdrawal transactions
}

export class ProfitWithdrawalAutomation {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract!: ethers.Contract; // Initialized in init()
  private config: WithdrawalConfig;
  private isRunning: boolean = false;

  // Major token addresses on Arbitrum
  private readonly tokens = {
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xA0b86a33E6441Ee04b3B1dcF3a7F66EF56fF6fC0', // USDC.e  
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548'
  };

  constructor() {
    if (!process.env.ARB_RPC || !process.env.PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    // Default withdrawal configuration
    this.config = {
      enabled: true,
      thresholds: {
        WETH: ethers.parseEther('0.01'),    // 0.01 ETH
        USDC: 10000000n,                    // 10 USDC (6 decimals)
        USDT: ethers.parseEther('10'),      // 10 USDT
        ARB: ethers.parseEther('100')       // 100 ARB
      },
      emergencyThresholds: {
        WETH: ethers.parseEther('0.1'),     // 0.1 ETH
        USDC: 100000000n,                   // 100 USDC
        USDT: ethers.parseEther('100'),     // 100 USDT  
        ARB: ethers.parseEther('1000')      // 1000 ARB
      },
      autoWithdrawInterval: 6, // Every 6 hours
      maxGasPrice: ethers.parseUnits('0.1', 'gwei') // 0.1 gwei max
    };
  }

  async initialize(contractAddress: string): Promise<void> {
    // Contract ABI for withdrawal functions
    const contractABI = [
      "function withdraw(address token) external",
      "function emergencyWithdraw(address token) external",
      "function owner() external view returns (address)",
      "function profitWallet() external view returns (address)",
      "function setProfitWallet(address) external",
      "function balanceOf(address) external view returns (uint256)"
    ];

    this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
    
    // Verify we're the owner
    const owner = await this.contract.owner();
    if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
      throw new Error(`Not contract owner. Owner: ${owner}, Wallet: ${this.wallet.address}`);
    }

    // Get current profit wallet
    let profitWallet;
    try {
      profitWallet = await this.contract.profitWallet();
    } catch (error) {
      profitWallet = owner; // Fallback for older contracts
    }

    // Set profit wallet from environment if configured
    if (process.env.PROFIT_WALLET_ADDRESS && 
        profitWallet.toLowerCase() !== process.env.PROFIT_WALLET_ADDRESS.toLowerCase()) {
      console.log(chalk.yellow(`🔄 Updating profit wallet to: ${process.env.PROFIT_WALLET_ADDRESS}`));
      const tx = await this.contract.setProfitWallet(process.env.PROFIT_WALLET_ADDRESS);
      await tx.wait();
      profitWallet = process.env.PROFIT_WALLET_ADDRESS;
      console.log(chalk.green('✅ Profit wallet updated successfully'));
    }

    console.log(chalk.green('💰 Profit Withdrawal Automation initialized'));
    console.log(chalk.cyan(`📍 Contract: ${contractAddress}`));
    console.log(chalk.cyan(`👤 Owner: ${this.wallet.address}`));
    console.log(chalk.cyan(`💼 Profit Wallet: ${profitWallet}`));
    console.log(chalk.cyan(`⏰ Auto-withdraw: Every ${this.config.autoWithdrawInterval} hours`));
  }

  async checkProfitBalances(): Promise<{ [token: string]: bigint }> {
    const balances: { [token: string]: bigint } = {};

    for (const [symbol, address] of Object.entries(this.tokens)) {
      try {
        const tokenContract = new ethers.Contract(address, [
          "function balanceOf(address) external view returns (uint256)"
        ], this.provider);
        
        const contractAddress = await this.contract.getAddress();
        balances[symbol] = await tokenContract.balanceOf(contractAddress);
      } catch (error) {
        console.error(chalk.yellow(`⚠️ Error checking ${symbol} balance:`, error));
        balances[symbol] = 0n;
      }
    }

    return balances;
  }

  async withdrawProfit(tokenSymbol: string, emergency: boolean = false): Promise<boolean> {
    try {
      const tokenAddress = this.tokens[tokenSymbol as keyof typeof this.tokens];
      if (!tokenAddress) {
        throw new Error(`Unknown token: ${tokenSymbol}`);
      }

      // Check current gas price
      const gasPrice = await this.provider.getFeeData();
      if (gasPrice.gasPrice && gasPrice.gasPrice > this.config.maxGasPrice) {
        console.log(chalk.yellow(`⛽ Gas price too high: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`));
        return false;
      }

      console.log(chalk.blue(`💸 Withdrawing ${tokenSymbol} profits...`));

      const withdrawTx = emergency 
        ? await this.contract.emergencyWithdraw(tokenAddress)
        : await this.contract.withdraw(tokenAddress);

      const receipt = await withdrawTx.wait();
      
      console.log(chalk.green(`✅ ${tokenSymbol} withdrawal successful`));
      console.log(chalk.cyan(`📄 Transaction: ${receipt.hash}`));
      console.log(chalk.cyan(`⛽ Gas used: ${receipt.gasUsed.toString()}`));

      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error withdrawing ${tokenSymbol}:`), error);
      return false;
    }
  }

  async performAutomaticWithdrawals(): Promise<void> {
    console.log(chalk.blue('🔄 Checking for automatic withdrawals...'));

    const balances = await this.checkProfitBalances();
    const thresholds = this.config.thresholds;
    const emergencyThresholds = this.config.emergencyThresholds;

    let withdrawalsPerformed = 0;

    for (const [token, balance] of Object.entries(balances)) {
      if (balance > 0n) {
        const threshold = thresholds[token as keyof typeof thresholds];
        const emergencyThreshold = emergencyThresholds[token as keyof typeof emergencyThresholds];
        
        // Format balance for display
        const decimals = token === 'USDC' ? 6 : 18;
        const formattedBalance = ethers.formatUnits(balance, decimals);
        const formattedThreshold = ethers.formatUnits(threshold, decimals);
        const formattedEmergency = ethers.formatUnits(emergencyThreshold, decimals);

        console.log(chalk.cyan(`📊 ${token}: ${formattedBalance} (threshold: ${formattedThreshold})`));

        // Check for emergency withdrawal (priority)
        if (balance >= emergencyThreshold) {
          console.log(chalk.red(`🚨 ${token} balance exceeds emergency threshold (${formattedEmergency})!`));
          
          const success = await this.withdrawProfit(token, true);
          if (success) {
            withdrawalsPerformed++;
          }
        }
        // Check for regular withdrawal
        else if (balance >= threshold) {
          console.log(chalk.yellow(`💡 ${token} balance exceeds threshold - withdrawing...`));
          
          const success = await this.withdrawProfit(token, false);
          if (success) {
            withdrawalsPerformed++;
          }
        }
      }
    }

    if (withdrawalsPerformed === 0) {
      console.log(chalk.green('✨ No withdrawals needed - all balances below thresholds'));
    } else {
      console.log(chalk.green(`✅ Performed ${withdrawalsPerformed} automatic withdrawals`));
    }
  }

  async startAutomaticWithdrawals(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Automatic withdrawals already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.blue('🚀 Starting automatic profit withdrawals...'));
    console.log(chalk.cyan(`⏰ Interval: ${this.config.autoWithdrawInterval} hours`));

    const withdrawalLoop = async () => {
      try {
        await this.performAutomaticWithdrawals();
      } catch (error) {
        console.error(chalk.red('❌ Error in withdrawal loop:'), error);
      }

      // Schedule next withdrawal check
      if (this.isRunning) {
        const nextCheck = new Date(Date.now() + this.config.autoWithdrawInterval * 60 * 60 * 1000);
        console.log(chalk.cyan(`⏰ Next withdrawal check: ${nextCheck.toLocaleString()}`));
        
        setTimeout(withdrawalLoop, this.config.autoWithdrawInterval * 60 * 60 * 1000);
      }
    };

    // Start the withdrawal loop
    withdrawalLoop();
  }

  async withdrawAllProfits(emergency: boolean = false): Promise<void> {
    console.log(chalk.blue(`💸 Withdrawing all profits${emergency ? ' (EMERGENCY)' : ''}...`));

    const balances = await this.checkProfitBalances();
    let totalWithdrawals = 0;

    for (const [token, balance] of Object.entries(balances)) {
      if (balance > 0n) {
        const success = await this.withdrawProfit(token, emergency);
        if (success) {
          totalWithdrawals++;
        }
        
        // Small delay between withdrawals
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(chalk.green(`✅ Completed ${totalWithdrawals} withdrawals`));
  }

  async adjustThresholds(newThresholds: Partial<WithdrawalConfig['thresholds']>): Promise<void> {
    console.log(chalk.yellow('🔧 Adjusting withdrawal thresholds...'));

    for (const [token, amount] of Object.entries(newThresholds)) {
      if (amount !== undefined) {
        this.config.thresholds[token as keyof typeof this.config.thresholds] = amount;
        
        const decimals = token === 'USDC' ? 6 : 18;
        const formatted = ethers.formatUnits(amount, decimals);
        console.log(chalk.cyan(`📊 ${token} threshold: ${formatted}`));
      }
    }

    console.log(chalk.green('✅ Thresholds updated successfully'));
  }

  stopAutomaticWithdrawals(): void {
    this.isRunning = false;
    console.log(chalk.yellow('⏹️ Automatic withdrawals stopped'));
  }

  getConfig(): WithdrawalConfig {
    return { ...this.config };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const automation = new ProfitWithdrawalAutomation();
  
  if (!process.env.BOT_CONTRACT_ADDRESS) {
    console.error(chalk.red('❌ BOT_CONTRACT_ADDRESS not set in environment'));
    process.exit(1);
  }

  try {
    await automation.initialize(process.env.BOT_CONTRACT_ADDRESS);

    switch (command) {
      case 'start':
        await automation.startAutomaticWithdrawals();
        // Keep process alive
        process.on('SIGINT', () => {
          automation.stopAutomaticWithdrawals();
          process.exit(0);
        });
        break;

      case 'check':
        await automation.performAutomaticWithdrawals();
        break;

      case 'balance':
        const balances = await automation.checkProfitBalances();
        console.log(chalk.blue('\n💼 Current Profit Balances:'));
        console.log(chalk.blue('═══════════════════════════'));
        for (const [token, balance] of Object.entries(balances)) {
          if (balance > 0n) {
            const decimals = token === 'USDC' ? 6 : 18;
            const formatted = ethers.formatUnits(balance, decimals);
            console.log(chalk.green(`   ${token}: ${formatted}`));
          }
        }
        break;

      case 'withdraw':
        const token = args[1];
        if (token) {
          await automation.withdrawProfit(token.toUpperCase());
        } else {
          await automation.withdrawAllProfits();
        }
        break;

      case 'emergency':
        await automation.withdrawAllProfits(true);
        break;

      default:
        console.log(chalk.blue('Profit Withdrawal Automation Commands:'));
        console.log(chalk.cyan('  start        - Start automatic withdrawals'));
        console.log(chalk.cyan('  check        - Check and perform withdrawals now'));
        console.log(chalk.cyan('  balance      - Show current profit balances'));
        console.log(chalk.cyan('  withdraw     - Withdraw all profits manually'));
        console.log(chalk.cyan('  withdraw ETH - Withdraw specific token'));
        console.log(chalk.cyan('  emergency    - Emergency withdraw all'));
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

export default ProfitWithdrawalAutomation;