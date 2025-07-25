// Comprehensive type definitions for ARBBot2025

// Module declarations for external libraries
declare module "axios" {
  export default any;
}

declare module "chalk" {
  export default any;
}

declare module "big.js" {
  export default any;
}

declare module "winston" {
  export const createLogger: any;
  export const format: any;
  export const transports: any;
  export default any;
}

declare module "node-cron" {
  export const schedule: any;
  export default any;
}

// Fix for ethers imports in Phase 3 modules
declare module "ethers" {
  export const JsonRpcProvider: any;
  export const parseUnits: any;
  export const formatUnits: any;
  export const formatEther: any;
  export const parseEther: any;
  export const Wallet: any;
  export const Contract: any;
  export const Interface: any;
  export const ethers: any;
  export const getAddress: any;
  export const isAddress: any;
  export const keccak256: any;
  export const toUtf8Bytes: any;
  export const solidityPackedKeccak256: any;
  export const providers: any;
  export const utils: any;
  export const BigNumber: any;
  export const constants: any;
  export const errors: any;
  
  // Add BaseContract and other types for tests
  export class BaseContract {
    address: string;
    deployed(): Promise<BaseContract>;
    deploymentTransaction(): any;
    transfer?: any;
    emergencyWithdraw?: any;
    owner?: any;
    [key: string]: any;
  }
  
  export interface ContractTransaction {
    hash: string;
    wait: () => Promise<any>;
    [key: string]: any;
  }
}

declare module "@flashbots/ethers-provider-bundle" {
  export const FlashbotsBundleProvider: any;
  export interface FlashbotsBundleTransaction {
    transaction: any;
    signer: any;
  }
  export interface FlashbotsBundleResolution {
    bundleHash: string;
    wait: () => Promise<any>;
  }
  
  export interface SimulationResponse {
    success: boolean;
    results: Array<{
      gasUsed: number;
      [key: string]: any;
    }>;
    coinbaseDiff: string;
    bundleHash: string;
    error?: string;
    [key: string]: any;
  }
}

declare module "@flashbots/mev-share-client" {
  export default class MevShareClient {
    static fromNetwork(signer: any, network: any): MevShareClient;
  }
}

// Additional module declarations for missing dependencies
declare module "hardhat" {
  export const ethers: any;
  export const run: any;
  export const network: any;
  export const config: any;
  export interface HardhatRuntimeEnvironment {
    ethers: any;
    network: any;
    run: any;
    deployments?: any;
    getNamedAccounts?: any;
  }
}

declare module "@nomiclabs/hardhat-ethers/signers" {
  export const SignerWithAddress: any;
}

declare module "@curvefi/api" {
  export const CurveApi: any;
  export default any;
}

declare module "@gmx-io/sdk" {
  export const GMXReader: any;
  export default any;
}

declare module "@uniswap/sdk-core" {
  export const ChainId: any;
  export const Token: any;
  export const CurrencyAmount: any;
  export const TradeType: any;
}

declare module "chai" {
  export const expect: any;
  export interface Assertion {
    reverted?: any;
    revertedWith?: any;
    [key: string]: any;
  }
}

// Global namespace extensions
declare global {
  var gc: (() => void) | undefined;
  var navigator: { userAgent: string; [key: string]: any } | undefined;
  
  namespace NodeJS {
    interface ProcessEnv {
      // Core configuration
      PRIVATE_KEY: string;
      FLASHBOTS_AUTH_KEY: string;
      
      // Profit management
      PROFIT_WALLET_ADDRESS?: string;
      
      // RPC endpoints
      ARB_RPC: string;
      OPT_RPC: string;
      MAINNET_RPC?: string;
      
      // Contract addresses
      ARB_BOT_CONTRACT_ADDRESS: string;
      OPT_BOT_CONTRACT_ADDRESS: string;
      
      // Alert configuration
      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;
      EMAIL_ALERT_ENDPOINT?: string;
      ALERT_EMAIL?: string;
      DISCORD_WEBHOOK_URL?: string;
      
      // Feature flags
      ENABLE_SIMULATION_MODE?: string;
      VERBOSE_LOGGING?: string;
      ENABLE_CROSS_CHAIN_MONITORING?: string;
      ENABLE_TRIANGULAR_ARBITRAGE?: string;
      PRODUCTION_MODE?: string;
      
      // Optimization settings
      LOG_LEVEL?: string;
      MIN_PROFIT_THRESHOLD?: string;
      MAX_GAS_PRICE_GWEI?: string;
      SLIPPAGE_TOLERANCE?: string;
      
      // MEV configuration
      FLASHBOTS_RELAY_URL?: string;
      MEV_SHARE_ENDPOINT?: string;
      
      // Cache configuration
      TOKEN_PRICE_CACHE?: string;
    }
  }
}

