import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  AggregatedMarketSnapshot,
  ExchangeAdapter,
  Logger,
  MarketDataFeed,
  OrderBookQuote,
  PollingConfig,
} from './types';

const SNAPSHOT_EVENT = 'snapshot';
const ERROR_EVENT = 'error';

export interface SnapshotEventPayload extends AggregatedMarketSnapshot {}

export class PollingMarketDataFeed extends EventEmitter implements MarketDataFeed {
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly adapters: ExchangeAdapter[],
    private readonly symbols: string[],
    private readonly config: PollingConfig,
    private readonly logger: Logger = console,
  ) {
    super();
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    await this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, this.config.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const start = performance.now();
    try {
      const quotes = await this.fetchQuotes();
      const snapshots = this.aggregate(quotes);
      const now = Date.now();
      for (const snapshot of snapshots) {
        if (now - snapshot.receivedAt > this.config.snapshotStalenessThresholdMs) {
          this.logger.warn(
            `Dropping stale snapshot for ${snapshot.symbol}. Age=${now - snapshot.receivedAt}ms`,
          );
          continue;
        }
        this.emit(SNAPSHOT_EVENT, snapshot satisfies SnapshotEventPayload);
      }
      this.logger.debug?.(
        `Fetched ${quotes.length} quotes across ${this.adapters.length} exchanges in ${(
          performance.now() - start
        ).toFixed(1)}ms`,
      );
    } catch (error) {
      this.logger.error('Failed to poll market data', error);
      this.emit(ERROR_EVENT, error);
    }
  }

  private async fetchQuotes(): Promise<OrderBookQuote[]> {
    const requests: Array<() => Promise<OrderBookQuote>> = [];
    for (const adapter of this.adapters) {
      for (const symbol of this.symbols) {
        requests.push(() =>
          adapter.fetchTopOfBook(symbol).catch((error) => {
            this.logger.warn(`Failed to fetch quote from ${adapter.displayName}: ${error}`);
            throw error;
          }),
        );
      }
    }

    const results: OrderBookQuote[] = [];
    const concurrency = Math.max(1, this.config.maxParallelRequests);

    for (let i = 0; i < requests.length; i += concurrency) {
      const chunk = requests.slice(i, i + concurrency).map((fn) => fn());
      const settled = await Promise.allSettled(chunk);
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          results.push(outcome.value);
        } else {
          this.emit(ERROR_EVENT, outcome.reason);
        }
      }
    }

    return results;
  }

  private aggregate(quotes: OrderBookQuote[]): AggregatedMarketSnapshot[] {
    const bySymbol = new Map<string, OrderBookQuote[]>();
    for (const quote of quotes) {
      if (!bySymbol.has(quote.symbol)) {
        bySymbol.set(quote.symbol, []);
      }
      bySymbol.get(quote.symbol)!.push(quote);
    }

    const snapshots: AggregatedMarketSnapshot[] = [];

    for (const [symbol, symbolQuotes] of bySymbol.entries()) {
      const bestAsk = symbolQuotes.reduce<OrderBookQuote | undefined>((lowest, quote) => {
        if (!lowest || quote.ask < lowest.ask) {
          return quote;
        }
        return lowest;
      }, undefined);

      const bestBid = symbolQuotes.reduce<OrderBookQuote | undefined>((highest, quote) => {
        if (!highest || quote.bid > highest.bid) {
          return quote;
        }
        return highest;
      }, undefined);

      snapshots.push({
        symbol,
        quotes: symbolQuotes,
        bestAsk,
        bestBid,
        receivedAt: Date.now(),
      });
    }

    return snapshots;
  }
}

export const MarketDataEvents = {
  Snapshot: SNAPSHOT_EVENT,
  Error: ERROR_EVENT,
} as const;

