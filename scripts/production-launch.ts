import chalk from "chalk";
import { spawn, ChildProcess } from "child_process";
import { validateProductionReadiness } from "./validate-production-ready";
import fs from "fs";

interface LaunchConfig {
  skipValidation?: boolean;
  dryRun?: boolean;
  logLevel?: string;
  restartOnFailure?: boolean;
  maxRestarts?: number;
  healthCheckInterval?: number;
}

class ProductionLauncher {
  private botProcess: ChildProcess | null = null;
  private restartCount = 0;
  private config: LaunchConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: LaunchConfig = {}) {
    this.config = {
      skipValidation: false,
      dryRun: false,
      logLevel: 'info',
      restartOnFailure: true,
      maxRestarts: 5,
      healthCheckInterval: 60000, // 1 minute
      ...config
    };
  }

  async launch(): Promise<void> {
    console.log(chalk.blue('🚀 ARBBot2025 Production Launch Sequence\n'));
    
    try {
      // Step 1: Final validation (unless skipped)
      if (!this.config.skipValidation) {
        console.log(chalk.cyan('Step 1: Final Production Validation...'));
        
        const isReady = await validateProductionReadiness();
        if (!isReady) {
          console.log(chalk.red('❌ Production validation failed. Aborting launch.'));
          console.log(chalk.yellow('Fix the issues above and run again, or use --skip-validation to bypass (not recommended)'));
          process.exit(1);
        }
        
        console.log(chalk.green('✅ Production validation passed\n'));
      } else {
        console.log(chalk.yellow('⚠️ Skipping production validation (not recommended)\n'));
      }

      // Step 2: Environment setup
      await this.setupProductionEnvironment();

      // Step 3: Start monitoring
      console.log(chalk.cyan('Step 2: Initializing Production Monitoring...'));
      this.startHealthMonitoring();
      
      // Step 4: Launch bot with production settings
      console.log(chalk.cyan('Step 3: Launching ARBBot2025...'));
      await this.startBot();
      
      // Step 5: Setup graceful shutdown handlers
      this.setupShutdownHandlers();
      
      console.log(chalk.green('✅ ARBBot2025 launched in production mode'));
      console.log(chalk.blue('📊 Bot is running with production settings'));
      console.log(chalk.yellow('⚠️ Keep this terminal open or run in a process manager like PM2'));
      console.log(chalk.gray('💡 Use Ctrl+C for graceful shutdown\n'));
      
      // Keep the process alive
      this.keepAlive();
      
    } catch (error) {
      console.error(chalk.red('❌ Production launch failed:'), error);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async setupProductionEnvironment(): Promise<void> {
    console.log(chalk.cyan('Setting up production environment...'));
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
      console.log(chalk.green('✅ Created logs directory'));
    }
    
    // Create monitoring directory if it doesn't exist
    if (!fs.existsSync('monitoring-data')) {
      fs.mkdirSync('monitoring-data');
      console.log(chalk.green('✅ Created monitoring data directory'));
    }
    
    // Set production environment variables
    process.env.NODE_ENV = 'production';
    process.env.PRODUCTION_MODE = 'true';
    
    if (!process.env.LOG_LEVEL) {
      process.env.LOG_LEVEL = this.config.logLevel;
    }
    
    console.log(chalk.green('✅ Production environment configured\n'));
  }

  private async startBot(): Promise<void> {
    const botArgs = ['scripts/run-bot.ts'];
    
    const botEnv = {
      ...process.env,
      ENABLE_SIMULATION_MODE: this.config.dryRun ? 'true' : 'false',
      LOG_LEVEL: this.config.logLevel,
      PRODUCTION_MODE: 'true',
      NODE_ENV: 'production'
    };

    console.log(chalk.blue(`Starting bot with settings:`));
    console.log(chalk.gray(`  • Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE TRADING'}`));
    console.log(chalk.gray(`  • Log Level: ${this.config.logLevel}`));
    console.log(chalk.gray(`  • Restart on Failure: ${this.config.restartOnFailure}`));
    console.log(chalk.gray(`  • Max Restarts: ${this.config.maxRestarts}\n`));

    this.botProcess = spawn('ts-node', botArgs, {
      env: botEnv,
      stdio: 'inherit'
    });

    this.botProcess.on('exit', (code, signal) => {
      if (this.isShuttingDown) {
        console.log(chalk.yellow('🛑 Bot shutdown completed'));
        return;
      }

      if (code === 0) {
        console.log(chalk.green('✅ Bot exited normally'));
      } else {
        console.log(chalk.red(`❌ Bot exited with code ${code} (signal: ${signal})`));
        
        if (this.config.restartOnFailure && this.restartCount < this.config.maxRestarts!) {
          this.restartBot();
        } else {
          console.log(chalk.red('❌ Maximum restart attempts reached. Bot stopped.'));
          process.exit(1);
        }
      }
    });

    this.botProcess.on('error', (error) => {
      console.error(chalk.red('❌ Bot process error:'), error);
      if (this.config.restartOnFailure && this.restartCount < this.config.maxRestarts!) {
        this.restartBot();
      }
    });
  }

  private restartBot(): void {
    this.restartCount++;
    const delay = Math.min(1000 * Math.pow(2, this.restartCount), 30000); // Exponential backoff, max 30s
    
    console.log(chalk.yellow(`🔄 Restarting bot in ${delay/1000}s (attempt ${this.restartCount}/${this.config.maxRestarts})...`));
    
    setTimeout(() => {
      this.startBot();
    }, delay);
  }

  private startHealthMonitoring(): void {
    console.log(chalk.green('✅ Health monitoring started'));
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private performHealthCheck(): void {
    if (!this.botProcess || this.isShuttingDown) {
      return;
    }

    // Check if process is still running
    if (this.botProcess.killed || this.botProcess.exitCode !== null) {
      console.log(chalk.red('⚠️ Health check failed: Bot process not running'));
      return;
    }

    // Log health check
    const timestamp = new Date().toISOString();
    console.log(chalk.blue(`💓 Health check passed - ${timestamp}`));
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memUsageMB > 2000) { // 2GB threshold
      console.log(chalk.yellow(`⚠️ High memory usage detected: ${memUsageMB}MB`));
    }
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(chalk.yellow(`\n🛑 Received ${signal}, initiating graceful shutdown...`));
      await this.shutdown();
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('💥 Uncaught Exception:'), error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error(chalk.red('💥 Unhandled Rejection:'), { reason, promise });
      await this.shutdown();
      process.exit(1);
    });
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    
    console.log(chalk.yellow('📊 Generating final reports...'));
    
    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Gracefully stop the bot
    if (this.botProcess && !this.botProcess.killed) {
      console.log(chalk.yellow('🛑 Stopping bot process...'));
      
      // Send SIGTERM for graceful shutdown
      this.botProcess.kill('SIGTERM');
      
      // Wait up to 30 seconds for graceful shutdown
      const shutdownTimeout = setTimeout(() => {
        if (this.botProcess && !this.botProcess.killed) {
          console.log(chalk.red('⚠️ Force killing bot process...'));
          this.botProcess.kill('SIGKILL');
        }
      }, 30000);
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (!this.botProcess || this.botProcess.killed) {
          resolve();
          return;
        }
        
        this.botProcess.once('exit', () => {
          clearTimeout(shutdownTimeout);
          resolve();
        });
      });
    }
    
    await this.cleanup();
    console.log(chalk.green('✅ Graceful shutdown completed'));
  }

  private async cleanup(): Promise<void> {
    // Perform any necessary cleanup
    console.log(chalk.yellow('🧹 Performing cleanup...'));
    
    // Log final statistics
    console.log(chalk.blue('📊 Final Statistics:'));
    console.log(chalk.gray(`  • Uptime: ${process.uptime().toFixed(0)} seconds`));
    console.log(chalk.gray(`  • Restart count: ${this.restartCount}`));
    console.log(chalk.gray(`  • Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`));
    
    console.log(chalk.green('✅ Cleanup completed'));
  }

  private keepAlive(): void {
    // Keep the main process running
    const keepAliveInterval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(keepAliveInterval);
      }
      // Process is kept alive by this interval
    }, 1000);
  }
}

