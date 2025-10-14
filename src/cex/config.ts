import fs from 'fs';
import path from 'path';
import {
  BotRuntimeConfig,
  ExchangeConfig,
  ExchangeCredentials,
  PollingConfig,
  Logger,
} from './types';

const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT'];

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readCredentials(prefix: string): ExchangeCredentials | undefined {
  const apiKey = process.env[`${prefix}_API_KEY`];
  const secret = process.env[`${prefix}_API_SECRET`];
  const passphrase = process.env[`${prefix}_API_PASSPHRASE`];
  const subAccountName = process.env[`${prefix}_SUB_ACCOUNT`];

  if (!apiKey && !secret && !passphrase) {
    return undefined;
  }

  return {
    apiKey,
    secret,
    passphrase,
    subAccountName,
  };
}

export function loadPollingConfig(): PollingConfig {
  return {
    pollIntervalMs: parseNumber(process.env.CEX_POLL_INTERVAL_MS, 1_000),
    snapshotStalenessThresholdMs: parseNumber(process.env.CEX_SNAPSHOT_STALENESS_MS, 3_000),
    maxParallelRequests: parseNumber(process.env.CEX_MAX_PARALLEL_REQUESTS, 3),
  };
}

export function loadBotRuntimeConfig(logger: Logger = console): BotRuntimeConfig {
  const symbols = parseCsv(process.env.CEX_SYMBOLS, DEFAULT_SYMBOLS);

  const config: BotRuntimeConfig = {
    symbols,
    minSpreadBps: parseNumber(process.env.CEX_MIN_SPREAD_BPS, 8),
    minAbsoluteSpreadUsd: parseNumber(process.env.CEX_MIN_ABSOLUTE_SPREAD_USD, 5),
    maxExposurePerTradeUsd: parseNumber(process.env.CEX_MAX_EXPOSURE_PER_TRADE_USD, 2_500),
    maxExposurePerExchangeUsd: parseNumber(process.env.CEX_MAX_EXPOSURE_PER_EXCHANGE_USD, 10_000),
    riskBufferBps: parseNumber(process.env.CEX_RISK_BUFFER_BPS, 2),
    simulationMode: parseBoolean(process.env.CEX_SIMULATION_MODE, true),
    dryRun: parseBoolean(process.env.CEX_DRY_RUN, false),
    maxConcurrentTrades: parseNumber(process.env.CEX_MAX_CONCURRENT_TRADES, 1),
    performanceLogPath:
      process.env.CEX_PERFORMANCE_LOG_PATH ?? path.resolve(process.cwd(), 'logs/cex-performance.log'),
    balancesRefreshIntervalMs: parseNumber(process.env.CEX_BALANCES_REFRESH_INTERVAL_MS, 30_000),
  };

  if (config.simulationMode) {
    logger.info('CEX arbitrage bot running in simulation mode. No live orders will be sent.');
  }

  return config;
}

export function loadExchangeConfigs(runtimeConfig: BotRuntimeConfig): ExchangeConfig[] {
  const enabled = new Set(parseCsv(process.env.CEX_ENABLED_EXCHANGES, ['binance', 'coinbase', 'kucoin']));

  const baseConfig: Record<string, ExchangeConfig> = {
    binance: {
      id: 'binance',
      displayName: 'Binance',
      symbols: runtimeConfig.symbols,
      tradingFeeBps: parseNumber(process.env.BINANCE_FEE_BPS, 10),
      credentials: readCredentials('BINANCE'),
      enableTrading: parseBoolean(process.env.BINANCE_ENABLE_TRADING, false),
      requestTimeoutMs: parseNumber(process.env.BINANCE_TIMEOUT_MS, 5_000),
      rateLimitPerMinute: parseNumber(process.env.BINANCE_RATE_LIMIT, 1_200),
    },
    coinbase: {
      id: 'coinbase',
      displayName: 'Coinbase Advanced',
      symbols: runtimeConfig.symbols,
      tradingFeeBps: parseNumber(process.env.COINBASE_FEE_BPS, 35),
      credentials: readCredentials('COINBASE'),
      enableTrading: parseBoolean(process.env.COINBASE_ENABLE_TRADING, false),
      requestTimeoutMs: parseNumber(process.env.COINBASE_TIMEOUT_MS, 5_000),
      rateLimitPerMinute: parseNumber(process.env.COINBASE_RATE_LIMIT, 120),
    },
    kucoin: {
      id: 'kucoin',
      displayName: 'KuCoin',
      symbols: runtimeConfig.symbols,
      tradingFeeBps: parseNumber(process.env.KUCOIN_FEE_BPS, 10),
      credentials: readCredentials('KUCOIN'),
      enableTrading: parseBoolean(process.env.KUCOIN_ENABLE_TRADING, false),
      requestTimeoutMs: parseNumber(process.env.KUCOIN_TIMEOUT_MS, 5_000),
      rateLimitPerMinute: parseNumber(process.env.KUCOIN_RATE_LIMIT, 1_800),
    },
  };

  return Array.from(enabled)
    .map((id) => baseConfig[id])
    .filter((config): config is ExchangeConfig => Boolean(config));
}

export function ensureLogFileExists(filepath: string): void {
  const directory = path.dirname(filepath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, '', { encoding: 'utf-8' });
  }
}