// Project-specific interfaces and types
export interface ArbitrageOpportunity {
  id: string;
  tokenA: string;
  tokenB: string;
  symbolA?: string;
  symbolB?: string;
  amountIn: string;
  expectedOutput: string;
  netProfit: string;
  gasEstimate: string;
  gasCost: string;
  chainId: number;
  currentPrice: bigint;
  spread: number;
  dexes?: string[];
  isTriangular?: boolean;
  estimatedGasCost?: bigint;
  slippageTolerance?: number;
  minProfitThreshold?: bigint;
  confidence?: number;
  marketImpact?: number;
  liquidityDepth?: bigint;
  priceDeviation?: number;
}

export interface TradeExecutionResult {
  success: boolean;
  profit: bigint;
  gasCost: bigint;
  executionTime: number;
  bundleSuccess: boolean;
  bundleAttempted: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  errorCount: number;
  totalProfit: number;
  dailyProfit: number;
  successRate: number;
  gasEfficiency: number;
}

export interface TokenPair {
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  decimalsA: number;
  decimalsB: number;
  minAmount: string;
  maxAmount: string;
  enabled?: boolean;
  fee?: number;
}

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  baseFee: bigint;
  totalCost: bigint;
  priority: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface MEVBundleData {
  transactions: any[];
  targetBlock: number;
  expectedProfit: bigint;
  profitAfterGas: bigint;
  gasUsed: bigint;
  estimatedSuccessRate: number;
  competitionLevel: number;
  recommendations: string[];
}

export interface RiskAssessment {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  reasonsForRejection: string[];
  warnings: string[];
  recommendations: string[];
  maxPositionSize: bigint;
  confidenceScore: number;
}

export interface PriceValidation {
  isValid: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  manipulationScore: number;
  recommendation: 'execute' | 'caution' | 'reject';
  warnings: string[];
  oraclePrice: bigint;
  dexPrice: bigint;
  priceDeviation: number;
}

export interface SlippageCalculation {
  optimalSlippage: number;
  minSlippage: number;
  maxSlippage: number;
  confidence: number;
  marketConditions: 'stable' | 'volatile' | 'extreme';
  recommendations: string[];
}

export interface ProfitThreshold {
  minProfitWei: bigint;
  minProfitPercentage: number;
  reasoning: string;
  adjustmentFactor: number;
  marketConditions: string;
  competitionLevel: number;
}

export interface LiquidityData {
  available: boolean;
  maxLoan: bigint;
  fee: bigint;
  utilizationRate?: number;
  healthFactor?: number;
  totalLiquidity?: bigint;
  reserveRatio?: number;
}

export interface FlashLoanProvider {
  name: 'AAVE' | 'BALANCER';
  available: boolean;
  fee: bigint;
  maxAmount: bigint;
  reliability: number;
  latency: number;
}

export interface CrossChainOpportunity {
  sourceChain: number;
  targetChain: number;
  token: string;
  amount: bigint;
  sourcePlatform: string;
  targetPlatform: string;
  expectedProfit: bigint;
  bridgeCost: bigint;
  bridgeTime: number;
  confidence: number;
}

