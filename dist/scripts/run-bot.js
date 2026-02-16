"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedMEVBot = void 0;
const ethers_1 = require("ethers");
const ethers_provider_bundle_1 = require("@flashbots/ethers-provider-bundle");
const mev_share_client_1 = __importDefault(require("@flashbots/mev-share-client"));
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const winston_1 = __importDefault(require("winston"));
const gas_pricing_1 = require("../utils/gas-pricing");
const volatile_tokens_1 = require("../utils/volatile-tokens");
const dex_routers_1 = require("../utils/dex-routers");
const arbitrage_pathfinder_1 = require("../utils/arbitrage-pathfinder");
const gas_optimizer_1 = require("../utils/gas-optimizer");
const l2_gas_manager_1 = require("../utils/l2-gas-manager");
const mev_bundle_optimizer_1 = require("../utils/mev-bundle-optimizer");
const triangular_arbitrage_1 = require("../strategies/triangular-arbitrage");
const dynamic_slippage_manager_1 = require("../utils/dynamic-slippage-manager");
const adaptive_profit_manager_1 = require("../utils/adaptive-profit-manager");
const advanced_risk_manager_1 = require("../utils/advanced-risk-manager");
const oracle_price_validator_1 = require("../utils/oracle-price-validator");
const optimization_coordinator_1 = require("../src/optimization/optimization-coordinator");
const BalancerVault_json_1 = __importDefault(require("../abi/BalancerVault.json"));
const UniswapV2Router_json_1 = __importDefault(require("../abi/UniswapV2Router.json"));
const SushiSwapRouter_json_1 = __importDefault(require("../abi/SushiSwapRouter.json"));
const UniswapV3Quoter_json_1 = __importDefault(require("../abi/UniswapV3Quoter.json"));
dotenv_1.default.config();
// Enhanced logging configuration
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        new winston_1.default.transports.File({ filename: "bot.log" }),
        new winston_1.default.transports.File({ filename: "bot-error.log", level: "error" })
    ]
});
class EnhancedMEVBot {
    // Provider setup
    arbitrumProvider;
    optimismProvider;
    executorSigner;
    authSigner;
    optimismExecutor;
    // Flashbots integration
    flashbotsProvider;
    mevShareClient;
    // OPTIMIZATION MODULES
    gasOptimizer;
    l2GasManager;
    mevBundleOptimizer;
    triangularArbManager;
    // PHASE 3 OPTIMIZATION MODULES
    dynamicSlippageManager;
    adaptiveProfitManager;
    advancedRiskManager;
    oraclePriceValidator;
    // MARKET OPTIMIZATION PROTOCOL
    optimizationCoordinator;
    // Contract instances
    arbBotContract;
    optBotContract;
    arbBalancerVault;
    optBalancerVault;
    arbAavePool;
    optAavePool;
    // Router contracts - Arbitrum
    arbUniV2Router;
    arbSushiRouter;
    arbUniV3Quoter;
    // Router contracts - Optimism
    optUniV2Router;
    optSushiRouter;
    optUniV3Quoter;
    // Token addresses - Arbitrum (native USDC, not bridged)
    TOKENS_ARB = {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC (Circle)
        USDC_BRIDGED: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // Bridged USDC.e (for depeg arb)
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529", // LST
        rETH: "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8", // LST
        GMX: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
        PENDLE: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8"
    };
    // Token addresses - Optimism (native USDC, not bridged)
    TOKENS_OPT = {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Native USDC (Circle)
        USDC_BRIDGED: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", // Bridged USDC.e (for depeg arb)
        USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        WBTC: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
        OP: "0x4200000000000000000000000000000000000042",
        DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        wstETH: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb", // LST
        rETH: "0x9Bcef72be871e61ED4fBbc7630889beE758eb81D", // LST
        SNX: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4"
    };
    // Router addresses
    ROUTERS_ARB = {
        UNISWAP_V2: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
        SUSHISWAP: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
        UNISWAP_V3_QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
    };
    ROUTERS_OPT = {
        UNISWAP_V2: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
        SUSHISWAP: "0x2ABf469074dc0b54d793850807E6eb5Faf2625b1",
        UNISWAP_V3_QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
    };
    // Aave V3 Pool addresses
    AAVE_POOLS = {
        ARBITRUM: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        OPTIMISM: "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
    };
    // Trading pairs configuration - expanded for competitive edge
    TRADING_PAIRS = [
        // Core high-liquidity pairs
        {
            tokenA: this.TOKENS_ARB.WETH,
            tokenB: this.TOKENS_ARB.USDC,
            symbolA: "WETH", symbolB: "USDC",
            decimalsA: 18, decimalsB: 6,
            minAmount: (0, ethers_1.parseEther)("0.1").toString(),
            maxAmount: (0, ethers_1.parseEther)("10").toString()
        },
        {
            tokenA: this.TOKENS_ARB.WETH,
            tokenB: this.TOKENS_ARB.USDT,
            symbolA: "WETH", symbolB: "USDT",
            decimalsA: 18, decimalsB: 6,
            minAmount: (0, ethers_1.parseEther)("0.1").toString(),
            maxAmount: (0, ethers_1.parseEther)("10").toString()
        },
        {
            tokenA: this.TOKENS_ARB.WBTC,
            tokenB: this.TOKENS_ARB.WETH,
            symbolA: "WBTC", symbolB: "WETH",
            decimalsA: 8, decimalsB: 18,
            minAmount: (0, ethers_1.parseUnits)("0.01", 8).toString(),
            maxAmount: (0, ethers_1.parseUnits)("1", 8).toString()
        },
        // Stablecoin depeg arbitrage: native USDC vs bridged USDC.e
        {
            tokenA: this.TOKENS_ARB.USDC,
            tokenB: this.TOKENS_ARB.USDC_BRIDGED,
            symbolA: "USDC", symbolB: "USDC.e",
            decimalsA: 6, decimalsB: 6,
            minAmount: (0, ethers_1.parseUnits)("100", 6).toString(),
            maxAmount: (0, ethers_1.parseUnits)("100000", 6).toString()
        },
        {
            tokenA: this.TOKENS_ARB.USDC,
            tokenB: this.TOKENS_ARB.USDT,
            symbolA: "USDC", symbolB: "USDT",
            decimalsA: 6, decimalsB: 6,
            minAmount: (0, ethers_1.parseUnits)("100", 6).toString(),
            maxAmount: (0, ethers_1.parseUnits)("100000", 6).toString()
        },
        // LST/ETH spread arbitrage
        {
            tokenA: this.TOKENS_ARB.wstETH,
            tokenB: this.TOKENS_ARB.WETH,
            symbolA: "wstETH", symbolB: "WETH",
            decimalsA: 18, decimalsB: 18,
            minAmount: (0, ethers_1.parseEther)("0.5").toString(),
            maxAmount: (0, ethers_1.parseEther)("20").toString()
        },
        {
            tokenA: this.TOKENS_ARB.rETH,
            tokenB: this.TOKENS_ARB.WETH,
            symbolA: "rETH", symbolB: "WETH",
            decimalsA: 18, decimalsB: 18,
            minAmount: (0, ethers_1.parseEther)("0.5").toString(),
            maxAmount: (0, ethers_1.parseEther)("20").toString()
        },
        // Native token pairs
        {
            tokenA: this.TOKENS_ARB.ARB,
            tokenB: this.TOKENS_ARB.WETH,
            symbolA: "ARB", symbolB: "WETH",
            decimalsA: 18, decimalsB: 18,
            minAmount: (0, ethers_1.parseEther)("100").toString(),
            maxAmount: (0, ethers_1.parseEther)("50000").toString()
        },
        // DeFi tokens with high volatility
        {
            tokenA: this.TOKENS_ARB.GMX,
            tokenB: this.TOKENS_ARB.WETH,
            symbolA: "GMX", symbolB: "WETH",
            decimalsA: 18, decimalsB: 18,
            minAmount: (0, ethers_1.parseEther)("1").toString(),
            maxAmount: (0, ethers_1.parseEther)("100").toString()
        },
        {
            tokenA: this.TOKENS_ARB.PENDLE,
            tokenB: this.TOKENS_ARB.WETH,
            symbolA: "PENDLE", symbolB: "WETH",
            decimalsA: 18, decimalsB: 18,
            minAmount: (0, ethers_1.parseEther)("10").toString(),
            maxAmount: (0, ethers_1.parseEther)("5000").toString()
        }
    ];
    // Configuration constants
    MIN_PROFIT_THRESHOLD = (0, ethers_1.parseEther)("0.01");
    MIN_CROSS_CHAIN_SPREAD = 0.0005; // 0.05%
    CRITICAL_SPREAD_THRESHOLD = 0.002; // 0.2%
    MAX_SLIPPAGE = 0.03; // 3%
    BUNDLE_TIMEOUT = 30000; // 30 seconds
    PRICE_UPDATE_INTERVAL = 5000; // 5 seconds
    GAS_LIMIT = 800000n;
    MAX_PRIORITY_FEE = (0, ethers_1.parseUnits)("3", "gwei");
    COOLDOWN_PERIOD = 15000; // 15 seconds
    // State management
    lastExecutionTime = 0;
    isRunning = false;
    crossChainEnabled = false;
    triangularEnabled = false;
    simulationMode = false;
    verboseMode = false;
    circuitBreakerTripped = false;
    totalProfit = BigInt(0);
    totalLoss = BigInt(0);
    executionCount = 0;
    opportunityCache = new Map();
    simulationStats = {
        opportunitiesDetected: 0,
        potentialProfit: BigInt(0),
        gasEstimated: BigInt(0),
        executionTime: 0
    };
    constructor(cliConfig) {
        this.initializeConfiguration(cliConfig);
        this.setupProviders();
        this.setupSigners();
        this.initializeContracts();
        this.initializeOptimizationModules();
    }
    initializeConfiguration(cliConfig) {
        // CLI arguments override environment variables
        this.crossChainEnabled = cliConfig?.crossChain ?? process.env.ENABLE_CROSS_CHAIN_MONITORING === "true";
        this.triangularEnabled = cliConfig?.triangular ?? process.env.ENABLE_TRIANGULAR_ARBITRAGE === "true";
        this.simulationMode = cliConfig?.simulate ?? process.env.ENABLE_SIMULATION_MODE === "true";
        this.verboseMode = cliConfig?.verbose ?? process.env.VERBOSE_LOGGING === "true";
        // Set log level based on verbose mode
        if (this.verboseMode) {
            logger.level = 'debug';
        }
        logger.info(chalk_1.default.blue("🔧 Configuration initialized"), {
            crossChain: this.crossChainEnabled,
            triangular: this.triangularEnabled,
            simulation: this.simulationMode,
            verbose: this.verboseMode
        });
    }
    setupProviders() {
        this.arbitrumProvider = new ethers_1.JsonRpcProvider(process.env.ARB_RPC, {
            name: "arbitrum",
            chainId: 42161
        });
        this.optimismProvider = new ethers_1.JsonRpcProvider(process.env.OPT_RPC, {
            name: "optimism",
            chainId: 10
        });
        logger.info(chalk_1.default.green("✅ Providers initialized"));
    }
    setupSigners() {
        this.executorSigner = new ethers_1.Wallet(process.env.PRIVATE_KEY, this.arbitrumProvider);
        this.authSigner = new ethers_1.Wallet(process.env.FLASHBOTS_AUTH_KEY, this.arbitrumProvider);
        this.optimismExecutor = new ethers_1.Wallet(process.env.PRIVATE_KEY, this.optimismProvider);
        logger.info(chalk_1.default.green("✅ Signers configured"), {
            executor: this.executorSigner.address,
            auth: this.authSigner.address
        });
    }
    // Bot contract ABI - matches FlashArbBotBalancer.sol
    static BOT_CONTRACT_ABI = [
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
    initializeContracts() {
        // Arbitrum contracts
        this.arbBotContract = new ethers_1.ethers.Contract(process.env.BOT_CONTRACT_ADDRESS, EnhancedMEVBot.BOT_CONTRACT_ABI, this.executorSigner);
        this.arbBalancerVault = new ethers_1.ethers.Contract(process.env.BALANCER_VAULT_ADDRESS, BalancerVault_json_1.default, this.executorSigner);
        this.arbUniV2Router = new ethers_1.ethers.Contract(this.ROUTERS_ARB.UNISWAP_V2, UniswapV2Router_json_1.default, this.executorSigner);
        this.arbSushiRouter = new ethers_1.ethers.Contract(this.ROUTERS_ARB.SUSHISWAP, SushiSwapRouter_json_1.default, this.executorSigner);
        this.arbUniV3Quoter = new ethers_1.ethers.Contract(this.ROUTERS_ARB.UNISWAP_V3_QUOTER, UniswapV3Quoter_json_1.default, this.executorSigner);
        // Aave V3 Pool contracts
        this.arbAavePool = new ethers_1.ethers.Contract(this.AAVE_POOLS.ARBITRUM, [
            "function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128)",
            "function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)",
            "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external"
        ], this.executorSigner);
        // Optimism contracts (if cross-chain enabled)
        if (this.crossChainEnabled && process.env.OPT_BOT_CONTRACT_ADDRESS) {
            this.optBotContract = new ethers_1.ethers.Contract(process.env.OPT_BOT_CONTRACT_ADDRESS, EnhancedMEVBot.BOT_CONTRACT_ABI, this.optimismExecutor);
            this.optBalancerVault = new ethers_1.ethers.Contract(process.env.OPT_BALANCER_VAULT_ADDRESS, BalancerVault_json_1.default, this.optimismExecutor);
            this.optUniV2Router = new ethers_1.ethers.Contract(this.ROUTERS_OPT.UNISWAP_V2, UniswapV2Router_json_1.default, this.optimismExecutor);
            this.optSushiRouter = new ethers_1.ethers.Contract(this.ROUTERS_OPT.SUSHISWAP, SushiSwapRouter_json_1.default, this.optimismExecutor);
            this.optUniV3Quoter = new ethers_1.ethers.Contract(this.ROUTERS_OPT.UNISWAP_V3_QUOTER, UniswapV3Quoter_json_1.default, this.optimismExecutor);
            this.optAavePool = new ethers_1.ethers.Contract(this.AAVE_POOLS.OPTIMISM, [
                "function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128)",
                "function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)",
                "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external"
            ], this.optimismExecutor);
        }
        logger.info(chalk_1.default.green("✅ Contracts initialized"));
    }
    initializeOptimizationModules() {
        // Initialize gas optimization modules
        this.gasOptimizer = new gas_optimizer_1.GasOptimizer(process.env.ARB_RPC, process.env.OPT_RPC);
        this.l2GasManager = new l2_gas_manager_1.L2GasManager(process.env.ARB_RPC, process.env.OPT_RPC, process.env.MAINNET_RPC);
        this.mevBundleOptimizer = new mev_bundle_optimizer_1.MEVBundleOptimizer(this.flashbotsProvider, this.gasOptimizer, this.l2GasManager, this.arbitrumProvider, this.executorSigner);
        this.triangularArbManager = new triangular_arbitrage_1.TriangularArbManager(this.arbitrumProvider, new dex_routers_1.EnhancedDEXManager(), this.gasOptimizer);
        // PHASE 3: Initialize advanced optimization modules
        const providers = new Map([
            [42161, this.arbitrumProvider],
            [10, this.optimismProvider]
        ]);
        this.dynamicSlippageManager = new dynamic_slippage_manager_1.DynamicSlippageManager(providers);
        this.adaptiveProfitManager = new adaptive_profit_manager_1.AdaptiveProfitManager(providers);
        this.oraclePriceValidator = new oracle_price_validator_1.OraclePriceValidator(providers);
        // Initialize risk manager with starting capital
        const initialCapital = (0, ethers_1.parseEther)("10"); // 10 ETH starting capital
        this.advancedRiskManager = new advanced_risk_manager_1.AdvancedRiskManager(initialCapital);
        // MARKET OPTIMIZATION PROTOCOL: Initialize coordination layer
        this.optimizationCoordinator = new optimization_coordinator_1.OptimizationCoordinator(providers, {
            adaptiveProfitManager: this.adaptiveProfitManager,
            gasOptimizer: this.gasOptimizer,
            slippageManager: this.dynamicSlippageManager,
            mevBundleOptimizer: this.mevBundleOptimizer,
            riskManager: this.advancedRiskManager,
            priceValidator: this.oraclePriceValidator
        }, {
            enabled: process.env.MARKET_OPTIMIZATION_ENABLED === 'true',
            primaryChainId: 42161,
            frequency: parseInt(process.env.OPTIMIZATION_FREQUENCY || '300000')
        });
        logger.info(chalk_1.default.green("🚀 All optimization modules initialized"));
        logger.info(chalk_1.default.blue("📊 Phase 3 advanced optimizations: Dynamic Slippage, Adaptive Profit, Risk Management, Oracle Validation"));
        logger.info(chalk_1.default.magenta("🎯 Market Optimization Protocol integrated and ready"));
    }
    async checkAaveLiquidity(asset, amount, chainId) {
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
    async checkBalancerLiquidity(asset, amount, chainId) {
        const vault = chainId === 42161 ? this.arbBalancerVault : this.optBalancerVault;
        const maxLoan = await vault.maxFlashLoan(asset);
        return {
            available: maxLoan >= amount,
            fee: 0n,
            maxLoan
        };
    }
    async selectOptimalFlashLoanProvider(asset, amount, chainId) {
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
        }
        else if (aaveData.available) {
            return {
                provider: 'AAVE',
                fee: aaveData.fee,
                score: aaveScore
            };
        }
        else {
            throw new Error('No flash loan provider available');
        }
    }
    calculateProviderScore(liquidityData, amount) {
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
        }
        else {
            score += 10;
        }
        return Math.min(100, Math.max(0, score));
    }
    async monitorLiquidityHealth() {
        const assets = [
            this.TOKENS_ARB.WETH,
            this.TOKENS_ARB.USDC,
            this.TOKENS_ARB.USDT,
            this.TOKENS_ARB.WBTC
        ];
        for (const asset of assets) {
            try {
                const [aaveData, balancerData] = await Promise.all([
                    this.checkAaveLiquidity(asset, (0, ethers_1.parseEther)("10"), 42161),
                    this.checkBalancerLiquidity(asset, (0, ethers_1.parseEther)("10"), 42161)
                ]);
                if (aaveData.utilizationRate > 0.8) {
                    logger.warn(chalk_1.default.yellow(`High Aave utilization for ${asset}: ${aaveData.utilizationRate * 100}%`));
                }
                if (!balancerData.available) {
                    logger.warn(chalk_1.default.yellow(`Balancer liquidity low for ${asset}`));
                }
            }
            catch (error) {
                logger.error(chalk_1.default.red(`Error monitoring liquidity for ${asset}`), error);
            }
        }
    }
    async initialize() {
        try {
            // L2 networks (Arbitrum/Optimism) don't use Flashbots relay directly.
            // Transactions are submitted directly to the L2 sequencer.
            // Initialize Flashbots provider only for simulation purposes on mainnet fork.
            try {
                if (process.env.MAINNET_RPC && process.env.FLASHBOTS_AUTH_KEY) {
                    const mainnetProvider = new ethers_1.JsonRpcProvider(process.env.MAINNET_RPC);
                    const fbAuthSigner = new ethers_1.Wallet(process.env.FLASHBOTS_AUTH_KEY, mainnetProvider);
                    this.flashbotsProvider = await ethers_provider_bundle_1.FlashbotsBundleProvider.create(mainnetProvider, fbAuthSigner, process.env.FLASHBOTS_RELAY_URL || "https://relay.flashbots.net", "mainnet");
                    logger.info(chalk_1.default.cyan("Flashbots provider initialized for mainnet simulation only"));
                }
            }
            catch (error) {
                logger.warn("Flashbots provider initialization skipped (not needed for L2 direct submission)", error);
            }
            // MEV-Share client (optional, for mainnet MEV protection)
            try {
                if (process.env.MAINNET_RPC && process.env.FLASHBOTS_AUTH_KEY) {
                    const mainnetProvider = new ethers_1.JsonRpcProvider(process.env.MAINNET_RPC);
                    const mainnetSigner = new ethers_1.Wallet(process.env.FLASHBOTS_AUTH_KEY, mainnetProvider);
                    const mainnetNetwork = await mainnetProvider.getNetwork();
                    this.mevShareClient = mev_share_client_1.default.fromNetwork(mainnetSigner, mainnetNetwork);
                }
            }
            catch (error) {
                logger.warn("MEV-Share client initialization failed, continuing without MEV-Share", error);
            }
            logger.info(chalk_1.default.green("L2 direct submission mode active (Arbitrum/Optimism sequencers)"));
            // Verify balances
            const arbBalance = await this.arbitrumProvider.getBalance(this.executorSigner.address);
            const optBalance = this.crossChainEnabled ?
                await this.optimismProvider.getBalance(this.optimismExecutor.address) : 0n;
            // Initialize Market Optimization Protocol
            try {
                await this.optimizationCoordinator.initialize();
                logger.info(chalk_1.default.magenta("🎯 Market Optimization Protocol initialized successfully"));
            }
            catch (error) {
                logger.warn(chalk_1.default.yellow("⚠️ Market Optimization Protocol initialization failed, continuing in fallback mode"), error);
            }
            logger.info(chalk_1.default.green("🚀 Enhanced MEV Bot initialized"), {
                arbitrumBalance: (0, ethers_1.formatEther)(arbBalance),
                optimismBalance: (0, ethers_1.formatEther)(optBalance),
                flashbotsEnabled: true,
                mevShareEnabled: !!this.mevShareClient,
                optimizationEnabled: this.optimizationCoordinator?.getOptimizationStatus().isRunning || false
            });
            // Check circuit breaker
            await this.checkCircuitBreaker();
        }
        catch (error) {
            logger.error(chalk_1.default.red("❌ Initialization failed"), error);
            throw error;
        }
    }
    async executeArbitrage(opportunity) {
        try {
            const now = Date.now();
            if (now - this.lastExecutionTime < this.COOLDOWN_PERIOD) {
                logger.info(chalk_1.default.yellow("⏱️ Cooldown period active"));
                return false;
            }
            if (this.circuitBreakerTripped) {
                logger.error(chalk_1.default.red("🚨 Circuit breaker tripped - execution disabled"));
                return false;
            }
            // PHASE 3: Advanced Risk Assessment
            const riskAssessment = await this.advancedRiskManager.assessTradeRisk([opportunity.tokenA, opportunity.tokenB], BigInt(opportunity.amountIn), BigInt(opportunity.expectedProfit), BigInt(opportunity.gasCost), opportunity.isTriangular ? 'triangular' : 'dual_dex', opportunity.chainId, 0.75 // Default confidence
            );
            if (!riskAssessment.approved) {
                logger.warn(chalk_1.default.red("❌ Trade rejected by risk manager"), {
                    reasons: riskAssessment.reasonsForRejection,
                    riskLevel: riskAssessment.riskLevel
                });
                return false;
            }
            if (riskAssessment.warnings.length > 0) {
                logger.warn(chalk_1.default.yellow("⚠️ Risk warnings:"), riskAssessment.warnings);
            }
            // PHASE 3: Oracle Price Validation
            const priceValidation = await this.oraclePriceValidator.validateTokenPrice(opportunity.tokenA, opportunity.tokenB, (0, ethers_1.parseUnits)("1", 18), // Normalized price
            opportunity.chainId, BigInt(opportunity.amountIn));
            if (!priceValidation.isValid || priceValidation.recommendation === 'reject') {
                logger.warn(chalk_1.default.red("❌ Trade rejected by price validator"), {
                    riskLevel: priceValidation.riskLevel,
                    manipulation: priceValidation.manipulationScore,
                    warnings: priceValidation.warnings
                });
                return false;
            }
            if (priceValidation.recommendation === 'caution') {
                logger.warn(chalk_1.default.yellow("⚠️ Price validation concerns:"), priceValidation.warnings);
            }
            // PHASE 3: Dynamic Slippage Calculation
            const slippageResult = await this.dynamicSlippageManager.calculateOptimalSlippage(opportunity.tokenA, opportunity.tokenB, BigInt(opportunity.amountIn), opportunity.chainId);
            // PHASE 3: Adaptive Profit Threshold
            const profitThreshold = await this.adaptiveProfitManager.calculateOptimalThreshold([opportunity.tokenA, opportunity.tokenB], BigInt(opportunity.amountIn), BigInt(opportunity.gasCost), opportunity.chainId);
            // Check if opportunity meets adaptive threshold
            if (BigInt(opportunity.netProfit) < profitThreshold.minProfitWei) {
                logger.info(chalk_1.default.yellow("📊 Opportunity below adaptive threshold"), {
                    netProfit: (0, ethers_1.formatEther)(opportunity.netProfit),
                    minRequired: (0, ethers_1.formatEther)(profitThreshold.minProfitWei.toString()),
                    reasoning: profitThreshold.reasoning
                });
                return false;
            }
            // MARKET OPTIMIZATION PROTOCOL: Get optimized parameters and validate trade
            let optimizationValidation;
            try {
                optimizationValidation = await this.optimizationCoordinator.validateTradeParameters(opportunity.tokenA, opportunity.tokenB, BigInt(opportunity.amountIn), BigInt(opportunity.expectedProfit), opportunity.chainId);
                if (!optimizationValidation.approved) {
                    logger.warn(chalk_1.default.red("❌ Trade rejected by Market Optimization Protocol"), {
                        warnings: optimizationValidation.warnings
                    });
                    return false;
                }
                if (optimizationValidation.warnings.length > 0) {
                    logger.warn(chalk_1.default.yellow("⚠️ Market optimization warnings:"), optimizationValidation.warnings);
                }
                logger.info(chalk_1.default.magenta("🎯 Market Optimization Protocol approved trade"), {
                    riskLevel: optimizationValidation.optimizedParameters.riskLevel,
                    slippage: `${optimizationValidation.optimizedParameters.slippageTolerance}bps`,
                    gasUrgency: optimizationValidation.optimizedParameters.gasSettings.urgency
                });
            }
            catch (error) {
                logger.warn(chalk_1.default.yellow("⚠️ Market optimization validation failed, using fallback parameters"), error);
                optimizationValidation = null;
            }
            logger.info(chalk_1.default.cyan("🚀 Executing arbitrage opportunity (All systems approved)"), {
                id: opportunity.id,
                profit: (0, ethers_1.formatEther)(opportunity.netProfit),
                spread: opportunity.spread,
                chain: opportunity.chainId === 42161 ? 'Arbitrum' : 'Optimism',
                slippage: `${slippageResult.slippageBps}bps`,
                profitStrategy: profitThreshold.recommendation,
                riskLevel: riskAssessment.riskLevel
            });
            if (this.simulationMode) {
                logger.info(chalk_1.default.blue("🎯 SIMULATION MODE - No actual execution"));
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
            if (!bundle)
                return false;
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
                logger.info(chalk_1.default.green("✅ Arbitrage executed successfully"), {
                    profit: (0, ethers_1.formatEther)(opportunity.netProfit),
                    totalProfit: (0, ethers_1.formatEther)(this.totalProfit),
                    executions: this.executionCount
                });
                return true;
            }
            return false;
        }
        catch (error) {
            logger.error(chalk_1.default.red("❌ Failed to execute arbitrage"), error);
            this.totalLoss += BigInt(opportunity.gasCost);
            await this.checkCircuitBreaker();
            return false;
        }
    }
    async performStaticSimulation(opportunity) {
        try {
            const startTime = Date.now();
            const provider = opportunity.chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
            const botContract = opportunity.chainId === 42161 ? this.arbBotContract : this.optBotContract;
            if (this.verboseMode) {
                logger.debug(chalk_1.default.cyan("🔍 Performing static simulation"), {
                    id: opportunity.id,
                    tokenA: opportunity.tokenA,
                    tokenB: opportunity.tokenB,
                    amountIn: (0, ethers_1.formatEther)(opportunity.amountIn),
                    expectedProfit: (0, ethers_1.formatEther)(opportunity.expectedProfit)
                });
            }
            // Use callStatic to simulate contract calls without execution
            if (opportunity.isTriangular) {
                const result = await botContract.executeTriangularArb.staticCall(opportunity.tokenA, opportunity.amountIn, opportunity.path, opportunity.expectedProfit);
                if (this.verboseMode) {
                    logger.debug(chalk_1.default.green("✅ Triangular arbitrage static call successful"), {
                        result: result.toString()
                    });
                }
            }
            else {
                const result = await botContract.executeArb.staticCall(opportunity.tokenA, opportunity.amountIn, opportunity.path, opportunity.sushiFirst, opportunity.expectedProfit);
                if (this.verboseMode) {
                    logger.debug(chalk_1.default.green("✅ Dual router arbitrage static call successful"), {
                        result: result.toString()
                    });
                }
            }
            // Simulate Flashbots bundle creation and simulation
            if (this.verboseMode) {
                const bundle = await this.createMEVBundle(opportunity);
                if (bundle) {
                    logger.debug(chalk_1.default.blue("📦 MEV Bundle created for simulation"), {
                        targetBlock: bundle.targetBlockNumber,
                        gasLimit: opportunity.gasEstimate
                    });
                    // Simulate bundle without submission
                    const signedBundle = await this.flashbotsProvider.signBundle(bundle.transactions);
                    const simulation = await this.flashbotsProvider.simulate(signedBundle, bundle.targetBlockNumber);
                    if ('error' in simulation) {
                        logger.debug(chalk_1.default.yellow("⚠️ Bundle simulation warning"), simulation.error);
                    }
                    else {
                        logger.debug(chalk_1.default.green("✅ Bundle simulation successful"), {
                            gasUsed: simulation.totalGasUsed?.toString(),
                            coinbaseDiff: simulation.coinbaseDiff?.toString()
                        });
                    }
                }
            }
            const executionTime = Date.now() - startTime;
            this.simulationStats.executionTime += executionTime;
            logger.info(chalk_1.default.blue("📊 Simulation completed"), {
                executionTime: `${executionTime}ms`,
                profit: (0, ethers_1.formatEther)(opportunity.netProfit),
                gasEstimate: (0, ethers_1.formatUnits)(opportunity.gasEstimate, 'gwei')
            });
        }
        catch (error) {
            logger.error(chalk_1.default.red("❌ Static simulation failed"), {
                error: error instanceof Error ? error.message : error,
                opportunity: opportunity.id
            });
        }
    }
    updateSimulationStats(opportunity) {
        this.simulationStats.opportunitiesDetected++;
        this.simulationStats.potentialProfit += BigInt(opportunity.netProfit);
        this.simulationStats.gasEstimated += BigInt(opportunity.gasEstimate);
    }
    printSimulationSummary() {
        logger.info(chalk_1.default.magenta("\n📈 SIMULATION SUMMARY"));
        logger.info(chalk_1.default.cyan("────────────────────────────────────────"));
        logger.info(chalk_1.default.white(`📊 Opportunities Detected: ${this.simulationStats.opportunitiesDetected}`));
        logger.info(chalk_1.default.green(`💰 Total Potential Profit: ${(0, ethers_1.formatEther)(this.simulationStats.potentialProfit)} ETH`));
        logger.info(chalk_1.default.yellow(`⛽ Total Gas Estimated: ${(0, ethers_1.formatUnits)(this.simulationStats.gasEstimated, 'gwei')} Gwei`));
        logger.info(chalk_1.default.blue(`⏱️  Total Execution Time: ${this.simulationStats.executionTime}ms`));
        if (this.simulationStats.opportunitiesDetected > 0) {
            const avgProfit = this.simulationStats.potentialProfit / BigInt(this.simulationStats.opportunitiesDetected);
            logger.info(chalk_1.default.white(`📈 Average Profit per Opportunity: ${(0, ethers_1.formatEther)(avgProfit)} ETH`));
        }
        logger.info(chalk_1.default.cyan("────────────────────────────────────────\n"));
    }
    // Enhanced arbitrage scanning with parallel quotes and multi-DEX support
    async scanForArbitrageOpportunities() {
        const opportunities = [];
        const scanStart = Date.now();
        try {
            // OPTIMIZATION: Parallel scanning of both chains simultaneously
            const scanPromises = [];
            // Scan Arbitrum opportunities
            scanPromises.push((async () => {
                const arbPathfinder = new arbitrage_pathfinder_1.EnhancedArbitragePathfinder(new Map([[42161, this.arbitrumProvider]]));
                const arbOpportunities = await arbPathfinder.findArbitrageOpportunities(42161, 4, 0.003);
                for (const opportunity of arbOpportunities) {
                    const arbOpp = this.convertToLegacyFormat(opportunity, 42161);
                    if (arbOpp)
                        opportunities.push(arbOpp);
                }
            })());
            // Scan Optimism opportunities in parallel if cross-chain enabled
            if (this.crossChainEnabled) {
                scanPromises.push((async () => {
                    const optPathfinder = new arbitrage_pathfinder_1.EnhancedArbitragePathfinder(new Map([[10, this.optimismProvider]]));
                    const optOpportunities = await optPathfinder.findArbitrageOpportunities(10, 4, 0.003);
                    for (const opportunity of optOpportunities) {
                        const optOpp = this.convertToLegacyFormat(opportunity, 10);
                        if (optOpp)
                            opportunities.push(optOpp);
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
                logger.info(chalk_1.default.green(`🎯 Enhanced pathfinding found ${opportunities.length} opportunities in ${scanDuration}ms`));
                const arbStats = dex_routers_1.EnhancedDEXManager.getCoverageStats(42161);
                const optStats = this.crossChainEnabled ? dex_routers_1.EnhancedDEXManager.getCoverageStats(10) : null;
                logger.info(chalk_1.default.cyan(`📊 Arbitrum: ${arbStats.totalRouters} DEXes, avg liquidity: ${arbStats.averageLiquidityScore.toFixed(1)}`));
                if (optStats) {
                    logger.info(chalk_1.default.cyan(`📊 Optimism: ${optStats.totalRouters} DEXes, avg liquidity: ${optStats.averageLiquidityScore.toFixed(1)}`));
                }
            }
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error in enhanced arbitrage scanning:"), error);
        }
        return opportunities.slice(0, 20);
    }
    // Direct price comparison on high-priority pairs for fastest detection
    async scanDirectPriceOpportunities(opportunities) {
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
                    if (!uniQuote || !sushiQuote)
                        return;
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
                            gasCost: (0, ethers_1.formatEther)(500000n * (0, ethers_1.parseUnits)("0.1", "gwei")),
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
                }
                catch {
                    // Skip pair on error
                }
            });
            await Promise.allSettled(quotePromises);
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error in direct price scanning:"), error);
        }
    }
    async scanCrossChainOpportunities() {
        if (!this.crossChainEnabled)
            return [];
        try {
            const crossChainOpportunities = [];
            // Get high-volatility pairs for both chains
            const arbPairs = volatile_tokens_1.VolatileTokenTracker.getHighVolatilityPairs(42161);
            const optPairs = volatile_tokens_1.VolatileTokenTracker.getHighVolatilityPairs(10);
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
                                amountIn: (0, ethers_1.parseEther)("1").toString(),
                                arbitrumPrice: "1.0",
                                optimismPrice: (1 + spread).toString(),
                                spread: spread.toString(),
                                estimatedProfit: (0, ethers_1.parseEther)((spread - 0.005).toString()).toString(),
                                bridgeCost,
                                netProfit: (0, ethers_1.parseEther)(Math.max(0, spread - 0.005).toString()).toString(),
                                timestamp: Date.now(),
                                profitable: spread > 0.005,
                                alertLevel: spread > 0.02 ? 'critical' : spread > 0.01 ? 'warning' : 'info'
                            });
                        }
                    }
                }
            }
            if (this.verboseMode && crossChainOpportunities.length > 0) {
                logger.info(chalk_1.default.yellow(`🌉 Found ${crossChainOpportunities.length} cross-chain opportunities`));
            }
            return crossChainOpportunities;
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error scanning cross-chain opportunities:"), error);
            return [];
        }
    }
    async createMEVBundle(opportunity) {
        try {
            const provider = opportunity.chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
            const botContract = opportunity.chainId === 42161 ? this.arbBotContract : this.optBotContract;
            const signer = opportunity.chainId === 42161 ? this.executorSigner : this.optimismExecutor;
            let tx;
            if (opportunity.isTriangular) {
                tx = await botContract.executeTriangularArb.populateTransaction(opportunity.tokenA, opportunity.amountIn, opportunity.path, opportunity.expectedProfit);
            }
            else {
                tx = await botContract.executeArb.populateTransaction(opportunity.tokenA, opportunity.amountIn, opportunity.path, opportunity.sushiFirst, opportunity.expectedProfit);
            }
            // Set gas parameters with dynamic pricing (high urgency for MEV)
            const gasSettings = await this.estimateGasSettings(opportunity.chainId, 'high');
            tx.gasLimit = gasSettings.gasLimit;
            tx.maxFeePerGas = gasSettings.maxFeePerGas;
            tx.maxPriorityFeePerGas = gasSettings.maxPriorityFeePerGas;
            tx.nonce = await provider.getTransactionCount(signer.address);
            tx.chainId = BigInt(opportunity.chainId);
            if (this.verboseMode) {
                logger.debug(chalk_1.default.cyan(`🚀 MEV bundle gas: ${gas_pricing_1.DynamicGasPricer.formatGasSettings(gasSettings)}`));
            }
            const currentBlock = await provider.getBlockNumber();
            const targetBlockNumber = currentBlock + 1;
            const bundleTransaction = {
                signer: signer,
                transaction: tx
            };
            const bundle = {
                transactions: [bundleTransaction],
                targetBlockNumber
            };
            return bundle;
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error creating MEV bundle"), error);
            return null;
        }
    }
    async submitMEVBundle(bundle) {
        try {
            // L2 networks (Arbitrum/Optimism) use sequencers, not Flashbots relay.
            // Submit transactions directly to the sequencer for inclusion.
            for (const bundleTx of bundle.transactions) {
                const signer = bundleTx.signer;
                const tx = bundleTx.transaction;
                // Ensure required fields are populated
                if (!tx.to || tx.to === ethers_1.ethers.ZeroAddress) {
                    logger.error(chalk_1.default.red("Invalid transaction target address"));
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
                logger.info(chalk_1.default.cyan(`📤 Transaction submitted: ${signedTx.hash}`));
                // Wait for confirmation with timeout
                const receipt = await Promise.race([
                    signedTx.wait(1),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Transaction confirmation timeout")), this.BUNDLE_TIMEOUT))
                ]);
                if (!receipt || receipt.status !== 1) {
                    logger.error(chalk_1.default.red(`❌ Transaction reverted: ${signedTx.hash}`));
                    return false;
                }
                logger.info(chalk_1.default.green(`✅ Transaction confirmed in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed}`));
            }
            return true;
        }
        catch (error) {
            logger.error(chalk_1.default.red("❌ Failed to submit L2 transaction"), error);
            return false;
        }
    }
    async estimateGasSettings(chainId, urgency = 'high') {
        try {
            const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
            // Use dynamic gas pricer for optimal pricing
            const gasSettings = await gas_pricing_1.DynamicGasPricer.calculateOptimalGas(provider, chainId, urgency);
            if (this.verboseMode) {
                logger.info(chalk_1.default.cyan(`⛽ Dynamic gas pricing: ${gas_pricing_1.DynamicGasPricer.formatGasSettings(gasSettings)}`));
            }
            return gasSettings;
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error calculating dynamic gas settings"), error);
            // Use fallback from DynamicGasPricer
            const provider = chainId === 42161 ? this.arbitrumProvider : this.optimismProvider;
            return await gas_pricing_1.DynamicGasPricer.calculateOptimalGas(provider, chainId, urgency);
        }
    }
    async determineSushiFirst(tokenA, tokenB, amountIn, chainId) {
        try {
            const uniRouter = chainId === 42161 ? this.arbUniV2Router : this.optUniV2Router;
            const sushiRouter = chainId === 42161 ? this.arbSushiRouter : this.optSushiRouter;
            // Query both DEXes for actual prices
            const [uniAmounts, sushiAmounts] = await Promise.all([
                uniRouter.getAmountsOut(amountIn, [tokenA, tokenB]).catch(() => null),
                sushiRouter.getAmountsOut(amountIn, [tokenA, tokenB]).catch(() => null)
            ]);
            if (!uniAmounts && !sushiAmounts)
                return false;
            if (!uniAmounts)
                return true; // Only Sushi has liquidity
            if (!sushiAmounts)
                return false; // Only Uni has liquidity
            const uniOut = uniAmounts[uniAmounts.length - 1];
            const sushiOut = sushiAmounts[sushiAmounts.length - 1];
            // Buy on the cheaper DEX first (lower output = cheaper), sell on the more expensive one
            // sushiFirst=true means: buy on Sushi, sell on Uni
            // If Sushi gives less output (cheaper price), buy there first
            return sushiOut < uniOut;
        }
        catch (error) {
            logger.warn(chalk_1.default.yellow("Could not determine optimal DEX order, defaulting to Uni first"));
            return false;
        }
    }
    convertToLegacyFormat(opportunity, chainId) {
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
                gasCost: (0, ethers_1.formatEther)(opportunity.bestPath.totalGasCost * BigInt(50000000)), // 0.05 gwei
                timestamp: Date.now(),
                isTriangular: opportunity.bestPath.isTriangular,
                chainId,
                priority: Math.floor(opportunity.confidence * 10),
                spread: opportunity.bestPath.profitMargin,
                slippage: 0.01,
                flashLoanProvider: 'BALANCER',
                flashLoanFee: "0"
            };
        }
        catch (error) {
            return null;
        }
    }
    async checkCircuitBreaker() {
        try {
            // Check the advanced risk manager's circuit breaker status
            const cbStatus = this.advancedRiskManager.getCircuitBreakerStatus();
            if (cbStatus.isActive) {
                if (!this.circuitBreakerTripped) {
                    this.circuitBreakerTripped = true;
                    logger.error(chalk_1.default.red("🚨 CIRCUIT BREAKER TRIPPED"), {
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
            const startingCapital = (0, ethers_1.parseEther)("10"); // matches constructor initialization
            if (netPnL < 0n && (-netPnL * 100n) / startingCapital > 5n) {
                this.circuitBreakerTripped = true;
                logger.error(chalk_1.default.red("🚨 CIRCUIT BREAKER TRIPPED - Max drawdown exceeded"), {
                    totalProfit: (0, ethers_1.formatEther)(this.totalProfit),
                    totalLoss: (0, ethers_1.formatEther)(this.totalLoss),
                    netPnL: (0, ethers_1.formatEther)(netPnL)
                });
                return;
            }
            // If circuit breaker was previously tripped but conditions improved, reset it
            if (this.circuitBreakerTripped && !cbStatus.isActive) {
                this.circuitBreakerTripped = false;
                logger.info(chalk_1.default.green("✅ Circuit breaker reset - trading resumed"));
            }
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error checking circuit breaker"), error);
        }
    }
    async monitorAndExecute() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        try {
            if (this.verboseMode) {
                logger.info(chalk_1.default.blue("🔍 Enhanced scanning: Volatile tokens + Multi-DEX coverage"));
            }
            // Enhanced arbitrage scanning
            const opportunities = await this.scanForArbitrageOpportunities();
            // OPTIMIZATION: Triangular arbitrage opportunities (if enabled)
            let triangularOpportunities = [];
            if (this.triangularEnabled) {
                try {
                    const arbTriangular = await this.triangularArbManager.scanTriangularOpportunities(42161, 0.01);
                    triangularOpportunities = arbTriangular.filter(opp => opp.recommendedAction === 'execute');
                    if (this.verboseMode && triangularOpportunities.length > 0) {
                        logger.info(chalk_1.default.yellow(`🔺 Found ${triangularOpportunities.length} triangular arbitrage opportunities`));
                        triangularOpportunities.forEach(opp => {
                            logger.debug(`   ${opp.id}: ${(0, ethers_1.formatEther)(opp.profitAfterGas)} ETH profit`);
                        });
                    }
                }
                catch (error) {
                    logger.error(chalk_1.default.red("Error scanning triangular opportunities:"), error);
                }
            }
            // Cross-chain opportunities
            const crossChainOpportunities = await this.scanCrossChainOpportunities();
            // Update simulation stats
            for (const opportunity of opportunities) {
                this.updateSimulationStats(opportunity);
                if (this.simulationMode) {
                    // Simulation: Log opportunity details
                    logger.info(chalk_1.default.cyan(`📊 SIMULATION: ${opportunity.tokenA}-${opportunity.tokenB}, profit: ${(0, ethers_1.formatEther)(opportunity.netProfit)} ETH`));
                }
            }
            // Log results
            if (opportunities.length > 0) {
                logger.info(chalk_1.default.green(`✅ Found ${opportunities.length} arbitrage opportunities`));
                // OPTIMIZATION: MEV Bundle Creation and Optimization
                try {
                    const combinedOpportunities = [...opportunities, ...triangularOpportunities];
                    if (combinedOpportunities.length > 0) {
                        const targetBlock = await this.arbitrumProvider.getBlockNumber() + 2;
                        const bundleResult = await this.mevBundleOptimizer.createOptimalBundle(combinedOpportunities, targetBlock);
                        if (this.verboseMode) {
                            logger.info(chalk_1.default.magenta(`📦 MEV Bundle Optimized: ${bundleResult.bundle.length} transactions`));
                            logger.info(chalk_1.default.magenta(`   Expected Profit: ${(0, ethers_1.formatEther)(bundleResult.expectedProfit)} ETH`));
                            logger.info(chalk_1.default.magenta(`   Profit After Gas: ${(0, ethers_1.formatEther)(bundleResult.profitAfterGas)} ETH`));
                            logger.info(chalk_1.default.magenta(`   Success Rate: ${bundleResult.estimatedSuccessRate}%`));
                            if (bundleResult.recommendations.length > 0) {
                                logger.info(chalk_1.default.cyan("💡 Bundle Recommendations:"));
                                bundleResult.recommendations.forEach(rec => logger.info(chalk_1.default.cyan(`   • ${rec}`)));
                            }
                        }
                        // Simulate bundle if profitable
                        if (bundleResult.profitAfterGas > (0, ethers_1.parseUnits)("0.005", 18)) { // > 0.005 ETH profit
                            const simulation = await this.mevBundleOptimizer.simulateBundle(bundleResult.bundle, targetBlock);
                            if (simulation.success) {
                                logger.info(chalk_1.default.green(`✅ Bundle Simulation PASSED: ${(0, ethers_1.formatEther)(simulation.profit)} ETH profit`));
                                if (simulation.competitorAnalysis.similarBundles > 5) {
                                    logger.warn(chalk_1.default.yellow(`⚠️  High competition detected: ${simulation.competitorAnalysis.similarBundles} similar bundles`));
                                }
                            }
                            else {
                                logger.warn(chalk_1.default.red(`❌ Bundle Simulation FAILED: ${simulation.revertReason}`));
                            }
                        }
                    }
                }
                catch (error) {
                    logger.error(chalk_1.default.red("Error in MEV bundle optimization:"), error);
                }
                const bestOpportunity = opportunities[0];
                logger.info(chalk_1.default.cyan(`💎 Best: ${bestOpportunity.tokenA}-${bestOpportunity.tokenB}, profit: ${(0, ethers_1.formatEther)(bestOpportunity.netProfit)} ETH`));
            }
            if (crossChainOpportunities.length > 0) {
                logger.info(chalk_1.default.yellow(`🌉 ${crossChainOpportunities.length} cross-chain opportunities detected`));
            }
            if (opportunities.length === 0 && crossChainOpportunities.length === 0) {
                if (this.verboseMode) {
                    logger.info(chalk_1.default.gray("📊 No profitable opportunities found this cycle"));
                }
            }
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error in enhanced monitoring cycle"), error);
        }
        finally {
            this.isRunning = false;
        }
    }
    scanInterval = null;
    liquidityInterval = null;
    async start() {
        logger.info(chalk_1.default.green("🤖 Starting Enhanced MEV Arbitrage Bot..."));
        if (this.verboseMode) {
            const arbStats = dex_routers_1.EnhancedDEXManager.getCoverageStats(42161);
            const volatilePairs = volatile_tokens_1.VolatileTokenTracker.getHighVolatilityPairs(42161).length;
            logger.info(chalk_1.default.cyan(`🔥 Volatile pairs: ${volatilePairs}`));
            logger.info(chalk_1.default.cyan(`🏪 DEX coverage: ${Object.keys(arbStats.routerTypes).join(', ')}`));
            logger.info(chalk_1.default.cyan(`🧠 Pathfinding: Enhanced Bellman-Ford + Line Graph`));
        }
        // Run first scan immediately
        await this.monitorAndExecute();
        // Start continuous scanning loop at configured interval
        this.scanInterval = setInterval(async () => {
            try {
                if (!this.circuitBreakerTripped) {
                    await this.monitorAndExecute();
                }
                else {
                    logger.warn(chalk_1.default.yellow("🚨 Scanning paused - circuit breaker active"));
                    await this.checkCircuitBreaker();
                }
            }
            catch (error) {
                logger.error(chalk_1.default.red("Error in scan loop"), error);
            }
        }, this.PRICE_UPDATE_INTERVAL);
        // Periodic liquidity health monitoring (every 60 seconds)
        this.liquidityInterval = setInterval(async () => {
            try {
                await this.monitorLiquidityHealth();
            }
            catch (error) {
                logger.error(chalk_1.default.red("Error in liquidity monitoring"), error);
            }
        }, 60000);
        logger.info(chalk_1.default.green(`✅ Enhanced MEV bot started - scanning every ${this.PRICE_UPDATE_INTERVAL}ms`));
    }
    async stop() {
        logger.info(chalk_1.default.yellow("🛑 Stopping Enhanced MEV Bot..."));
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
            logger.info(chalk_1.default.magenta("🎯 Market Optimization Protocol stopped"));
        }
        catch (error) {
            logger.warn(chalk_1.default.yellow("⚠️ Error stopping Market Optimization Protocol"), error);
        }
        // Log final statistics
        const optimizationStatus = this.optimizationCoordinator?.getOptimizationStatus();
        logger.info(chalk_1.default.blue("📊 Final Statistics"), {
            totalProfit: (0, ethers_1.formatEther)(this.totalProfit),
            totalLoss: (0, ethers_1.formatEther)(this.totalLoss),
            netProfit: (0, ethers_1.formatEther)(this.totalProfit - this.totalLoss),
            executionCount: this.executionCount,
            circuitBreakerTripped: this.circuitBreakerTripped,
            optimizationsPerformed: optimizationStatus?.totalOptimizations || 0,
            performanceImprovement: optimizationStatus?.performanceImprovement || 0
        });
        logger.info(chalk_1.default.yellow("✅ Enhanced MEV bot stopped"));
        // Print simulation statistics if in simulation mode
        if (this.simulationMode) {
            this.printSimulationSummary();
        }
    }
    // Phase 3 Integration Methods
    async getCurrentCapital() {
        try {
            const arbBalance = await this.arbitrumProvider.getBalance(this.executorSigner.address);
            const optBalance = this.crossChainEnabled ?
                await this.optimismProvider.getBalance(this.optimismExecutor.address) : 0n;
            return arbBalance + optBalance;
        }
        catch (error) {
            logger.error('Error getting current capital:', error);
            return 0n;
        }
    }
    async estimateGasCost(opportunity) {
        try {
            // Use L2GasManager for accurate gas estimation
            if (this.l2GasManager) {
                const gasLimit = await this.l2GasManager.estimateOptimalGasLimit(opportunity.chainId, 'flash-arbitrage');
                // Estimate total cost by multiplying gas limit with current gas price
                const gasPrice = (0, ethers_1.parseUnits)("0.1", "gwei"); // Default L2 gas price
                return gasLimit * gasPrice;
            }
            // Fallback to basic estimation
            return (0, ethers_1.parseUnits)("0.001", 18); // 0.001 ETH fallback
        }
        catch (error) {
            logger.error('Error estimating gas cost:', error);
            return (0, ethers_1.parseUnits)("0.002", 18); // Conservative fallback
        }
    }
    async executeWithPhase3Optimization(opportunity) {
        try {
            logger.info(chalk_1.default.cyan('🚀 Executing with Phase 3 optimization'));
            // Get current capital for position sizing
            const currentCapital = await this.getCurrentCapital();
            // Estimate precise gas costs
            const estimatedGas = await this.estimateGasCost(opportunity);
            // Execute optimized trade
            const result = await this.executeOptimizedTrade(opportunity);
            if (result.success) {
                logger.info(chalk_1.default.green(`✅ Phase 3 execution successful: ${(0, ethers_1.formatEther)(result.profit)} ETH profit`));
                return true;
            }
            else {
                logger.warn(chalk_1.default.yellow(`⚠️ Phase 3 execution failed, gas cost: ${(0, ethers_1.formatEther)(result.gasCost)} ETH`));
                return false;
            }
        }
        catch (error) {
            logger.error('Phase 3 execution failed:', error);
            return false;
        }
    }
    async executeOptimizedTrade(opportunity) {
        try {
            if (this.simulationMode) {
                logger.info(chalk_1.default.blue(`🎯 SIMULATION: Would execute trade with optimized parameters`));
                return {
                    success: true,
                    profit: BigInt(opportunity.netProfit || 0),
                    gasCost: BigInt(opportunity.estimatedGasCost || opportunity.gasCost || 0)
                };
            }
            // Real execution: create MEV bundle and submit via direct L2 submission
            const legacyOpp = typeof opportunity.id === 'string' && opportunity.tokenA
                ? opportunity
                : this.convertToLegacyFormat(opportunity, opportunity.chainId || 42161);
            if (!legacyOpp) {
                logger.error(chalk_1.default.red("Failed to convert opportunity to executable format"));
                return { success: false, profit: 0n, gasCost: 0n };
            }
            // Execute the arbitrage through the standard path
            const success = await this.executeArbitrage(legacyOpp);
            return {
                success,
                profit: success ? BigInt(legacyOpp.netProfit) : 0n,
                gasCost: BigInt(legacyOpp.gasCost || 0)
            };
        }
        catch (error) {
            logger.error('Error executing optimized trade:', error);
            return { success: false, profit: 0n, gasCost: 0n };
        }
    }
    async executeWithPhase2Fallback(opportunity) {
        try {
            logger.info(chalk_1.default.yellow('🔄 Falling back to Phase 2 MEV execution'));
            // Use existing Phase 2 MEV bundle optimization
            if (this.mevBundleOptimizer) {
                const targetBlock = await this.arbitrumProvider.getBlockNumber() + 2;
                const bundleResult = await this.mevBundleOptimizer.createOptimalBundle([opportunity], targetBlock);
                if (bundleResult.profitAfterGas > (0, ethers_1.parseUnits)("0.003", 18)) {
                    logger.info(chalk_1.default.green(`✅ Phase 2 fallback successful`));
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            logger.error('Phase 2 fallback failed:', error);
            return false;
        }
    }
    async enhancedMonitoringCycle() {
        try {
            this.isRunning = true;
            // Enhanced arbitrage scanning with Phase 3 integration
            const opportunities = await this.scanForArbitrageOpportunities();
            // Add Phase 3 optimization to the main execution flow
            if (opportunities.length > 0) {
                logger.info(chalk_1.default.green(`✅ Found ${opportunities.length} arbitrage opportunities`));
                // Use Phase 3 optimization for the best opportunity
                const bestOpportunity = opportunities[0];
                if (this.dynamicSlippageManager && this.advancedRiskManager && this.oraclePriceValidator) {
                    // Use Phase 3 advanced execution
                    const executed = await this.executeWithPhase3Optimization(bestOpportunity);
                    if (executed) {
                        logger.info(chalk_1.default.green(`🚀 Successfully executed with Phase 3 optimization`));
                    }
                }
                else {
                    // Fall back to Phase 2 if Phase 3 modules unavailable
                    logger.warn(chalk_1.default.yellow('⚠️ Phase 3 modules unavailable, using Phase 2'));
                    await this.executeWithPhase2Fallback(bestOpportunity);
                }
            }
            // Continue with existing cross-chain and triangular logic if needed
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error in enhanced monitoring cycle"), error);
        }
        finally {
            this.isRunning = false;
        }
    }
}
exports.EnhancedMEVBot = EnhancedMEVBot;
// CLI argument parsing
function parseCliArguments() {
    const args = process.argv.slice(2);
    const config = {
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
                    logger.warn(chalk_1.default.yellow(`Unknown argument: ${arg}`));
                }
                break;
        }
    }
    return config;
}
// Display help information
function displayHelp() {
    console.log(chalk_1.default.cyan(`\n🤖 Enhanced MEV Arbitrage Bot\n`));
    console.log(chalk_1.default.white('Usage: ts-node scripts/run-bot.ts [options]\n'));
    console.log(chalk_1.default.yellow('Options:'));
    console.log(chalk_1.default.white('  -s, --simulate     Run in simulation mode (no actual transactions)'));
    console.log(chalk_1.default.white('  -v, --verbose      Enable verbose logging and detailed output'));
    console.log(chalk_1.default.white('  -c, --cross-chain  Enable cross-chain monitoring'));
    console.log(chalk_1.default.white('  -t, --triangular   Enable triangular arbitrage'));
    console.log(chalk_1.default.white('  -h, --help         Display this help message'));
    console.log(chalk_1.default.white('\nEnvironment Variables:'));
    console.log(chalk_1.default.gray('  ENABLE_SIMULATION_MODE=true       Same as --simulate'));
    console.log(chalk_1.default.gray('  VERBOSE_LOGGING=true              Same as --verbose'));
    console.log(chalk_1.default.gray('  ENABLE_CROSS_CHAIN_MONITORING=true Same as --cross-chain'));
    console.log(chalk_1.default.gray('  ENABLE_TRIANGULAR_ARBITRAGE=true   Same as --triangular'));
    console.log(chalk_1.default.white('\nExamples:'));
    console.log(chalk_1.default.gray('  ts-node scripts/run-bot.ts --simulate --verbose'));
    console.log(chalk_1.default.gray('  ts-node scripts/run-bot.ts -s -c -t'));
    console.log(chalk_1.default.gray('  npm run bot:dry'));
    console.log(chalk_1.default.gray('  npm run bot:full\n'));
}
// Main execution function
async function main() {
    const cliConfig = parseCliArguments();
    if (cliConfig.help) {
        displayHelp();
        return;
    }
    const bot = new EnhancedMEVBot(cliConfig);
    try {
        await bot.initialize();
        if (cliConfig.simulate) {
            logger.info(chalk_1.default.magenta("🎯 Starting in SIMULATION MODE - No real transactions will be executed"));
        }
        await bot.start();
        // Graceful shutdown handlers
        process.on("SIGINT", async () => {
            console.log("\n");
            logger.info(chalk_1.default.yellow("Received SIGINT, shutting down gracefully..."));
            await bot.stop();
            process.exit(0);
        });
        process.on("SIGTERM", async () => {
            logger.info(chalk_1.default.yellow("Received SIGTERM, shutting down gracefully..."));
            await bot.stop();
            process.exit(0);
        });
    }
    catch (error) {
        logger.error(chalk_1.default.red("Failed to start Enhanced MEV Bot"), error);
        process.exit(1);
    }
}
// Global error handlers
process.on("uncaughtException", (error) => {
    logger.error(chalk_1.default.red("Uncaught Exception"), error);
    process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
    logger.error(chalk_1.default.red("Unhandled Rejection"), { reason, promise });
    process.exit(1);
});
// Start the bot
if (require.main === module) {
    main();
}
