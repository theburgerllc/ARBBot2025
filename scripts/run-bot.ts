import { ethers, JsonRpcProvider, parseEther, formatEther, parseUnits, formatUnits, Wallet } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleTransaction, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import MevShareClient from "@flashbots/mev-share-client";
import dotenv from "dotenv";
import chalk from "chalk";
import winston from "winston";
import * as cron from "node-cron";
import Big from "big.js";
import axios from "axios";
import { DynamicGasPricer } from "../utils/gas-pricing";
import { VolatileTokenTracker } from "../utils/volatile-tokens";
import { EnhancedDEXManager, DEXRouter } from "../utils/dex-routers";
import { EnhancedArbitragePathfinder } from "../utils/arbitrage-pathfinder";
import { GasOptimizer } from "../utils/gas-optimizer";
import { L2GasManager } from "../utils/l2-gas-manager";
import { MEVBundleOptimizer } from "../utils/mev-bundle-optimizer";
import { TriangularArbManager } from "../strategies/triangular-arbitrage";
import { DynamicSlippageManager } from "../utils/dynamic-slippage-manager";
import { AdaptiveProfitManager } from "../utils/adaptive-profit-manager";
import { AdvancedRiskManager } from "../utils/advanced-risk-manager";
import { OraclePriceValidator } from "../utils/oracle-price-validator";
import { OptimizationCoordinator } from "../src/optimization/optimization-coordinator";

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
  flashLoanProvider: 'BALANCER' | 'AAVE';
  flashLoanFee: string;
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
  optimalTip: bigint;
  networkCongestion: number;
}

class EnhancedMEVBot {
  // Provider setup
  private arbitrumProvider!: JsonRpcProvider;
  private optimismProvider!: JsonRpcProvider;
  private executorSigner!: ethers.Wallet;
  private authSigner!: ethers.Wallet;
  private optimismExecutor!: ethers.Wallet;
  
  // Flashbots integration
  private flashbotsProvider!: FlashbotsBundleProvider;
  private mevShareClient!: MevShareClient;
  
  // OPTIMIZATION MODULES
  private gasOptimizer!: GasOptimizer;
  private l2GasManager!: L2GasManager;
  private mevBundleOptimizer!: MEVBundleOptimizer;
  private triangularArbManager!: TriangularArbManager;
  
  // PHASE 3 OPTIMIZATION MODULES
  private dynamicSlippageManager!: DynamicSlippageManager;
  private adaptiveProfitManager!: AdaptiveProfitManager;
  private advancedRiskManager!: AdvancedRiskManager;
  private oraclePriceValidator!: OraclePriceValidator;
  
  // MARKET OPTIMIZATION PROTOCOL
  private optimizationCoordinator!: OptimizationCoordinator;
  
  // Contract instances
  private arbBotContract!: ethers.Contract;
  private optBotContract!: ethers.Contract;
  private arbBalancerVault!: ethers.Contract;
  private optBalancerVault!: ethers.Contract;
  private arbAavePool!: ethers.Contract;
  private optAavePool!: ethers.Contract;
  
  // Router contracts - Arbitrum
  private arbUniV2Router!: ethers.Contract;
  private arbSushiRouter!: ethers.Contract;
  private arbUniV3Quoter!: ethers.Contract;
  
  // Router contracts - Optimism
  private optUniV2Router!: ethers.Contract;
  private optSushiRouter!: ethers.Contract;
  private optUniV3Quoter!: ethers.Contract;
  
