#!/usr/bin/env ts-node

/**
 * Enhanced Testnet Deployment Script - ARBBot2025
 * 
 * Comprehensive deployment with:
 * - Automated testnet environment setup
 * - Balance validation and auto-funding
 * - Smart contract deployment with verification
 * - Post-deployment testing and validation
 */

import hre from "hardhat";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import chalk from 'chalk';
import { TestnetAutomation } from './testnet-automation';
import { RPCHarvester } from './rpc-harvester';

config();

interface TestnetDeploymentConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  privateKey: string;
  uniV2Router: string;
  sushiRouter: string;
  balancerVault: string;
  aavePool?: string;
  requiredBalance: string;
  gasSettings: {
    gasLimit: number;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
}

interface DeploymentResult {
  contractAddress: string;
  deploymentBlock: number;
  gasUsed: string;
  gasPrice: string;
  transactionHash: string;
  verified: boolean;
}

class TestnetDeployer {
  private testnetConfigs: Map<string, TestnetDeploymentConfig> = new Map();
  
  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    // Arbitrum Sepolia Configuration
    this.testnetConfigs.set('arbitrum-sepolia', {
      network: 'arbitrum-sepolia',
      chainId: 421614,
      rpcUrl: process.env.ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
      explorerUrl: 'https://sepolia.arbiscan.io',
      privateKey: process.env.PRIVATE_KEY!,
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
      privateKey: process.env.PRIVATE_KEY!,
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
      privateKey: process.env.PRIVATE_KEY!,
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

  async validateEnvironment(networkName: string): Promise<void> {
    console.log(chalk.blue(`🔍 Validating environment for ${networkName}...`));
    
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
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      const network = await provider.getNetwork();
      
      if (Number(network.chainId) !== config.chainId) {
        throw new Error(`Chain ID mismatch: expected ${config.chainId}, got ${network.chainId}`);
      }
      
      console.log(chalk.green(`  ✅ RPC connected: Block ${blockNumber}, Chain ID ${network.chainId}`));
    } catch (error) {
      throw new Error(`RPC connection failed: ${error}`);
    }

    // Validate contract addresses
    if (!utils.isAddress(config.uniV2Router)) {
      console.log(chalk.yellow(`  ⚠️ Uniswap V2 router address may be invalid: ${config.uniV2Router}`));
    }

    if (!utils.isAddress(config.balancerVault)) {
      throw new Error(`Invalid Balancer Vault address: ${config.balancerVault}`);
    }

    console.log(chalk.green(`  ✅ Environment validation passed for ${networkName}`));
  }

  async checkAndEnsureBalance(networkName: string): Promise<void> {
    const config = this.testnetConfigs.get(networkName)!;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    
    console.log(chalk.blue(`💰 Checking balance for deployment on ${networkName}...`));
    
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    const requiredBalanceWei = ethers.utils.parseEther(config.requiredBalance);
    
    console.log(chalk.white(`  Current balance: ${balanceEth} ETH`));
    console.log(chalk.white(`  Required balance: ${config.requiredBalance} ETH`));
    
    if (balance < requiredBalanceWei) {
      console.log(chalk.red(`  ❌ Insufficient balance for deployment`));
      console.log(chalk.yellow(`  🚰 Attempting to request funds from testnet faucets...`));
      
      // Automatically request funds using our automation
      try {
        const automation = new TestnetAutomation();
        await automation.initialize();
        
        const testnetConfig = {
          name: networkName,
          chainId: config.chainId,
          rpcUrl: config.rpcUrl,
          explorerUrl: config.explorerUrl,
          faucetUrl: this.getFaucetUrl(networkName),
          requiredBalance: config.requiredBalance
        };
        
        const result = await automation.requestFaucetTokens(testnetConfig);
        await automation.cleanup();
        
        if (result.success) {
          console.log(chalk.green(`  ✅ Faucet request submitted. Waiting for confirmation...`));
          
          // Wait for funds to arrive
          const maxWaitTime = result.waitTime || 300; // 5 minutes default
          const checkInterval = 30; // 30 seconds
          let waited = 0;
          
          while (waited < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
            waited += checkInterval;
            
            const newBalance = await provider.getBalance(wallet.address);
            if (newBalance >= requiredBalanceWei) {
              console.log(chalk.green(`  ✅ Sufficient balance received: ${ethers.utils.formatEther(newBalance)} ETH`));
              return;
            }
            
            console.log(chalk.gray(`    ⏳ Waiting for funds... (${waited}/${maxWaitTime}s)`));
          }
          
          throw new Error(`Timeout waiting for faucet funds after ${maxWaitTime}s`);
        } else {
          throw new Error(`Faucet request failed: ${result.error}`);
        }
        
      } catch (error) {
        console.log(chalk.red(`  ❌ Auto-funding failed: ${error}`));
        throw new Error(`Insufficient balance and auto-funding failed. Please manually request testnet ETH from faucets.`);
      }
    } else {
      console.log(chalk.green(`  ✅ Sufficient balance available for deployment`));
    }
  }

  private getFaucetUrl(networkName: string): string {
    const faucetUrls = {
      'arbitrum-sepolia': 'https://faucets.chain.link/arbitrum-sepolia',
      'ethereum-sepolia': 'https://sepolia-faucet.pk910.de',
      'optimism-sepolia': 'https://faucets.chain.link/optimism-sepolia'
    };
    
    return faucetUrls[networkName as keyof typeof faucetUrls] || '';
  }

  async deployContract(networkName: string): Promise<DeploymentResult> {
    const config = this.testnetConfigs.get(networkName)!;
    
    console.log(chalk.blue(`🚀 Deploying FlashArbBotBalancer to ${networkName}...`));
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    
    console.log(chalk.white(`  Deployer address: ${deployer.address}`));
    console.log(chalk.white(`  Deployer balance: ${ethers.utils.formatEther(balance)} ETH`));
    console.log(chalk.white(`  Network: ${networkName} (Chain ID: ${config.chainId})`));

    // Get contract factory
    const FlashArbBotBalancer = await ethers.getContractFactory("FlashArbBotBalancer");
    
    // Prepare deployment transaction with optimized gas settings
    const gasLimit = config.gasSettings.gasLimit;
    const maxFeePerGas = ethers.utils.parseUnits(config.gasSettings.maxFeePerGas, 'gwei');
    const maxPriorityFeePerGas = ethers.utils.parseUnits(config.gasSettings.maxPriorityFeePerGas, 'gwei');

    console.log(chalk.gray(`  Gas Limit: ${gasLimit.toLocaleString()}`));
    console.log(chalk.gray(`  Max Fee Per Gas: ${config.gasSettings.maxFeePerGas} gwei`));
    console.log(chalk.gray(`  Max Priority Fee: ${config.gasSettings.maxPriorityFeePerGas} gwei`));

    // Deploy contract
    const deploymentStart = Date.now();
    
    const flashArbBot = await FlashArbBotBalancer.deploy(
      config.uniV2Router,
      config.sushiRouter,  
      config.balancerVault,
      {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );

    console.log(chalk.yellow(`  ⏳ Deployment transaction sent, waiting for confirmation...`));
    
    // Wait for deployment
    await flashArbBot.waitForDeployment();
    const contractAddress = await flashArbBot.getAddress();
    
    const deploymentTime = Date.now() - deploymentStart;
    console.log(chalk.green(`  ✅ Contract deployed in ${deploymentTime / 1000}s`));
    console.log(chalk.green(`  📍 Contract Address: ${contractAddress}`));

    // Get deployment transaction details
    const deployTx = flashArbBot.deploymentTransaction();
    if (!deployTx) {
      throw new Error('Deployment transaction not found');
    }

    const receipt = await deployTx.wait();
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    console.log(chalk.white(`  🧾 Transaction Hash: ${receipt.hash}`));
    console.log(chalk.white(`  ⛽ Gas Used: ${receipt.gasUsed.toLocaleString()}`));
    console.log(chalk.white(`  💰 Gas Price: ${ethers.utils.formatUnits(receipt.gasPrice || 0, 'gwei')} gwei`));
    console.log(chalk.white(`  🏗️ Block Number: ${receipt.blockNumber}`));

    // Verify deployment
    const provider = deployer.provider;
    const code = await provider.getCode(contractAddress);
    
    if (code === "0x") {
      throw new Error("Contract deployment failed - no code at address");
    }

    console.log(chalk.green(`  ✅ Contract verified on-chain (${code.length} bytes)`));
    
    // Test basic contract functionality
    try {
      await flashArbBot.owner();
      console.log(chalk.green(`  ✅ Contract is responsive and functional`));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️ Contract deployed but basic call failed: ${error}`));
    }

    return {
      contractAddress,
      deploymentBlock: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: ethers.utils.formatUnits(receipt.gasPrice || 0, 'gwei'),
      transactionHash: receipt.hash,
      verified: true
    };
  }

  async postDeploymentValidation(networkName: string, result: DeploymentResult): Promise<void> {
    console.log(chalk.blue(`🔍 Running post-deployment validation for ${networkName}...`));
    
    const config = this.testnetConfigs.get(networkName)!;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Test 1: Contract code verification
    const code = await provider.getCode(result.contractAddress);
    console.log(chalk.white(`  📝 Contract code size: ${code.length - 2} hex chars`));
    
    // Test 2: Contract storage verification  
    try {
      const flashArbBot = await ethers.getContractAt("FlashArbBotBalancer", result.contractAddress);
      const owner = await flashArbBot.owner();
      const [deployer] = await ethers.getSigners();
      
      if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log(chalk.green(`  ✅ Contract ownership correctly set`));
      } else {
        console.log(chalk.red(`  ❌ Contract ownership mismatch`));
      }
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️ Could not verify contract ownership: ${error}`));
    }
    
    // Test 3: Explorer verification
    const explorerUrl = `${config.explorerUrl}/address/${result.contractAddress}`;
    console.log(chalk.cyan(`  🔗 Explorer URL: ${explorerUrl}`));
    
    console.log(chalk.green(`  ✅ Post-deployment validation completed`));
  }

