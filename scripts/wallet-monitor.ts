import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

interface WalletMonitorAlert {
  timestamp: string;
  alertType: 'BALANCE_CHANGE' | 'UNAUTHORIZED_TRANSFER' | 'SUSPICIOUS_ACTIVITY' | 'GAS_FUNDING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  wallet: string;
  message: string;
  details?: any;
}

interface MonitoredWallet {
  address: string;
  name: string;
  lastBalance: bigint;
  lastTxCount: number;
  threshold: bigint; // Alert if balance changes by more than this amount
}

export class WalletMonitor {
  private provider: ethers.JsonRpcProvider;
  private alerts: WalletMonitorAlert[] = [];
  private monitoredWallets: MonitoredWallet[] = [];
  private isRunning: boolean = false;
  private monitoringInterval: number = 30000; // 30 seconds

  // Known suspicious addresses
  private suspiciousAddresses = new Set([
    '0x541b9034c82d7fb564f12ca07037947ff5b4ef2f' // The address from user's report
  ]);

  constructor() {
    if (!process.env.ARB_RPC) {
      throw new Error('ARB_RPC not found in environment');
    }

    this.provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
    
    // Initialize monitored wallets
    this.initializeMonitoredWallets();
  }

  private initializeMonitoredWallets(): void {
    // Add executor wallet
    if (process.env.PRIVATE_KEY) {
      const executorWallet = new ethers.Wallet(process.env.PRIVATE_KEY);
      this.monitoredWallets.push({
        address: executorWallet.address,
        name: 'Executor Wallet',
        lastBalance: 0n,
        lastTxCount: 0,
        threshold: ethers.parseEther('0.001') // Alert if balance changes by 0.001 ETH
      });
    }

    // Add gas funding wallet (now same as executor wallet)
    this.monitoredWallets.push({
      address: '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac',
      name: 'Gas Funding Wallet',
      lastBalance: 0n,
      lastTxCount: 0,
      threshold: ethers.parseEther('0.001')
    });

    // Add testnet wallet if different from executor wallet
    if (process.env.TESTNET_WALLET_ADDRESS && 
        process.env.TESTNET_WALLET_ADDRESS !== this.monitoredWallets[0]?.address) {
      this.monitoredWallets.push({
        address: process.env.TESTNET_WALLET_ADDRESS,
        name: 'Testnet Wallet',
        lastBalance: 0n,
        lastTxCount: 0,
        threshold: ethers.parseEther('0.001')
      });
    }
  }

  async initializeBaselines(): Promise<void> {
    console.log(chalk.blue('🔍 Initializing wallet monitoring baselines...'));

    for (const wallet of this.monitoredWallets) {
      try {
        const balance = await this.provider.getBalance(wallet.address);
        const txCount = await this.provider.getTransactionCount(wallet.address);
        
        wallet.lastBalance = balance;
        wallet.lastTxCount = txCount;

        console.log(chalk.cyan(`📊 ${wallet.name} (${wallet.address})`));
        console.log(chalk.white(`   Balance: ${ethers.formatEther(balance)} ETH`));
        console.log(chalk.white(`   Transactions: ${txCount}`));
      } catch (error) {
        console.error(chalk.red(`❌ Error initializing ${wallet.name}:`), error);
      }
    }
  }

