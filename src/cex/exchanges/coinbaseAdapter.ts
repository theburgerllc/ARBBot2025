import crypto from 'crypto';
import {
  MarketOrderParams,
  MarketOrderResult,
  OrderBookQuote,
  PortfolioBalances,
} from '../types';
import { BaseExchangeAdapter } from './baseExchange';

interface CoinbaseOrderBookLevel {
  price: string;
  size: string;
}

interface CoinbaseOrderResponse {
  id: string;
  size: string;
  filled_size: string;
  executed_value: string;
  fill_fees: string;
}

interface CoinbaseAccount {
  currency: string;
  available: string;
  balance: string;
}

const COINBASE_API_URL = 'https://api.exchange.coinbase.com';

export class CoinbaseExchangeAdapter extends BaseExchangeAdapter {
  constructor(config: ConstructorParameters<typeof BaseExchangeAdapter>[0]) {
    super(config);
  }

  public async fetchTopOfBook(symbol: string): Promise<OrderBookQuote> {
    const exchangeSymbol = this.toExchangeSymbol(symbol);
    const { value, latency } = await this.computeLatency(() =>
      this.http.get<{ bids: CoinbaseOrderBookLevel[]; asks: CoinbaseOrderBookLevel[] }>(
        `${COINBASE_API_URL}/products/${exchangeSymbol}/book`,
        {
          params: { level: 2 },
        },
      ),
    );

    const bids = value.data.bids;
    const asks = value.data.asks;

    if (!bids?.length || !asks?.length) {
      throw new Error(`Coinbase returned empty order book for ${symbol}`);
    }

    return {
      exchange: this.id,
      symbol,
      bid: Number.parseFloat(bids[0].price),
      ask: Number.parseFloat(asks[0].price),
      bidVolume: Number.parseFloat(bids[0].size),
      askVolume: Number.parseFloat(asks[0].size),
      timestamp: Date.now(),
      latencyMs: latency,
    };
  }

  public async fetchBalances(symbols: string[]): Promise<PortfolioBalances> {
    if (!this.supportsTrading || !this.credentials?.apiKey || !this.credentials.passphrase) {
      return { base: {}, quote: {}, usdValueEstimate: 0 };
    }

    const timestamp = Date.now() / 1000;
    const method = 'GET';
    const requestPath = '/accounts';
    const sign = this.signRequest(timestamp, method, requestPath, '');

    const response = await this.http.get<CoinbaseAccount[]>(`${COINBASE_API_URL}${requestPath}`, {
      headers: {
        'CB-ACCESS-KEY': this.credentials.apiKey,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'CB-ACCESS-SIGN': sign,
        'CB-ACCESS-PASSPHRASE': this.credentials.passphrase,
      },
    });

    const balances: PortfolioBalances = { base: {}, quote: {}, usdValueEstimate: 0, raw: response.data };

    for (const symbol of symbols) {
      const [base, quote] = symbol.split('/');
      const baseAccount = response.data.find((a) => a.currency === base);
      const quoteAccount = response.data.find((a) => a.currency === quote);
      balances.base[base] = baseAccount ? Number.parseFloat(baseAccount.available) : 0;
      balances.quote[quote] = quoteAccount ? Number.parseFloat(quoteAccount.available) : 0;
    }

    return balances;
  }

  protected async executeMarketOrder(params: MarketOrderParams): Promise<MarketOrderResult> {
    if (!this.credentials?.apiKey || !this.credentials.secret || !this.credentials.passphrase) {
      throw new Error('Coinbase trading requires apiKey, secret, and passphrase.');
    }

    const timestamp = Date.now() / 1000;
    const method = 'POST';
    const requestPath = '/orders';
    const payload = JSON.stringify({
      product_id: this.toExchangeSymbol(params.symbol),
      side: params.side,
      type: 'market',
      size: params.side === 'buy' ? undefined : params.amount,
      funds: params.side === 'buy' ? params.amount : undefined,
      client_oid: params.clientOrderId,
    });

    const sign = this.signRequest(timestamp, method, requestPath, payload);

    const response = await this.http.post<CoinbaseOrderResponse>(
      `${COINBASE_API_URL}${requestPath}`,
      payload,
      {
        headers: {
          'CB-ACCESS-KEY': this.credentials.apiKey,
          'CB-ACCESS-TIMESTAMP': timestamp,
          'CB-ACCESS-SIGN': sign,
          'CB-ACCESS-PASSPHRASE': this.credentials.passphrase,
          'Content-Type': 'application/json',
        },
      },
    );

    const executedAmount = Number.parseFloat(response.data.filled_size);
    const quoteValue = Number.parseFloat(response.data.executed_value);
    const fee = Number.parseFloat(response.data.fill_fees);

    return {
      exchange: this.id,
      symbol: params.symbol,
      side: params.side,
      executedAmount,
      averagePrice: quoteValue / Math.max(executedAmount, Number.EPSILON),
      feePaid: fee,
      feeCurrency: 'USD',
      orderId: response.data.id,
      raw: response.data,
      timestamp: Date.now(),
    };
  }

  private signRequest(
    timestamp: number,
    method: string,
    requestPath: string,
    body: string,
  ): string {
    const what = `${timestamp}${method}${requestPath}${body}`;
    return crypto
      .createHmac('sha256', Buffer.from(this.credentials?.secret ?? '', 'base64'))
      .update(what)
      .digest('base64');
  }

  private toExchangeSymbol(symbol: string): string {
    return symbol.replace('/', '-');
  }
}

