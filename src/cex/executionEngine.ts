import { performance } from 'perf_hooks';
import {
  ArbitrageOpportunity,
  ExecutionEngineOptions,
  ExchangeAdapter,
  Logger,
  MarketOrderParams,
  MarketOrderResult,
  TradeExecutionResult,
} from './types';

function buildClientOrderId(symbol: string): string {
  return `${symbol.replace('/', '')}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export class ExecutionEngine {
  private readonly adapterMap = new Map<string, ExchangeAdapter>();

  constructor(
    adapters: ExchangeAdapter[],
    private readonly options: ExecutionEngineOptions,
    private readonly logger: Logger = console,
  ) {
    for (const adapter of adapters) {
      this.adapterMap.set(adapter.id, adapter);
    }
  }

  public async execute(
    opportunity: ArbitrageOpportunity,
    tradeAmount: number,
  ): Promise<TradeExecutionResult> {
    if (tradeAmount <= 0) {
      throw new Error('Trade amount must be positive');
    }

    const buyAdapter = this.adapterMap.get(opportunity.buyExchange);
    const sellAdapter = this.adapterMap.get(opportunity.sellExchange);

    if (!buyAdapter || !sellAdapter) {
      throw new Error('Missing exchange adapter for execution');
    }

    if (this.options.simulationMode) {
      return this.simulate(opportunity, tradeAmount);
    }

    const buyParams: MarketOrderParams = {
      symbol: opportunity.symbol,
      side: 'buy',
      amount: tradeAmount,
      clientOrderId: buildClientOrderId(opportunity.symbol),
    };

    const sellParams: MarketOrderParams = {
      symbol: opportunity.symbol,
      side: 'sell',
      amount: tradeAmount,
      clientOrderId: buildClientOrderId(opportunity.symbol),
    };

    const start = performance.now();
    const [buyResult, sellResult] = await Promise.all([
      buyAdapter.placeMarketOrder(buyParams),
      sellAdapter.placeMarketOrder(sellParams),
    ]);
    const latencyMs = performance.now() - start;

    const profitUsd = this.calculateProfit(opportunity, buyResult, sellResult);

    this.logger.info(
      `Executed arbitrage ${opportunity.symbol} buying ${tradeAmount} on ${buyAdapter.displayName} and selling on ${sellAdapter.displayName}. Profit=${profitUsd.toFixed(2)} USD latency=${latencyMs.toFixed(1)}ms`,
    );

    return {
      buy: buyResult,
      sell: sellResult,
      profitUsd,
      latencyMs,
      opportunity,
    };
  }

  private simulate(opportunity: ArbitrageOpportunity, tradeAmount: number): TradeExecutionResult {
    const buyResult: MarketOrderResult = {
      exchange: opportunity.buyExchange,
      symbol: opportunity.symbol,
      side: 'buy',
      executedAmount: tradeAmount,
      averagePrice: opportunity.bestAsk.ask,
      feePaid: (opportunity.bestAsk.ask * tradeAmount * 0.001),
      feeCurrency: opportunity.symbol.split('/')[1] ?? 'USD',
      orderId: `sim-${buildClientOrderId(opportunity.symbol)}`,
      timestamp: Date.now(),
    };

    const sellResult: MarketOrderResult = {
      exchange: opportunity.sellExchange,
      symbol: opportunity.symbol,
      side: 'sell',
      executedAmount: tradeAmount,
      averagePrice: opportunity.bestBid.bid,
      feePaid: (opportunity.bestBid.bid * tradeAmount * 0.001),
      feeCurrency: opportunity.symbol.split('/')[1] ?? 'USD',
      orderId: `sim-${buildClientOrderId(opportunity.symbol)}`,
      timestamp: Date.now(),
    };

    const profitUsd = this.calculateProfit(opportunity, buyResult, sellResult);

    return {
      buy: buyResult,
      sell: sellResult,
      profitUsd,
      latencyMs: 0,
      opportunity,
    };
  }

  private calculateProfit(
    opportunity: ArbitrageOpportunity,
    buy: MarketOrderResult,
    sell: MarketOrderResult,
  ): number {
    const gross = sell.averagePrice * sell.executedAmount - buy.averagePrice * buy.executedAmount;
    const totalFees = this.normaliseFee(buy) + this.normaliseFee(sell);
    const profit = gross - totalFees;

    if (profit < opportunity.expectedProfitUsd * -1) {
      this.logger.warn(
        `Execution profit (${profit.toFixed(2)}) deviated significantly from expected ${opportunity.expectedProfitUsd.toFixed(2)}`,
      );
    }

    return profit;
  }

  private normaliseFee(result: MarketOrderResult): number {
    // Assume fee is denominated in the quote currency and already in USD/USDT terms.
    return result.feePaid;
  }
}