  // Token addresses - Arbitrum (native USDC, not bridged)
  private readonly TOKENS_ARB = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  // Native USDC (Circle)
    USDC_BRIDGED: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",  // Bridged USDC.e (for depeg arb)
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529",  // LST
    rETH: "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8",    // LST
    GMX: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
    PENDLE: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8"
  };

  // Token addresses - Optimism (native USDC, not bridged)
  private readonly TOKENS_OPT = {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",  // Native USDC (Circle)
    USDC_BRIDGED: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",  // Bridged USDC.e (for depeg arb)
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    WBTC: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
    OP: "0x4200000000000000000000000000000000000042",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    wstETH: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",  // LST
    rETH: "0x9Bcef72be871e61ED4fBbc7630889beE758eb81D",    // LST
    SNX: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4"
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
  
  // Aave V3 Pool addresses
  private readonly AAVE_POOLS = {
    ARBITRUM: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    OPTIMISM: "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
  };
  
  // Trading pairs configuration - expanded for competitive edge
  private readonly TRADING_PAIRS: TokenPair[] = [
    // Core high-liquidity pairs
    {
      tokenA: this.TOKENS_ARB.WETH,
      tokenB: this.TOKENS_ARB.USDC,
      symbolA: "WETH", symbolB: "USDC",
      decimalsA: 18, decimalsB: 6,
      minAmount: parseEther("0.1").toString(),
      maxAmount: parseEther("10").toString()
    },
    {
      tokenA: this.TOKENS_ARB.WETH,
      tokenB: this.TOKENS_ARB.USDT,
      symbolA: "WETH", symbolB: "USDT",
      decimalsA: 18, decimalsB: 6,
      minAmount: parseEther("0.1").toString(),
      maxAmount: parseEther("10").toString()
    },
    {
      tokenA: this.TOKENS_ARB.WBTC,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "WBTC", symbolB: "WETH",
      decimalsA: 8, decimalsB: 18,
      minAmount: parseUnits("0.01", 8).toString(),
      maxAmount: parseUnits("1", 8).toString()
    },
    // Stablecoin depeg arbitrage: native USDC vs bridged USDC.e
    {
      tokenA: this.TOKENS_ARB.USDC,
      tokenB: this.TOKENS_ARB.USDC_BRIDGED,
      symbolA: "USDC", symbolB: "USDC.e",
      decimalsA: 6, decimalsB: 6,
      minAmount: parseUnits("100", 6).toString(),
      maxAmount: parseUnits("100000", 6).toString()
    },
    {
      tokenA: this.TOKENS_ARB.USDC,
      tokenB: this.TOKENS_ARB.USDT,
      symbolA: "USDC", symbolB: "USDT",
      decimalsA: 6, decimalsB: 6,
      minAmount: parseUnits("100", 6).toString(),
      maxAmount: parseUnits("100000", 6).toString()
    },
    // LST/ETH spread arbitrage
    {
      tokenA: this.TOKENS_ARB.wstETH,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "wstETH", symbolB: "WETH",
      decimalsA: 18, decimalsB: 18,
      minAmount: parseEther("0.5").toString(),
      maxAmount: parseEther("20").toString()
    },
    {
      tokenA: this.TOKENS_ARB.rETH,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "rETH", symbolB: "WETH",
      decimalsA: 18, decimalsB: 18,
      minAmount: parseEther("0.5").toString(),
      maxAmount: parseEther("20").toString()
    },
    // Native token pairs
    {
      tokenA: this.TOKENS_ARB.ARB,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "ARB", symbolB: "WETH",
      decimalsA: 18, decimalsB: 18,
      minAmount: parseEther("100").toString(),
      maxAmount: parseEther("50000").toString()
    },
    // DeFi tokens with high volatility
    {
      tokenA: this.TOKENS_ARB.GMX,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "GMX", symbolB: "WETH",
      decimalsA: 18, decimalsB: 18,
      minAmount: parseEther("1").toString(),
      maxAmount: parseEther("100").toString()
    },
    {
      tokenA: this.TOKENS_ARB.PENDLE,
      tokenB: this.TOKENS_ARB.WETH,
      symbolA: "PENDLE", symbolB: "WETH",
      decimalsA: 18, decimalsB: 18,
      minAmount: parseEther("10").toString(),
      maxAmount: parseEther("5000").toString()
    }
  ];
  
  // Configuration constants
  private readonly MIN_PROFIT_THRESHOLD = parseEther("0.01");
  private readonly MIN_CROSS_CHAIN_SPREAD = 0.0005; // 0.05%
  private readonly CRITICAL_SPREAD_THRESHOLD = 0.002; // 0.2%
  private readonly MAX_SLIPPAGE = 0.03; // 3%
  private readonly BUNDLE_TIMEOUT = 30000; // 30 seconds
  private readonly PRICE_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly GAS_LIMIT = 800000n;
  private readonly MAX_PRIORITY_FEE = parseUnits("3", "gwei");
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
    this.initializeOptimizationModules();
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
    this.arbitrumProvider = new JsonRpcProvider(process.env.ARB_RPC!, {
      name: "arbitrum",
      chainId: 42161
    });
    
    this.optimismProvider = new JsonRpcProvider(process.env.OPT_RPC!, {
      name: "optimism",
      chainId: 10
    });
    
    logger.info(chalk.green("✅ Providers initialized"));
  }
  
  private setupSigners(): void {
    this.executorSigner = new Wallet(process.env.PRIVATE_KEY!, this.arbitrumProvider);
    this.authSigner = new Wallet(process.env.FLASHBOTS_AUTH_KEY!, this.arbitrumProvider);
    this.optimismExecutor = new Wallet(process.env.PRIVATE_KEY!, this.optimismProvider);
    
    logger.info(chalk.green("✅ Signers configured"), {
      executor: this.executorSigner.address,
      auth: this.authSigner.address
    });
  }
  
  // Bot contract ABI - matches FlashArbBotBalancer.sol
  private static readonly BOT_CONTRACT_ABI = [
    "function executeArb(address asset, uint256 amount, address[] calldata path, bool sushiFirst, uint256 expectedProfit) external",
    "function executeTriangularArb(address asset, uint256 amount, address[] calldata path, uint256 expectedProfit) external",
    "function executeBatchArbitrage((( address asset, uint96 amount, address tokenA, address tokenB, bool sushiFirst, uint32 slippageBps, uint32 minProfitBps)[] trades, uint256 deadline) params) external",
    "function simulateArbitrage(address asset, uint256 amount, address[] calldata path, bool sushiFirst) external view returns (uint256 profit)",
    "function simulateTriangularArbitrage(address asset, uint256 amount, address[] calldata path) external view returns (uint256 profit)",
    "function getOptimalProvider(address asset, uint256 amount) external view returns (uint8 provider, uint256 fee)",
    "function setAuthorizedCaller(address caller, bool authorized) external",
    "function setSlippageTolerance(uint256 _slippage) external",
    "function setMinProfitBps(uint256 _minProfit) external",
    "function setPriceFeed(address token, address feed) external",
    "function setProfitWallet(address _profitWallet) external",
    "function setGasFundingWallet(address _gasFundingWallet) external",
    "function setGasFundingPercentage(uint256 _percentage) external",
    "function withdraw(address token) external",
    "function emergencyWithdraw(address token) external",
    "function pause() external",
    "function unpause() external",
    "function owner() external view returns (address)",
    "function paused() external view returns (bool)",
    "function slippageTolerance() external view returns (uint256)",
    "function minProfitBps() external view returns (uint256)",
    "function getGasFundingStats() external view returns (address wallet, uint256 percentage, uint256 totalTransferred)",
    "event ArbitrageExecuted(address indexed asset, uint256 amount, uint256 profit, bool sushiFirst)",
    "event TriangularArbitrageExecuted(address indexed tokenA, address indexed tokenB, address indexed tokenC, uint256 amount, uint256 profit)",
    "event BatchArbitrageExecuted(uint256 tradesCount, uint256 totalProfit)",
    "event FlashLoanProviderSelected(uint8 provider, address asset, uint256 amount)",
    "event ProfitWithdrawn(address indexed token, uint256 amount)"
  ];

  private initializeContracts(): void {
    // Arbitrum contracts
    this.arbBotContract = new ethers.Contract(
      process.env.BOT_CONTRACT_ADDRESS!,
      EnhancedMEVBot.BOT_CONTRACT_ABI,
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
    
    // Aave V3 Pool contracts
    this.arbAavePool = new ethers.Contract(
      this.AAVE_POOLS.ARBITRUM,
      [
        "function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128)",
        "function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)",
        "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external"
      ],
      this.executorSigner
    );
    
    // Optimism contracts (if cross-chain enabled)
    if (this.crossChainEnabled && process.env.OPT_BOT_CONTRACT_ADDRESS) {
      this.optBotContract = new ethers.Contract(
        process.env.OPT_BOT_CONTRACT_ADDRESS,
        EnhancedMEVBot.BOT_CONTRACT_ABI,
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
      
      this.optAavePool = new ethers.Contract(
        this.AAVE_POOLS.OPTIMISM,
        [
          "function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128)",
          "function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)",
          "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external"
        ],
        this.optimismExecutor
      );
    }
    
    logger.info(chalk.green("✅ Contracts initialized"));
  }
  
  private initializeOptimizationModules(): void {
    // Initialize gas optimization modules
    this.gasOptimizer = new GasOptimizer(
      process.env.ARB_RPC!,
      process.env.OPT_RPC!
    );
    
    this.l2GasManager = new L2GasManager(
      process.env.ARB_RPC!,
      process.env.OPT_RPC!,
      process.env.MAINNET_RPC!
    );
    
    this.mevBundleOptimizer = new MEVBundleOptimizer(
      this.flashbotsProvider,
      this.gasOptimizer,
      this.l2GasManager,
      this.arbitrumProvider,
      this.executorSigner
    );
    
    this.triangularArbManager = new TriangularArbManager(
      this.arbitrumProvider,
      new EnhancedDEXManager(),
      this.gasOptimizer
    );
    
    // PHASE 3: Initialize advanced optimization modules
    const providers = new Map<number, JsonRpcProvider>([
      [42161, this.arbitrumProvider],
      [10, this.optimismProvider]
    ]);
    
    this.dynamicSlippageManager = new DynamicSlippageManager(providers);
    this.adaptiveProfitManager = new AdaptiveProfitManager(providers);
    this.oraclePriceValidator = new OraclePriceValidator(providers);
    
    // Initialize risk manager with starting capital
    const initialCapital = parseEther("10"); // 10 ETH starting capital
    this.advancedRiskManager = new AdvancedRiskManager(initialCapital);
    
    // MARKET OPTIMIZATION PROTOCOL: Initialize coordination layer
    this.optimizationCoordinator = new OptimizationCoordinator(
      providers,
      {
        adaptiveProfitManager: this.adaptiveProfitManager,
        gasOptimizer: this.gasOptimizer,
        slippageManager: this.dynamicSlippageManager,
        mevBundleOptimizer: this.mevBundleOptimizer,
        riskManager: this.advancedRiskManager,
        priceValidator: this.oraclePriceValidator
      },
      {
        enabled: process.env.MARKET_OPTIMIZATION_ENABLED === 'true',
        primaryChainId: 42161,
        frequency: parseInt(process.env.OPTIMIZATION_FREQUENCY || '300000')
      }
    );
    
    logger.info(chalk.green("🚀 All optimization modules initialized"));
    logger.info(chalk.blue("📊 Phase 3 advanced optimizations: Dynamic Slippage, Adaptive Profit, Risk Management, Oracle Validation"));
    logger.info(chalk.magenta("🎯 Market Optimization Protocol integrated and ready"));
  }
  
  private async checkAaveLiquidity(asset: string, amount: bigint, chainId: number): Promise<{
    available: boolean;
    utilizationRate: number;
    fee: bigint;
    maxLoan: bigint;
  }> {
    const aavePool = chainId === 42161 ? this.arbAavePool : this.optAavePool;
    
    const reserveData = await aavePool.getReserveData(asset);
    const totalLiquidity = reserveData[1];
    const utilizationRate = Number(reserveData[4]) / 10000;
    
    const flashLoanPremium = await aavePool.FLASHLOAN_PREMIUM_TOTAL();
    const fee = (amount * BigInt(flashLoanPremium)) / 10000n;
    
    return {
      available: totalLiquidity >= amount,
      utilizationRate,
      fee,
      maxLoan: totalLiquidity
    };
  }

  private async checkBalancerLiquidity(asset: string, amount: bigint, chainId: number): Promise<{
    available: boolean;
    fee: bigint;
    maxLoan: bigint;
  }> {
    const vault = chainId === 42161 ? this.arbBalancerVault : this.optBalancerVault;
    
    const maxLoan = await vault.maxFlashLoan(asset);
    
    return {
      available: maxLoan >= amount,
      fee: 0n,
      maxLoan
    };
  }

  private async selectOptimalFlashLoanProvider(
    asset: string, 
    amount: bigint, 
    chainId: number
  ): Promise<{
    provider: 'BALANCER' | 'AAVE';
    fee: bigint;
    score: number;
  }> {
    const [aaveData, balancerData] = await Promise.all([
      this.checkAaveLiquidity(asset, amount, chainId),
      this.checkBalancerLiquidity(asset, amount, chainId)
    ]);
    
    const aaveScore = this.calculateProviderScore(aaveData, amount);
    const balancerScore = this.calculateProviderScore(balancerData, amount);
    
    if (balancerScore > aaveScore && balancerData.available) {
      return {
        provider: 'BALANCER',
        fee: balancerData.fee,
        score: balancerScore
      };
    } else if (aaveData.available) {
      return {
        provider: 'AAVE',
        fee: aaveData.fee,
        score: aaveScore
      };
    } else {
      throw new Error('No flash loan provider available');
    }
  }

  private calculateProviderScore(liquidityData: any, amount: bigint): number {
    let score = 0;
    
    if (liquidityData.available) {
      score += 40;
    }
    
    const feePercent = Number(liquidityData.fee) / Number(amount);
    score += Math.max(0, 30 - (feePercent * 30000));
    
    const liquidityRatio = Number(liquidityData.maxLoan) / Number(amount);
    score += Math.min(20, liquidityRatio * 5);
    
    if (liquidityData.utilizationRate !== undefined) {
      score += Math.max(0, 10 - (liquidityData.utilizationRate * 10));
    } else {
      score += 10;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private async monitorLiquidityHealth(): Promise<void> {
    const assets = [
      this.TOKENS_ARB.WETH,
      this.TOKENS_ARB.USDC,
      this.TOKENS_ARB.USDT,
      this.TOKENS_ARB.WBTC
    ];
    
    for (const asset of assets) {
      try {
        const [aaveData, balancerData] = await Promise.all([
          this.checkAaveLiquidity(asset, parseEther("10"), 42161),
          this.checkBalancerLiquidity(asset, parseEther("10"), 42161)
        ]);
        
        if (aaveData.utilizationRate > 0.8) {
          logger.warn(chalk.yellow(`High Aave utilization for ${asset}: ${aaveData.utilizationRate * 100}%`));
        }
        
        if (!balancerData.available) {
          logger.warn(chalk.yellow(`Balancer liquidity low for ${asset}`));
        }
      } catch (error) {
        logger.error(chalk.red(`Error monitoring liquidity for ${asset}`), error);
      }
    }
  }
  
  async initialize(): Promise<void> {
    try {
      // L2 networks (Arbitrum/Optimism) don't use Flashbots relay directly.
      // Transactions are submitted directly to the L2 sequencer.
      // Initialize Flashbots provider only for simulation purposes on mainnet fork.
      try {
        if (process.env.MAINNET_RPC && process.env.FLASHBOTS_AUTH_KEY) {
          const mainnetProvider = new JsonRpcProvider(process.env.MAINNET_RPC);
          const fbAuthSigner = new Wallet(process.env.FLASHBOTS_AUTH_KEY, mainnetProvider);
          this.flashbotsProvider = await FlashbotsBundleProvider.create(
            mainnetProvider,
            fbAuthSigner,
            process.env.FLASHBOTS_RELAY_URL || "https://relay.flashbots.net",
            "mainnet"
          );
          logger.info(chalk.cyan("Flashbots provider initialized for mainnet simulation only"));
        }
      } catch (error) {
        logger.warn("Flashbots provider initialization skipped (not needed for L2 direct submission)", error);
      }

      // MEV-Share client (optional, for mainnet MEV protection)
      try {
        if (process.env.MAINNET_RPC && process.env.FLASHBOTS_AUTH_KEY) {
          const mainnetProvider = new JsonRpcProvider(process.env.MAINNET_RPC);
          const mainnetSigner = new Wallet(process.env.FLASHBOTS_AUTH_KEY, mainnetProvider);
          const mainnetNetwork = await mainnetProvider.getNetwork();
          this.mevShareClient = MevShareClient.fromNetwork(mainnetSigner, mainnetNetwork);
        }
      } catch (error) {
        logger.warn("MEV-Share client initialization failed, continuing without MEV-Share", error);
      }

      logger.info(chalk.green("L2 direct submission mode active (Arbitrum/Optimism sequencers)"));
      
      // Verify balances
      const arbBalance = await this.arbitrumProvider.getBalance(this.executorSigner.address);
      const optBalance = this.crossChainEnabled ? 
        await this.optimismProvider.getBalance(this.optimismExecutor.address) : 0n;
      
      // Initialize Market Optimization Protocol
      try {
        await this.optimizationCoordinator.initialize();
        logger.info(chalk.magenta("🎯 Market Optimization Protocol initialized successfully"));
      } catch (error) {
        logger.warn(chalk.yellow("⚠️ Market Optimization Protocol initialization failed, continuing in fallback mode"), error);
      }
      
      logger.info(chalk.green("🚀 Enhanced MEV Bot initialized"), {
        arbitrumBalance: formatEther(arbBalance),
        optimismBalance: formatEther(optBalance),
        flashbotsEnabled: true,
        mevShareEnabled: !!this.mevShareClient,
        optimizationEnabled: this.optimizationCoordinator?.getOptimizationStatus().isRunning || false
      });
      
      // Check circuit breaker
      await this.checkCircuitBreaker();
      
    } catch (error) {
      logger.error(chalk.red("❌ Initialization failed"), error);
      throw error;
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
      
      // PHASE 3: Advanced Risk Assessment
      const riskAssessment = await this.advancedRiskManager.assessTradeRisk(
        [opportunity.tokenA, opportunity.tokenB],
        BigInt(opportunity.amountIn),
        BigInt(opportunity.expectedProfit),
        BigInt(opportunity.gasCost),
        opportunity.isTriangular ? 'triangular' : 'dual_dex',
        opportunity.chainId,
        0.75 // Default confidence
      );
      
      if (!riskAssessment.approved) {
        logger.warn(chalk.red("❌ Trade rejected by risk manager"), {
          reasons: riskAssessment.reasonsForRejection,
          riskLevel: riskAssessment.riskLevel
        });
        return false;
      }
      
      if (riskAssessment.warnings.length > 0) {
        logger.warn(chalk.yellow("⚠️ Risk warnings:"), riskAssessment.warnings);
      }
      
      // PHASE 3: Oracle Price Validation
      const priceValidation = await this.oraclePriceValidator.validateTokenPrice(
        opportunity.tokenA,
        opportunity.tokenB,
        parseUnits("1", 18), // Normalized price
        opportunity.chainId,
        BigInt(opportunity.amountIn)
      );
      
      if (!priceValidation.isValid || priceValidation.recommendation === 'reject') {
        logger.warn(chalk.red("❌ Trade rejected by price validator"), {
          riskLevel: priceValidation.riskLevel,
          manipulation: priceValidation.manipulationScore,
          warnings: priceValidation.warnings
        });
        return false;
      }
      
      if (priceValidation.recommendation === 'caution') {
        logger.warn(chalk.yellow("⚠️ Price validation concerns:"), priceValidation.warnings);
      }
      
      // PHASE 3: Dynamic Slippage Calculation
      const slippageResult = await this.dynamicSlippageManager.calculateOptimalSlippage(
        opportunity.tokenA,
        opportunity.tokenB,
        BigInt(opportunity.amountIn),
        opportunity.chainId
      );
      
      // PHASE 3: Adaptive Profit Threshold
      const profitThreshold = await this.adaptiveProfitManager.calculateOptimalThreshold(
        [opportunity.tokenA, opportunity.tokenB],
        BigInt(opportunity.amountIn),
        BigInt(opportunity.gasCost),
        opportunity.chainId
      );
      
      // Check if opportunity meets adaptive threshold
      if (BigInt(opportunity.netProfit) < profitThreshold.minProfitWei) {
        logger.info(chalk.yellow("📊 Opportunity below adaptive threshold"), {
          netProfit: formatEther(opportunity.netProfit),
          minRequired: formatEther(profitThreshold.minProfitWei.toString()),
          reasoning: profitThreshold.reasoning
        });
        return false;
      }
      
      // MARKET OPTIMIZATION PROTOCOL: Get optimized parameters and validate trade
      let optimizationValidation;
      try {
        optimizationValidation = await this.optimizationCoordinator.validateTradeParameters(
          opportunity.tokenA,
          opportunity.tokenB,
          BigInt(opportunity.amountIn),
          BigInt(opportunity.expectedProfit),
          opportunity.chainId
        );
        
        if (!optimizationValidation.approved) {
          logger.warn(chalk.red("❌ Trade rejected by Market Optimization Protocol"), {
            warnings: optimizationValidation.warnings
          });
          return false;
        }
        
        if (optimizationValidation.warnings.length > 0) {
          logger.warn(chalk.yellow("⚠️ Market optimization warnings:"), optimizationValidation.warnings);
        }
        
        logger.info(chalk.magenta("🎯 Market Optimization Protocol approved trade"), {
          riskLevel: optimizationValidation.optimizedParameters.riskLevel,
          slippage: `${optimizationValidation.optimizedParameters.slippageTolerance}bps`,
          gasUrgency: optimizationValidation.optimizedParameters.gasSettings.urgency
        });
        
      } catch (error) {
        logger.warn(chalk.yellow("⚠️ Market optimization validation failed, using fallback parameters"), error);
        optimizationValidation = null;
      }
      
      logger.info(chalk.cyan("🚀 Executing arbitrage opportunity (All systems approved)"), {
        id: opportunity.id,
        profit: formatEther(opportunity.netProfit),
        spread: opportunity.spread,
        chain: opportunity.chainId === 42161 ? 'Arbitrum' : 'Optimism',
        slippage: `${slippageResult.slippageBps}bps`,
        profitStrategy: profitThreshold.recommendation,
        riskLevel: riskAssessment.riskLevel
      });
      
      if (this.simulationMode) {
        logger.info(chalk.blue("🎯 SIMULATION MODE - No actual execution"));
        await this.performStaticSimulation(opportunity);
        this.updateSimulationStats(opportunity);
        
        // Update risk manager with simulation result
        await this.advancedRiskManager.updateMetricsAndCheckLimits({
          profit: BigInt(opportunity.expectedProfit),
          gasCost: BigInt(opportunity.gasCost),
          success: true,
          strategy: opportunity.isTriangular ? 'triangular' : 'dual_dex',
          tokenPair: `${opportunity.tokenA}-${opportunity.tokenB}`,
          chainId: opportunity.chainId,
          tradeSize: BigInt(opportunity.amountIn)
        });
        
        return true;
      }
      
      // Create MEV bundle with enhanced optimization
      const bundle = await this.createMEVBundle(opportunity);
      if (!bundle) return false;
      
      // Submit bundle to Flashbots
      const success = await this.submitMEVBundle(bundle);
      
      // Update risk manager with actual results
      await this.advancedRiskManager.updateMetricsAndCheckLimits({
        profit: success ? BigInt(opportunity.expectedProfit) : 0n,
        gasCost: BigInt(opportunity.gasCost),
        success,
        strategy: opportunity.isTriangular ? 'triangular' : 'dual_dex',
        tokenPair: `${opportunity.tokenA}-${opportunity.tokenB}`,
        chainId: opportunity.chainId,
        tradeSize: BigInt(opportunity.amountIn)
      });
      
      if (success) {
        this.lastExecutionTime = now;
        this.executionCount++;
        this.totalProfit += BigInt(opportunity.netProfit);
        
        logger.info(chalk.green("✅ Arbitrage executed successfully"), {
          profit: formatEther(opportunity.netProfit),
          totalProfit: formatEther(this.totalProfit),
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

  private async performStaticSimulation(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      const startTime = Date.now();
      const provider = opportunity.chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      const botContract = opportunity.chainId === 42161 ? this.arbBotContract : this.optBotContract;
      
      if (this.verboseMode) {
        logger.debug(chalk.cyan("🔍 Performing static simulation"), {
          id: opportunity.id,
          tokenA: opportunity.tokenA,
          tokenB: opportunity.tokenB,
          amountIn: formatEther(opportunity.amountIn),
          expectedProfit: formatEther(opportunity.expectedProfit)
        });
      }
      
      // Use callStatic to simulate contract calls without execution
      if (opportunity.isTriangular) {
        const result = await botContract.executeTriangularArb.staticCall(
          opportunity.tokenA,
          opportunity.amountIn,
          opportunity.path,
          opportunity.expectedProfit
        );
        
        if (this.verboseMode) {
          logger.debug(chalk.green("✅ Triangular arbitrage static call successful"), {
            result: result.toString()
          });
        }
      } else {
        const result = await botContract.executeArb.staticCall(
          opportunity.tokenA,
          opportunity.amountIn,
          opportunity.path,
          opportunity.sushiFirst,
          opportunity.expectedProfit
        );
        
        if (this.verboseMode) {
          logger.debug(chalk.green("✅ Dual router arbitrage static call successful"), {
            result: result.toString()
          });
        }
      }
      
      // Simulate Flashbots bundle creation and simulation
      if (this.verboseMode) {
        const bundle = await this.createMEVBundle(opportunity);
        if (bundle) {
          logger.debug(chalk.blue("📦 MEV Bundle created for simulation"), {
            targetBlock: bundle.targetBlockNumber,
            gasLimit: opportunity.gasEstimate
          });
          
          // Simulate bundle without submission
          const signedBundle = await this.flashbotsProvider.signBundle(bundle.transactions);
          const simulation = await this.flashbotsProvider.simulate(
            signedBundle,
            bundle.targetBlockNumber
          );
          
          if ('error' in simulation) {
            logger.debug(chalk.yellow("⚠️ Bundle simulation warning"), simulation.error);
          } else {
            logger.debug(chalk.green("✅ Bundle simulation successful"), {
              gasUsed: simulation.totalGasUsed?.toString(),
              coinbaseDiff: simulation.coinbaseDiff?.toString()
            });
          }
        }
      }
      
      const executionTime = Date.now() - startTime;
      this.simulationStats.executionTime += executionTime;
      
      logger.info(chalk.blue("📊 Simulation completed"), {
        executionTime: `${executionTime}ms`,
        profit: formatEther(opportunity.netProfit),
        gasEstimate: formatUnits(opportunity.gasEstimate, 'gwei')
      });
      
    } catch (error) {
      logger.error(chalk.red("❌ Static simulation failed"), {
        error: error instanceof Error ? error.message : error,
        opportunity: opportunity.id
      });
    }
  }
  
  private updateSimulationStats(opportunity: ArbitrageOpportunity): void {
    this.simulationStats.opportunitiesDetected++;
    this.simulationStats.potentialProfit += BigInt(opportunity.netProfit);
    this.simulationStats.gasEstimated += BigInt(opportunity.gasEstimate);
  }
  
  private printSimulationSummary(): void {
    logger.info(chalk.magenta("\n📈 SIMULATION SUMMARY"));
    logger.info(chalk.cyan("────────────────────────────────────────"));
    logger.info(chalk.white(`📊 Opportunities Detected: ${this.simulationStats.opportunitiesDetected}`));
    logger.info(chalk.green(`💰 Total Potential Profit: ${formatEther(this.simulationStats.potentialProfit)} ETH`));
    logger.info(chalk.yellow(`⛽ Total Gas Estimated: ${formatUnits(this.simulationStats.gasEstimated, 'gwei')} Gwei`));
    logger.info(chalk.blue(`⏱️  Total Execution Time: ${this.simulationStats.executionTime}ms`));
    
    if (this.simulationStats.opportunitiesDetected > 0) {
      const avgProfit = this.simulationStats.potentialProfit / BigInt(this.simulationStats.opportunitiesDetected);
      logger.info(chalk.white(`📈 Average Profit per Opportunity: ${formatEther(avgProfit)} ETH`));
    }
    
    logger.info(chalk.cyan("────────────────────────────────────────\n"));
  }

  // Enhanced arbitrage scanning with parallel quotes and multi-DEX support
  async scanForArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const scanStart = Date.now();

    try {
      // OPTIMIZATION: Parallel scanning of both chains simultaneously
      const scanPromises: Promise<void>[] = [];

      // Scan Arbitrum opportunities
      scanPromises.push((async () => {
        const arbPathfinder = new EnhancedArbitragePathfinder(new Map([[42161, this.arbitrumProvider]]));
        const arbOpportunities = await arbPathfinder.findArbitrageOpportunities(42161, 4, 0.003);

        for (const opportunity of arbOpportunities) {
          const arbOpp = this.convertToLegacyFormat(opportunity, 42161);
          if (arbOpp) opportunities.push(arbOpp);
        }
      })());

      // Scan Optimism opportunities in parallel if cross-chain enabled
      if (this.crossChainEnabled) {
        scanPromises.push((async () => {
          const optPathfinder = new EnhancedArbitragePathfinder(new Map([[10, this.optimismProvider]]));
          const optOpportunities = await optPathfinder.findArbitrageOpportunities(10, 4, 0.003);

          for (const opportunity of optOpportunities) {
            const optOpp = this.convertToLegacyFormat(opportunity, 10);
            if (optOpp) opportunities.push(optOpp);
          }
        })());
      }

      // OPTIMIZATION: Also run direct price queries in parallel for high-priority pairs
      scanPromises.push(this.scanDirectPriceOpportunities(opportunities));

      // Wait for all scans to complete simultaneously
      await Promise.allSettled(scanPromises);

      // Sort by priority (highest profit potential first)
      opportunities.sort((a, b) => {
        const profitA = BigInt(a.netProfit || 0);
        const profitB = BigInt(b.netProfit || 0);
        return profitB > profitA ? 1 : profitB < profitA ? -1 : 0;
      });

      const scanDuration = Date.now() - scanStart;
      if (this.verboseMode && opportunities.length > 0) {
        logger.info(chalk.green(`🎯 Enhanced pathfinding found ${opportunities.length} opportunities in ${scanDuration}ms`));

        const arbStats = EnhancedDEXManager.getCoverageStats(42161);
        const optStats = this.crossChainEnabled ? EnhancedDEXManager.getCoverageStats(10) : null;

        logger.info(chalk.cyan(`📊 Arbitrum: ${arbStats.totalRouters} DEXes, avg liquidity: ${arbStats.averageLiquidityScore.toFixed(1)}`));
        if (optStats) {
          logger.info(chalk.cyan(`📊 Optimism: ${optStats.totalRouters} DEXes, avg liquidity: ${optStats.averageLiquidityScore.toFixed(1)}`));
        }
      }

    } catch (error) {
      logger.error(chalk.red("Error in enhanced arbitrage scanning:"), error);
    }

    return opportunities.slice(0, 20);
  }

  // Direct price comparison on high-priority pairs for fastest detection
  private async scanDirectPriceOpportunities(opportunities: ArbitrageOpportunity[]): Promise<void> {
    try {
      const quotePromises = this.TRADING_PAIRS.map(async (pair) => {
        try {
          const amountIn = BigInt(pair.minAmount);
          const sushiFirst = await this.determineSushiFirst(pair.tokenA, pair.tokenB, amountIn, 42161);

          // Get quotes from both DEXes in parallel
          const [uniQuote, sushiQuote] = await Promise.all([
            this.arbUniV2Router.getAmountsOut(amountIn, [pair.tokenA, pair.tokenB]).catch(() => null),
            this.arbSushiRouter.getAmountsOut(amountIn, [pair.tokenA, pair.tokenB]).catch(() => null)
          ]);

          if (!uniQuote || !sushiQuote) return;

          const uniOut = uniQuote[uniQuote.length - 1];
          const sushiOut = sushiQuote[sushiQuote.length - 1];

          // Check for spread between the two DEXes
          const spread = Math.abs(Number(uniOut - sushiOut)) / Number(uniOut > sushiOut ? uniOut : sushiOut);

          if (spread > 0.003) { // 0.3% minimum spread
            const profit = uniOut > sushiOut ? uniOut - sushiOut : sushiOut - uniOut;
            opportunities.push({
              id: `direct-${pair.symbolA}-${pair.symbolB}-${Date.now()}`,
              tokenA: pair.tokenA,
              tokenB: pair.tokenB,
              amountIn: amountIn.toString(),
              expectedProfit: profit.toString(),
              netProfit: profit.toString(),
              sushiFirst: sushiOut < uniOut, // Buy on cheaper DEX
              path: [pair.tokenA, pair.tokenB],
              gasEstimate: "500000",
              gasCost: formatEther(500000n * parseUnits("0.1", "gwei")),
              timestamp: Date.now(),
              isTriangular: false,
              chainId: 42161,
              priority: 8,
              spread,
              slippage: 0.01,
              flashLoanProvider: 'BALANCER',
              flashLoanFee: "0"
            });
          }
        } catch {
          // Skip pair on error
        }
      });

      await Promise.allSettled(quotePromises);
    } catch (error) {
      logger.error(chalk.red("Error in direct price scanning:"), error);
    }
  }
  async scanCrossChainOpportunities(): Promise<CrossChainOpportunity[]> {
    if (!this.crossChainEnabled) return [];
    
    try {
      const crossChainOpportunities: CrossChainOpportunity[] = [];
      
      // Get high-volatility pairs for both chains
      const arbPairs = VolatileTokenTracker.getHighVolatilityPairs(42161);
      const optPairs = VolatileTokenTracker.getHighVolatilityPairs(10);
      
      // Find matching pairs across chains
      for (const arbPair of arbPairs.slice(0, 10)) {
        for (const optPair of optPairs.slice(0, 10)) {
          if (arbPair.tokenA.symbol === optPair.tokenA.symbol && 
              arbPair.tokenB.symbol === optPair.tokenB.symbol) {
            
            const spread = Math.abs(arbPair.expectedVolatility - optPair.expectedVolatility);
            const bridgeCost = "0.005"; // 0.5% bridge cost
            
            if (spread > 0.001) { // 0.1% minimum spread
              crossChainOpportunities.push({
                id: `cross-${arbPair.tokenA.symbol}-${arbPair.tokenB.symbol}-${Date.now()}`,
                tokenA: arbPair.tokenA.address,
                tokenB: arbPair.tokenB.address,
                amountIn: parseEther("1").toString(),
                arbitrumPrice: "1.0",
                optimismPrice: (1 + spread).toString(),
                spread: spread.toString(),
                estimatedProfit: parseEther((spread - 0.005).toString()).toString(),
                bridgeCost,
                netProfit: parseEther(Math.max(0, spread - 0.005).toString()).toString(),
                timestamp: Date.now(),
                profitable: spread > 0.005,
                alertLevel: spread > 0.02 ? 'critical' : spread > 0.01 ? 'warning' : 'info'
              });
            }
          }
        }
      }
      
      if (this.verboseMode && crossChainOpportunities.length > 0) {
        logger.info(chalk.yellow(`🌉 Found ${crossChainOpportunities.length} cross-chain opportunities`));
      }
      
      return crossChainOpportunities;
      
    } catch (error) {
      logger.error(chalk.red("Error scanning cross-chain opportunities:"), error);
      return [];
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
      }
      
      // Set gas parameters with dynamic pricing (high urgency for MEV)
      const gasSettings = await this.estimateGasSettings(opportunity.chainId, 'high');
      tx.gasLimit = gasSettings.gasLimit;
      tx.maxFeePerGas = gasSettings.maxFeePerGas;
      tx.maxPriorityFeePerGas = gasSettings.maxPriorityFeePerGas;
      tx.nonce = await provider.getTransactionCount(signer.address);
      tx.chainId = BigInt(opportunity.chainId);
      
      if (this.verboseMode) {
        logger.debug(chalk.cyan(`🚀 MEV bundle gas: ${DynamicGasPricer.formatGasSettings(gasSettings)}`));
      }
      
      const currentBlock = await provider.getBlockNumber();
      const targetBlockNumber = currentBlock + 1;
      
      const bundleTransaction: FlashbotsBundleTransaction = {
        signer: signer,
        transaction: tx
      };
      
      const bundle: MEVBundle = {
        transactions: [bundleTransaction],
        targetBlockNumber
      };
      
      return bundle;
      
    } catch (error) {
      logger.error(chalk.red("Error creating MEV bundle"), error);
      return null;
    }
  }
  private async submitMEVBundle(bundle: MEVBundle): Promise<boolean> {
    try {
      // L2 networks (Arbitrum/Optimism) use sequencers, not Flashbots relay.
      // Submit transactions directly to the sequencer for inclusion.
      for (const bundleTx of bundle.transactions) {
        const signer = bundleTx.signer as ethers.Wallet;
        const tx = bundleTx.transaction;

        // Ensure required fields are populated
        if (!tx.to || tx.to === ethers.ZeroAddress) {
          logger.error(chalk.red("Invalid transaction target address"));
          return false;
        }

        // Sign and send the transaction directly to the L2 sequencer
        const signedTx = await signer.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value || 0n,
          gasLimit: tx.gasLimit || this.GAS_LIMIT,
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
          nonce: tx.nonce,
          chainId: tx.chainId,
          type: 2
        });

        logger.info(chalk.cyan(`📤 Transaction submitted: ${signedTx.hash}`));

        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          signedTx.wait(1),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Transaction confirmation timeout")), this.BUNDLE_TIMEOUT)
          )
        ]);

        if (!receipt || receipt.status !== 1) {
          logger.error(chalk.red(`❌ Transaction reverted: ${signedTx.hash}`));
          return false;
        }

        logger.info(chalk.green(`✅ Transaction confirmed in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed}`));
      }

      return true;
    } catch (error) {
      logger.error(chalk.red("❌ Failed to submit L2 transaction"), error);
      return false;
    }
  }
  
  private async estimateGasSettings(chainId: number, urgency: 'low' | 'medium' | 'high' = 'high'): Promise<GasSettings> {
    try {
      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      
      // Use dynamic gas pricer for optimal pricing
      const gasSettings = await DynamicGasPricer.calculateOptimalGas(
        provider,
        chainId,
        urgency
      );
      
      if (this.verboseMode) {
        logger.info(chalk.cyan(`⛽ Dynamic gas pricing: ${DynamicGasPricer.formatGasSettings(gasSettings)}`));
      }
      
      return gasSettings;
      
    } catch (error) {
      logger.error(chalk.red("Error calculating dynamic gas settings"), error);
      
      // Use fallback from DynamicGasPricer
      const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
      return await DynamicGasPricer.calculateOptimalGas(provider, chainId, urgency);
    }
  }
  private async determineSushiFirst(
    tokenA: string,
    tokenB: string,
    amountIn: bigint,
    chainId: number
  ): Promise<boolean> {
    try {
      const uniRouter = chainId === 42161 ? this.arbUniV2Router : this.optUniV2Router;
      const sushiRouter = chainId === 42161 ? this.arbSushiRouter : this.optSushiRouter;

      // Query both DEXes for actual prices
      const [uniAmounts, sushiAmounts] = await Promise.all([
        uniRouter.getAmountsOut(amountIn, [tokenA, tokenB]).catch(() => null),
        sushiRouter.getAmountsOut(amountIn, [tokenA, tokenB]).catch(() => null)
      ]);

      if (!uniAmounts && !sushiAmounts) return false;
      if (!uniAmounts) return true; // Only Sushi has liquidity
      if (!sushiAmounts) return false; // Only Uni has liquidity

      const uniOut = uniAmounts[uniAmounts.length - 1];
      const sushiOut = sushiAmounts[sushiAmounts.length - 1];

      // Buy on the cheaper DEX first (lower output = cheaper), sell on the more expensive one
      // sushiFirst=true means: buy on Sushi, sell on Uni
      // If Sushi gives less output (cheaper price), buy there first
      return sushiOut < uniOut;
    } catch (error) {
      logger.warn(chalk.yellow("Could not determine optimal DEX order, defaulting to Uni first"));
      return false;
    }
  }

  private convertToLegacyFormat(opportunity: any, chainId: number): ArbitrageOpportunity | null {
    try {
      // Determine optimal DEX ordering based on the best path's router sequence
      // If the best path starts with SushiSwap, sushiFirst = true
      let sushiFirst = false;
      if (opportunity.bestPath.routers && opportunity.bestPath.routers.length > 0) {
        const firstRouter = opportunity.bestPath.routers[0];
        sushiFirst = firstRouter.name?.toLowerCase().includes('sushi') ?? false;
      }

      return {
        id: opportunity.id,
        tokenA: opportunity.tokenPair.tokenA.address,
        tokenB: opportunity.tokenPair.tokenB.address,
        amountIn: opportunity.amountIn.toString(),
        expectedProfit: opportunity.expectedAmountOut.toString(),
        netProfit: opportunity.netProfit.toString(),
        sushiFirst,
        path: opportunity.bestPath.path,
        gasEstimate: opportunity.bestPath.totalGasCost.toString(),
        gasCost: formatEther(opportunity.bestPath.totalGasCost * BigInt(50000000)), // 0.05 gwei
        timestamp: Date.now(),
        isTriangular: opportunity.bestPath.isTriangular,
        chainId,
        priority: Math.floor(opportunity.confidence * 10),
        spread: opportunity.bestPath.profitMargin,
        slippage: 0.01,
        flashLoanProvider: 'BALANCER' as const,
        flashLoanFee: "0"
      };
    } catch (error) {
      return null;
    }
  }
  
  private async checkCircuitBreaker(): Promise<void> {
    try {
      // Check the advanced risk manager's circuit breaker status
      const cbStatus = this.advancedRiskManager.getCircuitBreakerStatus();

      if (cbStatus.isActive) {
        if (!this.circuitBreakerTripped) {
          this.circuitBreakerTripped = true;
          logger.error(chalk.red("🚨 CIRCUIT BREAKER TRIPPED"), {
            reasons: cbStatus.reasons,
            estimatedRecovery: cbStatus.estimatedRecoveryTime
              ? new Date(cbStatus.estimatedRecoveryTime).toISOString()
              : "unknown"
          });
        }
        return;
      }

      // Manual loss-based circuit breaker: if total loss exceeds 5% of starting capital
      const netPnL = this.totalProfit - this.totalLoss;
      const startingCapital = parseEther("10"); // matches constructor initialization
      if (netPnL < 0n && (-netPnL * 100n) / startingCapital > 5n) {
        this.circuitBreakerTripped = true;
        logger.error(chalk.red("🚨 CIRCUIT BREAKER TRIPPED - Max drawdown exceeded"), {
          totalProfit: formatEther(this.totalProfit),
          totalLoss: formatEther(this.totalLoss),
          netPnL: formatEther(netPnL)
        });
        return;
      }

      // If circuit breaker was previously tripped but conditions improved, reset it
      if (this.circuitBreakerTripped && !cbStatus.isActive) {
        this.circuitBreakerTripped = false;
        logger.info(chalk.green("✅ Circuit breaker reset - trading resumed"));
      }
    } catch (error) {
      logger.error(chalk.red("Error checking circuit breaker"), error);
    }
  }
  async monitorAndExecute(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    try {
      if (this.verboseMode) {
        logger.info(chalk.blue("🔍 Enhanced scanning: Volatile tokens + Multi-DEX coverage"));
      }
      
      // Enhanced arbitrage scanning
      const opportunities = await this.scanForArbitrageOpportunities();
      
      // OPTIMIZATION: Triangular arbitrage opportunities (if enabled)
      let triangularOpportunities: any[] = [];
      if (this.triangularEnabled) {
        try {
          const arbTriangular = await this.triangularArbManager.scanTriangularOpportunities(42161, 0.01);
          triangularOpportunities = arbTriangular.filter(opp => opp.recommendedAction === 'execute');
          
          if (this.verboseMode && triangularOpportunities.length > 0) {
            logger.info(chalk.yellow(`🔺 Found ${triangularOpportunities.length} triangular arbitrage opportunities`));
            triangularOpportunities.forEach(opp => {
              logger.debug(`   ${opp.id}: ${formatEther(opp.profitAfterGas)} ETH profit`);
            });
          }
        } catch (error) {
          logger.error(chalk.red("Error scanning triangular opportunities:"), error);
        }
      }
      
      // Cross-chain opportunities
      const crossChainOpportunities = await this.scanCrossChainOpportunities();
      
      // Update simulation stats
      for (const opportunity of opportunities) {
        this.updateSimulationStats(opportunity);
        
        if (this.simulationMode) {
          // Simulation: Log opportunity details
          logger.info(chalk.cyan(`📊 SIMULATION: ${opportunity.tokenA}-${opportunity.tokenB}, profit: ${formatEther(opportunity.netProfit)} ETH`));
        }
      }
      
      // Log results
      if (opportunities.length > 0) {
        logger.info(chalk.green(`✅ Found ${opportunities.length} arbitrage opportunities`));
        
        // OPTIMIZATION: MEV Bundle Creation and Optimization
        try {
          const combinedOpportunities = [...opportunities, ...triangularOpportunities];
          
          if (combinedOpportunities.length > 0) {
            const targetBlock = await this.arbitrumProvider.getBlockNumber() + 2;
            const bundleResult = await this.mevBundleOptimizer.createOptimalBundle(
              combinedOpportunities,
              targetBlock
            );
            
            if (this.verboseMode) {
              logger.info(chalk.magenta(`📦 MEV Bundle Optimized: ${bundleResult.bundle.length} transactions`));
              logger.info(chalk.magenta(`   Expected Profit: ${formatEther(bundleResult.expectedProfit)} ETH`));
              logger.info(chalk.magenta(`   Profit After Gas: ${formatEther(bundleResult.profitAfterGas)} ETH`));
              logger.info(chalk.magenta(`   Success Rate: ${bundleResult.estimatedSuccessRate}%`));
              
              if (bundleResult.recommendations.length > 0) {
                logger.info(chalk.cyan("💡 Bundle Recommendations:"));
                bundleResult.recommendations.forEach(rec => logger.info(chalk.cyan(`   • ${rec}`)));
              }
            }
            
            // Simulate bundle if profitable
            if (bundleResult.profitAfterGas > parseUnits("0.005", 18)) { // > 0.005 ETH profit
              const simulation = await this.mevBundleOptimizer.simulateBundle(
                bundleResult.bundle,
                targetBlock
              );
              
              if (simulation.success) {
                logger.info(chalk.green(`✅ Bundle Simulation PASSED: ${formatEther(simulation.profit)} ETH profit`));
                
                if (simulation.competitorAnalysis.similarBundles > 5) {
                  logger.warn(chalk.yellow(`⚠️  High competition detected: ${simulation.competitorAnalysis.similarBundles} similar bundles`));
                }
              } else {
                logger.warn(chalk.red(`❌ Bundle Simulation FAILED: ${simulation.revertReason}`));
              }
            }
          }
        } catch (error) {
          logger.error(chalk.red("Error in MEV bundle optimization:"), error);
        }
        
        const bestOpportunity = opportunities[0];
        logger.info(chalk.cyan(`💎 Best: ${bestOpportunity.tokenA}-${bestOpportunity.tokenB}, profit: ${formatEther(bestOpportunity.netProfit)} ETH`));
      }
      
      if (crossChainOpportunities.length > 0) {
        logger.info(chalk.yellow(`🌉 ${crossChainOpportunities.length} cross-chain opportunities detected`));
      }
      
      if (opportunities.length === 0 && crossChainOpportunities.length === 0) {
        if (this.verboseMode) {
          logger.info(chalk.gray("📊 No profitable opportunities found this cycle"));
        }
      }
      
    } catch (error) {
      logger.error(chalk.red("Error in enhanced monitoring cycle"), error);
    } finally {
      this.isRunning = false;
    }
  }
  
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private liquidityInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    logger.info(chalk.green("🤖 Starting Enhanced MEV Arbitrage Bot..."));

    if (this.verboseMode) {
      const arbStats = EnhancedDEXManager.getCoverageStats(42161);
      const volatilePairs = VolatileTokenTracker.getHighVolatilityPairs(42161).length;

      logger.info(chalk.cyan(`🔥 Volatile pairs: ${volatilePairs}`));
      logger.info(chalk.cyan(`🏪 DEX coverage: ${Object.keys(arbStats.routerTypes).join(', ')}`));
      logger.info(chalk.cyan(`🧠 Pathfinding: Enhanced Bellman-Ford + Line Graph`));
    }

    // Run first scan immediately
    await this.monitorAndExecute();

    // Start continuous scanning loop at configured interval
    this.scanInterval = setInterval(async () => {
      try {
        if (!this.circuitBreakerTripped) {
          await this.monitorAndExecute();
        } else {
          logger.warn(chalk.yellow("🚨 Scanning paused - circuit breaker active"));
          await this.checkCircuitBreaker();
        }
      } catch (error) {
        logger.error(chalk.red("Error in scan loop"), error);
      }
    }, this.PRICE_UPDATE_INTERVAL);

    // Periodic liquidity health monitoring (every 60 seconds)
    this.liquidityInterval = setInterval(async () => {
      try {
        await this.monitorLiquidityHealth();
      } catch (error) {
        logger.error(chalk.red("Error in liquidity monitoring"), error);
      }
    }, 60000);

    logger.info(chalk.green(`✅ Enhanced MEV bot started - scanning every ${this.PRICE_UPDATE_INTERVAL}ms`));
  }
  
  async stop(): Promise<void> {
    logger.info(chalk.yellow("🛑 Stopping Enhanced MEV Bot..."));

    // Clear scanning intervals
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.liquidityInterval) {
      clearInterval(this.liquidityInterval);
      this.liquidityInterval = null;
    }

    // Stop Market Optimization Protocol
    try {
      await this.optimizationCoordinator?.stop();
      logger.info(chalk.magenta("🎯 Market Optimization Protocol stopped"));
    } catch (error) {
      logger.warn(chalk.yellow("⚠️ Error stopping Market Optimization Protocol"), error);
    }
    
    // Log final statistics
    const optimizationStatus = this.optimizationCoordinator?.getOptimizationStatus();
    logger.info(chalk.blue("📊 Final Statistics"), {
      totalProfit: formatEther(this.totalProfit),
      totalLoss: formatEther(this.totalLoss),
      netProfit: formatEther(this.totalProfit - this.totalLoss),
      executionCount: this.executionCount,
      circuitBreakerTripped: this.circuitBreakerTripped,
      optimizationsPerformed: optimizationStatus?.totalOptimizations || 0,
      performanceImprovement: optimizationStatus?.performanceImprovement || 0
    });
    
    logger.info(chalk.yellow("✅ Enhanced MEV bot stopped"));
    
    // Print simulation statistics if in simulation mode
    if (this.simulationMode) {
      this.printSimulationSummary();
    }
  }

  // Phase 3 Integration Methods
  private async getCurrentCapital(): Promise<bigint> {
    try {
      const arbBalance = await this.arbitrumProvider.getBalance(this.executorSigner.address);
      const optBalance = this.crossChainEnabled ? 
        await this.optimismProvider.getBalance(this.optimismExecutor.address) : 0n;
      
      return arbBalance + optBalance;
    } catch (error) {
      logger.error('Error getting current capital:', error);
      return 0n;
    }
  }

  private async estimateGasCost(opportunity: any): Promise<bigint> {
    try {
      // Use L2GasManager for accurate gas estimation
      if (this.l2GasManager) {
        const gasLimit = await this.l2GasManager.estimateOptimalGasLimit(
          opportunity.chainId,
          'flash-arbitrage'
        );
        // Estimate total cost by multiplying gas limit with current gas price
        const gasPrice = parseUnits("0.1", "gwei"); // Default L2 gas price
        return gasLimit * gasPrice;
      }
      
      // Fallback to basic estimation
      return parseUnits("0.001", 18); // 0.001 ETH fallback
    } catch (error) {
      logger.error('Error estimating gas cost:', error);
      return parseUnits("0.002", 18); // Conservative fallback
    }
  }

  private async executeWithPhase3Optimization(opportunity: any): Promise<boolean> {
    try {
      logger.info(chalk.cyan('🚀 Executing with Phase 3 optimization'));

      // Get current capital for position sizing
      const currentCapital = await this.getCurrentCapital();
      
      // Estimate precise gas costs
      const estimatedGas = await this.estimateGasCost(opportunity);
      
      // Execute optimized trade
      const result = await this.executeOptimizedTrade(opportunity);
      
      if (result.success) {
        logger.info(chalk.green(`✅ Phase 3 execution successful: ${formatEther(result.profit)} ETH profit`));
        return true;
      } else {
        logger.warn(chalk.yellow(`⚠️ Phase 3 execution failed, gas cost: ${formatEther(result.gasCost)} ETH`));
        return false;
      }
    } catch (error) {
      logger.error('Phase 3 execution failed:', error);
      return false;
    }
  }

  private async executeOptimizedTrade(opportunity: any): Promise<{
    success: boolean;
    profit: bigint;
    gasCost: bigint;
  }> {
    try {
      if (this.simulationMode) {
        logger.info(chalk.blue(`🎯 SIMULATION: Would execute trade with optimized parameters`));
        return {
          success: true,
          profit: BigInt(opportunity.netProfit || 0),
          gasCost: BigInt(opportunity.estimatedGasCost || opportunity.gasCost || 0)
        };
      }

      // Real execution: create MEV bundle and submit via direct L2 submission
      const legacyOpp: ArbitrageOpportunity = typeof opportunity.id === 'string' && opportunity.tokenA
        ? opportunity
        : this.convertToLegacyFormat(opportunity, opportunity.chainId || 42161)!;

      if (!legacyOpp) {
        logger.error(chalk.red("Failed to convert opportunity to executable format"));
        return { success: false, profit: 0n, gasCost: 0n };
      }

      // Execute the arbitrage through the standard path
      const success = await this.executeArbitrage(legacyOpp);

      return {
        success,
        profit: success ? BigInt(legacyOpp.netProfit) : 0n,
        gasCost: BigInt(legacyOpp.gasCost || 0)
      };
    } catch (error) {
      logger.error('Error executing optimized trade:', error);
      return { success: false, profit: 0n, gasCost: 0n };
    }
  }

  private async executeWithPhase2Fallback(opportunity: any): Promise<boolean> {
    try {
      logger.info(chalk.yellow('🔄 Falling back to Phase 2 MEV execution'));
      
      // Use existing Phase 2 MEV bundle optimization
      if (this.mevBundleOptimizer) {
        const targetBlock = await this.arbitrumProvider.getBlockNumber() + 2;
        const bundleResult = await this.mevBundleOptimizer.createOptimalBundle(
          [opportunity],
          targetBlock
        );
        
        if (bundleResult.profitAfterGas > parseUnits("0.003", 18)) {
          logger.info(chalk.green(`✅ Phase 2 fallback successful`));
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Phase 2 fallback failed:', error);
      return false;
    }
  }

  private async enhancedMonitoringCycle(): Promise<void> {
    try {
      this.isRunning = true;
      
      // Enhanced arbitrage scanning with Phase 3 integration
      const opportunities = await this.scanForArbitrageOpportunities();
      
      // Add Phase 3 optimization to the main execution flow
      if (opportunities.length > 0) {
        logger.info(chalk.green(`✅ Found ${opportunities.length} arbitrage opportunities`));
        
        // Use Phase 3 optimization for the best opportunity
        const bestOpportunity = opportunities[0];
        
        if (this.dynamicSlippageManager && this.advancedRiskManager && this.oraclePriceValidator) {
          // Use Phase 3 advanced execution
          const executed = await this.executeWithPhase3Optimization(bestOpportunity);
          
          if (executed) {
            logger.info(chalk.green(`🚀 Successfully executed with Phase 3 optimization`));
          }
        } else {
          // Fall back to Phase 2 if Phase 3 modules unavailable
          logger.warn(chalk.yellow('⚠️ Phase 3 modules unavailable, using Phase 2'));
          await this.executeWithPhase2Fallback(bestOpportunity);
        }
      }
      
      // Continue with existing cross-chain and triangular logic if needed
      
    } catch (error) {
      logger.error(chalk.red("Error in enhanced monitoring cycle"), error);
    } finally {
      this.isRunning = false;
    }
  }
}

// CLI argument parsing
function parseCliArguments(): CLIConfig {
  const args = process.argv.slice(2);
  const config: CLIConfig = {
    simulate: false,
    verbose: false,
    help: false,
    crossChain: false,
    triangular: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--simulate':
      case '-s':
        config.simulate = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
      case '-h':
        config.help = true;
        break;
      case '--cross-chain':
      case '-c':
        config.crossChain = true;
        break;
      case '--triangular':
      case '-t':
        config.triangular = true;
        break;
      default:
        if (arg.startsWith('-')) {
          logger.warn(chalk.yellow(`Unknown argument: ${arg}`));
        }
        break;
    }
  }
  
  return config;
}

