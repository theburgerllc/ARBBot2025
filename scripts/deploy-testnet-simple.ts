#!/usr/bin/env ts-node

/**
 * Simple Testnet Deployment Script - ARBBot2025
 * 
 * Simplified deployment without Hardhat dependency conflicts:
 * - Direct ethers.js provider connection
 * - Contract deployment via bytecode and ABI
 * - Testnet environment setup and validation
 */

import { ethers, JsonRpcProvider, parseEther, formatEther, formatUnits, Wallet, ContractFactory } from 'ethers';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

// Load environment variables
config();

interface DeploymentConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  privateKey: string;
  explorerUrl: string;
  uniV2Router: string;
  sushiRouter: string;
  balancerVault: string;
  requiredBalance: string;
}

interface DeploymentResult {
  contractAddress: string;
  deploymentBlock: number;
  gasUsed: string;
  gasPrice: string;
  transactionHash: string;
}

class SimpleTestnetDeployer {
  private configs: Map<string, DeploymentConfig> = new Map();
  
  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    // Arbitrum Sepolia Configuration
    this.configs.set('arbitrum-sepolia', {
      network: 'arbitrum-sepolia',
      chainId: 421614,
      rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || process.env.ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
      privateKey: process.env.PRIVATE_KEY!,
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
      privateKey: process.env.PRIVATE_KEY!,
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
      privateKey: process.env.PRIVATE_KEY!,
      explorerUrl: 'https://sepolia-optimistic.etherscan.io',
      uniV2Router: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
      sushiRouter: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
      balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      requiredBalance: '0.05'
    });
  }

  async validateEnvironment(networkName: string): Promise<void> {
    console.log(chalk.blue(`🔍 Validating environment for ${networkName}...`));
    
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
      const provider = new JsonRpcProvider(config.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      const network = await provider.getNetwork();
      
      if (network.chainId !== BigInt(config.chainId)) {
        throw new Error(`Chain ID mismatch: expected ${config.chainId}, got ${network.chainId}`);
      }
      
      console.log(chalk.green(`  ✅ RPC connected: Block ${blockNumber}, Chain ID ${network.chainId}`));
    } catch (error) {
      throw new Error(`RPC connection failed: ${error}`);
    }

    console.log(chalk.green(`  ✅ Environment validation passed for ${networkName}`));
  }

  async checkBalance(networkName: string): Promise<void> {
    const config = this.configs.get(networkName)!;
    const provider = new JsonRpcProvider(config.rpcUrl);
    const wallet = new Wallet(config.privateKey, provider);
    
    console.log(chalk.blue(`💰 Checking balance for deployment on ${networkName}...`));
    
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = formatEther(balance);
    const requiredBalanceWei = parseEther(config.requiredBalance);
    
    console.log(chalk.white(`  Wallet address: ${wallet.address}`));
    console.log(chalk.white(`  Current balance: ${balanceEth} ETH`));
    console.log(chalk.white(`  Required balance: ${config.requiredBalance} ETH`));
    
    if (balance < requiredBalanceWei) {
      throw new Error(`Insufficient balance. Need ${config.requiredBalance} ETH, have ${balanceEth} ETH. Please fund the wallet first.`);
    }

    console.log(chalk.green(`  ✅ Sufficient balance available for deployment`));
  }

  async getContractArtifacts(): Promise<{bytecode: string, abi: any[]}> {
    // Look for compiled contract artifacts
    const artifactPaths = [
      'artifacts/contracts/FlashArbBotBalancer.sol/FlashArbBotBalancer.json',
      'artifacts/contracts/FlashLoanArbitrage.sol/FlashLoanArbitrage.json',
      'build/contracts/FlashArbBotBalancer.json'
    ];

    for (const artifactPath of artifactPaths) {
      const fullPath = path.join(process.cwd(), artifactPath);
      if (fs.existsSync(fullPath)) {
        console.log(chalk.green(`📄 Found contract artifact: ${artifactPath}`));
        const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return {
          bytecode: artifact.bytecode || artifact.data?.bytecode?.object,
          abi: artifact.abi
        };
      }
    }

    throw new Error('No contract artifacts found. Please compile contracts first with "npm run compile"');
  }

  async deployContract(networkName: string): Promise<DeploymentResult> {
    const config = this.configs.get(networkName)!;
    
    console.log(chalk.blue(`🚀 Deploying FlashArbBotBalancer to ${networkName}...`));
    
    // Setup provider and wallet
    const provider = new JsonRpcProvider(config.rpcUrl);
    const wallet = new Wallet(config.privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    
    console.log(chalk.white(`  Deployer address: ${wallet.address}`));
    console.log(chalk.white(`  Deployer balance: ${formatEther(balance)} ETH`));
    console.log(chalk.white(`  Network: ${networkName} (Chain ID: ${config.chainId})`));

    // Get contract artifacts
    const { bytecode, abi } = await this.getContractArtifacts();
    
    if (!bytecode || bytecode === '0x') {
      throw new Error('Invalid bytecode found in artifacts');
    }

    // Create contract factory
    const contractFactory = new ContractFactory(abi, bytecode, wallet);
    
    // Estimate gas for deployment
    const deploymentTx = await contractFactory.getDeployTransaction(
      config.uniV2Router,
      config.sushiRouter,
      config.balancerVault
    );

    const gasEstimate = await provider.estimateGas(deploymentTx);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(20000000000); // 20 gwei fallback
    
    console.log(chalk.gray(`  Estimated gas: ${gasEstimate.toString()}`));
    console.log(chalk.gray(`  Gas price: ${formatUnits(gasPrice, 'gwei')} gwei`));

    // Deploy contract
    console.log(chalk.yellow(`  ⏳ Deploying contract...`));
    const deploymentStart = Date.now();
    
    const contract = await contractFactory.deploy(
      config.uniV2Router,
      config.sushiRouter,
      config.balancerVault,
      {
        gasLimit: gasEstimate * BigInt(120) / BigInt(100), // Add 20% buffer
        gasPrice: gasPrice
      }
    );

    console.log(chalk.yellow(`  ⏳ Waiting for deployment confirmation...`));
    await contract.deployed();
    
    const deploymentTime = Date.now() - deploymentStart;
    console.log(chalk.green(`  ✅ Contract deployed in ${deploymentTime / 1000}s`));
    console.log(chalk.green(`  📍 Contract Address: ${contract.address}`));

    // Get deployment transaction details
    const deployTx = contract.deployTransaction;
    const receipt = await deployTx.wait();
    
    console.log(chalk.white(`  🧾 Transaction Hash: ${receipt.transactionHash}`));
    console.log(chalk.white(`  ⛽ Gas Used: ${receipt.gasUsed.toString()}`));
    console.log(chalk.white(`  💰 Gas Price: ${formatUnits(receipt.effectiveGasPrice || gasPrice, 'gwei')} gwei`));
    console.log(chalk.white(`  🏗️ Block Number: ${receipt.blockNumber}`));

    // Verify deployment
    const code = await provider.getCode(contract.address);
    if (code === "0x") {
      throw new Error("Contract deployment failed - no code at address");
    }

    console.log(chalk.green(`  ✅ Contract verified on-chain (${code.length} bytes)`));
    
    // Test basic contract functionality
    try {
      const owner = await contract.owner();
      console.log(chalk.green(`  ✅ Contract is responsive, owner: ${owner}`));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️ Contract deployed but basic call failed: ${error}`));
    }

    return {
      contractAddress: contract.address,
      deploymentBlock: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: formatUnits(receipt.effectiveGasPrice || gasPrice, 'gwei'),
      transactionHash: receipt.transactionHash
    };
  }

  async saveDeploymentReport(networkName: string, result: DeploymentResult): Promise<void> {
    const config = this.configs.get(networkName)!;
    
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
      deployerAddress: new Wallet(config.privateKey).address
    };

    const reportPath = path.join(process.cwd(), `deployment-${networkName}-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(chalk.green(`📄 Deployment report saved: ${reportPath}`));
    
    // Update .env file
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      const envKey = `${networkName.toUpperCase().replace('-', '_')}_BOT_CONTRACT_ADDRESS`;
      
      if (envContent.includes(`${envKey}=`)) {
        envContent = envContent.replace(new RegExp(`${envKey}=.*`), `${envKey}=${result.contractAddress}`);
      } else {
        envContent += `\n${envKey}=${result.contractAddress}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log(chalk.green(`🔧 .env file updated with ${envKey}=${result.contractAddress}`));
    }
    
    // Print summary
    console.log(chalk.magenta('\n' + '='.repeat(60)));
    console.log(chalk.magenta(`🎉 DEPLOYMENT SUCCESSFUL: ${networkName.toUpperCase()}`));
    console.log(chalk.magenta('='.repeat(60)));
    console.log(chalk.cyan('\n📋 Deployment Summary:'));
    console.log(chalk.white(`  Network: ${networkName} (Chain ID: ${config.chainId})`));
    console.log(chalk.white(`  Contract: ${result.contractAddress}`));
    console.log(chalk.white(`  Block: ${result.deploymentBlock}`));
    console.log(chalk.white(`  Gas Used: ${parseInt(result.gasUsed).toLocaleString()}`));
    console.log(chalk.white(`  Gas Price: ${result.gasPrice} gwei`));
    console.log(chalk.white(`  Explorer: ${report.explorerUrl}`));
    console.log(chalk.magenta('\n' + '='.repeat(60) + '\n'));
  }

  async deployToNetwork(networkName: string): Promise<DeploymentResult> {
    console.log(chalk.magenta(`\n🚀 Starting deployment to ${networkName.toUpperCase()}\n`));
    
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
      
    } catch (error) {
      console.log(chalk.red(`💥 Deployment to ${networkName} failed: ${error}`));
      throw error;
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const networkName = args[0] || 'arbitrum-sepolia';
  
  console.log(chalk.blue('🤖 Simple Testnet Deployment System'));
  console.log(chalk.cyan(`📋 Target Network: ${networkName}`));
  
  const deployer = new SimpleTestnetDeployer();
  
  try {
    const result = await deployer.deployToNetwork(networkName);
    
    console.log(chalk.green(`\n🎉 Deployment completed successfully!`));
    console.log(chalk.white(`Contract deployed at: ${result.contractAddress}`));
    
  } catch (error) {
    console.log(chalk.red('\n💥 Deployment failed:', error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SimpleTestnetDeployer };