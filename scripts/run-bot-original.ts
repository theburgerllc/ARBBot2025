import { ethers } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleTransaction, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { MevShareClient } from "@flashbots/mev-share-client";
import dotenv from "dotenv";
import chalk from "chalk";
import winston from "winston";
import cron from "node-cron";
import Big from "big.js";
import axios from "axios";

import balancerVaultABI from "../abi/BalancerVault.json";
import uniswapV2RouterABI from "../abi/UniswapV2Router.json";
import sushiSwapRouterABI from "../abi/SushiSwapRouter.json";
import uniswapV3QuoterABI from "../abi/UniswapV3Quoter.json";
import erc20ABI from "../abi/ERC20.json";

dotenv.config();

// Enhanced logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: "bot.log" }),
    new winston.transports.File({ filename: "bot-error.log", level: "error" })
  ]
});

// CLI configuration interface
interface CLIConfig {
  simulate: boolean;
  verbose: boolean;
  help: boolean;
  crossChain: boolean;
  triangular: boolean;
}

// Enhanced interfaces for MEV operations
interface ArbitrageOpportunity {
  id: string;
  tokenA: string;
  tokenB: string;
  amountIn: string;
  expectedProfit: string;
  netProfit: string;
  sushiFirst: boolean;
  path: string[];
  gasEstimate: string;
  gasCost: string;
  timestamp: number;
  isTriangular?: boolean;
  chainId: number;
  priority: number;
  spread: number;
  slippage: number;
}

interface CrossChainOpportunity {
  id: string;
  tokenA: string;
  tokenB: string;
  amountIn: string;
  arbitrumPrice: string;
  optimismPrice: string;
  spread: string;
  estimatedProfit: string;
  bridgeCost: string;
  netProfit: string;
  timestamp: number;
  profitable: boolean;
  alertLevel: 'info' | 'warning' | 'critical';
}

interface MEVBundle {
  transactions: FlashbotsBundleTransaction[];
  targetBlockNumber: number;
  bundleHash?: string;
  simulation?: any;
  gasUsed?: string;
  gasPrice?: string;
  profit?: string;
}

interface TokenPair {
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  decimalsA: number;
  decimalsB: number;
  minAmount: string;
  maxAmount: string;
}

interface GasSettings {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  baseFee: bigint;
}

class EnhancedMEVBot {
  // Provider setup
  private arbitrumProvider: ethers.JsonRpcProvider;
  private optimismProvider: ethers.JsonRpcProvider;
  private executorSigner: ethers.Wallet;
  private authSigner: ethers.Wallet;
  private optimismExecutor: ethers.Wallet;
  
  // Flashbots integration
  private flashbotsProvider: FlashbotsBundleProvider;
  private mevShareClient: MevShareClient;
  
  // Contract instances
  private arbBotContract: ethers.Contract;
  private optBotContract: ethers.Contract;
  private arbBalancerVault: ethers.Contract;
  private optBalancerVault: ethers.Contract;
  
  // Router contracts - Arbitrum
  private arbUniV2Router: ethers.Contract;
  private arbSushiRouter: ethers.Contract;
  private arbUniV3Quoter: ethers.Contract;
  
  // Router contracts - Optimism
  private optUniV2Router: ethers.Contract;
  private optSushiRouter: ethers.Contract;
  private optUniV3Quoter: ethers.Contract;
  
