import { EventEmitter } from 'events';

export type ExchangeIdentifier =
  | 'binance'
  | 'coinbase'
  | 'kucoin'
  | 'kraken'
  | 'bybit'
  | 'okx'
  | 'bitstamp'
  | string;

export interface ExchangeCredentials {
  apiKey?: string;
  secret?: string;
  passphrase?: string;
  subAccountName?: string;
}

export interface ExchangeConfig {
  id: ExchangeIdentifier;
  displayName: string;
  symbols: string[];
  tradingFeeBps: number;
  credentials?: ExchangeCredentials;
  enableTrading?: boolean;
  requestTimeoutMs?: number;
  rateLimitPerMinute?: number;
}

export interface PollingConfig {
  pollIntervalMs: number;
  snapshotStalenessThresholdMs: number;
  maxParallelRequests: number;
}

export interface BotRuntimeConfig {
  symbols: string[];
  minSpreadBps: number;
  minAbsoluteSpreadUsd: number;
  maxExposurePerTradeUsd: number;
  maxExposurePerExchangeUsd: number;
  riskBufferBps: number;
  simulationMode: boolean;
  dryRun?: boolean;
  maxConcurrentTrades: number;
  performanceLogPath: string;
  balancesRefreshIntervalMs: number;
}

export interface OrderBookQuote {
  exchange: ExchangeIdentifier;
  symbol: string;
  bid: number;
  ask: number;
  bidVolume: number;
  askVolume: number;
  timestamp: number;
  latencyMs?: number;
}

export interface AggregatedMarketSnapshot {
  symbol: string;
  quotes: OrderBookQuote[];
  bestBid?: OrderBookQuote;
  bestAsk?: OrderBookQuote;
  receivedAt: number;
}

export interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: ExchangeIdentifier;
  sellExchange: ExchangeIdentifier;
  spread: number;
  spreadBps: number;
  tradeAmount: number;
  maxTradeAmount: number;
  expectedProfitUsd: number;
  bestAsk: OrderBookQuote;
  bestBid: OrderBookQuote;
}

export interface RiskCheckContext {
  balances: PortfolioState;
  opportunity: ArbitrageOpportunity;
}

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  adjustedTradeAmount?: number;
}

export interface PortfolioState {
  timestamp: number;
  exchangeBalances: Record<
    ExchangeIdentifier,
    {
      base: Record<string, number>;
      quote: Record<string, number>;
      usdValueEstimate: number;
    }
  >;
}

export interface MarketOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  clientOrderId?: string;
  priceLimit?: number;
  reduceOnly?: boolean;
}

export interface MarketOrderResult {
  exchange: ExchangeIdentifier;
  symbol: string;
  side: 'buy' | 'sell';
  executedAmount: number;
  averagePrice: number;
  feePaid: number;
  feeCurrency: string;
  orderId?: string;
  raw?: unknown;
  timestamp: number;
}

export interface TradeExecutionResult {
  buy: MarketOrderResult;
  sell: MarketOrderResult;
  profitUsd: number;
  latencyMs: number;
  opportunity: ArbitrageOpportunity;
}

export interface MarketDataFeed extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface ExchangeAdapter {
  readonly id: ExchangeIdentifier;
  readonly displayName: string;
  readonly supportsTrading: boolean;
  readonly tradingFeeBps: number;
  readonly configuredSymbols: string[];

  fetchTopOfBook(symbol: string): Promise<OrderBookQuote>;
  fetchBalances(symbols: string[]): Promise<PortfolioBalances>;
  placeMarketOrder(params: MarketOrderParams): Promise<MarketOrderResult>;
}

export interface PortfolioBalances {
  base: Record<string, number>;
  quote: Record<string, number>;
  usdValueEstimate: number;
  raw?: unknown;
}

export interface ExecutionEngineOptions {
  simulationMode: boolean;
  maxSlippageBps: number;
  timeoutMs: number;
}

export interface TradeRecord extends TradeExecutionResult {
  balancesSnapshot: PortfolioState;
}

export interface PerformanceSummary {
  totalTrades: number;
  cumulativeProfitUsd: number;
  averageLatencyMs: number;
  winRate: number;
  realisedLossUsd: number;
  realisedProfitUsd: number;
}

export interface PerformanceTracker {
  recordTrade(trade: TradeRecord): Promise<void>;
  getSummary(): PerformanceSummary;
}

export type Logger = Pick<
  Console,
  'info' | 'warn' | 'error' | 'debug'
>;

export interface OpportunityFilter {
  shouldTrade(opportunity: ArbitrageOpportunity): boolean;
}

