import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

interface HealthStatus {
  component: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  message: string;
  details?: any;
}

class HealthChecker {
  private provider: ethers.JsonRpcProvider;
  private results: HealthStatus[] = [];

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ARB_RPC!);
  }

  async runHealthCheck(): Promise<void> {
    console.log(chalk.blue('🏥 ARBBot2025 Health Check Starting...\n'));

    await Promise.all([
      this.checkRPCConnectivity(),
      this.checkWalletBalance(),
      this.checkContractDeployment(),
      this.checkMemoryUsage(),
      this.checkEnvironmentVariables()
    ]);

    this.displayResults();
  }

  private async checkRPCConnectivity(): Promise<void> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.results.push({
        component: 'RPC Connectivity',
        status: 'HEALTHY',
        message: `Connected to Arbitrum block ${blockNumber}`,
        details: { blockNumber }
      });
    } catch (error) {
      this.results.push({
        component: 'RPC Connectivity',
        status: 'CRITICAL',
        message: 'Failed to connect to RPC endpoint',
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  private async checkWalletBalance(): Promise<void> {
    try {
      if (!process.env.PRIVATE_KEY) {
        this.results.push({
          component: 'Wallet Balance',
          status: 'CRITICAL',
          message: 'Private key not configured'
        });
        return;
      }

      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
      const balance = await this.provider.getBalance(wallet.address);
      const balanceETH = parseFloat(ethers.formatEther(balance));

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      let message = `Balance: ${balanceETH.toFixed(4)} ETH`;

      if (balanceETH < 0.001) {
        status = 'CRITICAL';
        message += ' - CRITICAL: Insufficient gas funds';
      } else if (balanceETH < 0.01) {
        status = 'WARNING';
        message += ' - WARNING: Low gas funds';
      }

      this.results.push({
        component: 'Wallet Balance',
        status,
        message,
        details: { address: wallet.address, balanceETH }
      });
    } catch (error) {
      this.results.push({
        component: 'Wallet Balance',
        status: 'CRITICAL',
        message: 'Failed to check wallet balance',
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  private async checkContractDeployment(): Promise<void> {
    try {
      if (!process.env.BOT_CONTRACT_ADDRESS) {
        this.results.push({
          component: 'Contract Deployment',
          status: 'CRITICAL',
          message: 'Bot contract address not configured'
        });
        return;
      }

      const code = await this.provider.getCode(process.env.BOT_CONTRACT_ADDRESS);
      
      if (code === '0x') {
        this.results.push({
          component: 'Contract Deployment',
          status: 'CRITICAL',
          message: 'Contract not deployed at specified address',
          details: { address: process.env.BOT_CONTRACT_ADDRESS }
        });
      } else {
        this.results.push({
          component: 'Contract Deployment',
          status: 'HEALTHY',
          message: 'Contract deployed and verified',
          details: { 
            address: process.env.BOT_CONTRACT_ADDRESS,
            codeSize: code.length 
          }
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Contract Deployment',
        status: 'CRITICAL',
        message: 'Failed to verify contract deployment',
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    let message = `Memory: ${heapUsedMB}/${heapTotalMB} MB`;

    if (heapUsedMB > 2000) {
      status = 'CRITICAL';
      message += ' - CRITICAL: High memory usage';
    } else if (heapUsedMB > 1000) {
      status = 'WARNING';
      message += ' - WARNING: Elevated memory usage';
    }

    this.results.push({
      component: 'Memory Usage',
      status,
      message,
      details: { heapUsedMB, heapTotalMB, rss: Math.round(memUsage.rss / 1024 / 1024) }
    });
  }

  private checkEnvironmentVariables(): void {
    const requiredVars = [
      'PRIVATE_KEY',
      'ARB_RPC',
      'BOT_CONTRACT_ADDRESS',
      'BALANCER_VAULT_ADDRESS',
      'FLASHBOTS_AUTH_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length === 0) {
      this.results.push({
        component: 'Environment Variables',
        status: 'HEALTHY',
        message: 'All required environment variables configured'
      });
    } else {
      this.results.push({
        component: 'Environment Variables',
        status: 'CRITICAL',
        message: `Missing variables: ${missingVars.join(', ')}`,
        details: { missingVars }
      });
    }
  }

  private displayResults(): void {
    console.log(chalk.blue('📊 Health Check Results:\n'));

    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const result of this.results) {
      let statusColor = chalk.green;
      let statusIcon = '✅';

      switch (result.status) {
        case 'WARNING':
          statusColor = chalk.yellow;
          statusIcon = '⚠️';
          warningCount++;
          break;
        case 'CRITICAL':
          statusColor = chalk.red;
          statusIcon = '❌';
          criticalCount++;
          break;
        default:
          healthyCount++;
          break;
      }

      console.log(`${statusIcon} ${chalk.bold(result.component)}: ${statusColor(result.message)}`);
      
      if (result.details) {
        console.log(chalk.gray(`   Details: ${JSON.stringify(result.details, null, 2)}`));
      }
      console.log();
    }

    // Summary
    console.log(chalk.blue('📈 Health Summary:'));
    console.log(`✅ Healthy: ${healthyCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    console.log(`❌ Critical: ${criticalCount}`);

    const overallHealth = criticalCount === 0 ? 
      (warningCount === 0 ? 'HEALTHY' : 'WARNING') : 'CRITICAL';

    console.log(`\n🎯 Overall Status: ${this.getStatusColor(overallHealth)(overallHealth)}`);

    if (overallHealth === 'HEALTHY') {
      console.log(chalk.green('🚀 System is ready for production operation!'));
    } else if (overallHealth === 'WARNING') {
      console.log(chalk.yellow('⚠️ System operational with warnings - monitor closely'));
    } else {
      console.log(chalk.red('🚨 Critical issues detected - resolve before production use'));
    }
  }

  private getStatusColor(status: string) {
    switch (status) {
      case 'HEALTHY': return chalk.green;
      case 'WARNING': return chalk.yellow;
      case 'CRITICAL': return chalk.red;
      default: return chalk.white;
    }
  }
}

// Main execution
async function main() {
  const healthChecker = new HealthChecker();
  await healthChecker.runHealthCheck();
}

if (require.main === module) {
  main().catch(console.error);
}

export { HealthChecker };