  // Token addresses - Arbitrum
  private readonly TOKENS_ARB = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
  };
  
  // Token addresses - Optimism
  private readonly TOKENS_OPT = {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    WBTC: "0x68f180fcCe6836688e9084f035309E29Bf0A2095"
  };
  
  // Router addresses
  private readonly ROUTERS_ARB = {
    UNISWAP_V2: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
    SUSHISWAP: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
    UNISWAP_V3_QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
  };
  
  private readonly ROUTERS_OPT = {
    UNISWAP_V2: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
    SUSHISWAP: "0x2ABf469074dc0b54d793850807E6eb5Faf2625b1",
    UNISWAP_V3_QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
  };
  
  // Trading pairs configuration
  private readonly TRADING_PAIRS: TokenPair[] = [
    {
      tokenA: this.TOKENS_ARB.WETH,
      tokenB: this.TOKENS_ARB.USDT,
      symbolA: "WETH",
      symbolB: "USDT",
      decimalsA: 18,
      decimalsB: 6,
      minAmount: ethers.parseEther("0.1").toString(),
      maxAmount: ethers.parseEther("10").toString()
    },
    {
      tokenA: this.TOKENS_ARB.WBTC,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "WBTC",
      symbolB: "WETH",
      decimalsA: 8,
      decimalsB: 18,
      minAmount: ethers.parseUnits("0.01", 8).toString(),
      maxAmount: ethers.parseUnits("1", 8).toString()
    }
  ];
  
  // Configuration constants
  private readonly MIN_PROFIT_THRESHOLD = ethers.parseEther("0.01");
  private readonly MIN_CROSS_CHAIN_SPREAD = 0.0005; // 0.05%
  private readonly CRITICAL_SPREAD_THRESHOLD = 0.002; // 0.2%
  private readonly MAX_SLIPPAGE = 0.03; // 3%
  private readonly BUNDLE_TIMEOUT = 30000; // 30 seconds
  private readonly PRICE_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly GAS_LIMIT = 800000n;
  private readonly MAX_PRIORITY_FEE = ethers.parseUnits("3", "gwei");
  private readonly COOLDOWN_PERIOD = 15000; // 15 seconds
  
  // State management
  private lastExecutionTime = 0;
  private isRunning = false;
  private crossChainEnabled = false;
  private triangularEnabled = false;
  private simulationMode = false;
  private verboseMode = false;
  private circuitBreakerTripped = false;
  private totalProfit = BigInt(0);
  private totalLoss = BigInt(0);
  private executionCount = 0;
  private opportunityCache = new Map<string, ArbitrageOpportunity>();
  private simulationStats = {
    opportunitiesDetected: 0,
    potentialProfit: BigInt(0),
    gasEstimated: BigInt(0),
    executionTime: 0
  };
  
  constructor(cliConfig?: Partial<CLIConfig>) {
    this.initializeConfiguration(cliConfig);
    this.setupProviders();
    this.setupSigners();
    this.initializeContracts();
  }
  
  private initializeConfiguration(cliConfig?: Partial<CLIConfig>): void {
    // CLI arguments override environment variables
    this.crossChainEnabled = cliConfig?.crossChain ?? process.env.ENABLE_CROSS_CHAIN_MONITORING === "true";
    this.triangularEnabled = cliConfig?.triangular ?? process.env.ENABLE_TRIANGULAR_ARBITRAGE === "true";
    this.simulationMode = cliConfig?.simulate ?? process.env.ENABLE_SIMULATION_MODE === "true";
    this.verboseMode = cliConfig?.verbose ?? process.env.VERBOSE_LOGGING === "true";
    
    // Set log level based on verbose mode
    if (this.verboseMode) {
      logger.level = 'debug';
    }
    
    logger.info(chalk.blue("🔧 Configuration initialized"), {
      crossChain: this.crossChainEnabled,
      triangular: this.triangularEnabled,
      simulation: this.simulationMode,
      verbose: this.verboseMode
    });
  }
  
  private setupProviders(): void {
    this.arbitrumProvider = new ethers.JsonRpcProvider(process.env.ARB_RPC!, {
      name: "arbitrum",
      chainId: 42161
    });
    
    this.optimismProvider = new ethers.JsonRpcProvider(process.env.OPT_RPC!, {
      name: "optimism",
      chainId: 10
    });
    
    logger.info(chalk.green("✅ Providers initialized"));
  }
  
  private setupSigners(): void {
    this.executorSigner = new ethers.Wallet(process.env.PRIVATE_KEY!, this.arbitrumProvider);
    this.authSigner = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY!, this.arbitrumProvider);
    this.optimismExecutor = new ethers.Wallet(process.env.PRIVATE_KEY!, this.optimismProvider);
    
    logger.info(chalk.green("✅ Signers configured"), {
      executor: this.executorSigner.address,
      auth: this.authSigner.address
    });
  }
  
  private initializeContracts(): void {
    // Arbitrum contracts
    this.arbBotContract = new ethers.Contract(
      process.env.BOT_CONTRACT_ADDRESS!,
      [], // ABI would be loaded from compilation
      this.executorSigner
    );
    
    this.arbBalancerVault = new ethers.Contract(
      process.env.BALANCER_VAULT_ADDRESS!,
      balancerVaultABI,
      this.executorSigner
    );
    
    this.arbUniV2Router = new ethers.Contract(
      this.ROUTERS_ARB.UNISWAP_V2,
      uniswapV2RouterABI,
      this.executorSigner
    );
    
    this.arbSushiRouter = new ethers.Contract(
      this.ROUTERS_ARB.SUSHISWAP,
      sushiSwapRouterABI,
      this.executorSigner
    );
    
    this.arbUniV3Quoter = new ethers.Contract(
      this.ROUTERS_ARB.UNISWAP_V3_QUOTER,
      uniswapV3QuoterABI,
      this.executorSigner
    );
    
    // Optimism contracts (if cross-chain enabled)
    if (this.crossChainEnabled && process.env.OPT_BOT_CONTRACT_ADDRESS) {
      this.optBotContract = new ethers.Contract(
        process.env.OPT_BOT_CONTRACT_ADDRESS,
        [],
        this.optimismExecutor
      );
      
      this.optBalancerVault = new ethers.Contract(
        process.env.OPT_BALANCER_VAULT_ADDRESS!,
        balancerVaultABI,
        this.optimismExecutor
      );
      
      this.optUniV2Router = new ethers.Contract(
        this.ROUTERS_OPT.UNISWAP_V2,
        uniswapV2RouterABI,
        this.optimismExecutor
      );
      
      this.optSushiRouter = new ethers.Contract(
        this.ROUTERS_OPT.SUSHISWAP,
        sushiSwapRouterABI,
        this.optimismExecutor
      );
      
      this.optUniV3Quoter = new ethers.Contract(
        this.ROUTERS_OPT.UNISWAP_V3_QUOTER,
        uniswapV3QuoterABI,
        this.optimismExecutor
      );
    }
    
    logger.info(chalk.green("✅ Contracts initialized"));
  }
  
  async initialize(): Promise<void> {
    try {
      // Initialize Flashbots provider
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.arbitrumProvider,
        this.authSigner,
        process.env.FLASHBOTS_RELAY_URL || "https://relay.flashbots.net",
        "arbitrum"
      );
      
      // Initialize MEV-Share client
      this.mevShareClient = new MevShareClient({
        name: "enhanced-arb-bot",
        url: process.env.MEV_SHARE_URL || "https://mev-share.flashbots.net",
        signer: this.authSigner
      });
      
      // Verify balances
      const arbBalance = await this.arbitrumProvider.getBalance(this.executorSigner.address);
      const optBalance = this.crossChainEnabled ? 
        await this.optimismProvider.getBalance(this.optimismExecutor.address) : 0n;
      
      logger.info(chalk.green("🚀 Enhanced MEV Bot initialized"), {
        arbitrumBalance: ethers.formatEther(arbBalance),
        optimismBalance: ethers.formatEther(optBalance),
        flashbotsEnabled: true,
        mevShareEnabled: true
      });
      
      // Check circuit breaker
      await this.checkCircuitBreaker();
      
    } catch (error) {
      logger.error(chalk.red("❌ Initialization failed"), error);
      throw error;
    }
  }
  
  async scanForArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    try {
      // Scan Arbitrum opportunities
      const arbOpps = await this.scanChainOpportunities(42161);
      opportunities.push(...arbOpps);
      
      // Scan Optimism opportunities (if enabled)
      if (this.crossChainEnabled) {
        const optOpps = await this.scanChainOpportunities(10);
        opportunities.push(...optOpps);
      }
      
      // Scan triangular opportunities
      if (this.triangularEnabled) {
        const triangularOpps = await this.scanTriangularOpportunities();
        opportunities.push(...triangularOpps);
      }
      
      // Sort by priority and net profit
      opportunities.sort((a, b) => {
        const priorityDiff = b.priority - a.priority;
        if (priorityDiff !== 0) return priorityDiff;
        return Big(b.netProfit).minus(Big(a.netProfit)).toNumber();
      });
      
      // Cache opportunities
      opportunities.forEach(opp => {
        this.opportunityCache.set(opp.id, opp);
      });
      
      return opportunities;
      
    } catch (error) {
      logger.error(chalk.red("Error scanning opportunities"), error);
      return [];
    }
  }
  
  private async scanChainOpportunities(chainId: number): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
    const uniRouter = chainId === 42161 ? this.arbUniV2Router : this.optUniV2Router;
    const sushiRouter = chainId === 42161 ? this.arbSushiRouter : this.optSushiRouter;
    const tokens = chainId === 42161 ? this.TOKENS_ARB : this.TOKENS_OPT;
    
    const amounts = [
      ethers.parseEther("1"),
      ethers.parseEther("2"),
      ethers.parseEther("5"),
      ethers.parseEther("10")
    ];
    
    for (const pair of this.TRADING_PAIRS) {
      const tokenA = chainId === 42161 ? pair.tokenA : this.getOptimismToken(pair.tokenA);
      const tokenB = chainId === 42161 ? pair.tokenB : this.getOptimismToken(pair.tokenB);
      
      for (const amount of amounts) {
        // Check both directions
        const opp1 = await this.checkDualRouterArbitrage(
          tokenA, tokenB, amount, true, chainId
        );
        const opp2 = await this.checkDualRouterArbitrage(
          tokenA, tokenB, amount, false, chainId
        );
        
        if (opp1) opportunities.push(opp1);
        if (opp2) opportunities.push(opp2);
      }
    }
    
    return opportunities;
  }
  
  private async checkDualRouterArbitrage(
    tokenA: string,
    tokenB: string,
    amount: bigint,
    sushiFirst: boolean,
    chainId: number
  ): Promise<ArbitrageOpportunity | null> {
    try {
      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      const uniRouter = chainId === 42161 ? this.arbUniV2Router : this.optUniV2Router;
      const sushiRouter = chainId === 42161 ? this.arbSushiRouter : this.optSushiRouter;
      
      const path = [tokenA, tokenB];
      const reversePath = [tokenB, tokenA];
      
      // Get quotes from both routers
      const router1 = sushiFirst ? sushiRouter : uniRouter;
      const router2 = sushiFirst ? uniRouter : sushiRouter;
      
      const amounts1 = await router1.getAmountsOut(amount, path);
      const amounts2 = await router2.getAmountsOut(amounts1[1], reversePath);
      
      const finalAmount = amounts2[1];
      const grossProfit = finalAmount > amount ? finalAmount - amount : 0n;
      
      if (grossProfit === 0n) return null;
      
      // Calculate gas costs
      const gasSettings = await this.estimateGasSettings(chainId);
      const gasCost = gasSettings.gasLimit * gasSettings.maxFeePerGas;
      
      // Calculate net profit
      const netProfit = grossProfit > gasCost ? grossProfit - gasCost : 0n;
      
      if (netProfit < this.MIN_PROFIT_THRESHOLD) return null;
      
      // Calculate spread and priority
      const spread = Number(grossProfit * 10000n / amount) / 10000; // percentage
      const priority = this.calculatePriority(netProfit, spread, chainId);
      
      const opportunity: ArbitrageOpportunity = {
        id: `${tokenA}-${tokenB}-${amount}-${sushiFirst}-${chainId}-${Date.now()}`,
        tokenA,
        tokenB,
        amountIn: amount.toString(),
        expectedProfit: grossProfit.toString(),
        netProfit: netProfit.toString(),
        sushiFirst,
        path,
        gasEstimate: gasSettings.gasLimit.toString(),
        gasCost: gasCost.toString(),
        timestamp: Date.now(),
        chainId,
        priority,
        spread,
        slippage: 0.02 // 2% default slippage
      };
      
      return opportunity;
      
    } catch (error) {
      logger.error(chalk.red("Error checking dual router arbitrage"), error);
      return null;
    }
  }
  
  private async scanTriangularOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    if (!this.triangularEnabled) return opportunities;
    
    // ETH -> USDT -> USDC -> ETH
    const triangularPath = [
      this.TOKENS_ARB.WETH,
      this.TOKENS_ARB.USDT,
      this.TOKENS_ARB.USDC,
      this.TOKENS_ARB.WETH
    ];
    
    const amounts = [
      ethers.parseEther("1"),
      ethers.parseEther("5"),
      ethers.parseEther("10")
    ];
    
    for (const amount of amounts) {
      const opp = await this.checkTriangularArbitrage(amount, triangularPath);
      if (opp) opportunities.push(opp);
    }
    
    return opportunities;
  }
  
  private async checkTriangularArbitrage(
    amount: bigint,
    path: string[]
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Step 1: WETH -> USDT (Uniswap)
      const path1 = [path[0], path[1]];
      const amounts1 = await this.arbUniV2Router.getAmountsOut(amount, path1);
      const usdtAmount = amounts1[1];
      
      // Step 2: USDT -> USDC (SushiSwap)
      const path2 = [path[1], path[2]];
      const amounts2 = await this.arbSushiRouter.getAmountsOut(usdtAmount, path2);
      const usdcAmount = amounts2[1];
      
      // Step 3: USDC -> WETH (Uniswap)
      const path3 = [path[2], path[3]];
      const amounts3 = await this.arbUniV2Router.getAmountsOut(usdcAmount, path3);
      const finalAmount = amounts3[1];
      
      const grossProfit = finalAmount > amount ? finalAmount - amount : 0n;
      
      if (grossProfit === 0n) return null;
      
      // Calculate gas costs (higher for triangular)
      const gasSettings = await this.estimateGasSettings(42161);
      const gasCost = gasSettings.gasLimit * gasSettings.maxFeePerGas * 2n; // 2x for complexity
      
      const netProfit = grossProfit > gasCost ? grossProfit - gasCost : 0n;
      
      if (netProfit < this.MIN_PROFIT_THRESHOLD) return null;
      
      const spread = Number(grossProfit * 10000n / amount) / 10000;
      const priority = this.calculatePriority(netProfit, spread, 42161) + 1; // Higher priority
      
      const opportunity: ArbitrageOpportunity = {
        id: `triangular-${amount}-${Date.now()}`,
        tokenA: path[0],
        tokenB: path[1],
        amountIn: amount.toString(),
        expectedProfit: grossProfit.toString(),
        netProfit: netProfit.toString(),
        sushiFirst: false,
        path,
        gasEstimate: (gasSettings.gasLimit * 2n).toString(),
        gasCost: gasCost.toString(),
        timestamp: Date.now(),
        isTriangular: true,
        chainId: 42161,
        priority,
        spread,
        slippage: 0.03 // 3% slippage for triangular
      };
      
      return opportunity;
      
    } catch (error) {
      logger.error(chalk.red("Error checking triangular arbitrage"), error);
      return null;
    }
  }
  
  async scanCrossChainOpportunities(): Promise<CrossChainOpportunity[]> {
    const opportunities: CrossChainOpportunity[] = [];
    
    if (!this.crossChainEnabled) return opportunities;
    
    try {
      // Check ETH/USDT spread
      const ethUsdtSpread = await this.checkCrossChainSpread(
        this.TOKENS_ARB.WETH,
        this.TOKENS_ARB.USDT,
        this.TOKENS_OPT.WETH,
        this.TOKENS_OPT.USDT,
        "ETH/USDT"
      );
      
      if (ethUsdtSpread) opportunities.push(ethUsdtSpread);
      
      // Check WBTC/ETH spread
      const wbtcEthSpread = await this.checkCrossChainSpread(
        this.TOKENS_ARB.WBTC,
        this.TOKENS_ARB.WETH,
        this.TOKENS_OPT.WBTC,
        this.TOKENS_OPT.WETH,
        "WBTC/ETH"
      );
      
      if (wbtcEthSpread) opportunities.push(wbtcEthSpread);
      
      // Log alerts for significant spreads
      opportunities.forEach(opp => {
        if (opp.alertLevel === 'critical') {
          logger.warn(chalk.red(`🚨 CRITICAL CROSS-CHAIN SPREAD: ${opp.spread}%`), opp);
        } else if (opp.alertLevel === 'warning') {
          logger.info(chalk.yellow(`⚠️ Cross-chain spread detected: ${opp.spread}%`), opp);
        }
      });
      
      return opportunities;
      
    } catch (error) {
      logger.error(chalk.red("Error scanning cross-chain opportunities"), error);
      return [];
    }
  }
  
  private async checkCrossChainSpread(
    tokenA_arb: string,
    tokenB_arb: string,
    tokenA_opt: string,
    tokenB_opt: string,
    pairName: string
  ): Promise<CrossChainOpportunity | null> {
    try {
      const amount = ethers.parseEther("1");
      
      // Get Arbitrum price
      const arbPath = [tokenA_arb, tokenB_arb];
      const arbAmounts = await this.arbUniV2Router.getAmountsOut(amount, arbPath);
      const arbPrice = arbAmounts[1];
      
      // Get Optimism price
      const optPath = [tokenA_opt, tokenB_opt];
      const optAmounts = await this.optUniV2Router.getAmountsOut(amount, optPath);
      const optPrice = optAmounts[1];
      
      // Calculate spread
      const spread = arbPrice > optPrice ? 
        Number((arbPrice - optPrice) * 10000n / optPrice) / 10000 :
        Number((optPrice - arbPrice) * 10000n / arbPrice) / 10000;
      
      if (spread < this.MIN_CROSS_CHAIN_SPREAD) return null;
      
      // Calculate bridge cost and net profit
      const bridgeCost = ethers.parseEther(process.env.BRIDGE_COST_ESTIMATE || "0.005");
      const grossProfit = arbPrice > optPrice ? arbPrice - optPrice : optPrice - arbPrice;
      const netProfit = grossProfit > bridgeCost ? grossProfit - bridgeCost : 0n;
      
      const alertLevel = spread >= this.CRITICAL_SPREAD_THRESHOLD ? 'critical' : 'warning';
      
      const opportunity: CrossChainOpportunity = {
        id: `crosschain-${pairName}-${Date.now()}`,
        tokenA: tokenA_arb,
        tokenB: tokenB_arb,
        amountIn: amount.toString(),
        arbitrumPrice: arbPrice.toString(),
        optimismPrice: optPrice.toString(),
        spread: (spread * 100).toFixed(4),
        estimatedProfit: grossProfit.toString(),
        bridgeCost: bridgeCost.toString(),
        netProfit: netProfit.toString(),
        timestamp: Date.now(),
        profitable: netProfit > 0n,
        alertLevel
      };
      
      return opportunity;
      
    } catch (error) {
      logger.error(chalk.red("Error checking cross-chain spread"), error);
      return null;
    }
  }
  
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<boolean> {
    try {
      const now = Date.now();
      if (now - this.lastExecutionTime < this.COOLDOWN_PERIOD) {
        logger.info(chalk.yellow("⏱️ Cooldown period active"));
        return false;
      }
      
      if (this.circuitBreakerTripped) {
        logger.error(chalk.red("🚨 Circuit breaker tripped - execution disabled"));
        return false;
      }
      
      logger.info(chalk.cyan("🚀 Executing arbitrage opportunity"), {
        id: opportunity.id,
        profit: ethers.formatEther(opportunity.netProfit),
        spread: opportunity.spread,
        chain: opportunity.chainId === 42161 ? 'Arbitrum' : 'Optimism'
      });
      
      if (this.simulationMode) {
        logger.info(chalk.blue("🎯 SIMULATION MODE - No actual execution"));
        await this.performStaticSimulation(opportunity);
        this.updateSimulationStats(opportunity);
        return true;
      }
      
      // Create MEV bundle
      const bundle = await this.createMEVBundle(opportunity);
      if (!bundle) return false;
      
      // Submit bundle to Flashbots
      const success = await this.submitMEVBundle(bundle);
      
      if (success) {
        this.lastExecutionTime = now;
        this.executionCount++;
        this.totalProfit += BigInt(opportunity.netProfit);
        
        logger.info(chalk.green("✅ Arbitrage executed successfully"), {
          profit: ethers.formatEther(opportunity.netProfit),
          totalProfit: ethers.formatEther(this.totalProfit),
          executions: this.executionCount
        });
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error(chalk.red("❌ Failed to execute arbitrage"), error);
      this.totalLoss += BigInt(opportunity.gasCost);
      await this.checkCircuitBreaker();
      return false;
    }
  }
  
  private async createMEVBundle(opportunity: ArbitrageOpportunity): Promise<MEVBundle | null> {
    try {
      const provider = opportunity.chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      const botContract = opportunity.chainId === 42161 ? this.arbBotContract : this.optBotContract;
      const signer = opportunity.chainId === 42161 ? this.executorSigner : this.optimismExecutor;
      
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
      }\n      \n      // Set gas parameters with dynamic pricing\n      const gasSettings = await this.estimateGasSettings(opportunity.chainId);\n      tx.gasLimit = gasSettings.gasLimit;\n      tx.maxFeePerGas = gasSettings.maxFeePerGas;\n      tx.maxPriorityFeePerGas = gasSettings.maxPriorityFeePerGas;\n      tx.nonce = await provider.getTransactionCount(signer.address);\n      \n      const currentBlock = await provider.getBlockNumber();\n      const targetBlockNumber = currentBlock + 1;\n      \n      const bundleTransaction: FlashbotsBundleTransaction = {\n        signer: signer,\n        transaction: tx\n      };\n      \n      const bundle: MEVBundle = {\n        transactions: [bundleTransaction],\n        targetBlockNumber\n      };\n      \n      return bundle;\n      \n    } catch (error) {\n      logger.error(chalk.red(\"Error creating MEV bundle\"), error);\n      return null;\n    }\n  }\n  \n  private async submitMEVBundle(bundle: MEVBundle): Promise<boolean> {\n    try {\n      // Simulate bundle first\n      const simulation = await this.flashbotsProvider.simulate(\n        bundle.transactions,\n        bundle.targetBlockNumber\n      );\n      \n      if (simulation.error) {\n        logger.error(chalk.red(\"Bundle simulation failed\"), simulation.error);\n        return false;\n      }\n      \n      bundle.simulation = simulation;\n      bundle.gasUsed = simulation.totalGasUsed?.toString();\n      \n      logger.info(chalk.blue(\"📊 Bundle simulation successful\"), {\n        gasUsed: simulation.totalGasUsed?.toString(),\n        profit: simulation.coinbaseDiff?.toString()\n      });\n      \n      // Submit bundle\n      const bundleSubmission = await this.flashbotsProvider.sendBundle(\n        bundle.transactions,\n        bundle.targetBlockNumber\n      );\n      \n      if (bundleSubmission.error) {\n        logger.error(chalk.red(\"Bundle submission failed\"), bundleSubmission.error);\n        return false;\n      }\n      \n      bundle.bundleHash = bundleSubmission.bundleHash;\n      \n      // Wait for bundle resolution\n      const resolution = await bundleSubmission.wait();\n      \n      if (resolution === FlashbotsBundleResolution.BundleIncluded) {\n        logger.info(chalk.green(\"✅ Bundle included in block\"), {\n          bundleHash: bundle.bundleHash,\n          blockNumber: bundle.targetBlockNumber\n        });\n        return true;\n      } else if (resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {\n        logger.warn(chalk.yellow(\"⚠️ Bundle not included - block passed\"));\n        return false;\n      } else {\n        logger.warn(chalk.yellow(\"⚠️ Bundle resolution unknown\"));\n        return false;\n      }\n      \n    } catch (error) {\n      logger.error(chalk.red(\"Error submitting MEV bundle\"), error);\n      return false;\n    }\n  }\n  \n  private async estimateGasSettings(chainId: number): Promise<GasSettings> {\n    try {\n      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;\n      const feeData = await provider.getFeeData();\n      \n      const baseFee = feeData.gasPrice || ethers.parseUnits(\"1\", \"gwei\");\n      const maxPriorityFee = this.MAX_PRIORITY_FEE;\n      \n      // Dynamic gas pricing based on network congestion\n      const congestionMultiplier = await this.getNetworkCongestionMultiplier(chainId);\n      const adjustedBaseFee = baseFee * BigInt(Math.floor(congestionMultiplier * 100)) / 100n;\n      \n      return {\n        gasLimit: this.GAS_LIMIT,\n        maxFeePerGas: adjustedBaseFee + maxPriorityFee,\n        maxPriorityFeePerGas: maxPriorityFee,\n        baseFee: adjustedBaseFee\n      };\n      \n    } catch (error) {\n      logger.error(chalk.red(\"Error estimating gas settings\"), error);\n      \n      // Fallback values\n      return {\n        gasLimit: this.GAS_LIMIT,\n        maxFeePerGas: ethers.parseUnits(\"2\", \"gwei\"),\n        maxPriorityFeePerGas: this.MAX_PRIORITY_FEE,\n        baseFee: ethers.parseUnits(\"1\", \"gwei\")\n      };\n    }\n  }\n  \n  private async getNetworkCongestionMultiplier(chainId: number): Promise<number> {\n    try {\n      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;\n      const blockNumber = await provider.getBlockNumber();\n      const block = await provider.getBlock(blockNumber);\n      \n      if (!block) return 1.0;\n      \n      // Simple congestion metric based on gas usage\n      const gasUsedPercentage = Number(block.gasUsed * 100n / block.gasLimit);\n      \n      if (gasUsedPercentage > 90) return 1.5;\n      if (gasUsedPercentage > 70) return 1.3;\n      if (gasUsedPercentage > 50) return 1.1;\n      \n      return 1.0;\n      \n    } catch (error) {\n      logger.error(chalk.red(\"Error calculating congestion multiplier\"), error);\n      return 1.0;\n    }\n  }\n  \n  private calculatePriority(netProfit: bigint, spread: number, chainId: number): number {\n    let priority = 0;\n    \n    // Profit-based priority\n    const profitEth = Number(ethers.formatEther(netProfit));\n    if (profitEth > 0.1) priority += 5;\n    else if (profitEth > 0.05) priority += 3;\n    else if (profitEth > 0.01) priority += 1;\n    \n    // Spread-based priority\n    if (spread > 0.01) priority += 3; // >1%\n    else if (spread > 0.005) priority += 2; // >0.5%\n    else if (spread > 0.002) priority += 1; // >0.2%\n    \n    // Chain-based priority (Arbitrum preferred for MEV)\n    if (chainId === 42161) priority += 1;\n    \n    return priority;\n  }\n  \n  private async checkCircuitBreaker(): Promise<void> {\n    const threshold = ethers.parseEther(process.env.CIRCUIT_BREAKER_THRESHOLD || \"10\");\n    \n    if (this.totalLoss > threshold) {\n      this.circuitBreakerTripped = true;\n      logger.error(chalk.red(\"🚨 CIRCUIT BREAKER TRIPPED\"), {\n        totalLoss: ethers.formatEther(this.totalLoss),\n        threshold: ethers.formatEther(threshold)\n      });\n    }\n  }\n  \n  private getOptimismToken(arbitrumToken: string): string {\n    const mapping: { [key: string]: string } = {\n      [this.TOKENS_ARB.WETH]: this.TOKENS_OPT.WETH,\n      [this.TOKENS_ARB.USDC]: this.TOKENS_OPT.USDC,\n      [this.TOKENS_ARB.USDT]: this.TOKENS_OPT.USDT,\n      [this.TOKENS_ARB.WBTC]: this.TOKENS_OPT.WBTC\n    };\n    \n    return mapping[arbitrumToken] || arbitrumToken;\n  }\n  \n  async monitorAndExecute(): Promise<void> {\n    if (this.isRunning) return;\n    \n    this.isRunning = true;\n    \n    try {\n      logger.info(chalk.blue(\"🔍 Scanning for opportunities...\"));\n      \n      // Scan for arbitrage opportunities\n      const opportunities = await this.scanForArbitrageOpportunities();\n      \n      // Scan for cross-chain opportunities\n      const crossChainOpportunities = await this.scanCrossChainOpportunities();\n      \n      if (opportunities.length > 0) {\n        logger.info(chalk.green(`Found ${opportunities.length} arbitrage opportunities`));\n        \n        // Execute the highest priority opportunity\n        const bestOpportunity = opportunities[0];\n        const success = await this.executeArbitrage(bestOpportunity);\n        \n        if (success) {\n          logger.info(chalk.green(\"💰 Arbitrage executed successfully!\"));\n        }\n      }\n      \n      if (crossChainOpportunities.length > 0) {\n        logger.info(chalk.yellow(`📊 ${crossChainOpportunities.length} cross-chain opportunities detected`));\n      }\n      \n      if (opportunities.length === 0 && crossChainOpportunities.length === 0) {\n        logger.info(chalk.gray(\"No profitable opportunities found\"));\n      }\n      \n    } catch (error) {\n      logger.error(chalk.red(\"Error in monitoring cycle\"), error);\n    } finally {\n      this.isRunning = false;\n    }\n  }\n  \n  async start(): Promise<void> {\n    logger.info(chalk.green(\"🤖 Starting Enhanced MEV Arbitrage Bot...\"));\n    \n    // Monitor every 5 seconds\n    cron.schedule(\"*/5 * * * * *\", async () => {\n      await this.monitorAndExecute();\n    });\n    \n    // Monitor new blocks on Arbitrum\n    this.arbitrumProvider.on(\"block\", async (blockNumber) => {\n      logger.info(chalk.blue(`📦 Arbitrum block: ${blockNumber}`));\n      await this.monitorAndExecute();\n    });\n    \n    // Monitor new blocks on Optimism (if enabled)\n    if (this.crossChainEnabled) {\n      this.optimismProvider.on(\"block\", async (blockNumber) => {\n        logger.info(chalk.blue(`📦 Optimism block: ${blockNumber}`));\n        await this.monitorAndExecute();\n      });\n    }\n    \n    // Periodic cross-chain monitoring\n    if (this.crossChainEnabled) {\n      setInterval(async () => {\n        await this.scanCrossChainOpportunities();\n      }, this.PRICE_UPDATE_INTERVAL);\n    }\n    \n    logger.info(chalk.green(\"✅ Enhanced MEV bot started successfully\"));\n  }\n  \n  async stop(): Promise<void> {\n    logger.info(chalk.yellow(\"🛑 Stopping Enhanced MEV Bot...\"));\n    \n    this.arbitrumProvider.removeAllListeners();\n    if (this.crossChainEnabled) {\n      this.optimismProvider.removeAllListeners();\n    }\n    \n    // Log final statistics\n    logger.info(chalk.blue(\"📊 Final Statistics\"), {\n      totalProfit: ethers.formatEther(this.totalProfit),\n      totalLoss: ethers.formatEther(this.totalLoss),\n      netProfit: ethers.formatEther(this.totalProfit - this.totalLoss),\n      executionCount: this.executionCount,\n      circuitBreakerTripped: this.circuitBreakerTripped\n    });\n    \n    logger.info(chalk.yellow(\"✅ Enhanced MEV bot stopped\"));\n  }\n}\n\n// Main execution function\nasync function main(): Promise<void> {\n  const bot = new EnhancedMEVBot();\n  \n  try {\n    await bot.initialize();\n    await bot.start();\n    \n    // Graceful shutdown handlers\n    process.on(\"SIGINT\", async () => {\n      console.log(\"\\n\");\n      logger.info(chalk.yellow(\"Received SIGINT, shutting down gracefully...\"));\n      await bot.stop();\n      process.exit(0);\n    });\n    \n    process.on(\"SIGTERM\", async () => {\n      logger.info(chalk.yellow(\"Received SIGTERM, shutting down gracefully...\"));\n      await bot.stop();\n      process.exit(0);\n    });\n    \n  } catch (error) {\n    logger.error(chalk.red(\"Failed to start Enhanced MEV Bot\"), error);\n    process.exit(1);\n  }\n}\n\n// Global error handlers\nprocess.on(\"uncaughtException\", (error) => {\n  logger.error(chalk.red(\"Uncaught Exception\"), error);\n  process.exit(1);\n});\n\nprocess.on(\"unhandledRejection\", (reason, promise) => {\n  logger.error(chalk.red(\"Unhandled Rejection\"), { reason, promise });\n  process.exit(1);\n});\n\n// Start the bot\nif (require.main === module) {\n  main();\n}\n\nexport { EnhancedMEVBot };"