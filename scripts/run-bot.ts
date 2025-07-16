import { ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { MevShareClient } from "@flashbots/mev-share-client";
import dotenv from "dotenv";
import chalk from "chalk";
import winston from "winston";
import cron from "node-cron";
import Big from "big.js";

import balancerVaultABI from "../abi/BalancerVault.json";
import uniswapV2RouterABI from "../abi/UniswapV2Router.json";
import sushiSwapRouterABI from "../abi/SushiSwapRouter.json";
import uniswapV3QuoterABI from "../abi/UniswapV3Quoter.json";
import erc20ABI from "../abi/ERC20.json";

dotenv.config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "bot.log" })
  ]
});

interface ArbitrageOpportunity {
  tokenA: string;
  tokenB: string;
  amountIn: string;
  expectedProfit: string;
  sushiFirst: boolean;
  path: string[];
  gasEstimate: string;
  timestamp: number;
  isTriangular?: boolean;
  chainId?: number;
}

interface CrossChainOpportunity {
  tokenA: string;
  tokenB: string;
  amountIn: string;
  arbitrumPrice: string;
  optimismPrice: string;
  spread: string;
  estimatedProfit: string;
  bridgeCost: string;
  timestamp: number;
}

interface TokenPair {
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
}

class ArbitrageBot {
  private arbitrumProvider: ethers.JsonRpcProvider;
  private optimismProvider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private optimismWallet: ethers.Wallet;
  private flashbotsProvider: FlashbotsBundleProvider;
  private mevShareClient: MevShareClient;
  private botContract: ethers.Contract;
  private optimismBotContract: ethers.Contract;
  private uniswapV2Router: ethers.Contract;
  private sushiSwapRouter: ethers.Contract;
  private uniswapV3Quoter: ethers.Contract;
  private balancerVault: ethers.Contract;
  
  // Token addresses - Arbitrum
  private readonly WETH_ARB = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  private readonly USDC_ARB = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
  private readonly USDT_ARB = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
  private readonly WBTC_ARB = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  
  // Token addresses - Optimism
  private readonly WETH_OPT = "0x4200000000000000000000000000000000000006";
  private readonly USDC_OPT = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
  private readonly USDT_OPT = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58";
  private readonly WBTC_OPT = "0x68f180fcCe6836688e9084f035309E29Bf0A2095";
  
  // Router addresses
  private readonly UNI_V2_ROUTER_ARB = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
  private readonly SUSHI_ROUTER_ARB = "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55";
  private readonly UNI_V2_ROUTER_OPT = "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2";
  private readonly SUSHI_ROUTER_OPT = "0x2ABf469074dc0b54d793850807E6eb5Faf2625b1";
  
  private readonly MIN_PROFIT_THRESHOLD = ethers.parseEther("0.01"); // 0.01 ETH
  private readonly MIN_CROSS_CHAIN_SPREAD = 0.0005; // 0.05%
  private readonly GAS_LIMIT = 500000n;
  private readonly MAX_PRIORITY_FEE = ethers.parseUnits("2", "gwei");
  private readonly COOLDOWN_PERIOD = 30000; // 30 seconds
  
  private lastExecutionTime = 0;
  private isRunning = false;
  private crossChainMonitoringActive = false;
  
