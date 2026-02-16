"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityAuditor = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
dotenv_1.default.config();
class SecurityAuditor {
    provider;
    executorWallet;
    gasFundingWalletAddress;
    suspiciousAddress;
    constructor() {
        if (!process.env.ARB_RPC || !process.env.PRIVATE_KEY) {
            throw new Error('Missing required environment variables');
        }
        this.provider = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        this.executorWallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.gasFundingWalletAddress = '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac';
        this.suspiciousAddress = '0x541b9034c82d7fb564f12ca07037947ff5b4ef2f';
    }
    async auditWallet(address) {
        try {
            console.log(chalk_1.default.blue(`🔍 Auditing wallet: ${address}`));
            const balance = await this.provider.getBalance(address);
            const transactionCount = await this.provider.getTransactionCount(address);
            const code = await this.provider.getCode(address);
            const isContract = code !== '0x';
            return {
                address,
                balance: ethers_1.ethers.formatEther(balance),
                transactionCount,
                isContract
            };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Error auditing wallet ${address}:`), error);
            return {
                address,
                balance: '0',
                transactionCount: 0,
                isContract: false
            };
        }
    }
    async checkRecentTransactions(address, blockRange = 1000) {
        try {
            console.log(chalk_1.default.yellow(`📊 Checking recent transactions for ${address}`));
            const currentBlock = await this.provider.getBlockNumber();
            const startBlock = Math.max(0, currentBlock - blockRange);
            // Get transaction history using filter (limited approach)
            const filter = {
                fromBlock: startBlock,
                toBlock: 'latest',
                topics: []
            };
            console.log(chalk_1.default.cyan(`🔎 Searching blocks ${startBlock} to ${currentBlock}`));
            // Note: This is limited. For comprehensive transaction history, 
            // consider using an indexing service like The Graph or Etherscan API
            const logs = await this.provider.getLogs(filter);
            return logs.slice(0, 10); // Return last 10 transactions
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Error fetching transactions for ${address}:`), error);
            return [];
        }
    }
    async checkForSuspiciousActivity() {
        const issues = [];
        try {
            // Check if executor wallet has been drained
            const executorBalance = await this.provider.getBalance(this.executorWallet.address);
            if (executorBalance < ethers_1.ethers.parseEther('0.001')) {
                issues.push(`⚠️ Executor wallet balance critically low: ${ethers_1.ethers.formatEther(executorBalance)} ETH`);
            }
            // Check gas funding wallet balance
            const gasFundingBalance = await this.provider.getBalance(this.gasFundingWalletAddress);
            if (gasFundingBalance < ethers_1.ethers.parseEther('0.001')) {
                issues.push(`⚠️ Gas funding wallet balance low: ${ethers_1.ethers.formatEther(gasFundingBalance)} ETH`);
            }
            // Check suspicious address balance (if it has significant ETH, it's concerning)
            const suspiciousBalance = await this.provider.getBalance(this.suspiciousAddress);
            if (suspiciousBalance > ethers_1.ethers.parseEther('0.01')) {
                issues.push(`🚨 Suspicious address has significant balance: ${ethers_1.ethers.formatEther(suspiciousBalance)} ETH`);
            }
            // Check if suspicious address is a contract
            const suspiciousCode = await this.provider.getCode(this.suspiciousAddress);
            if (suspiciousCode !== '0x') {
                issues.push(`🚨 Suspicious address is a smart contract - potential MEV bot or malicious contract`);
            }
            return issues;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error checking for suspicious activity:'), error);
            return [`❌ Failed to complete security check: ${error}`];
        }
    }
    async generateSecurityRecommendations() {
        const recommendations = [
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
    async performCompleteAudit() {
        console.log(chalk_1.default.blue('\n🛡️ SECURITY AUDIT STARTING'));
        console.log(chalk_1.default.blue('═══════════════════════════════'));
        // Audit all wallets
        const executorWallet = await this.auditWallet(this.executorWallet.address);
        const gasFundingWallet = await this.auditWallet(this.gasFundingWalletAddress);
        const suspiciousAddress = await this.auditWallet(this.suspiciousAddress);
        // Check for security issues
        const securityIssues = await this.checkForSuspiciousActivity();
        // Generate recommendations
        const recommendations = await this.generateSecurityRecommendations();
        const result = {
            executorWallet,
            gasFundingWallet,
            suspiciousAddress,
            securityIssues,
            recommendations
        };
        this.printAuditReport(result);
        return result;
    }
    printAuditReport(result) {
        console.log(chalk_1.default.blue('\n📊 SECURITY AUDIT REPORT'));
        console.log(chalk_1.default.blue('═════════════════════════'));
        // Executor Wallet
        console.log(chalk_1.default.cyan('\n🔑 EXECUTOR WALLET'));
        console.log(chalk_1.default.white(`Address: ${result.executorWallet.address}`));
        console.log(chalk_1.default.white(`Balance: ${result.executorWallet.balance} ETH`));
        console.log(chalk_1.default.white(`Transactions: ${result.executorWallet.transactionCount}`));
        console.log(chalk_1.default.white(`Is Contract: ${result.executorWallet.isContract ? 'Yes' : 'No'}`));
        // Gas Funding Wallet
        console.log(chalk_1.default.cyan('\n⛽ GAS FUNDING WALLET'));
        console.log(chalk_1.default.white(`Address: ${result.gasFundingWallet.address}`));
        console.log(chalk_1.default.white(`Balance: ${result.gasFundingWallet.balance} ETH`));
        console.log(chalk_1.default.white(`Transactions: ${result.gasFundingWallet.transactionCount}`));
        console.log(chalk_1.default.white(`Is Contract: ${result.gasFundingWallet.isContract ? 'Yes' : 'No'}`));
        // Suspicious Address
        console.log(chalk_1.default.red('\n🚨 SUSPICIOUS ADDRESS ANALYSIS'));
        console.log(chalk_1.default.white(`Address: ${result.suspiciousAddress.address}`));
        console.log(chalk_1.default.white(`Balance: ${result.suspiciousAddress.balance} ETH`));
        console.log(chalk_1.default.white(`Transactions: ${result.suspiciousAddress.transactionCount}`));
        console.log(chalk_1.default.white(`Is Contract: ${result.suspiciousAddress.isContract ? 'Yes' : 'No'}`));
        // Security Issues
        console.log(chalk_1.default.red('\n⚠️ SECURITY ISSUES FOUND'));
        if (result.securityIssues.length === 0) {
            console.log(chalk_1.default.green('✅ No immediate security issues detected'));
        }
        else {
            result.securityIssues.forEach(issue => console.log(chalk_1.default.red(issue)));
        }
        // Recommendations
        console.log(chalk_1.default.yellow('\n💡 SECURITY RECOMMENDATIONS'));
        result.recommendations.forEach(rec => console.log(chalk_1.default.yellow(rec)));
        console.log(chalk_1.default.blue('\n═════════════════════════'));
        console.log(chalk_1.default.blue('🛡️ SECURITY AUDIT COMPLETE'));
    }
    async checkEtherscanTransactions(address) {
        if (!process.env.ARBISCAN_API_KEY) {
            console.log(chalk_1.default.yellow('⚠️ ARBISCAN_API_KEY not found - skipping detailed transaction analysis'));
            return;
        }
        try {
            console.log(chalk_1.default.blue(`🔍 Checking Arbiscan for ${address} transactions...`));
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
                apikey: process.env.ARBISCAN_API_KEY
            });
            // Note: Using console.log instead of actual fetch to avoid external dependencies
            console.log(chalk_1.default.cyan(`📡 API URL: ${apiUrl}?${params.toString()}`));
            console.log(chalk_1.default.yellow('💡 Use this URL to manually check transaction history'));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error preparing Etherscan check:'), error);
        }
    }
}
exports.SecurityAuditor = SecurityAuditor;
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
                    console.error(chalk_1.default.red('❌ Please provide wallet address'));
                    process.exit(1);
                }
                await auditor.auditWallet(address);
                break;
            case 'etherscan':
                const checkAddress = args[1];
                if (!checkAddress) {
                    console.error(chalk_1.default.red('❌ Please provide wallet address'));
                    process.exit(1);
                }
                await auditor.checkEtherscanTransactions(checkAddress);
                break;
            default:
                console.log(chalk_1.default.blue('Security Audit Commands:'));
                console.log(chalk_1.default.cyan('  audit              - Perform complete security audit'));
                console.log(chalk_1.default.cyan('  wallet <address>   - Audit specific wallet'));
                console.log(chalk_1.default.cyan('  etherscan <addr>   - Generate Etherscan API URL'));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Security audit failed:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = SecurityAuditor;