export interface TriangularOpportunity {
  tokenA: string;
  tokenB: string;
  tokenC: string;
  amountIn: bigint;
  path: string[];
  expectedOutput: bigint;
  netProfit: bigint;
  gasEstimate: bigint;
  confidence: number;
  marketImpact: number;
  recommendedAction: 'execute' | 'monitor' | 'skip';
}

export interface ChainConfiguration {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: string;
  blockTime: number;
  gasToken: string;
  dexRouters: Record<string, string>;
  stablecoins: string[];
  wethAddress: string;
  aavePool?: string;
  balancerVault?: string;
  uniswapV3Factory?: string;
  flashLoanProviders: string[];
}

export interface CLIConfig {
  simulate: boolean;
  verbose: boolean;
  help: boolean;
  crossChain: boolean;
  triangular: boolean;
  dryRun?: boolean;
  configFile?: string;
  logLevel?: string;
  maxExecutions?: number;
  stopLoss?: number;
}

export interface SimulationStats {
  totalOpportunities: number;
  profitableOpportunities: number;
  totalSimulatedProfit: number;
  totalSimulatedCost: number;
  netSimulatedProfit: number;
  averageProfit: number;
  successRate: number;
  bestOpportunity: ArbitrageOpportunity | null;
  worstLoss: number;
  totalGasEstimate: bigint;
  executionTimeMs: number[];
}

export interface MonitoringAlert {
  id: string;
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data?: any;
  acknowledged?: boolean;
  resolved?: boolean;
}

export interface PerformanceMetrics {
  period: string;
  totalTrades: number;
  successfulTrades: number;
  totalVolume: bigint;
  totalProfit: bigint;
  totalGasCost: bigint;
  netProfit: bigint;
  averageProfit: number;
  winRate: number;
  sharpeRatio?: number;
  maxDrawdown: number;
  profitFactor: number;
  averageExecutionTime: number;
  gasEfficiency: number;
  riskScore: number;
}

// Export commonly used type aliases
export type NetworkId = 1 | 10 | 137 | 42161 | 8453; // Mainnet, Optimism, Polygon, Arbitrum, Base
export type DexProtocol = 'UNISWAP_V2' | 'UNISWAP_V3' | 'SUSHISWAP' | 'CURVE' | 'BALANCER' | 'PANCAKESWAP';
export type TradeType = 'dual_dex' | 'triangular' | 'cross_chain' | 'flash_arbitrage';
export type ExecutionStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

// Utility type for partial configuration updates
export type PartialConfig<T> = {
  [P in keyof T]?: T[P] extends object ? PartialConfig<T[P]> : T[P];
};

// Event emitter types for real-time monitoring
export interface BotEvents {
  'opportunity_found': (opportunity: ArbitrageOpportunity) => void;
  'trade_executed': (result: TradeExecutionResult) => void;
  'error_occurred': (error: Error) => void;
  'metrics_updated': (metrics: SystemMetrics) => void;
  'alert_triggered': (alert: MonitoringAlert) => void;
  'circuit_breaker_triggered': (reason: string) => void;
  'profit_threshold_updated': (threshold: ProfitThreshold) => void;
}

// Constants and enums
export const SUPPORTED_CHAINS = [1, 10, 137, 42161, 8453] as const;
export const DEX_PROTOCOLS = ['UNISWAP_V2', 'UNISWAP_V3', 'SUSHISWAP', 'CURVE', 'BALANCER'] as const;

export enum TradeExecutionMode {
  SIMULATION = 'simulation',
  DRY_RUN = 'dry_run',
  LIVE = 'live'
}

export enum AlertChannel {
  CONSOLE = 'console',
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  DISCORD = 'discord',
  WEBHOOK = 'webhook'
}

export enum CircuitBreakerReason {
  MAX_LOSS_EXCEEDED = 'max_loss_exceeded',
  CONSECUTIVE_FAILURES = 'consecutive_failures',
  SYSTEM_ERROR = 'system_error',
  MANUAL_TRIGGER = 'manual_trigger',
  RISK_THRESHOLD_EXCEEDED = 'risk_threshold_exceeded'
}