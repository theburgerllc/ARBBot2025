import { stringify } from 'querystring';
import {
  MarketOrderParams,
  MarketOrderResult,
  OrderBookQuote,
  PortfolioBalances,
} from '../types';
import { BaseExchangeAdapter } from './baseExchange';

interface BinanceOrderResponse {
  orderId: number;
  cummulativeQuoteQty: string;
  executedQty: string;
  fills?: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
}

interface BinanceAccountBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceAccountResponse {
  balances: BinanceAccountBalance[];
}

const BINANCE_API_URL = 'https://api.binance.com';

export class BinanceExchangeAdapter extends BaseExchangeAdapter {
  constructor(config: ConstructorParameters<typeof BaseExchangeAdapter>[0]) {
    super(config);
  }

  public async fetchTopOfBook(symbol: string): Promise<OrderBookQuote> {
    const exchangeSymbol = this.toExchangeSymbol(symbol);
    const { value, latency } = await this.computeLatency(() =>
      this.http.get(`${BINANCE_API_URL}/api/v3/depth`, {
        params: { symbol: exchangeSymbol, limit: 5 },
      }),
    );

    const bids: [string, string][] = value.data.bids;
    const asks: [string, string][] = value.data.asks;

    if (!bids?.length || !asks?.length) {
      throw new Error(`Binance returned empty order book for ${symbol}`);
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
    if (!this.supportsTrading || !this.credentials?.apiKey) {
      return { base: {}, quote: {}, usdValueEstimate: 0 };
    }

    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = this.signQuery(query, this.credentials?.secret);

    const response = await this.http.get<BinanceAccountResponse>(`${BINANCE_API_URL}/api/v3/account`, {
      headers: { 'X-MBX-APIKEY': this.credentials.apiKey },
      params: { timestamp, signature },
    });

    const balances: PortfolioBalances = { base: {}, quote: {}, usdValueEstimate: 0, raw: response.data };

    for (const symbol of symbols) {
      const [base, quote] = symbol.split('/');
      const baseBalance = response.data.balances.find((b) => b.asset === base)?.free ?? '0';
      const quoteBalance = response.data.balances.find((b) => b.asset === quote)?.free ?? '0';
      balances.base[base] = Number.parseFloat(baseBalance);
      balances.quote[quote] = Number.parseFloat(quoteBalance);
    }

    return balances;
  }

  protected async executeMarketOrder(params: MarketOrderParams): Promise<MarketOrderResult> {
    const timestamp = Date.now();
    const symbol = this.toExchangeSymbol(params.symbol);
    const side = params.side.toUpperCase();
    const quantity = params.amount.toString();
    const payload = {
      symbol,
      side,
      type: 'MARKET',
      quantity,
      newClientOrderId: params.clientOrderId,
      timestamp,
    };

    const query = stringify(payload);
    const signature = this.signQuery(query, this.credentials?.secret);
    const requestPayload = { ...payload, signature };

    const response = await this.http.post<BinanceOrderResponse>(`${BINANCE_API_URL}/api/v3/order`, null, {
      headers: { 'X-MBX-APIKEY': this.credentials?.apiKey ?? '' },
      params: requestPayload,
    });

    const executedQty = Number.parseFloat(response.data.executedQty);
    const quoteQty = Number.parseFloat(response.data.cummulativeQuoteQty);
    const fee = response.data.fills?.reduce((acc, fill) => acc + Number.parseFloat(fill.commission), 0) ?? 0;
    const feeCurrency = response.data.fills?.[0]?.commissionAsset ?? 'USDT';

    return {
      exchange: this.id,
      symbol: params.symbol,
      side: params.side,
      executedAmount: executedQty,
      averagePrice: quoteQty / Math.max(executedQty, Number.EPSILON),
      feePaid: fee,
      feeCurrency,
      orderId: String(response.data.orderId),
      raw: response.data,
      timestamp,
    };
  }

  private toExchangeSymbol(symbol: string): string {
    return symbol.replace('/', '');
  }
}

