#!/usr/bin/env ts-node
"use strict";
/**
 * Simple Testnet Deployment Script - ARBBot2025
 *
 * Simplified deployment without Hardhat dependency conflicts:
 * - Direct ethers.js provider connection
 * - Contract deployment via bytecode and ABI
 * - Testnet environment setup and validation
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
exports.SimpleTestnetDeployer = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = require("dotenv");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
// Load environment variables
(0, dotenv_1.config)();
class SimpleTestnetDeployer {
    configs = new Map();
    constructor() {
        this.initializeConfigs();
    }
    initializeConfigs() {
        // Arbitrum Sepolia Configuration
        this.configs.set('arbitrum-sepolia', {
            network: 'arbitrum-sepolia',
            chainId: 421614,
            rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || process.env.ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
            privateKey: process.env.PRIVATE_KEY,
            explorerUrl: 'https://sepolia.arbiscan.io',
            uniV2Router: '0x4648a43B2C14Da09FdAb83dd5aB3120E74D4d39b',
            sushiRouter: '0x4648a43B2C14Da09FdAb83dd5aB3120E74D4d39b',
            balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            requiredBalance: '0.05'
        });
        // Ethereum Sepolia Configuration
        this.configs.set('ethereum-sepolia', {
            network: 'ethereum-sepolia',
            chainId: 11155111,
            rpcUrl: process.env.ETH_SEPOLIA_RPC || 'https://rpc.sepolia.org',
            privateKey: process.env.PRIVATE_KEY,
            explorerUrl: 'https://sepolia.etherscan.io',
            uniV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            sushiRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
            balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            requiredBalance: '0.1'
        });
        // Optimism Sepolia Configuration
        this.configs.set('optimism-sepolia', {
            network: 'optimism-sepolia',
            chainId: 11155420,
            rpcUrl: process.env.OPT_SEPOLIA_RPC || 'https://sepolia.optimism.io',
            privateKey: process.env.PRIVATE_KEY,
            explorerUrl: 'https://sepolia-optimistic.etherscan.io',
            uniV2Router: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
            sushiRouter: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
            balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            requiredBalance: '0.05'
        });
    }
    async validateEnvironment(networkName) {
        console.log(chalk_1.default.blue(`🔍 Validating environment for ${networkName}...`));
        const config = this.configs.get(networkName);
        if (!config) {
            throw new Error(`Network ${networkName} not configured`);
        }
        // Validate private key
        if (!config.privateKey || !config.privateKey.startsWith("0x") || config.privateKey.length !== 66) {
            throw new Error("PRIVATE_KEY is missing or invalid format");
        }
        // Validate RPC URL
        if (!config.rpcUrl || !config.rpcUrl.startsWith("http")) {
            throw new Error(`RPC URL is missing or invalid format for ${networkName}`);
        }
        // Test RPC connectivity
        try {
            const provider = new ethers_1.ethers.providers.JsonRpcProvider(config.rpcUrl);
            const blockNumber = await provider.getBlockNumber();
            const network = await provider.getNetwork();
            if (network.chainId !== config.chainId) {
                throw new Error(`Chain ID mismatch: expected ${config.chainId}, got ${network.chainId}`);
            }
            console.log(chalk_1.default.green(`  ✅ RPC connected: Block ${blockNumber}, Chain ID ${network.chainId}`));
        }
        catch (error) {
            throw new Error(`RPC connection failed: ${error}`);
        }
        console.log(chalk_1.default.green(`  ✅ Environment validation passed for ${networkName}`));
    }
    async checkBalance(networkName) {
        const config = this.configs.get(networkName);
        const provider = new ethers_1.ethers.providers.JsonRpcProvider(config.rpcUrl);
        const wallet = new ethers_1.ethers.Wallet(config.privateKey, provider);
        console.log(chalk_1.default.blue(`💰 Checking balance for deployment on ${networkName}...`));
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers_1.ethers.utils.formatEther(balance);
        const requiredBalanceWei = ethers_1.ethers.utils.parseEther(config.requiredBalance);
        console.log(chalk_1.default.white(`  Wallet address: ${wallet.address}`));
        console.log(chalk_1.default.white(`  Current balance: ${balanceEth} ETH`));
        console.log(chalk_1.default.white(`  Required balance: ${config.requiredBalance} ETH`));
        if (balance.lt(requiredBalanceWei)) {
            throw new Error(`Insufficient balance. Need ${config.requiredBalance} ETH, have ${balanceEth} ETH. Please fund the wallet first.`);
        }
        console.log(chalk_1.default.green(`  ✅ Sufficient balance available for deployment`));
    }
    async getContractArtifacts() {
        // Look for compiled contract artifacts
        const artifactPaths = [
            'artifacts/contracts/FlashArbBotBalancer.sol/FlashArbBotBalancer.json',
            'artifacts/contracts/FlashLoanArbitrage.sol/FlashLoanArbitrage.json',
            'build/contracts/FlashArbBotBalancer.json'
        ];
        for (const artifactPath of artifactPaths) {
            const fullPath = path.join(process.cwd(), artifactPath);
            if (fs.existsSync(fullPath)) {
                console.log(chalk_1.default.green(`📄 Found contract artifact: ${artifactPath}`));
                const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                return {
                    bytecode: artifact.bytecode || artifact.data?.bytecode?.object,
                    abi: artifact.abi
                };
            }
        }
        throw new Error('No contract artifacts found. Please compile contracts first with "npm run compile"');
    }
    async deployContract(networkName) {
        const config = this.configs.get(networkName);
        console.log(chalk_1.default.blue(`🚀 Deploying FlashArbBotBalancer to ${networkName}...`));
        // Setup provider and wallet
        const provider = new ethers_1.ethers.providers.JsonRpcProvider(config.rpcUrl);
        const wallet = new ethers_1.ethers.Wallet(config.privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        console.log(chalk_1.default.white(`  Deployer address: ${wallet.address}`));
        console.log(chalk_1.default.white(`  Deployer balance: ${ethers_1.ethers.utils.formatEther(balance)} ETH`));
        console.log(chalk_1.default.white(`  Network: ${networkName} (Chain ID: ${config.chainId})`));
        // Get contract artifacts
        const { bytecode, abi } = await this.getContractArtifacts();
        if (!bytecode || bytecode === '0x') {
            throw new Error('Invalid bytecode found in artifacts');
        }
        // Create contract factory
        const contractFactory = new ethers_1.ethers.ContractFactory(abi, bytecode, wallet);
        // Estimate gas for deployment
        const deploymentTx = contractFactory.getDeployTransaction(config.uniV2Router, config.sushiRouter, config.balancerVault);
        const gasEstimate = await provider.estimateGas(deploymentTx);
        const gasPrice = await provider.getGasPrice();
        console.log(chalk_1.default.gray(`  Estimated gas: ${gasEstimate.toString()}`));
        console.log(chalk_1.default.gray(`  Gas price: ${ethers_1.ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`));
        // Deploy contract
        console.log(chalk_1.default.yellow(`  ⏳ Deploying contract...`));
        const deploymentStart = Date.now();
        const contract = await contractFactory.deploy(config.uniV2Router, config.sushiRouter, config.balancerVault, {
            gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
            gasPrice: gasPrice
        });
        console.log(chalk_1.default.yellow(`  ⏳ Waiting for deployment confirmation...`));
        await contract.deployed();
        const deploymentTime = Date.now() - deploymentStart;
        console.log(chalk_1.default.green(`  ✅ Contract deployed in ${deploymentTime / 1000}s`));
        console.log(chalk_1.default.green(`  📍 Contract Address: ${contract.address}`));
        // Get deployment transaction details
        const deployTx = contract.deployTransaction;
        const receipt = await deployTx.wait();
        console.log(chalk_1.default.white(`  🧾 Transaction Hash: ${receipt.transactionHash}`));
        console.log(chalk_1.default.white(`  ⛽ Gas Used: ${receipt.gasUsed.toString()}`));
        console.log(chalk_1.default.white(`  💰 Gas Price: ${ethers_1.ethers.utils.formatUnits(receipt.effectiveGasPrice || gasPrice, 'gwei')} gwei`));
        console.log(chalk_1.default.white(`  🏗️ Block Number: ${receipt.blockNumber}`));
        // Verify deployment
        const code = await provider.getCode(contract.address);
        if (code === "0x") {
            throw new Error("Contract deployment failed - no code at address");
        }
        console.log(chalk_1.default.green(`  ✅ Contract verified on-chain (${code.length} bytes)`));
        // Test basic contract functionality
        try {
            const owner = await contract.owner();
            console.log(chalk_1.default.green(`  ✅ Contract is responsive, owner: ${owner}`));
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`  ⚠️ Contract deployed but basic call failed: ${error}`));
        }
        return {
            contractAddress: contract.address,
            deploymentBlock: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            gasPrice: ethers_1.ethers.utils.formatUnits(receipt.effectiveGasPrice || gasPrice, 'gwei'),
            transactionHash: receipt.transactionHash
        };
    }
    async saveDeploymentReport(networkName, result) {
        const config = this.configs.get(networkName);
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
            deployerAddress: new ethers_1.ethers.Wallet(config.privateKey).address
        };
        const reportPath = path.join(process.cwd(), `deployment-${networkName}-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk_1.default.green(`📄 Deployment report saved: ${reportPath}`));
        // Update .env file
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            const envKey = `${networkName.toUpperCase().replace('-', '_')}_BOT_CONTRACT_ADDRESS`;
            if (envContent.includes(`${envKey}=`)) {
                envContent = envContent.replace(new RegExp(`${envKey}=.*`), `${envKey}=${result.contractAddress}`);
            }
            else {
                envContent += `\n${envKey}=${result.contractAddress}\n`;
            }
            fs.writeFileSync(envPath, envContent);
            console.log(chalk_1.default.green(`🔧 .env file updated with ${envKey}=${result.contractAddress}`));
        }
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
            // Step 2: Check balance
            await this.checkBalance(networkName);
            // Step 3: Deploy contract
            const result = await this.deployContract(networkName);
            // Step 4: Save deployment report
            await this.saveDeploymentReport(networkName, result);
            return result;
        }
        catch (error) {
            console.log(chalk_1.default.red(`💥 Deployment to ${networkName} failed: ${error}`));
            throw error;
        }
    }
}
exports.SimpleTestnetDeployer = SimpleTestnetDeployer;
// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const networkName = args[0] || 'arbitrum-sepolia';
    console.log(chalk_1.default.blue('🤖 Simple Testnet Deployment System'));
    console.log(chalk_1.default.cyan(`📋 Target Network: ${networkName}`));
    const deployer = new SimpleTestnetDeployer();
    try {
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
