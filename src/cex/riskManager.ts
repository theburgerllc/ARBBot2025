import {
  ArbitrageOpportunity,
  BotRuntimeConfig,
  Logger,
  PortfolioState,
  RiskCheckResult,
} from './types';

export class RiskManager {
  constructor(
    private readonly config: BotRuntimeConfig,
    private readonly logger: Logger = console,
  ) {}

  public evaluate(opportunity: ArbitrageOpportunity, portfolio: PortfolioState): RiskCheckResult {
    const [baseSymbol, quoteSymbol] = opportunity.symbol.split('/');
    const buyExchangeBalances = portfolio.exchangeBalances[opportunity.buyExchange];
    const sellExchangeBalances = portfolio.exchangeBalances[opportunity.sellExchange];

    if (!buyExchangeBalances || !sellExchangeBalances) {
      return { approved: false, reason: 'Missing balance information for exchange' };
    }

    const availableQuote = buyExchangeBalances.quote[quoteSymbol] ?? 0;
    const availableBase = sellExchangeBalances.base[baseSymbol] ?? 0;

    const quoteRequired = opportunity.bestAsk.ask * opportunity.tradeAmount;
    if (availableQuote <= 0 || availableQuote < quoteRequired) {
      this.logger.warn(
        `Insufficient quote balance on ${opportunity.buyExchange}. Required=${quoteRequired.toFixed(4)} Available=${availableQuote.toFixed(4)}`,
      );
    }

    const baseRequired = opportunity.tradeAmount;
    if (availableBase <= 0 || availableBase < baseRequired) {
      this.logger.warn(
        `Insufficient base balance on ${opportunity.sellExchange}. Required=${baseRequired.toFixed(4)} Available=${availableBase.toFixed(4)}`,
      );
    }

    const tradeValueUsd = opportunity.tradeAmount * opportunity.bestAsk.ask;
    if (tradeValueUsd > this.config.maxExposurePerTradeUsd) {
      this.logger.debug?.(
        `Reducing trade size due to per-trade exposure cap ${this.config.maxExposurePerTradeUsd}`,
      );
    }

    const buyExchangeExposure = buyExchangeBalances.usdValueEstimate;
    const sellExchangeExposure = sellExchangeBalances.usdValueEstimate;

    if (buyExchangeExposure + tradeValueUsd > this.config.maxExposurePerExchangeUsd) {
      return {
        approved: false,
        reason: `Buy exchange exposure limit exceeded (${this.config.maxExposurePerExchangeUsd})`,
      };
    }

    if (sellExchangeExposure + tradeValueUsd > this.config.maxExposurePerExchangeUsd) {
      return {
        approved: false,
        reason: `Sell exchange exposure limit exceeded (${this.config.maxExposurePerExchangeUsd})`,
      };
    }

    const maxByQuote = availableQuote / opportunity.bestAsk.ask;
    const maxByBase = availableBase;
    const maxByTradeValue = this.config.maxExposurePerTradeUsd / opportunity.bestAsk.ask;
    const allowable = Math.min(
      opportunity.maxTradeAmount,
      maxByQuote,
      maxByBase,
      maxByTradeValue,
    );

    if (allowable <= 0) {
      return { approved: false, reason: 'No capacity after applying risk limits' };
    }

    if (allowable < opportunity.tradeAmount) {
      return { approved: true, adjustedTradeAmount: allowable };
    }

    return { approved: true };
  }
}

