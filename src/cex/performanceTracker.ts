import fs from 'fs';
import path from 'path';
import { appendFile } from 'fs/promises';
import {
  PerformanceSummary,
  PerformanceTracker,
  TradeRecord,
  Logger,
} from './types';

export class FilePerformanceTracker implements PerformanceTracker {
  private totalTrades = 0;
  private wins = 0;
  private cumulativeProfitUsd = 0;
  private realisedProfitUsd = 0;
  private realisedLossUsd = 0;
  private cumulativeLatencyMs = 0;

  constructor(private readonly filepath: string, private readonly logger: Logger = console) {}

  public async recordTrade(trade: TradeRecord): Promise<void> {
    this.totalTrades += 1;
    this.cumulativeProfitUsd += trade.profitUsd;
    this.cumulativeLatencyMs += trade.latencyMs;

    if (trade.profitUsd >= 0) {
      this.wins += 1;
      this.realisedProfitUsd += trade.profitUsd;
    } else {
      this.realisedLossUsd += Math.abs(trade.profitUsd);
    }

    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      profitUsd: trade.profitUsd,
      latencyMs: trade.latencyMs,
      symbol: trade.opportunity.symbol,
      buyExchange: trade.opportunity.buyExchange,
      sellExchange: trade.opportunity.sellExchange,
      spread: trade.opportunity.spread,
      spreadBps: trade.opportunity.spreadBps,
      tradeAmount: trade.opportunity.tradeAmount,
      balances: trade.balancesSnapshot,
    });

    try {
      await appendFile(this.filepath, `${logEntry}\n`, { encoding: 'utf-8' });
    } catch (error) {
      this.logger.error(`Failed to append performance log at ${this.filepath}`, error);
    }
  }

  public getSummary(): PerformanceSummary {
    const averageLatencyMs = this.totalTrades ? this.cumulativeLatencyMs / this.totalTrades : 0;
    const winRate = this.totalTrades ? this.wins / this.totalTrades : 0;

    return {
      totalTrades: this.totalTrades,
      cumulativeProfitUsd: this.cumulativeProfitUsd,
      averageLatencyMs,
      winRate,
      realisedLossUsd: this.realisedLossUsd,
      realisedProfitUsd: this.realisedProfitUsd,
    };
  }
}

export function ensurePerformanceLog(filepath: string): void {
  const directory = path.dirname(filepath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, '', { encoding: 'utf-8' });
  }
}

