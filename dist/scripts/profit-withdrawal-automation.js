"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfitWithdrawalAutomation = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
dotenv_1.default.config();
class ProfitWithdrawalAutomation {
    provider;
    wallet;
    contract; // Initialized in init()
    config;
    isRunning = false;
    // Major token addresses on Arbitrum
    tokens = {
        WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        USDC: '0xA0b86a33E6441Ee04b3B1dcF3a7F66EF56fF6fC0', // USDC.e  
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548'
    };
    constructor() {
        if (!process.env.ARB_RPC || !process.env.PRIVATE_KEY) {
            throw new Error('Missing required environment variables');
        }
        this.provider = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        this.wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        // Default withdrawal configuration
        this.config = {
            enabled: true,
            thresholds: {
                WETH: ethers_1.ethers.parseEther('0.01'), // 0.01 ETH
                USDC: 10000000n, // 10 USDC (6 decimals)
                USDT: ethers_1.ethers.parseEther('10'), // 10 USDT
                ARB: ethers_1.ethers.parseEther('100') // 100 ARB
            },
            emergencyThresholds: {
                WETH: ethers_1.ethers.parseEther('0.1'), // 0.1 ETH
                USDC: 100000000n, // 100 USDC
                USDT: ethers_1.ethers.parseEther('100'), // 100 USDT  
                ARB: ethers_1.ethers.parseEther('1000') // 1000 ARB
            },
            autoWithdrawInterval: 6, // Every 6 hours
            maxGasPrice: ethers_1.ethers.parseUnits('0.1', 'gwei') // 0.1 gwei max
        };
    }
    async initialize(contractAddress) {
        // Contract ABI for withdrawal functions
        const contractABI = [
            "function withdraw(address token) external",
            "function emergencyWithdraw(address token) external",
            "function owner() external view returns (address)",
            "function balanceOf(address) external view returns (uint256)"
        ];
        this.contract = new ethers_1.ethers.Contract(contractAddress, contractABI, this.wallet);
        // Verify we're the owner
        const owner = await this.contract.owner();
        if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
            throw new Error(`Not contract owner. Owner: ${owner}, Wallet: ${this.wallet.address}`);
        }
        console.log(chalk_1.default.green('💰 Profit Withdrawal Automation initialized'));
        console.log(chalk_1.default.cyan(`📍 Contract: ${contractAddress}`));
        console.log(chalk_1.default.cyan(`👤 Owner: ${this.wallet.address}`));
        console.log(chalk_1.default.cyan(`⏰ Auto-withdraw: Every ${this.config.autoWithdrawInterval} hours`));
    }
    async checkProfitBalances() {
        const balances = {};
        for (const [symbol, address] of Object.entries(this.tokens)) {
            try {
                const tokenContract = new ethers_1.ethers.Contract(address, [
                    "function balanceOf(address) external view returns (uint256)"
                ], this.provider);
                const contractAddress = await this.contract.getAddress();
                balances[symbol] = await tokenContract.balanceOf(contractAddress);
            }
            catch (error) {
                console.error(chalk_1.default.yellow(`⚠️ Error checking ${symbol} balance:`, error));
                balances[symbol] = 0n;
            }
        }
        return balances;
    }
    async withdrawProfit(tokenSymbol, emergency = false) {
        try {
            const tokenAddress = this.tokens[tokenSymbol];
            if (!tokenAddress) {
                throw new Error(`Unknown token: ${tokenSymbol}`);
            }
            // Check current gas price
            const gasPrice = await this.provider.getFeeData();
            if (gasPrice.gasPrice && gasPrice.gasPrice > this.config.maxGasPrice) {
                console.log(chalk_1.default.yellow(`⛽ Gas price too high: ${ethers_1.ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`));
                return false;
            }
            console.log(chalk_1.default.blue(`💸 Withdrawing ${tokenSymbol} profits...`));
            const withdrawTx = emergency
                ? await this.contract.emergencyWithdraw(tokenAddress)
                : await this.contract.withdraw(tokenAddress);
            const receipt = await withdrawTx.wait();
            console.log(chalk_1.default.green(`✅ ${tokenSymbol} withdrawal successful`));
            console.log(chalk_1.default.cyan(`📄 Transaction: ${receipt.hash}`));
            console.log(chalk_1.default.cyan(`⛽ Gas used: ${receipt.gasUsed.toString()}`));
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Error withdrawing ${tokenSymbol}:`), error);
            return false;
        }
    }
    async performAutomaticWithdrawals() {
        console.log(chalk_1.default.blue('🔄 Checking for automatic withdrawals...'));
        const balances = await this.checkProfitBalances();
        const thresholds = this.config.thresholds;
        const emergencyThresholds = this.config.emergencyThresholds;
        let withdrawalsPerformed = 0;
        for (const [token, balance] of Object.entries(balances)) {
            if (balance > 0n) {
                const threshold = thresholds[token];
                const emergencyThreshold = emergencyThresholds[token];
                // Format balance for display
                const decimals = token === 'USDC' ? 6 : 18;
                const formattedBalance = ethers_1.ethers.formatUnits(balance, decimals);
                const formattedThreshold = ethers_1.ethers.formatUnits(threshold, decimals);
                const formattedEmergency = ethers_1.ethers.formatUnits(emergencyThreshold, decimals);
                console.log(chalk_1.default.cyan(`📊 ${token}: ${formattedBalance} (threshold: ${formattedThreshold})`));
                // Check for emergency withdrawal (priority)
                if (balance >= emergencyThreshold) {
                    console.log(chalk_1.default.red(`🚨 ${token} balance exceeds emergency threshold (${formattedEmergency})!`));
                    const success = await this.withdrawProfit(token, true);
                    if (success) {
                        withdrawalsPerformed++;
                    }
                }
                // Check for regular withdrawal
                else if (balance >= threshold) {
                    console.log(chalk_1.default.yellow(`💡 ${token} balance exceeds threshold - withdrawing...`));
                    const success = await this.withdrawProfit(token, false);
                    if (success) {
                        withdrawalsPerformed++;
                    }
                }
            }
        }
        if (withdrawalsPerformed === 0) {
            console.log(chalk_1.default.green('✨ No withdrawals needed - all balances below thresholds'));
        }
        else {
            console.log(chalk_1.default.green(`✅ Performed ${withdrawalsPerformed} automatic withdrawals`));
        }
    }
    async startAutomaticWithdrawals() {
        if (this.isRunning) {
            console.log(chalk_1.default.yellow('⚠️ Automatic withdrawals already running'));
            return;
        }
        this.isRunning = true;
        console.log(chalk_1.default.blue('🚀 Starting automatic profit withdrawals...'));
        console.log(chalk_1.default.cyan(`⏰ Interval: ${this.config.autoWithdrawInterval} hours`));
        const withdrawalLoop = async () => {
            try {
                await this.performAutomaticWithdrawals();
            }
            catch (error) {
                console.error(chalk_1.default.red('❌ Error in withdrawal loop:'), error);
            }
            // Schedule next withdrawal check
            if (this.isRunning) {
                const nextCheck = new Date(Date.now() + this.config.autoWithdrawInterval * 60 * 60 * 1000);
                console.log(chalk_1.default.cyan(`⏰ Next withdrawal check: ${nextCheck.toLocaleString()}`));
                setTimeout(withdrawalLoop, this.config.autoWithdrawInterval * 60 * 60 * 1000);
            }
        };
        // Start the withdrawal loop
        withdrawalLoop();
    }
    async withdrawAllProfits(emergency = false) {
        console.log(chalk_1.default.blue(`💸 Withdrawing all profits${emergency ? ' (EMERGENCY)' : ''}...`));
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
        console.log(chalk_1.default.green(`✅ Completed ${totalWithdrawals} withdrawals`));
    }
    async adjustThresholds(newThresholds) {
        console.log(chalk_1.default.yellow('🔧 Adjusting withdrawal thresholds...'));
        for (const [token, amount] of Object.entries(newThresholds)) {
            if (amount !== undefined) {
                this.config.thresholds[token] = amount;
                const decimals = token === 'USDC' ? 6 : 18;
                const formatted = ethers_1.ethers.formatUnits(amount, decimals);
                console.log(chalk_1.default.cyan(`📊 ${token} threshold: ${formatted}`));
            }
        }
        console.log(chalk_1.default.green('✅ Thresholds updated successfully'));
    }
    stopAutomaticWithdrawals() {
        this.isRunning = false;
        console.log(chalk_1.default.yellow('⏹️ Automatic withdrawals stopped'));
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.ProfitWithdrawalAutomation = ProfitWithdrawalAutomation;
// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const automation = new ProfitWithdrawalAutomation();
    if (!process.env.BOT_CONTRACT_ADDRESS) {
        console.error(chalk_1.default.red('❌ BOT_CONTRACT_ADDRESS not set in environment'));
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
                console.log(chalk_1.default.blue('\n💼 Current Profit Balances:'));
                console.log(chalk_1.default.blue('═══════════════════════════'));
                for (const [token, balance] of Object.entries(balances)) {
                    if (balance > 0n) {
                        const decimals = token === 'USDC' ? 6 : 18;
                        const formatted = ethers_1.ethers.formatUnits(balance, decimals);
                        console.log(chalk_1.default.green(`   ${token}: ${formatted}`));
                    }
                }
                break;
            case 'withdraw':
                const token = args[1];
                if (token) {
                    await automation.withdrawProfit(token.toUpperCase());
                }
                else {
                    await automation.withdrawAllProfits();
                }
                break;
            case 'emergency':
                await automation.withdrawAllProfits(true);
                break;
            default:
                console.log(chalk_1.default.blue('Profit Withdrawal Automation Commands:'));
                console.log(chalk_1.default.cyan('  start        - Start automatic withdrawals'));
                console.log(chalk_1.default.cyan('  check        - Check and perform withdrawals now'));
                console.log(chalk_1.default.cyan('  balance      - Show current profit balances'));
                console.log(chalk_1.default.cyan('  withdraw     - Withdraw all profits manually'));
                console.log(chalk_1.default.cyan('  withdraw ETH - Withdraw specific token'));
                console.log(chalk_1.default.cyan('  emergency    - Emergency withdraw all'));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = ProfitWithdrawalAutomation;