  constructor() {
    this.arbitrumProvider = new ethers.JsonRpcProvider(process.env.ARB_RPC!);
    this.optimismProvider = new ethers.JsonRpcProvider(process.env.OPT_RPC!);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.arbitrumProvider);
    this.optimismWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.optimismProvider);
    
    // Initialize Arbitrum contracts
    this.balancerVault = new ethers.Contract(
      process.env.BALANCER_VAULT_ADDRESS!,
      balancerVaultABI,
      this.wallet
    );
    
    this.uniswapV2Router = new ethers.Contract(
      this.UNI_V2_ROUTER_ARB,
      uniswapV2RouterABI,
      this.wallet
    );
    
    this.sushiSwapRouter = new ethers.Contract(
      this.SUSHI_ROUTER_ARB,
      sushiSwapRouterABI,
      this.wallet
    );
    
    this.uniswapV3Quoter = new ethers.Contract(
      process.env.UNISWAP_V3_QUOTER_ADDRESS!,
      uniswapV3QuoterABI,
      this.wallet
    );
    
    this.botContract = new ethers.Contract(
      process.env.BOT_CONTRACT_ADDRESS!,
      [], // Will be populated from compilation
      this.wallet
    );
    
    // Initialize Optimism contracts if deployed
    if (process.env.OPT_BOT_CONTRACT_ADDRESS) {
      this.optimismBotContract = new ethers.Contract(
        process.env.OPT_BOT_CONTRACT_ADDRESS,
        [],
        this.optimismWallet
      );
    }
  }

  async initialize() {
    try {
      // Initialize Flashbots
      const authSigner = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY!, this.arbitrumProvider);
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.arbitrumProvider,
        authSigner,
        process.env.FLASHBOTS_RELAY_URL || "https://relay.flashbots.net",
        "arbitrum"
      );
      
      // Initialize MEV-Share client
      this.mevShareClient = new MevShareClient({
        name: "arbitrage-bot",
        url: process.env.MEV_SHARE_URL || "https://mev-share.flashbots.net",
        signer: authSigner
      });
      
      logger.info(chalk.green("✓ Multi-chain Bot initialized successfully"));
      logger.info(chalk.blue(`Arbitrum Wallet: ${this.wallet.address}`));
      logger.info(chalk.blue(`Optimism Wallet: ${this.optimismWallet.address}`));
      
      const arbBalance = await this.arbitrumProvider.getBalance(this.wallet.address);
      const optBalance = await this.optimismProvider.getBalance(this.optimismWallet.address);
      
      logger.info(chalk.blue(`Arbitrum Balance: ${ethers.formatEther(arbBalance)} ETH`));
      logger.info(chalk.blue(`Optimism Balance: ${ethers.formatEther(optBalance)} ETH`));
      
      // Enable cross-chain monitoring if both networks are configured
      if (process.env.OPT_RPC && process.env.ARB_RPC) {
        this.crossChainMonitoringActive = true;
        logger.info(chalk.green("✓ Cross-chain monitoring enabled"));
      }
      
    } catch (error) {
      logger.error(chalk.red("Failed to initialize bot:"), error);
      throw error;
    }
  }

  async scanForOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    try {
      const amounts = [
        ethers.parseEther("1"),    // 1 ETH
        ethers.parseEther("5"),    // 5 ETH
        ethers.parseEther("10"),   // 10 ETH
        ethers.parseEther("25"),   // 25 ETH
      ];
      
      // Define trading pairs for both networks
      const arbitrumPairs = [
        [this.WETH_ARB, this.USDC_ARB],
        [this.WETH_ARB, this.USDT_ARB],
        [this.WBTC_ARB, this.WETH_ARB],
      ];
      
      const optimismPairs = [
        [this.WETH_OPT, this.USDC_OPT],
        [this.WETH_OPT, this.USDT_OPT],
        [this.WBTC_OPT, this.WETH_OPT],
      ];
      
      // Scan Arbitrum opportunities
      for (const pair of arbitrumPairs) {
        for (const amount of amounts) {
          const opp1 = await this.checkArbitrageOpportunity(amount, pair, true, 42161);
          const opp2 = await this.checkArbitrageOpportunity(amount, pair, false, 42161);
          
          if (opp1) opportunities.push(opp1);
          if (opp2) opportunities.push(opp2);
        }
      }
      
      // Scan triangular arbitrage (Arbitrum only for now)
      const triangularPath = [this.WETH_ARB, this.USDT_ARB, this.USDC_ARB, this.WETH_ARB];
      for (const amount of amounts) {
        const triangularOpp = await this.checkTriangularArbitrageOpportunity(amount, triangularPath);
        if (triangularOpp) opportunities.push(triangularOpp);
      }
      
      // Cross-chain opportunities
      if (this.crossChainMonitoringActive) {
        const crossChainOpps = await this.scanCrossChainOpportunities();
        // Convert cross-chain opportunities to regular opportunities format
        for (const crossOpp of crossChainOpps) {
          if (Big(crossOpp.estimatedProfit).gt(0)) {
            logger.info(chalk.yellow(`🌉 Cross-chain opportunity detected: ${crossOpp.spread}% spread`));
          }
        }
      }
      
      // Sort by expected profit (highest first)
      opportunities.sort((a, b) => 
        Big(b.expectedProfit).minus(Big(a.expectedProfit)).toNumber()
      );
      
      return opportunities;
      
    } catch (error) {
      logger.error(chalk.red("Error scanning for opportunities:"), error);
      return [];
    }
  }

  async checkArbitrageOpportunity(
    amount: bigint,
    path: string[],
    sushiFirst: boolean,
    chainId: number = 42161
  ): Promise<ArbitrageOpportunity | null> {
    try {
      let amounts1: bigint[], amounts2: bigint[];
      
      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      const router1Address = chainId === 42161 ? 
        (sushiFirst ? this.SUSHI_ROUTER_ARB : this.UNI_V2_ROUTER_ARB) :
        (sushiFirst ? this.SUSHI_ROUTER_OPT : this.UNI_V2_ROUTER_OPT);
      const router2Address = chainId === 42161 ? 
        (sushiFirst ? this.UNI_V2_ROUTER_ARB : this.SUSHI_ROUTER_ARB) :
        (sushiFirst ? this.UNI_V2_ROUTER_OPT : this.SUSHI_ROUTER_OPT);
      
      const router1 = new ethers.Contract(router1Address, uniswapV2RouterABI, provider);
      const router2 = new ethers.Contract(router2Address, uniswapV2RouterABI, provider);
      
      if (sushiFirst) {
        amounts1 = await router1.getAmountsOut(amount, path);
        amounts2 = await router2.getAmountsOut(
          amounts1[amounts1.length - 1],
          path.slice().reverse()
        );
      } else {
        amounts1 = await router1.getAmountsOut(amount, path);
        amounts2 = await router2.getAmountsOut(
          amounts1[amounts1.length - 1],
          path.slice().reverse()
        );
      }
      
      const finalAmount = amounts2[amounts2.length - 1];
      const profit = finalAmount > amount ? finalAmount - amount : 0n;
      
      if (profit > this.MIN_PROFIT_THRESHOLD) {
        const gasEstimate = await this.estimateGasCost(chainId);
        const profitAfterGas = profit - gasEstimate;
        
        if (profitAfterGas > 0n) {
          return {
            tokenA: path[0],
            tokenB: path[1],
            amountIn: amount.toString(),
            expectedProfit: profitAfterGas.toString(),
            sushiFirst,
            path: path,
            gasEstimate: gasEstimate.toString(),
            timestamp: Date.now(),
            chainId
          };
        }
      }
      
      return null;
      
    } catch (error) {
      logger.error(chalk.red("Error checking arbitrage opportunity:"), error);
      return null;
    }
  }
  
  async checkTriangularArbitrageOpportunity(
    amount: bigint,
    path: string[]
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Simulate triangular arbitrage: A -> B -> C -> A
      const router1 = new ethers.Contract(this.UNI_V2_ROUTER_ARB, uniswapV2RouterABI, this.arbitrumProvider);
      const router2 = new ethers.Contract(this.SUSHI_ROUTER_ARB, sushiSwapRouterABI, this.arbitrumProvider);
      
      // Step 1: A -> B
      const pathAB = [path[0], path[1]];
      const amounts1 = await router1.getAmountsOut(amount, pathAB);
      const amountB = amounts1[amounts1.length - 1];
      
      // Step 2: B -> C
      const pathBC = [path[1], path[2]];
      const amounts2 = await router2.getAmountsOut(amountB, pathBC);
      const amountC = amounts2[amounts2.length - 1];
      
      // Step 3: C -> A
      const pathCA = [path[2], path[0]];
      const amounts3 = await router1.getAmountsOut(amountC, pathCA);
      const finalAmount = amounts3[amounts3.length - 1];
      
      const profit = finalAmount > amount ? finalAmount - amount : 0n;
      
      if (profit > this.MIN_PROFIT_THRESHOLD) {
        const gasEstimate = await this.estimateGasCost(42161);
        const profitAfterGas = profit - gasEstimate;
        
        if (profitAfterGas > 0n) {
          return {
            tokenA: path[0],
            tokenB: path[1],
            amountIn: amount.toString(),
            expectedProfit: profitAfterGas.toString(),
            sushiFirst: false,
            path: path,
            gasEstimate: gasEstimate.toString(),
            timestamp: Date.now(),
            isTriangular: true,
            chainId: 42161
          };
        }
      }
      
      return null;
      
    } catch (error) {
      logger.error(chalk.red("Error checking triangular arbitrage opportunity:"), error);
      return null;
    }
  }
  
  async scanCrossChainOpportunities(): Promise<CrossChainOpportunity[]> {
    const opportunities: CrossChainOpportunity[] = [];
    
    try {
      const pairs = [
        { tokenA: this.WETH_ARB, tokenB: this.USDT_ARB, tokenA_opt: this.WETH_OPT, tokenB_opt: this.USDT_OPT },
        { tokenA: this.WBTC_ARB, tokenB: this.WETH_ARB, tokenA_opt: this.WBTC_OPT, tokenB_opt: this.WETH_OPT },
      ];
      
      const amount = ethers.parseEther("1");
      
      for (const pair of pairs) {
        const arbPath = [pair.tokenA, pair.tokenB];
        const optPath = [pair.tokenA_opt, pair.tokenB_opt];
        
        // Get prices on both chains
        const arbRouter = new ethers.Contract(this.UNI_V2_ROUTER_ARB, uniswapV2RouterABI, this.arbitrumProvider);
        const optRouter = new ethers.Contract(this.UNI_V2_ROUTER_OPT, uniswapV2RouterABI, this.optimismProvider);
        
        const arbAmounts = await arbRouter.getAmountsOut(amount, arbPath);
        const optAmounts = await optRouter.getAmountsOut(amount, optPath);
        
        const arbPrice = arbAmounts[arbAmounts.length - 1];
        const optPrice = optAmounts[optAmounts.length - 1];
        
        // Calculate spread
        const spread = arbPrice > optPrice ? 
          Number(arbPrice - optPrice) / Number(optPrice) :
          Number(optPrice - arbPrice) / Number(arbPrice);
        
        if (spread >= this.MIN_CROSS_CHAIN_SPREAD) {
          const bridgeCost = ethers.parseEther("0.005"); // Estimated bridge cost
          const potentialProfit = arbPrice > optPrice ? 
            (arbPrice - optPrice) - bridgeCost :
            (optPrice - arbPrice) - bridgeCost;
          
          opportunities.push({
            tokenA: pair.tokenA,
            tokenB: pair.tokenB,
            amountIn: amount.toString(),
            arbitrumPrice: arbPrice.toString(),
            optimismPrice: optPrice.toString(),
            spread: (spread * 100).toFixed(4),
            estimatedProfit: potentialProfit.toString(),
            bridgeCost: bridgeCost.toString(),
            timestamp: Date.now()
          });
        }
      }
      
      return opportunities;
      
    } catch (error) {
      logger.error(chalk.red("Error scanning cross-chain opportunities:"), error);
      return [];
    }
  }

  async estimateGasCost(chainId: number = 42161): Promise<bigint> {
    try {
      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      const gasPrice = await provider.getFeeData();
      const baseFee = gasPrice.gasPrice || ethers.parseUnits("1", "gwei");
      const priorityFee = this.MAX_PRIORITY_FEE;
      
      return this.GAS_LIMIT * (baseFee + priorityFee);
    } catch (error) {
      logger.error(chalk.red("Error estimating gas cost:"), error);
      return ethers.parseEther("0.01"); // Default fallback
    }
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<boolean> {
    try {
      const now = Date.now();
      if (now - this.lastExecutionTime < this.COOLDOWN_PERIOD) {
        logger.info(chalk.yellow("Cooldown period active, skipping execution"));
        return false;
      }
      
      const chainId = opportunity.chainId || 42161;
      const isArbitrum = chainId === 42161;
      
      logger.info(chalk.cyan(`🚀 Executing ${opportunity.isTriangular ? 'triangular ' : ''}arbitrage opportunity on ${isArbitrum ? 'Arbitrum' : 'Optimism'}:`));
      logger.info(chalk.cyan(`  Amount: ${ethers.formatEther(opportunity.amountIn)} ETH`));
      logger.info(chalk.cyan(`  Expected Profit: ${ethers.formatEther(opportunity.expectedProfit)} ETH`));
      logger.info(chalk.cyan(`  Strategy: ${opportunity.isTriangular ? 'Triangular' : (opportunity.sushiFirst ? 'Sushi First' : 'Uniswap First')}`));
      
      const provider = isArbitrum ? this.arbitrumProvider : this.optimismProvider;
      const wallet = isArbitrum ? this.wallet : this.optimismWallet;
      const botContract = isArbitrum ? this.botContract : this.optimismBotContract;
      
      if (!botContract) {
        logger.error(chalk.red(`Bot contract not deployed on ${isArbitrum ? 'Arbitrum' : 'Optimism'}`));
        return false;
      }
      
      // Create transaction
      let tx;
      if (opportunity.isTriangular) {
        tx = await botContract.executeTriangularArb.populateTransaction(
          opportunity.tokenA,
          opportunity.amountIn,
          opportunity.path,
          opportunity.expectedProfit
        );
      } else {
        tx = await botContract.executeArb.populateTransaction(
          opportunity.tokenA,
          opportunity.amountIn,
          opportunity.path,
          opportunity.sushiFirst,
          opportunity.expectedProfit
        );
      }
      
      // Set gas parameters
      const feeData = await provider.getFeeData();
      tx.gasLimit = this.GAS_LIMIT;
      tx.maxFeePerGas = feeData.gasPrice || ethers.parseUnits("2", "gwei");
      tx.maxPriorityFeePerGas = this.MAX_PRIORITY_FEE;
      tx.nonce = await provider.getTransactionCount(wallet.address);
      
      // Submit as MEV bundle (Arbitrum only for now)
      if (isArbitrum) {
        const bundleSuccess = await this.submitMevBundle([tx]);
        
        if (bundleSuccess) {
          this.lastExecutionTime = now;
          logger.info(chalk.green("✓ Arbitrage executed successfully via MEV bundle"));
          return true;
        } else {
          logger.warn(chalk.yellow("MEV bundle failed, trying direct transaction"));
        }
      }
      
      // Fallback to direct transaction
      const signedTx = await wallet.signTransaction(tx);
      const txResponse = await provider.sendTransaction(signedTx);
      
      logger.info(chalk.blue(`Transaction hash: ${txResponse.hash}`));
      
      const receipt = await txResponse.wait();
      if (receipt?.status === 1) {
        this.lastExecutionTime = now;
        logger.info(chalk.green(`✓ Arbitrage executed successfully via direct transaction on ${isArbitrum ? 'Arbitrum' : 'Optimism'}`));
        return true;
      } else {
        logger.error(chalk.red("Transaction failed"));
        return false;
      }
      
    } catch (error) {
      logger.error(chalk.red("Failed to execute arbitrage:"), error);
      return false;
    }
  }

  async submitMevBundle(transactions: any[]): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const targetBlockNumber = blockNumber + 1;
      
      // Create bundle
      const bundle = {
        transactions: transactions,
        blockNumber: targetBlockNumber,
        minTimestamp: Math.floor(Date.now() / 1000),
        maxTimestamp: Math.floor(Date.now() / 1000) + 60
      };
      
      // Submit to MEV-Share
      const simulation = await this.mevShareClient.sendBundle(bundle);
      
      if (simulation.success) {
        logger.info(chalk.green("✓ MEV bundle submitted successfully"));
        
        // Wait for inclusion
        const result = await this.mevShareClient.getBundleStatus(simulation.bundleHash);
        return result.status === "included";
      } else {
        logger.warn(chalk.yellow("MEV bundle simulation failed"));
        return false;
      }
      
    } catch (error) {
      logger.error(chalk.red("Failed to submit MEV bundle:"), error);
      return false;
    }
  }

  async monitorBlock() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    try {
      logger.info(chalk.blue("🔍 Scanning for arbitrage opportunities..."));
      
      const opportunities = await this.scanForOpportunities();
      
      if (opportunities.length > 0) {
        logger.info(chalk.green(`Found ${opportunities.length} opportunities`));
        
        // Execute the most profitable opportunity
        const bestOpportunity = opportunities[0];
        const success = await this.executeArbitrage(bestOpportunity);
        
        if (success) {
          logger.info(chalk.green("💰 Arbitrage executed successfully!"));
        }
      } else {
        logger.info(chalk.gray("No profitable opportunities found"));
      }
      
    } catch (error) {
      logger.error(chalk.red("Error in monitor block:"), error);
    } finally {
      this.isRunning = false;
    }
  }

  async start() {
    logger.info(chalk.green("🤖 Starting Multi-Chain Arbitrage Bot..."));
    
    // Monitor every 12 seconds (block time)
    cron.schedule("*/12 * * * * *", async () => {
      await this.monitorBlock();
    });
    
    // Monitor new blocks on both chains
    this.arbitrumProvider.on("block", async (blockNumber) => {
      logger.info(chalk.blue(`📦 Arbitrum block: ${blockNumber}`));
      await this.monitorBlock();
    });
    
    if (this.crossChainMonitoringActive) {
      this.optimismProvider.on("block", async (blockNumber) => {
        logger.info(chalk.blue(`📦 Optimism block: ${blockNumber}`));
        await this.monitorBlock();
      });
    }
    
    logger.info(chalk.green("✓ Multi-chain bot started successfully"));
  }

  async stop() {
    logger.info(chalk.yellow("🛑 Stopping Multi-Chain Arbitrage Bot..."));
    this.arbitrumProvider.removeAllListeners();
    this.optimismProvider.removeAllListeners();
    logger.info(chalk.yellow("✓ Multi-chain bot stopped"));
  }
}

async function main() {
  const bot = new ArbitrageBot();
  
  try {
    await bot.initialize();
    await bot.start();
    
    // Graceful shutdown
    process.on("SIGINT", async () => {
      await bot.stop();
      process.exit(0);
    });
    
    process.on("SIGTERM", async () => {
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(chalk.red("Failed to start bot:"), error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error(chalk.red("Uncaught exception:"), error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(chalk.red("Unhandled rejection at:"), promise, "reason:", reason);
  process.exit(1);
});

main();
