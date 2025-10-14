import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import {
  ExchangeAdapter,
  ExchangeConfig,
  ExchangeCredentials,
  MarketOrderParams,
  MarketOrderResult,
  OrderBookQuote,
  PortfolioBalances,
} from '../types';

export abstract class BaseExchangeAdapter implements ExchangeAdapter {
  public readonly id: ExchangeConfig['id'];
  public readonly displayName: string;
  public readonly tradingFeeBps: number;
  public readonly configuredSymbols: string[];
  public readonly supportsTrading: boolean;

  protected readonly http: AxiosInstance;
  protected readonly credentials?: ExchangeCredentials;

  constructor(protected readonly config: ExchangeConfig) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.tradingFeeBps = config.tradingFeeBps;
    this.configuredSymbols = config.symbols;
    this.credentials = config.credentials;
    this.supportsTrading = Boolean(config.enableTrading && config.credentials?.apiKey);
    this.http = axios.create({
      timeout: config.requestTimeoutMs ?? 5_000,
    });
  }

  public abstract fetchTopOfBook(symbol: string): Promise<OrderBookQuote>;

  public abstract fetchBalances(symbols: string[]): Promise<PortfolioBalances>;

  public async placeMarketOrder(params: MarketOrderParams): Promise<MarketOrderResult> {
    if (!this.supportsTrading) {
      throw new Error(
        `${this.displayName} is configured in market-data-only mode. Enable credentials to trade.`,
      );
    }

    return this.executeMarketOrder(params);
  }

  protected abstract executeMarketOrder(params: MarketOrderParams): Promise<MarketOrderResult>;

  protected computeLatency<T>(fn: () => Promise<T>): Promise<{ value: T; latency: number }> {
    const start = performance.now();
    return fn().then((value) => ({ value, latency: performance.now() - start }));
  }

  protected signQuery(query: string, secret?: string): string {
    if (!secret) {
      throw new Error(`${this.displayName} missing secret for signing`);
    }

    return crypto.createHmac('sha256', secret).update(query).digest('hex');
  }

  protected maskKey(key?: string): string {
    if (!key) {
      return '***';
    }

    return `${key.slice(0, 4)}…${key.slice(-4)}`;
  }
}

