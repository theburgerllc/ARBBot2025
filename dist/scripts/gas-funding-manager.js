"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GasFundingManager = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const enhanced_cross_chain_gas_manager_1 = __importDefault(require("./enhanced-cross-chain-gas-manager"));
dotenv_1.default.config();
class GasFundingManager {
    provider;
    wallet;
    contract; // Initialized in init()
    config;
    isRunning = false;
    crossChainManager;
    constructor() {
        if (!process.env.ARB_RPC || !process.env.PRIVATE_KEY) {
            throw new Error('Missing required environment variables');
        }
        this.provider = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        this.wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        // Default configuration - Updated for new wallet
        this.config = {
            enabled: true,
            gasFundingWallet: '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac', // New executor wallet
            fundingPercentage: 10, // 10% of profits
            targetGasReserve: ethers_1.ethers.parseEther('0.01'), // 0.01 ETH target
            maxGasReserve: ethers_1.ethers.parseEther('0.05'), // 0.05 ETH maximum
            monitoringInterval: 30 // Check every 30 minutes
        };
    }
    async initialize(contractAddress) {
        // Load contract ABI (simplified version for gas funding)
        const contractABI = [
            "function getGasFundingStats() external view returns (address wallet, uint256 percentage, uint256 totalTransferred)",
            "function setGasFundingWallet(address _gasFundingWallet) external",
            "function setGasFundingPercentage(uint256 _percentage) external",
            "function withdraw(address token) external",
            "function balanceOf(address) external view returns (uint256)",
            "event GasFundingTransfer(address indexed token, uint256 amount, address indexed gasFundingWallet)"
        ];
        this.contract = new ethers_1.ethers.Contract(contractAddress, contractABI, this.wallet);
        // Initialize enhanced cross-chain gas manager
        try {
            this.crossChainManager = new enhanced_cross_chain_gas_manager_1.default();
            await this.crossChainManager.initialize();
            console.log(chalk_1.default.green('✅ Enhanced cross-chain gas manager integrated'));
        }
        catch (error) {
            console.log(chalk_1.default.yellow('⚠️ Cross-chain manager not available:', error));
        }
        console.log(chalk_1.default.green('🔧 Gas Funding Manager initialized'));
        console.log(chalk_1.default.cyan(`📍 Contract: ${contractAddress}`));
        console.log(chalk_1.default.cyan(`💰 Gas Wallet: ${this.config.gasFundingWallet}`));
        console.log(chalk_1.default.cyan(`📊 Funding: ${this.config.fundingPercentage}%`));
    }
    async setupGasFunding() {
        try {
            console.log(chalk_1.default.yellow('⚙️ Setting up gas funding configuration...'));
            // Set gas funding wallet
            const setWalletTx = await this.contract.setGasFundingWallet(this.config.gasFundingWallet);
            await setWalletTx.wait();
            console.log(chalk_1.default.green(`✅ Gas funding wallet set: ${this.config.gasFundingWallet}`));
            // Set funding percentage (convert to basis points: 10% = 1000 bps)
            const percentageBps = this.config.fundingPercentage * 100;
            const setPercentageTx = await this.contract.setGasFundingPercentage(percentageBps);
            await setPercentageTx.wait();
            console.log(chalk_1.default.green(`✅ Gas funding percentage set: ${this.config.fundingPercentage}%`));
            console.log(chalk_1.default.green('🎯 Gas funding configuration complete!'));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error setting up gas funding:'), error);
            throw error;
        }
    }
    async getGasFundingStats() {
        try {
            const [wallet, percentage, totalTransferred] = await this.contract.getGasFundingStats();
            const currentGasBalance = await this.provider.getBalance(this.config.gasFundingWallet);
            // Get contract balances for major tokens
            const tokens = {
                WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
                USDC: '0xA0b86a33E6441Ee04b3B1dcF3a7F66EF56fF6fC0',
                USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
            };
            const contractProfits = {};
            for (const [symbol, address] of Object.entries(tokens)) {
                try {
                    const tokenContract = new ethers_1.ethers.Contract(address, [
                        "function balanceOf(address) external view returns (uint256)"
                    ], this.provider);
                    contractProfits[symbol] = await tokenContract.balanceOf(await this.contract.getAddress());
                }
                catch (error) {
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
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error getting gas funding stats:'), error);
            throw error;
        }
    }
    async monitorGasFunding() {
        if (this.isRunning) {
            console.log(chalk_1.default.yellow('⚠️ Gas funding monitor already running'));
            return;
        }
        this.isRunning = true;
        console.log(chalk_1.default.blue('🔍 Starting gas funding monitor...'));
        console.log(chalk_1.default.cyan(`⏱️ Check interval: ${this.config.monitoringInterval} minutes`));
        const monitoringLoop = async () => {
            try {
                const stats = await this.getGasFundingStats();
                this.logGasFundingStatus(stats);
                // Check if gas balance is too low
                if (stats.currentGasBalance < this.config.targetGasReserve) {
                    console.log(chalk_1.default.yellow('🔽 Gas balance below target - checking cross-chain funding and manual withdrawal'));
                    // Try cross-chain funding first
                    if (this.crossChainManager) {
                        try {
                            console.log(chalk_1.default.blue('🌉 Triggering cross-chain gas funding...'));
                            const allBalances = await this.crossChainManager.getAllGasBalances();
                            const operations = await this.crossChainManager.executeAutomaticBridging(allBalances);
                            if (operations.length > 0) {
                                console.log(chalk_1.default.green(`✅ Initiated ${operations.length} cross-chain funding operation(s)`));
                            }
                            else {
                                console.log(chalk_1.default.yellow('⚠️ No cross-chain funding needed, checking manual withdrawal'));
                                await this.checkManualWithdrawal(stats);
                            }
                        }
                        catch (error) {
                            console.log(chalk_1.default.red('❌ Cross-chain funding failed, falling back to manual withdrawal'));
                            await this.checkManualWithdrawal(stats);
                        }
                    }
                    else {
                        await this.checkManualWithdrawal(stats);
                    }
                }
                // Check if gas balance is too high (pause auto-funding temporarily)
                if (stats.currentGasBalance > this.config.maxGasReserve) {
                    console.log(chalk_1.default.blue('🔼 Gas balance above maximum - auto-funding is sufficient'));
                }
            }
            catch (error) {
                console.error(chalk_1.default.red('❌ Error in monitoring loop:'), error);
            }
            // Schedule next check
            if (this.isRunning) {
                setTimeout(monitoringLoop, this.config.monitoringInterval * 60 * 1000);
            }
        };
        // Start monitoring
        monitoringLoop();
    }
    logGasFundingStatus(stats) {
        console.log(chalk_1.default.blue('\n📊 GAS FUNDING STATUS'));
        console.log(chalk_1.default.blue('═══════════════════════'));
        console.log(chalk_1.default.cyan(`💰 Gas Wallet: ${stats.wallet}`));
        console.log(chalk_1.default.cyan(`📈 Funding Rate: ${stats.percentage}%`));
        console.log(chalk_1.default.cyan(`💎 Total Transferred: ${ethers_1.ethers.formatEther(stats.totalTransferred)} ETH equiv`));
        console.log(chalk_1.default.cyan(`⛽ Current Gas Balance: ${ethers_1.ethers.formatEther(stats.currentGasBalance)} ETH`));
        const targetStatus = stats.currentGasBalance >= this.config.targetGasReserve ? '✅' : '⚠️';
        console.log(chalk_1.default.cyan(`🎯 Target Status: ${targetStatus} (${ethers_1.ethers.formatEther(this.config.targetGasReserve)} ETH target)`));
        console.log(chalk_1.default.blue('\n💼 Contract Profit Balances:'));
        for (const [token, balance] of Object.entries(stats.contractProfits)) {
            if (balance > 0n) {
                const formatted = token === 'WETH'
                    ? ethers_1.ethers.formatEther(balance)
                    : ethers_1.ethers.formatUnits(balance, token === 'USDC' ? 6 : 18);
                console.log(chalk_1.default.green(`   ${token}: ${formatted}`));
            }
        }
        console.log('');
    }
    async checkManualWithdrawal(stats) {
        // Check if there are significant profits to withdraw manually
        let hasSignificantProfits = false;
        for (const [token, balance] of Object.entries(stats.contractProfits)) {
            const threshold = token === 'WETH'
                ? ethers_1.ethers.parseEther('0.005') // 0.005 ETH threshold
                : token === 'USDC'
                    ? 5000000n // 5 USDC (6 decimals)
                    : ethers_1.ethers.parseEther('5'); // 5 tokens default
            if (balance > threshold) {
                hasSignificantProfits = true;
                console.log(chalk_1.default.yellow(`💡 Manual withdrawal opportunity: ${token} balance above threshold`));
            }
        }
        if (hasSignificantProfits) {
            console.log(chalk_1.default.yellow('🔔 Consider manual profit withdrawal to increase gas funding'));
            console.log(chalk_1.default.cyan('   Command: npm run withdraw-profits'));
        }
    }
    async emergencyDisableGasFunding() {
        try {
            console.log(chalk_1.default.red('🚨 Emergency: Disabling gas funding...'));
            const disableTx = await this.contract.setGasFundingPercentage(0);
            await disableTx.wait();
            console.log(chalk_1.default.green('✅ Gas funding disabled successfully'));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error disabling gas funding:'), error);
        }
    }
    async adjustFundingPercentage(newPercentage) {
        try {
            console.log(chalk_1.default.yellow(`🔧 Adjusting funding percentage to ${newPercentage}%...`));
            const percentageBps = newPercentage * 100; // Convert to basis points
            const adjustTx = await this.contract.setGasFundingPercentage(percentageBps);
            await adjustTx.wait();
            this.config.fundingPercentage = newPercentage;
            console.log(chalk_1.default.green(`✅ Funding percentage updated to ${newPercentage}%`));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error adjusting funding percentage:'), error);
        }
    }
    stopMonitoring() {
        this.isRunning = false;
        if (this.crossChainManager) {
            this.crossChainManager.stopMonitoring();
        }
        console.log(chalk_1.default.yellow('⏹️ Gas funding monitor stopped'));
    }
    async getCrossChainStatus() {
        if (this.crossChainManager) {
            await this.crossChainManager.getStatus();
        }
        else {
            console.log(chalk_1.default.yellow('⚠️ Cross-chain manager not available'));
        }
    }
    async emergencyCrossChainFunding() {
        if (this.crossChainManager) {
            console.log(chalk_1.default.red('🚨 Triggering emergency cross-chain funding...'));
            await this.crossChainManager.emergencyFundAll();
        }
        else {
            console.log(chalk_1.default.red('❌ Cross-chain manager not available for emergency funding'));
        }
    }
}
exports.GasFundingManager = GasFundingManager;
// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const manager = new GasFundingManager();
    if (!process.env.BOT_CONTRACT_ADDRESS) {
        console.error(chalk_1.default.red('❌ BOT_CONTRACT_ADDRESS not set in environment'));
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
                    console.error(chalk_1.default.red('❌ Invalid percentage. Must be 0-50'));
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
                console.log(chalk_1.default.blue('Gas Funding Manager Commands:'));
                console.log(chalk_1.default.cyan('  setup                - Configure gas funding (run once)'));
                console.log(chalk_1.default.cyan('  monitor              - Start continuous monitoring'));
                console.log(chalk_1.default.cyan('  status               - Show current status'));
                console.log(chalk_1.default.cyan('  cross-chain-status   - Show cross-chain gas status'));
                console.log(chalk_1.default.cyan('  adjust X             - Set funding percentage to X%'));
                console.log(chalk_1.default.cyan('  disable              - Emergency disable gas funding'));
                console.log(chalk_1.default.cyan('  emergency-cross-chain - Emergency fund all chains'));
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
exports.default = GasFundingManager;
