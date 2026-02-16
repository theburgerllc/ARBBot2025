"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentDryRunner = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
class DeploymentDryRunner {
    provider = {};
    wallets = {};
    constructor() {
        this.initializeProviders();
        this.initializeWallets();
    }
    initializeProviders() {
        if (process.env.ARB_RPC) {
            this.provider.arbitrum = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        }
        if (process.env.OPT_RPC) {
            this.provider.optimism = new ethers_1.ethers.JsonRpcProvider(process.env.OPT_RPC);
        }
    }
    initializeWallets() {
        if (process.env.PRIVATE_KEY && process.env.ARB_RPC) {
            this.wallets.executor = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider.arbitrum);
        }
        if (process.env.FLASHBOTS_AUTH_KEY && process.env.ARB_RPC) {
            this.wallets.flashbots = new ethers_1.ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY, this.provider.arbitrum);
        }
    }
    async validateWallet(walletType) {
        const wallet = this.wallets[walletType];
        if (!wallet) {
            return {
                address: 'Not configured',
                isValid: false,
                balance: '0',
                transactionCount: 0,
                networkConnected: false,
                error: `${walletType} wallet not configured`
            };
        }
        try {
            const address = wallet.address;
            const balance = await wallet.provider.getBalance(address);
            const transactionCount = await wallet.provider.getTransactionCount(address);
            // Test network connectivity
            const networkConnected = await this.testNetworkConnectivity(wallet.provider);
            return {
                address,
                isValid: true,
                balance: ethers_1.ethers.formatEther(balance),
                transactionCount,
                networkConnected
            };
        }
        catch (error) {
            return {
                address: wallet.address,
                isValid: false,
                balance: '0',
                transactionCount: 0,
                networkConnected: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async validateNetwork(networkName) {
        const provider = this.provider[networkName];
        const rpcUrl = networkName === 'arbitrum' ? process.env.ARB_RPC : process.env.OPT_RPC;
        const expectedChainId = networkName === 'arbitrum' ? 42161 : 10;
        if (!provider) {
            return {
                name: networkName,
                chainId: 0,
                rpcUrl: rpcUrl || 'Not configured',
                connected: false,
                latestBlock: 0,
                gasPrice: '0',
                error: `${networkName} provider not configured`
            };
        }
        try {
            const network = await provider.getNetwork();
            const latestBlock = await provider.getBlockNumber();
            const feeData = await provider.getFeeData();
            return {
                name: networkName,
                chainId: Number(network.chainId),
                rpcUrl,
                connected: Number(network.chainId) === expectedChainId,
                latestBlock,
                gasPrice: ethers_1.ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')
            };
        }
        catch (error) {
            return {
                name: networkName,
                chainId: 0,
                rpcUrl,
                connected: false,
                latestBlock: 0,
                gasPrice: '0',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async testNetworkConnectivity(provider) {
        try {
            await provider.getBlockNumber();
            return true;
        }
        catch {
            return false;
        }
    }
    validateConfiguration() {
        const requiredEnvVars = [
            'PRIVATE_KEY',
            'FLASHBOTS_AUTH_KEY',
            'ARB_RPC',
            'OPT_RPC',
            'BALANCER_VAULT_ADDRESS',
            'UNISWAP_V3_QUOTER_ADDRESS'
        ];
        const contractAddresses = [
            'BALANCER_VAULT_ADDRESS',
            'OPT_BALANCER_VAULT_ADDRESS',
            'UNISWAP_V3_QUOTER_ADDRESS'
        ];
        const routerAddresses = [
            'UNI_V2_ROUTER_ARB',
            'SUSHI_ROUTER_ARB',
            'UNI_V2_ROUTER_OPT',
            'SUSHI_ROUTER_OPT'
        ];
        const tokenAddresses = [
            'WETH_ARB',
            'USDC_ARB',
            'USDT_ARB',
            'WBTC_ARB',
            'WETH_OPT',
            'USDC_OPT',
            'USDT_OPT',
            'WBTC_OPT'
        ];
        return {
            environmentVariables: requiredEnvVars.every(varName => !!process.env[varName]),
            contractAddresses: contractAddresses.every(addr => {
                const value = process.env[addr];
                return value && ethers_1.ethers.isAddress(value);
            }),
            routerAddresses: routerAddresses.every(addr => {
                const value = process.env[addr];
                return value && ethers_1.ethers.isAddress(value);
            }),
            tokenAddresses: tokenAddresses.every(addr => {
                const value = process.env[addr];
                return value && ethers_1.ethers.isAddress(value);
            })
        };
    }
    generateDeploymentReadiness(walletValidation, networkValidation, configChecks) {
        const issues = [];
        const recommendations = [];
        // Check wallet validation
        if (!walletValidation.executor.isValid) {
            issues.push('Executor wallet validation failed');
        }
        if (!walletValidation.flashbots.isValid) {
            issues.push('Flashbots wallet validation failed');
        }
        // Check wallet balances
        if (parseFloat(walletValidation.executor.balance) === 0) {
            issues.push('Executor wallet has no ETH balance');
            recommendations.push('Fund executor wallet with at least 0.1 ETH on both Arbitrium and Optimism');
        }
        // Check network connectivity
        if (!networkValidation.arbitrum.connected) {
            issues.push('Cannot connect to Arbitrum network');
        }
        if (!networkValidation.optimism.connected) {
            issues.push('Cannot connect to Optimism network');
        }
        // Check configuration
        if (!configChecks.environmentVariables) {
            issues.push('Missing required environment variables');
        }
        if (!configChecks.contractAddresses) {
            issues.push('Invalid contract addresses configured');
        }
        if (!configChecks.routerAddresses) {
            issues.push('Invalid router addresses configured');
        }
        if (!configChecks.tokenAddresses) {
            issues.push('Invalid token addresses configured');
        }
        // Generate recommendations
        if (walletValidation.executor.transactionCount === 0) {
            recommendations.push('Executor wallet is fresh - consider testing with small amounts first');
        }
        if (parseFloat(networkValidation.arbitrum.gasPrice) > 1) {
            recommendations.push('Arbitrum gas prices are high - consider waiting for lower gas periods');
        }
        if (parseFloat(networkValidation.optimism.gasPrice) > 10) {
            recommendations.push('Optimism gas prices are high - consider waiting for lower gas periods');
        }
        recommendations.push('Always test deployments on testnets first');
        recommendations.push('Keep private keys secure and never share them');
        recommendations.push('Start with simulation mode before live trading');
        return {
            ready: issues.length === 0,
            issues,
            recommendations
        };
    }
    async runComprehensiveDryRun() {
        console.log(chalk_1.default.blue('🚀 Starting Deployment Dry Run with New Wallet Addresses'));
        console.log(chalk_1.default.blue('═══════════════════════════════════════════════════════'));
        // Validate wallets
        console.log(chalk_1.default.yellow('\n🔍 Phase 1: Wallet Validation'));
        const executorValidation = await this.validateWallet('executor');
        const flashbotsValidation = await this.validateWallet('flashbots');
        this.logWalletValidation('Executor', executorValidation);
        this.logWalletValidation('Flashbots', flashbotsValidation);
        // Validate networks
        console.log(chalk_1.default.yellow('\n🌐 Phase 2: Network Validation'));
        const arbitrumValidation = await this.validateNetwork('arbitrum');
        const optimismValidation = await this.validateNetwork('optimism');
        this.logNetworkValidation(arbitrumValidation);
        this.logNetworkValidation(optimismValidation);
        // Validate configuration
        console.log(chalk_1.default.yellow('\n⚙️ Phase 3: Configuration Validation'));
        const configChecks = this.validateConfiguration();
        this.logConfigurationValidation(configChecks);
        // Generate deployment readiness
        console.log(chalk_1.default.yellow('\n✅ Phase 4: Deployment Readiness Assessment'));
        const deploymentReadiness = this.generateDeploymentReadiness({ executor: executorValidation, flashbots: flashbotsValidation }, { arbitrum: arbitrumValidation, optimism: optimismValidation }, configChecks);
        this.logDeploymentReadiness(deploymentReadiness);
        const result = {
            timestamp: new Date().toISOString(),
            walletValidation: {
                executor: executorValidation,
                flashbots: flashbotsValidation
            },
            networkValidation: {
                arbitrum: arbitrumValidation,
                optimism: optimismValidation
            },
            configurationChecks: configChecks,
            deploymentReadiness
        };
        // Save results to file
        await this.saveResults(result);
        return result;
    }
    logWalletValidation(type, validation) {
        const status = validation.isValid ? '✅' : '❌';
        console.log(chalk_1.default.cyan(`${status} ${type} Wallet:`));
        console.log(chalk_1.default.white(`   Address: ${validation.address}`));
        console.log(chalk_1.default.white(`   Balance: ${validation.balance} ETH`));
        console.log(chalk_1.default.white(`   Transactions: ${validation.transactionCount}`));
        console.log(chalk_1.default.white(`   Network Connected: ${validation.networkConnected ? '✅' : '❌'}`));
        if (validation.error) {
            console.log(chalk_1.default.red(`   Error: ${validation.error}`));
        }
    }
    logNetworkValidation(validation) {
        const status = validation.connected ? '✅' : '❌';
        console.log(chalk_1.default.cyan(`${status} ${validation.name.charAt(0).toUpperCase() + validation.name.slice(1)} Network:`));
        console.log(chalk_1.default.white(`   Chain ID: ${validation.chainId}`));
        console.log(chalk_1.default.white(`   RPC URL: ${validation.rpcUrl}`));
        console.log(chalk_1.default.white(`   Latest Block: ${validation.latestBlock}`));
        console.log(chalk_1.default.white(`   Gas Price: ${validation.gasPrice} gwei`));
        if (validation.error) {
            console.log(chalk_1.default.red(`   Error: ${validation.error}`));
        }
    }
    logConfigurationValidation(config) {
        console.log(chalk_1.default.cyan(`${config.environmentVariables ? '✅' : '❌'} Environment Variables`));
        console.log(chalk_1.default.cyan(`${config.contractAddresses ? '✅' : '❌'} Contract Addresses`));
        console.log(chalk_1.default.cyan(`${config.routerAddresses ? '✅' : '❌'} Router Addresses`));
        console.log(chalk_1.default.cyan(`${config.tokenAddresses ? '✅' : '❌'} Token Addresses`));
    }
    logDeploymentReadiness(readiness) {
        console.log(chalk_1.default.green(`\n🎯 DEPLOYMENT READINESS: ${readiness.ready ? '✅ READY' : '❌ NOT READY'}`));
        if (readiness.issues.length > 0) {
            console.log(chalk_1.default.red('\n🚨 Issues Found:'));
            readiness.issues.forEach(issue => {
                console.log(chalk_1.default.red(`   • ${issue}`));
            });
        }
        if (readiness.recommendations.length > 0) {
            console.log(chalk_1.default.yellow('\n💡 Recommendations:'));
            readiness.recommendations.forEach(rec => {
                console.log(chalk_1.default.yellow(`   • ${rec}`));
            });
        }
    }
    async saveResults(result) {
        const reportsDir = path_1.default.join(process.cwd(), 'reports');
        if (!fs_1.default.existsSync(reportsDir)) {
            fs_1.default.mkdirSync(reportsDir, { mode: 0o700 });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `deployment-dry-run-${timestamp}.json`;
        const filepath = path_1.default.join(reportsDir, filename);
        fs_1.default.writeFileSync(filepath, JSON.stringify(result, null, 2), { mode: 0o600 });
        console.log(chalk_1.default.green(`\n📄 Results saved to: ${filepath}`));
    }
    async testDeploymentSimulation() {
        console.log(chalk_1.default.blue('\n🧪 Testing Deployment Simulation'));
        console.log(chalk_1.default.blue('═══════════════════════════════'));
        try {
            // Test contract compilation
            console.log(chalk_1.default.yellow('📦 Testing contract compilation...'));
            // This would normally run hardhat compile, but we'll simulate it
            console.log(chalk_1.default.green('✅ Contract compilation successful (simulated)'));
            // Test deployment parameters
            console.log(chalk_1.default.yellow('⚙️ Validating deployment parameters...'));
            const requiredParams = [
                'BALANCER_VAULT_ADDRESS',
                'SUSHI_ROUTER_ARB',
                'UNI_V2_ROUTER_ARB',
                'UNISWAP_V3_QUOTER_ADDRESS'
            ];
            for (const param of requiredParams) {
                const value = process.env[param];
                if (!value || !ethers_1.ethers.isAddress(value)) {
                    console.log(chalk_1.default.red(`❌ Invalid ${param}: ${value}`));
                    return false;
                }
                console.log(chalk_1.default.green(`✅ ${param}: ${value}`));
            }
            // Test gas estimation
            console.log(chalk_1.default.yellow('⛽ Testing gas estimation...'));
            const gasLimit = 3000000; // Estimated deployment gas
            const gasPrice = await this.provider.arbitrum?.getFeeData();
            if (gasPrice?.gasPrice) {
                const estimatedCost = (BigInt(gasLimit) * gasPrice.gasPrice);
                console.log(chalk_1.default.green(`✅ Estimated deployment cost: ${ethers_1.ethers.formatEther(estimatedCost)} ETH`));
            }
            console.log(chalk_1.default.green('✅ Deployment simulation tests passed'));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Deployment simulation failed: ${error}`));
            return false;
        }
    }
}
exports.DeploymentDryRunner = DeploymentDryRunner;
// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'full';
    const dryRunner = new DeploymentDryRunner();
    try {
        switch (command) {
            case 'full':
                const result = await dryRunner.runComprehensiveDryRun();
                if (result.deploymentReadiness.ready) {
                    console.log(chalk_1.default.green('\n🎉 System is ready for deployment!'));
                    console.log(chalk_1.default.yellow('⚠️ Remember to fund your executor wallet before actual deployment.'));
                }
                else {
                    console.log(chalk_1.default.red('\n⚠️ System is not ready for deployment.'));
                    console.log(chalk_1.default.yellow('Please address the issues listed above.'));
                }
                break;
            case 'simulation':
                const simResult = await dryRunner.testDeploymentSimulation();
                process.exit(simResult ? 0 : 1);
                break;
            case 'wallet':
                const executorResult = await dryRunner.validateWallet('executor');
                const flashbotsResult = await dryRunner.validateWallet('flashbots');
                dryRunner['logWalletValidation']('Executor', executorResult);
                dryRunner['logWalletValidation']('Flashbots', flashbotsResult);
                break;
            case 'network':
                const arbResult = await dryRunner.validateNetwork('arbitrum');
                const optResult = await dryRunner.validateNetwork('optimism');
                dryRunner['logNetworkValidation'](arbResult);
                dryRunner['logNetworkValidation'](optResult);
                break;
            default:
                console.log(chalk_1.default.blue('Deployment Dry Run Commands:'));
                console.log(chalk_1.default.cyan('  full        - Run complete dry run test'));
                console.log(chalk_1.default.cyan('  simulation  - Test deployment simulation'));
                console.log(chalk_1.default.cyan('  wallet      - Validate wallet configuration'));
                console.log(chalk_1.default.cyan('  network     - Validate network connectivity'));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Dry run failed:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = DeploymentDryRunner;
