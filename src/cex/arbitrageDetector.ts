import { AggregatedMarketSnapshot, ArbitrageOpportunity, Logger } from './types';

export interface ArbitrageDetectorConfig {
  minSpreadBps: number;
  minAbsoluteSpreadUsd: number;
  riskBufferBps: number;
}

export class ArbitrageDetector {
  constructor(
    private readonly config: ArbitrageDetectorConfig,
    private readonly logger: Logger = console,
  ) {}

  public evaluate(snapshot: AggregatedMarketSnapshot): ArbitrageOpportunity | null {
    if (!snapshot.bestAsk || !snapshot.bestBid) {
      return null;
    }

    if (snapshot.bestAsk.exchange === snapshot.bestBid.exchange) {
      return null;
    }

    const spread = snapshot.bestBid.bid - snapshot.bestAsk.ask;
    if (spread <= 0) {
      return null;
    }

    const spreadBps = (spread / snapshot.bestAsk.ask) * 10_000;
    if (spreadBps < this.config.minSpreadBps && spread < this.config.minAbsoluteSpreadUsd) {
      return null;
    }

    const maxTradeAmount = Math.min(snapshot.bestAsk.askVolume, snapshot.bestBid.bidVolume);
    if (maxTradeAmount <= 0) {
      return null;
    }

    const bufferedSpread = spread * (1 - this.config.riskBufferBps / 10_000);
    const tradeAmount = maxTradeAmount;
    const expectedProfitUsd = bufferedSpread * tradeAmount;

    if (expectedProfitUsd <= 0) {
      return null;
    }

    this.logger.debug?.(
      `Arbitrage candidate ${snapshot.symbol}: ${snapshot.bestBid.exchange} bid ${snapshot.bestBid.bid} vs ${snapshot.bestAsk.exchange} ask ${snapshot.bestAsk.ask} spread ${spread.toFixed(2)} (${spreadBps.toFixed(2)} bps)`,
    );

    return {
      symbol: snapshot.symbol,
      buyExchange: snapshot.bestAsk.exchange,
      sellExchange: snapshot.bestBid.exchange,
      spread,
      spreadBps,
      tradeAmount,
      maxTradeAmount,
      expectedProfitUsd,
      bestAsk: snapshot.bestAsk,
      bestBid: snapshot.bestBid,
    };
  }
}