  async updateEnvironmentFile(networkName: string, result: DeploymentResult): Promise<void> {
    console.log(chalk.blue(`📝 Updating environment configuration...`));
    
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = fs.readFileSync(envPath, 'utf8');
    } catch {
      console.log(chalk.yellow('  ⚠️ .env file not found, creating new one'));
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
    const filteredLines = lines.filter(line => 
      !line.includes(envKey) && 
      !line.includes(`===== ${networkName.toUpperCase()} DEPLOYMENT`)
    );

    const updatedContent = filteredLines.join('\n') + '\n' + updates.join('\n');
    fs.writeFileSync(envPath, updatedContent);

    console.log(chalk.green(`  ✅ Environment updated with ${envKey}=${result.contractAddress}`));
  }

  async saveDeploymentReport(networkName: string, result: DeploymentResult): Promise<void> {
    const config = this.testnetConfigs.get(networkName)!;
    
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
      deployerAddress: new ethers.Wallet(config.privateKey).address
    };

    const reportPath = path.join(process.cwd(), `deployment-${networkName}-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(chalk.green(`📄 Deployment report saved: ${reportPath}`));
    
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
      
    } catch (error) {
      console.log(chalk.red(`💥 Deployment to ${networkName} failed: ${error}`));
      throw error;
    }
  }

  async runPreDeploymentSetup(): Promise<void> {
    console.log(chalk.blue('🔧 Running pre-deployment setup...'));
    
    try {
      // Run RPC optimization
      console.log(chalk.yellow('  📡 Optimizing RPC endpoints...'));
      const rpcHarvester = new RPCHarvester();
      await rpcHarvester.runFullHarvest();
      
      // Run testnet balance check and auto-funding
      console.log(chalk.yellow('  💰 Checking testnet balances...'));
      const testnetAutomation = new TestnetAutomation();
      await testnetAutomation.runFullAutomation();
      
      console.log(chalk.green('✅ Pre-deployment setup completed successfully'));
      
    } catch (error) {
      console.log(chalk.red(`⚠️ Pre-deployment setup failed: ${error}`));
      console.log(chalk.yellow('Continuing with deployment anyway...'));
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const networkName = args[0] || 'arbitrum-sepolia';
  const skipSetup = args.includes('--skip-setup');
  
  console.log(chalk.blue('🤖 Enhanced Testnet Deployment System'));
  console.log(chalk.cyan(`📋 Target Network: ${networkName}`));
  
  const deployer = new TestnetDeployer();
  
  try {
    // Run pre-deployment setup unless skipped
    if (!skipSetup) {
      await deployer.runPreDeploymentSetup();
    }
    
    // Deploy to specified network
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

export { TestnetDeployer };