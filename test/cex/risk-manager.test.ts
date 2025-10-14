import { expect } from 'chai';
import { RiskManager } from '../../src/cex/riskManager';
import { ArbitrageOpportunity, BotRuntimeConfig, PortfolioState } from '../../src/cex/types';

describe('RiskManager', () => {
  const runtimeConfig: BotRuntimeConfig = {
    symbols: ['BTC/USDT'],
    minSpreadBps: 5,
    minAbsoluteSpreadUsd: 5,
    maxExposurePerTradeUsd: 5_000,
    maxExposurePerExchangeUsd: 20_000,
    riskBufferBps: 2,
    simulationMode: true,
    dryRun: true,
    maxConcurrentTrades: 1,
    performanceLogPath: 'logs/cex-performance.log',
    balancesRefreshIntervalMs: 60_000,
  };

  const opportunity: ArbitrageOpportunity = {
    symbol: 'BTC/USDT',
    buyExchange: 'binance',
    sellExchange: 'coinbase',
    spread: 40,
    spreadBps: 13.3,
    tradeAmount: 0.3,
    maxTradeAmount: 0.3,
    expectedProfitUsd: 10,
    bestAsk: {
      exchange: 'binance',
      symbol: 'BTC/USDT',
      bid: 29_900,
      ask: 29_900,
      bidVolume: 0.4,
      askVolume: 0.4,
      timestamp: Date.now(),
    },
    bestBid: {
      exchange: 'coinbase',
      symbol: 'BTC/USDT',
      bid: 29_940,
      ask: 29_950,
      bidVolume: 0.5,
      askVolume: 0.3,
      timestamp: Date.now(),
    },
  };

  it('approves trades when balances and exposure allow', () => {
    const portfolio: PortfolioState = {
      timestamp: Date.now(),
      exchangeBalances: {
        binance: {
          base: { BTC: 0 },
          quote: { USDT: 20_000 },
          usdValueEstimate: 20_000,
        },
        coinbase: {
          base: { BTC: 0.5 },
          quote: { USDT: 5_000 },
          usdValueEstimate: 20_000,
        },
      },
    };

    const manager = new RiskManager(runtimeConfig);
    const result = manager.evaluate(opportunity, portfolio);
    expect(result.approved).to.be.true;
    expect(result.adjustedTradeAmount).to.be.undefined;
  });

  it('rejects trades when balances insufficient', () => {
    const portfolio: PortfolioState = {
      timestamp: Date.now(),
      exchangeBalances: {
        binance: {
          base: { BTC: 0 },
          quote: { USDT: 1_000 },
          usdValueEstimate: 1_000,
        },
        coinbase: {
          base: { BTC: 0.05 },
          quote: { USDT: 1_000 },
          usdValueEstimate: 1_000,
        },
      },
    };

    const manager = new RiskManager(runtimeConfig);
    const result = manager.evaluate(opportunity, portfolio);
    expect(result.approved).to.be.false;
  });
});

