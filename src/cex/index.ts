import { ArbitrageDetector } from './arbitrageDetector';
import { loadBotRuntimeConfig, loadExchangeConfigs, loadPollingConfig, ensureLogFileExists } from './config';
import { PollingMarketDataFeed, MarketDataEvents } from './dataFeed';
import { ExecutionEngine } from './executionEngine';
import { FilePerformanceTracker, ensurePerformanceLog } from './performanceTracker';
import { PortfolioManager } from './portfolioManager';
import { RiskManager } from './riskManager';
import { buildExchangeAdapter } from './exchanges/factory';
import {
  Logger,
  TradeRecord,
  ArbitrageOpportunity,
  ExchangeAdapter,
  PerformanceTracker,
  AggregatedMarketSnapshot,
  BotRuntimeConfig,
} from './types';

export interface CexArbitrageBotContext {
  feed: PollingMarketDataFeed;
  detector: ArbitrageDetector;
  executionEngine: ExecutionEngine;
  riskManager: RiskManager;
  portfolioManager: PortfolioManager;
  performanceTracker: PerformanceTracker;
  adapters: ExchangeAdapter[];
  runtimeConfig: BotRuntimeConfig;
}

export async function createCexArbitrageBot(logger: Logger = console): Promise<CexArbitrageBotContext> {
  const runtimeConfig = loadBotRuntimeConfig(logger);
  ensureLogFileExists(runtimeConfig.performanceLogPath);
  ensurePerformanceLog(runtimeConfig.performanceLogPath);

  const pollingConfig = loadPollingConfig();
  const exchangeConfigs = loadExchangeConfigs(runtimeConfig);
  const adapters = exchangeConfigs.map((config) => buildExchangeAdapter(config));

  if (!adapters.length) {
    throw new Error('No exchanges enabled. Configure CEX_ENABLED_EXCHANGES.');
  }

  const feed = new PollingMarketDataFeed(adapters, runtimeConfig.symbols, pollingConfig, logger);
  const detector = new ArbitrageDetector(
    {
      minSpreadBps: runtimeConfig.minSpreadBps,
      minAbsoluteSpreadUsd: runtimeConfig.minAbsoluteSpreadUsd,
      riskBufferBps: runtimeConfig.riskBufferBps,
    },
    logger,
  );
  const riskManager = new RiskManager(runtimeConfig, logger);
  const portfolioManager = new PortfolioManager(adapters, runtimeConfig.symbols, logger);
  const performanceTracker = new FilePerformanceTracker(runtimeConfig.performanceLogPath, logger);
  const executionEngine = new ExecutionEngine(
    adapters,
    {
      simulationMode: runtimeConfig.simulationMode,
      maxSlippageBps: runtimeConfig.riskBufferBps,
      timeoutMs: 10_000,
    },
    logger,
  );

  return {
    feed,
    detector,
    executionEngine,
    riskManager,
    portfolioManager,
    performanceTracker,
    adapters,
    runtimeConfig,
  };
}

export async function runCexArbitrageBot(logger: Logger = console): Promise<void> {
  const context = await createCexArbitrageBot(logger);
  const { feed, detector, executionEngine, riskManager, portfolioManager, performanceTracker, runtimeConfig } = context;

  await portfolioManager.refresh();
  let lastBalanceRefresh = Date.now();

  const inFlight = new Set<Promise<void>>();

  const refreshBalancesIfNeeded = async () => {
    if (Date.now() - lastBalanceRefresh >= runtimeConfig.balancesRefreshIntervalMs) {
      await portfolioManager.refresh();
      lastBalanceRefresh = Date.now();
    }
  };

  feed.on(MarketDataEvents.Snapshot, async (snapshot: AggregatedMarketSnapshot) => {
    await refreshBalancesIfNeeded();
    const opportunity = detector.evaluate(snapshot);
    if (!opportunity) {
      return;
    }

    if (inFlight.size >= runtimeConfig.maxConcurrentTrades) {
      logger.debug?.('Skipping opportunity because max concurrent trades reached');
      return;
    }

    const portfolioState = portfolioManager.getState();
    const riskResult = riskManager.evaluate(opportunity, portfolioState);
    if (!riskResult.approved) {
      logger.debug?.(`Risk manager rejected trade: ${riskResult.reason ?? 'unknown reason'}`);
      return;
    }

    const tradeAmount = riskResult.adjustedTradeAmount ?? opportunity.tradeAmount;
    if (tradeAmount <= 0) {
      return;
    }

    const tradeOpportunity: ArbitrageOpportunity = {
      ...opportunity,
      tradeAmount,
      expectedProfitUsd: opportunity.spread * tradeAmount,
    };

    const tradeTask = (async () => {
      try {
        const executionResult = await executionEngine.execute(tradeOpportunity, tradeAmount);
        const tradeRecord: TradeRecord = {
          ...executionResult,
          balancesSnapshot: JSON.parse(JSON.stringify(portfolioState)) as typeof portfolioState,
        };
        await performanceTracker.recordTrade(tradeRecord);
        await portfolioManager.refresh();
      } catch (error) {
        logger.error('Failed to execute arbitrage opportunity', error);
      } finally {
        inFlight.delete(tradeTask);
      }
    })();

    inFlight.add(tradeTask);
  });

  feed.on(MarketDataEvents.Error, (error) => {
    logger.error('Market data feed error', error);
  });

  await feed.start();

  const shutdown = async () => {
    logger.info('Shutting down CEX arbitrage bot...');
    await feed.stop();
    await Promise.allSettled(Array.from(inFlight));
    logger.info('CEX arbitrage bot stopped.');
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

