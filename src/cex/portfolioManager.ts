import { ExchangeAdapter, Logger, PortfolioState } from './types';

export class PortfolioManager {
  private state: PortfolioState = { timestamp: 0, exchangeBalances: {} };

  constructor(
    private readonly adapters: ExchangeAdapter[],
    private readonly symbols: string[],
    private readonly logger: Logger = console,
  ) {}

  public async refresh(): Promise<PortfolioState> {
    const exchangeBalances: PortfolioState['exchangeBalances'] = {};

    for (const adapter of this.adapters) {
      try {
        const balances = await adapter.fetchBalances(this.symbols);
        exchangeBalances[adapter.id] = {
          base: balances.base,
          quote: balances.quote,
          usdValueEstimate: balances.usdValueEstimate ?? this.estimateUsdValue(balances),
        };
      } catch (error) {
        this.logger.warn(`Failed to refresh balances for ${adapter.displayName}: ${error}`);
      }
    }

    this.state = {
      timestamp: Date.now(),
      exchangeBalances,
    };

    return this.state;
  }

  public getState(): PortfolioState {
    return this.state;
  }

  private estimateUsdValue(balances: { base: Record<string, number>; quote: Record<string, number> }): number {
    const quoteSum = Object.values(balances.quote).reduce((acc, value) => acc + value, 0);
    return quoteSum;
  }
}