// CLI handling
function parseArgs(): LaunchConfig {
  const args = process.argv.slice(2);
  const config: LaunchConfig = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--skip-validation':
        config.skipValidation = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--log-level':
        config.logLevel = args[i + 1];
        i++; // Skip next argument
        break;
      case '--no-restart':
        config.restartOnFailure = false;
        break;
      case '--max-restarts':
        config.maxRestarts = parseInt(args[i + 1]) || 5;
        i++; // Skip next argument
        break;
      case '--help':
        displayHelp();
        process.exit(0);
      default:
        if (arg.startsWith('-')) {
          console.log(chalk.yellow(`Unknown argument: ${arg}`));
        }
        break;
    }
  }
  
  return config;
}

function displayHelp(): void {
  console.log(chalk.cyan(`\n🚀 ARBBot2025 Production Launch Tool\n`));
  console.log(chalk.white('Usage: ts-node scripts/production-launch.ts [options]\n'));
  console.log(chalk.yellow('Options:'));
  console.log(chalk.white('  --skip-validation    Skip production readiness validation (not recommended)'));
  console.log(chalk.white('  --dry-run           Launch in simulation mode (no real trades)'));
  console.log(chalk.white('  --log-level LEVEL   Set log level (debug, info, warn, error)'));
  console.log(chalk.white('  --no-restart        Disable automatic restart on failure'));
  console.log(chalk.white('  --max-restarts NUM  Maximum number of restart attempts (default: 5)'));
  console.log(chalk.white('  --help              Display this help message'));
  console.log(chalk.white('\nExamples:'));
  console.log(chalk.gray('  ts-node scripts/production-launch.ts'));
  console.log(chalk.gray('  ts-node scripts/production-launch.ts --dry-run'));
  console.log(chalk.gray('  ts-node scripts/production-launch.ts --log-level debug --max-restarts 10'));
  console.log(chalk.gray('  npm run production:launch\n'));
}

// Main execution
async function main(): Promise<void> {
  const config = parseArgs();
  const launcher = new ProductionLauncher(config);
  
  try {
    await launcher.launch();
  } catch (error) {
    console.error(chalk.red('Launch failed:', error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ProductionLauncher };