  async checkWalletChanges(): Promise<void> {
    for (const wallet of this.monitoredWallets) {
      try {
        const currentBalance = await this.provider.getBalance(wallet.address);
        const currentTxCount = await this.provider.getTransactionCount(wallet.address);

        // Check for balance changes
        if (currentBalance !== wallet.lastBalance) {
          const balanceChange = currentBalance - wallet.lastBalance;
          const isSignificant = balanceChange > wallet.threshold || balanceChange < -wallet.threshold;

          if (isSignificant) {
            this.createAlert({
              alertType: 'BALANCE_CHANGE',
              severity: balanceChange < 0 ? 'HIGH' : 'MEDIUM',
              wallet: wallet.address,
              message: `${wallet.name} balance changed by ${ethers.formatEther(balanceChange)} ETH`,
              details: {
                previousBalance: ethers.formatEther(wallet.lastBalance),
                currentBalance: ethers.formatEther(currentBalance),
                change: ethers.formatEther(balanceChange)
              }
            });
          }

          wallet.lastBalance = currentBalance;
        }

        // Check for new transactions
        if (currentTxCount > wallet.lastTxCount) {
          const newTxs = currentTxCount - wallet.lastTxCount;
          
          this.createAlert({
            alertType: 'UNAUTHORIZED_TRANSFER',
            severity: 'MEDIUM',
            wallet: wallet.address,
            message: `${wallet.name} has ${newTxs} new transaction(s)`,
            details: {
              previousCount: wallet.lastTxCount,
              currentCount: currentTxCount,
              newTransactions: newTxs
            }
          });

          wallet.lastTxCount = currentTxCount;
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error checking ${wallet.name}:`), error);
      }
    }
  }

  async checkSuspiciousAddresses(): Promise<void> {
    for (const suspiciousAddress of this.suspiciousAddresses) {
      try {
        const balance = await this.provider.getBalance(suspiciousAddress);
        const txCount = await this.provider.getTransactionCount(suspiciousAddress);

        if (balance > 0n) {
          this.createAlert({
            alertType: 'SUSPICIOUS_ACTIVITY',
            severity: 'CRITICAL',
            wallet: suspiciousAddress,
            message: `Suspicious address has non-zero balance: ${ethers.formatEther(balance)} ETH`,
            details: {
              balance: ethers.formatEther(balance),
              transactions: txCount
            }
          });
        }

        if (txCount > 0) {
          this.createAlert({
            alertType: 'SUSPICIOUS_ACTIVITY',
            severity: 'HIGH',
            wallet: suspiciousAddress,
            message: `Suspicious address has transaction activity: ${txCount} transactions`,
            details: {
              balance: ethers.formatEther(balance),
              transactions: txCount
            }
          });
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error checking suspicious address ${suspiciousAddress}:`), error);
      }
    }
  }

  private createAlert(alert: Omit<WalletMonitorAlert, 'timestamp'>): void {
    const fullAlert: WalletMonitorAlert = {
      ...alert,
      timestamp: new Date().toISOString()
    };

    this.alerts.push(fullAlert);
    this.displayAlert(fullAlert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private displayAlert(alert: WalletMonitorAlert): void {
    const severityColors = {
      LOW: chalk.blue,
      MEDIUM: chalk.yellow,
      HIGH: chalk.red,
      CRITICAL: chalk.bgRed.white
    };

    const color = severityColors[alert.severity];
    console.log(color(`\n🚨 ${alert.severity} ALERT - ${alert.alertType}`));
    console.log(color(`⏰ ${alert.timestamp}`));
    console.log(color(`💰 Wallet: ${alert.wallet}`));
    console.log(color(`📝 ${alert.message}`));
    
    if (alert.details) {
      console.log(color(`📊 Details: ${JSON.stringify(alert.details, null, 2)}`));
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Monitoring already running'));
      return;
    }

    console.log(chalk.blue('🛡️ Starting wallet security monitoring...'));
    console.log(chalk.cyan(`⏱️ Check interval: ${this.monitoringInterval / 1000} seconds`));

    await this.initializeBaselines();
    this.isRunning = true;

    const monitoringLoop = async () => {
      if (!this.isRunning) return;

      try {
        await this.checkWalletChanges();
        await this.checkSuspiciousAddresses();
      } catch (error) {
        console.error(chalk.red('❌ Error in monitoring loop:'), error);
      }

      setTimeout(monitoringLoop, this.monitoringInterval);
    };

    monitoringLoop();

    console.log(chalk.green('✅ Wallet monitoring started successfully'));
  }

  stopMonitoring(): void {
    this.isRunning = false;
    console.log(chalk.yellow('⏹️ Wallet monitoring stopped'));
  }

  getAlerts(severity?: WalletMonitorAlert['severity']): WalletMonitorAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  displayRecentAlerts(count: number = 10): void {
    console.log(chalk.blue(`\n📊 RECENT ALERTS (Last ${count})`));
    console.log(chalk.blue('═══════════════════════════════'));

    const recentAlerts = this.alerts.slice(-count);
    
    if (recentAlerts.length === 0) {
      console.log(chalk.green('✅ No recent alerts'));
      return;
    }

    recentAlerts.forEach(alert => {
      const color = alert.severity === 'CRITICAL' ? chalk.red : 
                   alert.severity === 'HIGH' ? chalk.yellow : 
                   chalk.white;
      
      console.log(color(`${alert.timestamp} | ${alert.severity} | ${alert.message}`));
    });
  }

  async generateSecurityReport(): Promise<void> {
    console.log(chalk.blue('\n🛡️ SECURITY MONITORING REPORT'));
    console.log(chalk.blue('═══════════════════════════════'));

    // Alert summary
    const criticalAlerts = this.alerts.filter(a => a.severity === 'CRITICAL').length;
    const highAlerts = this.alerts.filter(a => a.severity === 'HIGH').length;
    const mediumAlerts = this.alerts.filter(a => a.severity === 'MEDIUM').length;
    const lowAlerts = this.alerts.filter(a => a.severity === 'LOW').length;

    console.log(chalk.cyan('\n📊 ALERT SUMMARY'));
    console.log(chalk.red(`🔴 Critical: ${criticalAlerts}`));
    console.log(chalk.yellow(`🟡 High: ${highAlerts}`));
    console.log(chalk.blue(`🔵 Medium: ${mediumAlerts}`));
    console.log(chalk.green(`🟢 Low: ${lowAlerts}`));

    // Current wallet status
    console.log(chalk.cyan('\n💰 CURRENT WALLET STATUS'));
    for (const wallet of this.monitoredWallets) {
      try {
        const balance = await this.provider.getBalance(wallet.address);
        const txCount = await this.provider.getTransactionCount(wallet.address);
        
        console.log(chalk.white(`\n${wallet.name} (${wallet.address})`));
        console.log(chalk.white(`  Balance: ${ethers.formatEther(balance)} ETH`));
        console.log(chalk.white(`  Transactions: ${txCount}`));
        
        if (balance === 0n) {
          console.log(chalk.red('  ⚠️ EMPTY WALLET'));
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ Error checking wallet: ${error}`));
      }
    }

    // Suspicious address status
    console.log(chalk.cyan('\n🚨 SUSPICIOUS ADDRESS STATUS'));
    for (const suspiciousAddress of this.suspiciousAddresses) {
      try {
        const balance = await this.provider.getBalance(suspiciousAddress);
        const txCount = await this.provider.getTransactionCount(suspiciousAddress);
        
        console.log(chalk.white(`\n${suspiciousAddress}`));
        console.log(chalk.white(`  Balance: ${ethers.formatEther(balance)} ETH`));
        console.log(chalk.white(`  Transactions: ${txCount}`));
        
        if (balance > 0n || txCount > 0) {
          console.log(chalk.red('  🚨 REQUIRES INVESTIGATION'));
        } else {
          console.log(chalk.green('  ✅ INACTIVE'));
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ Error checking address: ${error}`));
      }
    }

    this.displayRecentAlerts();
  }

  addSuspiciousAddress(address: string): void {
    this.suspiciousAddresses.add(address.toLowerCase());
    console.log(chalk.yellow(`🚨 Added ${address} to suspicious addresses watchlist`));
  }

  addMonitoredWallet(address: string, name: string, threshold: string = '0.001'): void {
    this.monitoredWallets.push({
      address,
      name,
      lastBalance: 0n,
      lastTxCount: 0,
      threshold: ethers.parseEther(threshold)
    });
    console.log(chalk.green(`✅ Added ${name} (${address}) to monitoring`));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const monitor = new WalletMonitor();

  try {
    switch (command) {
      case 'start':
        await monitor.startMonitoring();
        // Keep process alive
        process.on('SIGINT', () => {
          monitor.stopMonitoring();
          process.exit(0);
        });
        break;

      case 'report':
        await monitor.generateSecurityReport();
        break;

      case 'alerts':
        const severity = args[1] as WalletMonitorAlert['severity'] | undefined;
        const alerts = monitor.getAlerts(severity);
        console.log(chalk.blue(`Found ${alerts.length} alerts`));
        monitor.displayRecentAlerts(20);
        break;

      case 'add-suspicious':
        const suspiciousAddr = args[1];
        if (!suspiciousAddr) {
          console.error(chalk.red('❌ Please provide address'));
          process.exit(1);
        }
        monitor.addSuspiciousAddress(suspiciousAddr);
        break;

      case 'add-wallet':
        const walletAddr = args[1];
        const walletName = args[2];
        const threshold = args[3];
        if (!walletAddr || !walletName) {
          console.error(chalk.red('❌ Please provide address and name'));
          process.exit(1);
        }
        monitor.addMonitoredWallet(walletAddr, walletName, threshold);
        break;

      default:
        console.log(chalk.blue('Wallet Monitor Commands:'));
        console.log(chalk.cyan('  start                     - Start continuous monitoring'));
        console.log(chalk.cyan('  report                    - Generate security report'));
        console.log(chalk.cyan('  alerts [severity]         - Show alerts'));
        console.log(chalk.cyan('  add-suspicious <address>  - Add address to watchlist'));
        console.log(chalk.cyan('  add-wallet <addr> <name>  - Add wallet to monitoring'));
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

export default WalletMonitor;