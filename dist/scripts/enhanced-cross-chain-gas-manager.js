"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedCrossChainGasManager = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
dotenv_1.default.config();
class EnhancedCrossChainGasManager {
    mainnetProvider;
    executorWallet;
    providers = {};
    isRunning = false;
    CHAIN_CONFIGS = {
        mainnet: {
            name: 'Ethereum Mainnet',
            chainId: 1,
            rpcUrl: process.env.MAINNET_RPC || 'https://eth.llamarpc.com',
            minGasThreshold: ethers_1.ethers.parseEther('0.05'), // 0.05 ETH minimum
            targetGasBalance: ethers_1.ethers.parseEther('0.2'), // 0.2 ETH target
            maxGasBalance: ethers_1.ethers.parseEther('1.0') // 1.0 ETH maximum
        },
        arbitrum: {
            name: 'Arbitrum One',
            chainId: 42161,
            rpcUrl: process.env.ARB_RPC,
            bridgeAddress: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a', // Arbitrum Inbox
            minGasThreshold: ethers_1.ethers.parseEther('0.01'), // 0.01 ETH minimum
            targetGasBalance: ethers_1.ethers.parseEther('0.05'), // 0.05 ETH target
            maxGasBalance: ethers_1.ethers.parseEther('0.2') // 0.2 ETH maximum
        },
        optimism: {
            name: 'Optimism',
            chainId: 10,
            rpcUrl: process.env.OPT_RPC,
            bridgeAddress: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // Optimism Portal
            minGasThreshold: ethers_1.ethers.parseEther('0.01'), // 0.01 ETH minimum
            targetGasBalance: ethers_1.ethers.parseEther('0.05'), // 0.05 ETH target
            maxGasBalance: ethers_1.ethers.parseEther('0.2') // 0.2 ETH maximum
        }
    };
    config = {
        monitoringInterval: 5 * 60 * 1000, // 5 minutes
        bridgeTimeout: 30 * 60 * 1000, // 30 minutes
        maxBridgeAttempts: 3,
        emergencyThreshold: ethers_1.ethers.parseEther('0.005'), // 0.005 ETH emergency threshold
        bridgeFeeBuffer: ethers_1.ethers.parseEther('0.01') // 0.01 ETH buffer for bridge fees
    };
    constructor() {
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }
        // Initialize mainnet provider and wallet
        this.mainnetProvider = new ethers_1.ethers.JsonRpcProvider(this.CHAIN_CONFIGS.mainnet.rpcUrl);
        this.executorWallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.mainnetProvider);
        // Initialize providers for all chains
        for (const [chainName, config] of Object.entries(this.CHAIN_CONFIGS)) {
            this.providers[chainName] = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
        }
    }
    async initialize() {
        console.log(chalk_1.default.blue('🚀 Enhanced Cross-Chain Gas Manager v2.0'));
        console.log(chalk_1.default.cyan(`👤 Executor Wallet: ${this.executorWallet.address}`));
        console.log(chalk_1.default.cyan(`⏱️ Monitor Interval: ${this.config.monitoringInterval / 1000 / 60} minutes`));
        // Verify wallet address across all chains
        console.log(chalk_1.default.yellow('\n🔍 Verifying wallet address across chains...'));
        for (const [chainName, config] of Object.entries(this.CHAIN_CONFIGS)) {
            try {
                const balance = await this.providers[chainName].getBalance(this.executorWallet.address);
                console.log(chalk_1.default.green(`✅ ${config.name}: ${ethers_1.ethers.formatEther(balance)} ETH`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ ${config.name}: Connection failed`));
                throw new Error(`Failed to connect to ${config.name}`);
            }
        }
        console.log(chalk_1.default.green('\n✅ Enhanced Cross-Chain Gas Manager initialized successfully'));
    }
    async getAllGasBalances() {
        const balances = [];
        for (const [chainName, config] of Object.entries(this.CHAIN_CONFIGS)) {
            try {
                const balance = await this.providers[chainName].getBalance(this.executorWallet.address);
                let status = 'sufficient';
                let needsFunding = false;
                let fundingAmount;
                if (balance < config.minGasThreshold) {
                    status = balance < this.config.emergencyThreshold ? 'critical' : 'low';
                    needsFunding = true;
                    fundingAmount = config.targetGasBalance - balance;
                }
                else if (balance > config.maxGasBalance) {
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
            }
            catch (error) {
                console.error(chalk_1.default.red(`❌ Error getting balance for ${config.name}:`, error));
            }
        }
        return balances;
    }
    async executeAutomaticBridging(balances) {
        const operations = [];
        // Find chains that need funding
        const chainsNeedingFunding = balances.filter(b => b.needsFunding && b.chain !== 'mainnet');
        if (chainsNeedingFunding.length === 0) {
            console.log(chalk_1.default.green('✅ All chains have sufficient gas balances'));
            return operations;
        }
        // Check mainnet balance for funding source
        const mainnetBalance = balances.find(b => b.chain === 'mainnet');
        if (!mainnetBalance) {
            console.log(chalk_1.default.red('❌ Cannot get mainnet balance'));
            return operations;
        }
        console.log(chalk_1.default.yellow(`\n🔄 Found ${chainsNeedingFunding.length} chain(s) needing funding`));
        for (const chainStatus of chainsNeedingFunding) {
            if (chainStatus.fundingAmount && chainStatus.chain !== 'mainnet') {
                const operation = await this.bridgeFromMainnet(chainStatus.chain, chainStatus.fundingAmount, chainStatus.status === 'critical');
                if (operation) {
                    operations.push(operation);
                }
            }
        }
        return operations;
    }
    async bridgeFromMainnet(targetChain, amount, emergency = false) {
        const targetConfig = this.CHAIN_CONFIGS[targetChain];
        if (!targetConfig) {
            console.log(chalk_1.default.red(`❌ Unknown target chain: ${targetChain}`));
            return null;
        }
        console.log(chalk_1.default.blue(`\n🌉 ${emergency ? 'EMERGENCY ' : ''}Bridging to ${targetConfig.name}`));
        console.log(chalk_1.default.cyan(`💰 Amount: ${ethers_1.ethers.formatEther(amount)} ETH`));
        try {
            // Check mainnet balance
            const mainnetBalance = await this.mainnetProvider.getBalance(this.executorWallet.address);
            const totalNeeded = amount + this.config.bridgeFeeBuffer;
            if (mainnetBalance < totalNeeded) {
                console.log(chalk_1.default.red(`❌ Insufficient mainnet balance. Need: ${ethers_1.ethers.formatEther(totalNeeded)} ETH, Have: ${ethers_1.ethers.formatEther(mainnetBalance)} ETH`));
                return null;
            }
            // Create bridge operation based on target chain
            let bridgeResult;
            if (targetChain === 'arbitrum') {
                bridgeResult = await this.bridgeToArbitrum(amount);
            }
            else if (targetChain === 'optimism') {
                bridgeResult = await this.bridgeToOptimism(amount);
            }
            else {
                console.log(chalk_1.default.red(`❌ Bridging to ${targetChain} not yet implemented`));
                return null;
            }
            if (bridgeResult.success) {
                console.log(chalk_1.default.green(`✅ Bridge transaction successful: ${bridgeResult.txHash}`));
                console.log(chalk_1.default.cyan(`⏱️ Estimated completion: ${bridgeResult.estimatedTime}`));
                // Start monitoring bridge completion
                this.monitorBridgeCompletion(bridgeResult);
            }
            return bridgeResult;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Bridge to ${targetConfig.name} failed:`), error);
            return null;
        }
    }
    async bridgeToArbitrum(amount) {
        const operation = {
            fromChain: 'mainnet',
            toChain: 'arbitrum',
            amount,
            estimatedFee: ethers_1.ethers.parseEther('0.005'),
            estimatedTime: '10-15 minutes'
        };
        try {
            // Use Arbitrum's official bridge contract
            const arbitrumInbox = this.CHAIN_CONFIGS.arbitrum.bridgeAddress;
            console.log(chalk_1.default.blue('📤 Submitting Arbitrum bridge transaction...'));
            // Simple ETH deposit to Arbitrum Inbox
            const tx = await this.executorWallet.sendTransaction({
                to: arbitrumInbox,
                value: amount,
                gasLimit: 200000,
                gasPrice: await this.mainnetProvider.getFeeData().then(fee => fee.gasPrice || ethers_1.ethers.parseUnits('20', 'gwei'))
            });
            await tx.wait();
            operation.success = true;
            operation.txHash = tx.hash;
            return operation;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Arbitrum bridge failed:'), error);
            operation.success = false;
            return operation;
        }
    }
    async bridgeToOptimism(amount) {
        const operation = {
            fromChain: 'mainnet',
            toChain: 'optimism',
            amount,
            estimatedFee: ethers_1.ethers.parseEther('0.005'),
            estimatedTime: '10-15 minutes'
        };
        try {
            // Use Optimism's official bridge contract
            const optimismPortal = this.CHAIN_CONFIGS.optimism.bridgeAddress;
            console.log(chalk_1.default.blue('📤 Submitting Optimism bridge transaction...'));
            // Create bridge transaction data for Optimism Portal
            const bridgeData = '0x'; // Empty data for simple ETH deposit
            const tx = await this.executorWallet.sendTransaction({
                to: optimismPortal,
                value: amount,
                data: bridgeData,
                gasLimit: 150000,
                gasPrice: await this.mainnetProvider.getFeeData().then(fee => fee.gasPrice || ethers_1.ethers.parseUnits('20', 'gwei'))
            });
            await tx.wait();
            operation.success = true;
            operation.txHash = tx.hash;
            return operation;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Optimism bridge failed:'), error);
            operation.success = false;
            return operation;
        }
    }
    async monitorBridgeCompletion(operation) {
        if (!operation.txHash)
            return;
        console.log(chalk_1.default.blue(`\n⏳ Monitoring bridge completion for ${operation.toChain}...`));
        const targetProvider = this.providers[operation.toChain];
        const initialBalance = await targetProvider.getBalance(this.executorWallet.address);
        const startTime = Date.now();
        const checkInterval = 30000; // 30 seconds
        const monitor = async () => {
            const currentBalance = await targetProvider.getBalance(this.executorWallet.address);
            if (currentBalance > initialBalance) {
                const received = currentBalance - initialBalance;
                console.log(chalk_1.default.green(`✅ Bridge completed! Received ${ethers_1.ethers.formatEther(received)} ETH on ${operation.toChain}`));
                return;
            }
            const elapsed = Date.now() - startTime;
            if (elapsed > this.config.bridgeTimeout) {
                console.log(chalk_1.default.yellow(`⏰ Bridge monitoring timeout for ${operation.toChain}. Please check manually.`));
                return;
            }
            const minutes = Math.floor(elapsed / 60000);
            console.log(chalk_1.default.gray(`⏳ Bridge pending... (${minutes} minutes elapsed)`));
            setTimeout(monitor, checkInterval);
        };
        setTimeout(monitor, checkInterval);
    }
    async startAutomaticMonitoring() {
        if (this.isRunning) {
            console.log(chalk_1.default.yellow('⚠️ Automatic monitoring already running'));
            return;
        }
        this.isRunning = true;
        console.log(chalk_1.default.blue('\n🚀 Starting automatic cross-chain gas monitoring...'));
        console.log(chalk_1.default.cyan(`⏱️ Check interval: ${this.config.monitoringInterval / 1000 / 60} minutes`));
        const monitoringLoop = async () => {
            try {
                console.log(chalk_1.default.blue('\n📊 Checking gas balances across all chains...'));
                const balances = await this.getAllGasBalances();
                this.logGasStatus(balances);
                // Execute automatic bridging if needed
                const operations = await this.executeAutomaticBridging(balances);
                if (operations.length > 0) {
                    console.log(chalk_1.default.green(`✅ Executed ${operations.length} bridge operation(s)`));
                }
            }
            catch (error) {
                console.error(chalk_1.default.red('❌ Error in monitoring loop:'), error);
            }
            // Schedule next check
            if (this.isRunning) {
                const nextCheck = new Date(Date.now() + this.config.monitoringInterval);
                console.log(chalk_1.default.gray(`⏰ Next check: ${nextCheck.toLocaleTimeString()}`));
                setTimeout(monitoringLoop, this.config.monitoringInterval);
            }
        };
        // Start monitoring
        monitoringLoop();
    }
    logGasStatus(balances) {
        console.log(chalk_1.default.blue('\n💰 CROSS-CHAIN GAS STATUS'));
        console.log(chalk_1.default.blue('═══════════════════════════'));
        for (const balance of balances) {
            const config = this.CHAIN_CONFIGS[balance.chain];
            const color = balance.status === 'sufficient' ? chalk_1.default.green :
                balance.status === 'low' ? chalk_1.default.yellow :
                    balance.status === 'critical' ? chalk_1.default.red : chalk_1.default.cyan;
            const statusIcon = balance.status === 'sufficient' ? '✅' :
                balance.status === 'low' ? '⚠️' :
                    balance.status === 'critical' ? '🚨' : '📈';
            console.log(color(`${statusIcon} ${config.name}: ${ethers_1.ethers.formatEther(balance.balance)} ETH (${balance.status})`));
            if (balance.needsFunding && balance.fundingAmount) {
                console.log(chalk_1.default.yellow(`   → Needs ${ethers_1.ethers.formatEther(balance.fundingAmount)} ETH`));
            }
        }
        console.log('');
    }
    async emergencyFundAll() {
        console.log(chalk_1.default.red('\n🚨 EMERGENCY FUNDING ALL CHAINS'));
        const balances = await this.getAllGasBalances();
        const operations = [];
        for (const balance of balances) {
            if (balance.chain !== 'mainnet' && balance.balance < this.CHAIN_CONFIGS[balance.chain].targetGasBalance) {
                const fundingAmount = this.CHAIN_CONFIGS[balance.chain].targetGasBalance - balance.balance;
                const operation = await this.bridgeFromMainnet(balance.chain, fundingAmount, true);
                if (operation) {
                    operations.push(operation);
                }
            }
        }
        console.log(chalk_1.default.green(`✅ Emergency funding initiated for ${operations.length} chain(s)`));
    }
    stopMonitoring() {
        this.isRunning = false;
        console.log(chalk_1.default.yellow('⏹️ Cross-chain gas monitoring stopped'));
    }
    async getStatus() {
        const balances = await this.getAllGasBalances();
        this.logGasStatus(balances);
    }
}
exports.EnhancedCrossChainGasManager = EnhancedCrossChainGasManager;
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
                console.log(chalk_1.default.blue('Enhanced Cross-Chain Gas Manager Commands:'));
                console.log(chalk_1.default.cyan('  start     - Start automatic monitoring and bridging'));
                console.log(chalk_1.default.cyan('  status    - Show current gas status across all chains'));
                console.log(chalk_1.default.cyan('  emergency - Emergency fund all chains to target levels'));
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
exports.default = EnhancedCrossChainGasManager;
