import 'dotenv/config';
import pino from 'pino';
import { runCexArbitrageBot } from '../src/cex';

async function main(): Promise<void> {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true },
          },
  });

  try {
    await runCexArbitrageBot(logger);
  } catch (error) {
    logger.error(error, 'Failed to start CEX arbitrage bot');
    process.exitCode = 1;
  }
}

void main();

