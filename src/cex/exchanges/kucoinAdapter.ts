import crypto from 'crypto';
import {
  MarketOrderParams,
  MarketOrderResult,
  OrderBookQuote,
  PortfolioBalances,
} from '../types';
import { BaseExchangeAdapter } from './baseExchange';

interface KuCoinOrderBook {
  sequence: string;
  asks: [string, string][];
  bids: [string, string][];
}

interface KuCoinOrderResponse {
  orderId: string;
}

interface KuCoinAccountResponse {
  data: Array<{
    currency: string;
    available: string;
    holds: string;
  }>;
}

const KUCOIN_API_URL = 'https://api.kucoin.com';

export class KuCoinExchangeAdapter extends BaseExchangeAdapter {
  constructor(config: ConstructorParameters<typeof BaseExchangeAdapter>[0]) {
    super(config);
  }

  public async fetchTopOfBook(symbol: string): Promise<OrderBookQuote> {
    const exchangeSymbol = this.toExchangeSymbol(symbol);
    const { value, latency } = await this.computeLatency(() =>
      this.http.get<{ data: KuCoinOrderBook }>(
        `${KUCOIN_API_URL}/api/v1/market/orderbook/level2_20`,
        {
          params: { symbol: exchangeSymbol },
        },
      ),
    );

    const bids = value.data.data.bids;
    const asks = value.data.data.asks;

    if (!bids?.length || !asks?.length) {
      throw new Error(`KuCoin returned empty order book for ${symbol}`);
    }

    return {
      exchange: this.id,
      symbol,
      bid: Number.parseFloat(bids[0][0]),
      ask: Number.parseFloat(asks[0][0]),
      bidVolume: Number.parseFloat(bids[0][1]),
      askVolume: Number.parseFloat(asks[0][1]),
      timestamp: Date.now(),
      latencyMs: latency,
    };
  }

  public async fetchBalances(symbols: string[]): Promise<PortfolioBalances> {
    if (!this.supportsTrading || !this.credentials?.apiKey || !this.credentials.secret) {
      return { base: {}, quote: {}, usdValueEstimate: 0 };
    }

    const method = 'GET';
    const endpoint = '/api/v1/accounts';
    const timestamp = Date.now().toString();
    const sign = this.signRequest(timestamp, method, endpoint, '');

    const response = await this.http.get<KuCoinAccountResponse>(`${KUCOIN_API_URL}${endpoint}`, {
      headers: this.buildHeaders(timestamp, sign),
      params: { type: 'trade' },
    });

    const balances: PortfolioBalances = { base: {}, quote: {}, usdValueEstimate: 0, raw: response.data };

    for (const symbol of symbols) {
      const [base, quote] = symbol.split('/');
      const baseBalance = response.data.data.find((i) => i.currency === base)?.available ?? '0';
      const quoteBalance = response.data.data.find((i) => i.currency === quote)?.available ?? '0';
      balances.base[base] = Number.parseFloat(baseBalance);
      balances.quote[quote] = Number.parseFloat(quoteBalance);
    }

    return balances;
  }

  protected async executeMarketOrder(params: MarketOrderParams): Promise<MarketOrderResult> {
    if (!this.credentials?.apiKey || !this.credentials.secret) {
      throw new Error('KuCoin trading requires apiKey and secret.');
    }

    const endpoint = '/api/v1/orders';
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      clientOid: params.clientOrderId ?? crypto.randomUUID(),
      side: params.side,
      symbol: this.toExchangeSymbol(params.symbol),
      type: 'market',
      ...(params.side === 'buy'
        ? { funds: params.amount.toString() }
        : { size: params.amount.toString() }),
    });

    const sign = this.signRequest(timestamp, 'POST', endpoint, body);

    const response = await this.http.post<{ data: KuCoinOrderResponse }>(
      `${KUCOIN_API_URL}${endpoint}`,
      body,
      {
        headers: {
          ...this.buildHeaders(timestamp, sign),
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      exchange: this.id,
      symbol: params.symbol,
      side: params.side,
      executedAmount: params.amount,
      averagePrice: 0,
      feePaid: 0,
      feeCurrency: 'USDT',
      orderId: response.data.data.orderId,
      raw: response.data,
      timestamp: Date.now(),
    };
  }

  private buildHeaders(timestamp: string, sign: string): Record<string, string> {
    return {
      'KC-API-KEY': this.credentials?.apiKey ?? '',
      'KC-API-SIGN': sign,
      'KC-API-TIMESTAMP': timestamp,
      'KC-API-PASSPHRASE': this.credentials?.passphrase ?? '',
      'KC-API-KEY-VERSION': '2',
    };
  }

  private signRequest(timestamp: string, method: string, endpoint: string, body: string): string {
    const payload = `${timestamp}${method}${endpoint}${body}`;
    return crypto.createHmac('sha256', this.credentials?.secret ?? '').update(payload).digest('base64');
  }

  private toExchangeSymbol(symbol: string): string {
    return symbol.replace('/', '-');
  }
}

