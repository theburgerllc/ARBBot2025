import { expect } from 'chai';
import { ArbitrageDetector } from '../../src/cex/arbitrageDetector';
import { AggregatedMarketSnapshot, OrderBookQuote } from '../../src/cex/types';

describe('ArbitrageDetector', () => {
  const createQuote = (overrides: Partial<OrderBookQuote>): OrderBookQuote => ({
    exchange: 'binance',
    symbol: 'BTC/USDT',
    bid: 29_900,
    ask: 29_910,
    bidVolume: 0.5,
    askVolume: 0.5,
    timestamp: Date.now(),
    ...overrides,
  });

  const detector = new ArbitrageDetector({
    minSpreadBps: 5,
    minAbsoluteSpreadUsd: 5,
    riskBufferBps: 2,
  });

  it('identifies profitable opportunities across exchanges', () => {
    const snapshot: AggregatedMarketSnapshot = {
      symbol: 'BTC/USDT',
      quotes: [
        createQuote({ exchange: 'binance', ask: 29_900, askVolume: 0.75 }),
        createQuote({ exchange: 'coinbase', bid: 29_940, bidVolume: 0.4 }),
      ],
      bestAsk: createQuote({ exchange: 'binance', ask: 29_900, askVolume: 0.75 }),
      bestBid: createQuote({ exchange: 'coinbase', bid: 29_940, bidVolume: 0.4 }),
      receivedAt: Date.now(),
    };

    const opportunity = detector.evaluate(snapshot);
    expect(opportunity).to.not.be.null;
    expect(opportunity?.buyExchange).to.equal('binance');
    expect(opportunity?.sellExchange).to.equal('coinbase');
    expect(opportunity?.spread).to.equal(40);
    expect(opportunity?.tradeAmount).to.equal(0.4);
  });

  it('rejects opportunities when spread below thresholds', () => {
    const snapshot: AggregatedMarketSnapshot = {
      symbol: 'BTC/USDT',
      quotes: [
        createQuote({ exchange: 'binance', ask: 29_900 }),
        createQuote({ exchange: 'coinbase', bid: 29_902 }),
      ],
      bestAsk: createQuote({ exchange: 'binance', ask: 29_900 }),
      bestBid: createQuote({ exchange: 'coinbase', bid: 29_902 }),
      receivedAt: Date.now(),
    };

    const opportunity = detector.evaluate(snapshot);
    expect(opportunity).to.be.null;
  });

  it('ignores when best prices come from same exchange', () => {
    const quote = createQuote({ exchange: 'binance', bid: 29_950, ask: 29_900, bidVolume: 0.5, askVolume: 0.5 });
    const snapshot: AggregatedMarketSnapshot = {
      symbol: 'BTC/USDT',
      quotes: [quote],
      bestAsk: quote,
      bestBid: quote,
      receivedAt: Date.now(),
    };

    const opportunity = detector.evaluate(snapshot);
    expect(opportunity).to.be.null;
  });
});

