import { ExchangeAdapter, ExchangeConfig } from '../types';
import { BaseExchangeAdapter } from './baseExchange';
import { BinanceExchangeAdapter } from './binanceAdapter';
import { CoinbaseExchangeAdapter } from './coinbaseAdapter';
import { KuCoinExchangeAdapter } from './kucoinAdapter';

const registry: Record<string, new (config: ExchangeConfig) => BaseExchangeAdapter> = {
  binance: BinanceExchangeAdapter,
  coinbase: CoinbaseExchangeAdapter,
  kucoin: KuCoinExchangeAdapter,
};

export function buildExchangeAdapter(config: ExchangeConfig): ExchangeAdapter {
  const Adapter = registry[config.id];
  if (!Adapter) {
    throw new Error(`Unsupported exchange adapter requested: ${config.id}`);
  }

  return new Adapter(config);
}

