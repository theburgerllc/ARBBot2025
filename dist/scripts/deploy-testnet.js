#!/usr/bin/env ts-node
"use strict";
/**
 * Enhanced Testnet Deployment Script - ARBBot2025
 *
 * Comprehensive deployment with:
 * - Automated testnet environment setup
 * - Balance validation and auto-funding
 * - Smart contract deployment with verification
 * - Post-deployment testing and validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestnetDeployer = void 0;
const hardhat_1 = __importDefault(require("hardhat"));
const dotenv_1 = require("dotenv");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const testnet_automation_1 = require("./testnet-automation");
const rpc_harvester_1 = require("./rpc-harvester");
(0, dotenv_1.config)();
class TestnetDeployer {
    testnetConfigs = new Map();
    constructor() {
        this.initializeConfigs();
    }
    initializeConfigs() {
        // Arbitrum Sepolia Configuration
        this.testnetConfigs.set('arbitrum-sepolia', {
            network: 'arbitrum-sepolia',
            chainId: 421614,
            rpcUrl: process.env.ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
            explorerUrl: 'https://sepolia.arbiscan.io',
            privateKey: process.env.PRIVATE_KEY,
            uniV2Router: '0x4648a43B2C14Da09FdAb83dd5aB3120E74D4d39b', // Arbitrum Sepolia Uniswap V2
            sushiRouter: '0x4648a43B2C14Da09FdAb83dd5aB3120E74D4d39b', // Fallback to same
            balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Same on all networks
            aavePool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951', // Aave V3 Arbitrum Sepolia
            requiredBalance: '0.05',
            gasSettings: {
                gasLimit: 3000000,
                maxFeePerGas: '0.1', // gwei
                maxPriorityFeePerGas: '0.01' // gwei
            }
        });
        // Ethereum Sepolia Configuration
        this.testnetConfigs.set('ethereum-sepolia', {
            network: 'ethereum-sepolia',
            chainId: 11155111,
            rpcUrl: process.env.ETH_SEPOLIA_RPC || 'https://rpc.sepolia.org',
            explorerUrl: 'https://sepolia.etherscan.io',
            privateKey: process.env.PRIVATE_KEY,
            uniV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
            sushiRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap Router
            balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            aavePool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951', // Aave V3 Sepolia
            requiredBalance: '0.1',
            gasSettings: {
                gasLimit: 3000000,
                maxFeePerGas: '20', // gwei
                maxPriorityFeePerGas: '2' // gwei
            }
        });
        // Optimism Sepolia Configuration  
        this.testnetConfigs.set('optimism-sepolia', {
            network: 'optimism-sepolia',
            chainId: 11155420,
            rpcUrl: process.env.OPT_SEPOLIA_RPC || 'https://sepolia.optimism.io',
            explorerUrl: 'https://sepolia-optimistic.etherscan.io',
            privateKey: process.env.PRIVATE_KEY,
            uniV2Router: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2', // Optimism Sepolia
            sushiRouter: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2', // Fallback
            balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            requiredBalance: '0.05',
            gasSettings: {
                gasLimit: 3000000,
                maxFeePerGas: '0.001', // gwei
                maxPriorityFeePerGas: '0.0001' // gwei
            }
        });
    }
    async validateEnvironment(networkName) {
        console.log(chalk_1.default.blue(`🔍 Validating environment for ${networkName}...`));
        const config = this.testnetConfigs.get(networkName);
        if (!config) {
            throw new Error(`Network ${networkName} not configured`);
        }
        // Validate private key
        if (!config.privateKey || !config.privateKey.startsWith("0x") || config.privateKey.length !== 66) {
            throw new Error("PRIVATE_KEY is missing or invalid format");
        }
        // Validate RPC URL
        if (!config.rpcUrl || !config.rpcUrl.startsWith("http")) {
            throw new Error(`${networkName.toUpperCase()}_RPC is missing or invalid format`);
        }
        // Test RPC connectivity
        try {
            const provider = new ethers_1.JsonRpcProvider(config.rpcUrl);
            const blockNumber = await provider.getBlockNumber();
            const network = await provider.getNetwork();
            if (Number(network.chainId) !== config.chainId) {
                throw new Error(`Chain ID mismatch: expected ${config.chainId}, got ${network.chainId}`);
            }
            console.log(chalk_1.default.green(`  ✅ RPC connected: Block ${blockNumber}, Chain ID ${network.chainId}`));
        }
        catch (error) {
            throw new Error(`RPC connection failed: ${error}`);
        }
        // Validate contract addresses
        if (!(0, ethers_1.isAddress)(config.uniV2Router)) {
            console.log(chalk_1.default.yellow(`  ⚠️ Uniswap V2 router address may be invalid: ${config.uniV2Router}`));
        }
        if (!(0, ethers_1.isAddress)(config.balancerVault)) {
            throw new Error(`Invalid Balancer Vault address: ${config.balancerVault}`);
        }
        console.log(chalk_1.default.green(`  ✅ Environment validation passed for ${networkName}`));
    }
    async checkAndEnsureBalance(networkName) {
        const config = this.testnetConfigs.get(networkName);
        const provider = new ethers_1.JsonRpcProvider(config.rpcUrl);
        const wallet = new ethers_1.Wallet(config.privateKey, provider);
        console.log(chalk_1.default.blue(`💰 Checking balance for deployment on ${networkName}...`));
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = (0, ethers_1.formatEther)(balance);
        const requiredBalanceWei = (0, ethers_1.parseEther)(config.requiredBalance);
        console.log(chalk_1.default.white(`  Current balance: ${balanceEth} ETH`));
        console.log(chalk_1.default.white(`  Required balance: ${config.requiredBalance} ETH`));
        if (balance < requiredBalanceWei) {
            console.log(chalk_1.default.red(`  ❌ Insufficient balance for deployment`));
            console.log(chalk_1.default.yellow(`  🚰 Attempting to request funds from testnet faucets...`));
            // Automatically request funds using our automation
            try {
                const automation = new testnet_automation_1.TestnetAutomation();
                await automation.initialize();
                const testnetConfig = {
                    name: networkName,
                    chainId: config.chainId,
                    rpcUrl: config.rpcUrl,
                    explorerUrl: config.explorerUrl,
                    faucetUrl: this.getFaucetUrl(networkName),
                    requiredBalance: config.requiredBalance,
                    priority: 1,
                    estimatedWaitTime: 5, // 5 minutes
                    amount: "0.1" // 0.1 ETH per request
                };
                const result = await automation.requestFaucetTokens(testnetConfig);
                await automation.cleanup();
                if (result.success) {
                    console.log(chalk_1.default.green(`  ✅ Faucet request submitted. Waiting for confirmation...`));
                    // Wait for funds to arrive
                    const maxWaitTime = result.waitTime || 300; // 5 minutes default
                    const checkInterval = 30; // 30 seconds
                    let waited = 0;
                    while (waited < maxWaitTime) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
                        waited += checkInterval;
                        const newBalance = await provider.getBalance(wallet.address);
                        if (newBalance >= requiredBalanceWei) {
                            console.log(chalk_1.default.green(`  ✅ Sufficient balance received: ${(0, ethers_1.formatEther)(newBalance)} ETH`));
                            return;
                        }
                        console.log(chalk_1.default.gray(`    ⏳ Waiting for funds... (${waited}/${maxWaitTime}s)`));
                    }
                    throw new Error(`Timeout waiting for faucet funds after ${maxWaitTime}s`);
                }
                else {
                    throw new Error(`Faucet request failed: ${result.error}`);
                }
            }
            catch (error) {
                console.log(chalk_1.default.red(`  ❌ Auto-funding failed: ${error}`));
                throw new Error(`Insufficient balance and auto-funding failed. Please manually request testnet ETH from faucets.`);
            }
        }
        else {
            console.log(chalk_1.default.green(`  ✅ Sufficient balance available for deployment`));
        }
    }
    getFaucetUrl(networkName) {
        const faucetUrls = {
            'arbitrum-sepolia': 'https://faucets.chain.link/arbitrum-sepolia',
            'ethereum-sepolia': 'https://sepolia-faucet.pk910.de',
            'optimism-sepolia': 'https://faucets.chain.link/optimism-sepolia'
        };
        return faucetUrls[networkName] || '';
    }
    async deployContract(networkName) {
        const config = this.testnetConfigs.get(networkName);
        console.log(chalk_1.default.blue(`🚀 Deploying FlashArbBotBalancer to ${networkName}...`));
        // Get deployer account
        const [deployer] = await hardhat_1.default.ethers.getSigners();
        const balance = await deployer.provider.getBalance(deployer.address);
        console.log(chalk_1.default.white(`  Deployer address: ${deployer.address}`));
        console.log(chalk_1.default.white(`  Deployer balance: ${(0, ethers_1.formatEther)(balance)} ETH`));
        console.log(chalk_1.default.white(`  Network: ${networkName} (Chain ID: ${config.chainId})`));
        // Get contract factory
        const FlashArbBotBalancer = await hardhat_1.default.ethers.getContractFactory("FlashArbBotBalancer");
        // Prepare deployment transaction with optimized gas settings
        const gasLimit = config.gasSettings.gasLimit;
        const maxFeePerGas = (0, ethers_1.parseUnits)(config.gasSettings.maxFeePerGas, 'gwei');
        const maxPriorityFeePerGas = (0, ethers_1.parseUnits)(config.gasSettings.maxPriorityFeePerGas, 'gwei');
        console.log(chalk_1.default.gray(`  Gas Limit: ${gasLimit.toLocaleString()}`));
        console.log(chalk_1.default.gray(`  Max Fee Per Gas: ${config.gasSettings.maxFeePerGas} gwei`));
        console.log(chalk_1.default.gray(`  Max Priority Fee: ${config.gasSettings.maxPriorityFeePerGas} gwei`));
        // Deploy contract
        const deploymentStart = Date.now();
        const flashArbBot = await FlashArbBotBalancer.deploy(config.uniV2Router, config.sushiRouter, config.balancerVault, {
            gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas
        });
        console.log(chalk_1.default.yellow(`  ⏳ Deployment transaction sent, waiting for confirmation...`));
        // Wait for deployment
        await flashArbBot.waitForDeployment();
        const contractAddress = await flashArbBot.getAddress();
        const deploymentTime = Date.now() - deploymentStart;
        console.log(chalk_1.default.green(`  ✅ Contract deployed in ${deploymentTime / 1000}s`));
        console.log(chalk_1.default.green(`  📍 Contract Address: ${contractAddress}`));
        // Get deployment transaction details
        const deployTx = flashArbBot.deploymentTransaction();
        if (!deployTx) {
            throw new Error('Deployment transaction not found');
        }
        const receipt = await deployTx.wait();
        if (!receipt) {
            throw new Error('Transaction receipt not found');
        }
        console.log(chalk_1.default.white(`  🧾 Transaction Hash: ${receipt.hash}`));
        console.log(chalk_1.default.white(`  ⛽ Gas Used: ${receipt.gasUsed.toLocaleString()}`));
        console.log(chalk_1.default.white(`  💰 Gas Price: ${(0, ethers_1.formatUnits)(receipt.gasPrice || 0, 'gwei')} gwei`));
        console.log(chalk_1.default.white(`  🏗️ Block Number: ${receipt.blockNumber}`));
        // Verify deployment
        const provider = deployer.provider;
        const code = await provider.getCode(contractAddress);
        if (code === "0x") {
            throw new Error("Contract deployment failed - no code at address");
        }
        console.log(chalk_1.default.green(`  ✅ Contract verified on-chain (${code.length} bytes)`));
        // Test basic contract functionality
        try {
            await flashArbBot.owner();
            console.log(chalk_1.default.green(`  ✅ Contract is responsive and functional`));
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`  ⚠️ Contract deployed but basic call failed: ${error}`));
        }
        return {
            contractAddress,
            deploymentBlock: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            gasPrice: (0, ethers_1.formatUnits)(receipt.gasPrice || 0, 'gwei'),
            transactionHash: receipt.hash,
            verified: true
        };
    }
    async postDeploymentValidation(networkName, result) {
        console.log(chalk_1.default.blue(`🔍 Running post-deployment validation for ${networkName}...`));
        const config = this.testnetConfigs.get(networkName);
        const provider = new ethers_1.JsonRpcProvider(config.rpcUrl);
        // Test 1: Contract code verification
        const code = await provider.getCode(result.contractAddress);
        console.log(chalk_1.default.white(`  📝 Contract code size: ${code.length - 2} hex chars`));
        // Test 2: Contract storage verification  
        try {
            const flashArbBot = await hardhat_1.default.ethers.getContractAt("FlashArbBotBalancer", result.contractAddress);
            const owner = await flashArbBot.owner();
            const [deployer] = await hardhat_1.default.ethers.getSigners();
            if (owner.toLowerCase() === deployer.address.toLowerCase()) {
                console.log(chalk_1.default.green(`  ✅ Contract ownership correctly set`));
            }
            else {
                console.log(chalk_1.default.red(`  ❌ Contract ownership mismatch`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`  ⚠️ Could not verify contract ownership: ${error}`));
        }
        // Test 3: Explorer verification
        const explorerUrl = `${config.explorerUrl}/address/${result.contractAddress}`;
        console.log(chalk_1.default.cyan(`  🔗 Explorer URL: ${explorerUrl}`));
        console.log(chalk_1.default.green(`  ✅ Post-deployment validation completed`));
    }
    async updateEnvironmentFile(networkName, result) {
        console.log(chalk_1.default.blue(`📝 Updating environment configuration...`));
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        try {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        catch {
            console.log(chalk_1.default.yellow('  ⚠️ .env file not found, creating new one'));
        }
        // Prepare environment updates
        const envKey = `${networkName.toUpperCase().replace('-', '_')}_BOT_CONTRACT_ADDRESS`;
        const updates = [
            '',
            `# ===== ${networkName.toUpperCase()} DEPLOYMENT =====`,
            `# Deployed: ${new Date().toISOString()}`,
            `export ${envKey}="${result.contractAddress}"`,
            `export ${envKey}_BLOCK="${result.deploymentBlock}"`,
            `export ${envKey}_TX="${result.transactionHash}"`,
            ''
        ];
        // Remove old deployment entries for this network and add new ones
        const lines = envContent.split('\n');
        const filteredLines = lines.filter(line => !line.includes(envKey) &&
            !line.includes(`===== ${networkName.toUpperCase()} DEPLOYMENT`));
        const updatedContent = filteredLines.join('\n') + '\n' + updates.join('\n');
        fs.writeFileSync(envPath, updatedContent);
        console.log(chalk_1.default.green(`  ✅ Environment updated with ${envKey}=${result.contractAddress}`));
    }
    async saveDeploymentReport(networkName, result) {
        const config = this.testnetConfigs.get(networkName);
        const report = {
            timestamp: new Date().toISOString(),
            network: networkName,
            chainId: config.chainId,
            contractAddress: result.contractAddress,
            deploymentBlock: result.deploymentBlock,
            transactionHash: result.transactionHash,
            gasUsed: result.gasUsed,
            gasPrice: result.gasPrice,
            explorerUrl: `${config.explorerUrl}/address/${result.contractAddress}`,
            rpcUrl: config.rpcUrl,
            verified: result.verified,
            deployerAddress: new ethers_1.Wallet(config.privateKey).address
        };
        const reportPath = path.join(process.cwd(), `deployment-${networkName}-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk_1.default.green(`📄 Deployment report saved: ${reportPath}`));
        // Print summary
        console.log(chalk_1.default.magenta('\n' + '='.repeat(60)));
        console.log(chalk_1.default.magenta(`🎉 DEPLOYMENT SUCCESSFUL: ${networkName.toUpperCase()}`));
        console.log(chalk_1.default.magenta('='.repeat(60)));
        console.log(chalk_1.default.cyan('\n📋 Deployment Summary:'));
        console.log(chalk_1.default.white(`  Network: ${networkName} (Chain ID: ${config.chainId})`));
        console.log(chalk_1.default.white(`  Contract: ${result.contractAddress}`));
        console.log(chalk_1.default.white(`  Block: ${result.deploymentBlock}`));
        console.log(chalk_1.default.white(`  Gas Used: ${parseInt(result.gasUsed).toLocaleString()}`));
        console.log(chalk_1.default.white(`  Gas Price: ${result.gasPrice} gwei`));
        console.log(chalk_1.default.white(`  Explorer: ${report.explorerUrl}`));
        console.log(chalk_1.default.magenta('\n' + '='.repeat(60) + '\n'));
    }
    async deployToNetwork(networkName) {
        console.log(chalk_1.default.magenta(`\n🚀 Starting deployment to ${networkName.toUpperCase()}\n`));
        try {
            // Step 1: Validate environment
            await this.validateEnvironment(networkName);
            // Step 2: Ensure sufficient balance
            await this.checkAndEnsureBalance(networkName);
            // Step 3: Deploy contract
            const result = await this.deployContract(networkName);
            // Step 4: Post-deployment validation
            await this.postDeploymentValidation(networkName, result);
            // Step 5: Update environment file
            await this.updateEnvironmentFile(networkName, result);
            // Step 6: Save deployment report
            await this.saveDeploymentReport(networkName, result);
            return result;
        }
        catch (error) {
            console.log(chalk_1.default.red(`💥 Deployment to ${networkName} failed: ${error}`));
            throw error;
        }
    }
    async runPreDeploymentSetup() {
        console.log(chalk_1.default.blue('🔧 Running pre-deployment setup...'));
        try {
            // Run RPC optimization
            console.log(chalk_1.default.yellow('  📡 Optimizing RPC endpoints...'));
            const rpcHarvester = new rpc_harvester_1.RPCHarvester();
            await rpcHarvester.runFullHarvest();
            // Run testnet balance check and auto-funding
            console.log(chalk_1.default.yellow('  💰 Checking testnet balances...'));
            const testnetAutomation = new testnet_automation_1.TestnetAutomation();
            await testnetAutomation.runFullAutomation();
            console.log(chalk_1.default.green('✅ Pre-deployment setup completed successfully'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`⚠️ Pre-deployment setup failed: ${error}`));
            console.log(chalk_1.default.yellow('Continuing with deployment anyway...'));
        }
    }
}
exports.TestnetDeployer = TestnetDeployer;
// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const networkName = args[0] || 'arbitrum-sepolia';
    const skipSetup = args.includes('--skip-setup');
    console.log(chalk_1.default.blue('🤖 Enhanced Testnet Deployment System'));
    console.log(chalk_1.default.cyan(`📋 Target Network: ${networkName}`));
    const deployer = new TestnetDeployer();
    try {
        // Run pre-deployment setup unless skipped
        if (!skipSetup) {
            await deployer.runPreDeploymentSetup();
        }
        // Deploy to specified network
        const result = await deployer.deployToNetwork(networkName);
        console.log(chalk_1.default.green(`\n🎉 Deployment completed successfully!`));
        console.log(chalk_1.default.white(`Contract deployed at: ${result.contractAddress}`));
    }
    catch (error) {
        console.log(chalk_1.default.red('\n💥 Deployment failed:', error));
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