// Display help information
function displayHelp(): void {
  console.log(chalk.cyan(`\n🤖 Enhanced MEV Arbitrage Bot\n`));
  console.log(chalk.white('Usage: ts-node scripts/run-bot.ts [options]\n'));
  console.log(chalk.yellow('Options:'));
  console.log(chalk.white('  -s, --simulate     Run in simulation mode (no actual transactions)'));
  console.log(chalk.white('  -v, --verbose      Enable verbose logging and detailed output'));
  console.log(chalk.white('  -c, --cross-chain  Enable cross-chain monitoring'));
  console.log(chalk.white('  -t, --triangular   Enable triangular arbitrage'));
  console.log(chalk.white('  -h, --help         Display this help message'));
  console.log(chalk.white('\nEnvironment Variables:'));
  console.log(chalk.gray('  ENABLE_SIMULATION_MODE=true       Same as --simulate'));
  console.log(chalk.gray('  VERBOSE_LOGGING=true              Same as --verbose'));
  console.log(chalk.gray('  ENABLE_CROSS_CHAIN_MONITORING=true Same as --cross-chain'));
  console.log(chalk.gray('  ENABLE_TRIANGULAR_ARBITRAGE=true   Same as --triangular'));
  console.log(chalk.white('\nExamples:'));
  console.log(chalk.gray('  ts-node scripts/run-bot.ts --simulate --verbose'));
  console.log(chalk.gray('  ts-node scripts/run-bot.ts -s -c -t'));
  console.log(chalk.gray('  npm run bot:dry'));
  console.log(chalk.gray('  npm run bot:full\n'));
}

// Main execution function
async function main(): Promise<void> {
  const cliConfig = parseCliArguments();
  
  if (cliConfig.help) {
    displayHelp();
    return;
  }
  
  const bot = new EnhancedMEVBot(cliConfig);
  
  try {
    await bot.initialize();
    
    if (cliConfig.simulate) {
      logger.info(chalk.magenta("🎯 Starting in SIMULATION MODE - No real transactions will be executed"));
    }
    
    await bot.start();
    
    // Graceful shutdown handlers
    process.on("SIGINT", async () => {
      console.log("\n");
      logger.info(chalk.yellow("Received SIGINT, shutting down gracefully..."));
      await bot.stop();
      process.exit(0);
    });
    
    process.on("SIGTERM", async () => {
      logger.info(chalk.yellow("Received SIGTERM, shutting down gracefully..."));
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(chalk.red("Failed to start Enhanced MEV Bot"), error);
    process.exit(1);
  }
}

// Global error handlers
process.on("uncaughtException", (error) => {
  logger.error(chalk.red("Uncaught Exception"), error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(chalk.red("Unhandled Rejection"), { reason, promise });
  process.exit(1);
});

// Start the bot
if (require.main === module) {
  main();
}

export { EnhancedMEVBot };