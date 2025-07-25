import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

interface WalletAudit {
  address: string;
  balance: string;
  transactionCount: number;
  isContract: boolean;
  recentTransactions?: any[];
}

interface SecurityAuditResult {
  executorWallet: WalletAudit;
  gasFundingWallet: WalletAudit;
  suspiciousAddress: WalletAudit;
  securityIssues: string[];
  recommendations: string[];
}

export class SecurityAuditor {
  private provider: ethers.JsonRpcProvider;
  private executorWallet: ethers.Wallet;
  private gasFundingWalletAddress: string;
  private suspiciousAddress: string;

  constructor() {
    if (!process.env.ARB_RPC || !process.env.PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
    this.executorWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.gasFundingWalletAddress = '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac';
    this.suspiciousAddress = '0x541b9034c82d7fb564f12ca07037947ff5b4ef2f';
  }

  async auditWallet(address: string): Promise<WalletAudit> {
    try {
      console.log(chalk.blue(`🔍 Auditing wallet: ${address}`));

      const balance = await this.provider.getBalance(address);
      const transactionCount = await this.provider.getTransactionCount(address);
      const code = await this.provider.getCode(address);
      const isContract = code !== '0x';

      return {
        address,
        balance: ethers.formatEther(balance),
        transactionCount,
        isContract
      };
    } catch (error) {
      console.error(chalk.red(`❌ Error auditing wallet ${address}:`), error);
      return {
        address,
        balance: '0',
        transactionCount: 0,
        isContract: false
      };
    }
  }

  async checkRecentTransactions(address: string, blockRange: number = 1000): Promise<any[]> {
    try {
      console.log(chalk.yellow(`📊 Checking recent transactions for ${address}`));
      
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = Math.max(0, currentBlock - blockRange);
      
      // Get transaction history using filter (limited approach)
      const filter = {
        fromBlock: startBlock,
        toBlock: 'latest',
        topics: [] as string[]
      };

      console.log(chalk.cyan(`🔎 Searching blocks ${startBlock} to ${currentBlock}`));
      
      // Note: This is limited. For comprehensive transaction history, 
      // consider using an indexing service like The Graph or Etherscan API
      const logs = await this.provider.getLogs(filter);
      
      return logs.slice(0, 10); // Return last 10 transactions
    } catch (error) {
      console.error(chalk.red(`❌ Error fetching transactions for ${address}:`), error);
      return [];
    }
  }

  async checkForSuspiciousActivity(): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check if executor wallet has been drained
      const executorBalance = await this.provider.getBalance(this.executorWallet.address);
      if (executorBalance < ethers.parseEther('0.001')) {
        issues.push(`⚠️ Executor wallet balance critically low: ${ethers.formatEther(executorBalance)} ETH`);
      }

      // Check gas funding wallet balance
      const gasFundingBalance = await this.provider.getBalance(this.gasFundingWalletAddress);
      if (gasFundingBalance < ethers.parseEther('0.001')) {
        issues.push(`⚠️ Gas funding wallet balance low: ${ethers.formatEther(gasFundingBalance)} ETH`);
      }

      // Check suspicious address balance (if it has significant ETH, it's concerning)
      const suspiciousBalance = await this.provider.getBalance(this.suspiciousAddress);
      if (suspiciousBalance > ethers.parseEther('0.01')) {
        issues.push(`🚨 Suspicious address has significant balance: ${ethers.formatEther(suspiciousBalance)} ETH`);
      }

      // Check if suspicious address is a contract
      const suspiciousCode = await this.provider.getCode(this.suspiciousAddress);
      if (suspiciousCode !== '0x') {
        issues.push(`🚨 Suspicious address is a smart contract - potential MEV bot or malicious contract`);
      }

      return issues;
    } catch (error) {
      console.error(chalk.red('❌ Error checking for suspicious activity:'), error);
      return [`❌ Failed to complete security check: ${error}`];
    }
  }

  async generateSecurityRecommendations(): Promise<string[]> {
    const recommendations: string[] = [
      '🔒 Immediately rotate all private keys if compromise is suspected',
      '🔐 Enable 2FA on all exchange and service accounts',
      '📱 Set up real-time alerts for wallet balance changes',
      '🏦 Consider using a multi-signature wallet for large funds',
      '🔍 Implement transaction monitoring and approval workflows',
      '💾 Keep private keys in hardware wallets or secure key management systems',
      '🚫 Never share private keys or store them in plaintext files',
      '📊 Regularly audit all smart contract interactions',
      '🛡️ Use a separate wallet for testing vs production',
      '⚡ Implement circuit breakers to halt operations during suspicious activity'
    ];

    return recommendations;
  }

  async performCompleteAudit(): Promise<SecurityAuditResult> {
    console.log(chalk.blue('\n🛡️ SECURITY AUDIT STARTING'));
    console.log(chalk.blue('═══════════════════════════════'));

    // Audit all wallets
    const executorWallet = await this.auditWallet(this.executorWallet.address);
    const gasFundingWallet = await this.auditWallet(this.gasFundingWalletAddress);
    const suspiciousAddress = await this.auditWallet(this.suspiciousAddress);

    // Check for security issues
    const securityIssues = await this.checkForSuspiciousActivity();

    // Generate recommendations
    const recommendations = await this.generateSecurityRecommendations();

    const result: SecurityAuditResult = {
      executorWallet,
      gasFundingWallet,
      suspiciousAddress,
      securityIssues,
      recommendations
    };

    this.printAuditReport(result);
    return result;
  }

  private printAuditReport(result: SecurityAuditResult): void {
    console.log(chalk.blue('\n📊 SECURITY AUDIT REPORT'));
    console.log(chalk.blue('═════════════════════════'));

    // Executor Wallet
    console.log(chalk.cyan('\n🔑 EXECUTOR WALLET'));
    console.log(chalk.white(`Address: ${result.executorWallet.address}`));
    console.log(chalk.white(`Balance: ${result.executorWallet.balance} ETH`));
    console.log(chalk.white(`Transactions: ${result.executorWallet.transactionCount}`));
    console.log(chalk.white(`Is Contract: ${result.executorWallet.isContract ? 'Yes' : 'No'}`));

    // Gas Funding Wallet
    console.log(chalk.cyan('\n⛽ GAS FUNDING WALLET'));
    console.log(chalk.white(`Address: ${result.gasFundingWallet.address}`));
    console.log(chalk.white(`Balance: ${result.gasFundingWallet.balance} ETH`));
    console.log(chalk.white(`Transactions: ${result.gasFundingWallet.transactionCount}`));
    console.log(chalk.white(`Is Contract: ${result.gasFundingWallet.isContract ? 'Yes' : 'No'}`));

    // Suspicious Address
    console.log(chalk.red('\n🚨 SUSPICIOUS ADDRESS ANALYSIS'));
    console.log(chalk.white(`Address: ${result.suspiciousAddress.address}`));
    console.log(chalk.white(`Balance: ${result.suspiciousAddress.balance} ETH`));
    console.log(chalk.white(`Transactions: ${result.suspiciousAddress.transactionCount}`));
    console.log(chalk.white(`Is Contract: ${result.suspiciousAddress.isContract ? 'Yes' : 'No'}`));

    // Security Issues
    console.log(chalk.red('\n⚠️ SECURITY ISSUES FOUND'));
    if (result.securityIssues.length === 0) {
      console.log(chalk.green('✅ No immediate security issues detected'));
    } else {
      result.securityIssues.forEach(issue => console.log(chalk.red(issue)));
    }

    // Recommendations
    console.log(chalk.yellow('\n💡 SECURITY RECOMMENDATIONS'));
    result.recommendations.forEach(rec => console.log(chalk.yellow(rec)));

    console.log(chalk.blue('\n═════════════════════════'));
    console.log(chalk.blue('🛡️ SECURITY AUDIT COMPLETE'));
  }

  async checkEtherscanTransactions(address: string): Promise<void> {
    if (!process.env.ARBISCAN_API_KEY) {
      console.log(chalk.yellow('⚠️ ARBISCAN_API_KEY not found - skipping detailed transaction analysis'));
      return;
    }

    try {
      console.log(chalk.blue(`🔍 Checking Arbiscan for ${address} transactions...`));
      
      const apiUrl = `https://api.arbiscan.io/api`;
      const params = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: '0',
        endblock: '99999999',
        page: '1',
        offset: '10',
        sort: 'desc',
        apikey: process.env.ARBISCAN_API_KEY!
      });

      // Note: Using console.log instead of actual fetch to avoid external dependencies
      console.log(chalk.cyan(`📡 API URL: ${apiUrl}?${params.toString()}`));
      console.log(chalk.yellow('💡 Use this URL to manually check transaction history'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error preparing Etherscan check:'), error);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'audit';

  const auditor = new SecurityAuditor();

  try {
    switch (command) {
      case 'audit':
        await auditor.performCompleteAudit();
        break;

      case 'wallet':
        const address = args[1];
        if (!address) {
          console.error(chalk.red('❌ Please provide wallet address'));
          process.exit(1);
        }
        await auditor.auditWallet(address);
        break;

      case 'etherscan':
        const checkAddress = args[1];
        if (!checkAddress) {
          console.error(chalk.red('❌ Please provide wallet address'));
          process.exit(1);
        }
        await auditor.checkEtherscanTransactions(checkAddress);
        break;

      default:
        console.log(chalk.blue('Security Audit Commands:'));
        console.log(chalk.cyan('  audit              - Perform complete security audit'));
        console.log(chalk.cyan('  wallet <address>   - Audit specific wallet'));
        console.log(chalk.cyan('  etherscan <addr>   - Generate Etherscan API URL'));
        break;
    }

  } catch (error) {
    console.error(chalk.red('❌ Security audit failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default SecurityAuditor;