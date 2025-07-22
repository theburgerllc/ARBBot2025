"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionLauncher = void 0;
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const validate_production_ready_1 = require("./validate-production-ready");
const fs_1 = __importDefault(require("fs"));
class ProductionLauncher {
    botProcess = null;
    restartCount = 0;
    config;
    healthCheckTimer = null;
    isShuttingDown = false;
    constructor(config = {}) {
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
    async launch() {
        console.log(chalk_1.default.blue('🚀 ARBBot2025 Production Launch Sequence\n'));
        try {
            // Step 1: Final validation (unless skipped)
            if (!this.config.skipValidation) {
                console.log(chalk_1.default.cyan('Step 1: Final Production Validation...'));
                const isReady = await (0, validate_production_ready_1.validateProductionReadiness)();
                if (!isReady) {
                    console.log(chalk_1.default.red('❌ Production validation failed. Aborting launch.'));
                    console.log(chalk_1.default.yellow('Fix the issues above and run again, or use --skip-validation to bypass (not recommended)'));
                    process.exit(1);
                }
                console.log(chalk_1.default.green('✅ Production validation passed\n'));
            }
            else {
                console.log(chalk_1.default.yellow('⚠️ Skipping production validation (not recommended)\n'));
            }
            // Step 2: Environment setup
            await this.setupProductionEnvironment();
            // Step 3: Start monitoring
            console.log(chalk_1.default.cyan('Step 2: Initializing Production Monitoring...'));
            this.startHealthMonitoring();
            // Step 4: Launch bot with production settings
            console.log(chalk_1.default.cyan('Step 3: Launching ARBBot2025...'));
            await this.startBot();
            // Step 5: Setup graceful shutdown handlers
            this.setupShutdownHandlers();
            console.log(chalk_1.default.green('✅ ARBBot2025 launched in production mode'));
            console.log(chalk_1.default.blue('📊 Bot is running with production settings'));
            console.log(chalk_1.default.yellow('⚠️ Keep this terminal open or run in a process manager like PM2'));
            console.log(chalk_1.default.gray('💡 Use Ctrl+C for graceful shutdown\n'));
            // Keep the process alive
            this.keepAlive();
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Production launch failed:'), error);
            await this.cleanup();
            process.exit(1);
        }
    }
    async setupProductionEnvironment() {
        console.log(chalk_1.default.cyan('Setting up production environment...'));
        // Create logs directory if it doesn't exist
        if (!fs_1.default.existsSync('logs')) {
            fs_1.default.mkdirSync('logs');
            console.log(chalk_1.default.green('✅ Created logs directory'));
        }
        // Create monitoring directory if it doesn't exist
        if (!fs_1.default.existsSync('monitoring-data')) {
            fs_1.default.mkdirSync('monitoring-data');
            console.log(chalk_1.default.green('✅ Created monitoring data directory'));
        }
        // Set production environment variables
        process.env.NODE_ENV = 'production';
        process.env.PRODUCTION_MODE = 'true';
        if (!process.env.LOG_LEVEL) {
            process.env.LOG_LEVEL = this.config.logLevel;
        }
        console.log(chalk_1.default.green('✅ Production environment configured\n'));
    }
    async startBot() {
        const botArgs = ['scripts/run-bot.ts'];
        const botEnv = {
            ...process.env,
            ENABLE_SIMULATION_MODE: this.config.dryRun ? 'true' : 'false',
            LOG_LEVEL: this.config.logLevel,
            PRODUCTION_MODE: 'true',
            NODE_ENV: 'production'
        };
        console.log(chalk_1.default.blue(`Starting bot with settings:`));
        console.log(chalk_1.default.gray(`  • Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE TRADING'}`));
        console.log(chalk_1.default.gray(`  • Log Level: ${this.config.logLevel}`));
        console.log(chalk_1.default.gray(`  • Restart on Failure: ${this.config.restartOnFailure}`));
        console.log(chalk_1.default.gray(`  • Max Restarts: ${this.config.maxRestarts}\n`));
        this.botProcess = (0, child_process_1.spawn)('ts-node', botArgs, {
            env: botEnv,
            stdio: 'inherit'
        });
        this.botProcess.on('exit', (code, signal) => {
            if (this.isShuttingDown) {
                console.log(chalk_1.default.yellow('🛑 Bot shutdown completed'));
                return;
            }
            if (code === 0) {
                console.log(chalk_1.default.green('✅ Bot exited normally'));
            }
            else {
                console.log(chalk_1.default.red(`❌ Bot exited with code ${code} (signal: ${signal})`));
                if (this.config.restartOnFailure && this.restartCount < this.config.maxRestarts) {
                    this.restartBot();
                }
                else {
                    console.log(chalk_1.default.red('❌ Maximum restart attempts reached. Bot stopped.'));
                    process.exit(1);
                }
            }
        });
        this.botProcess.on('error', (error) => {
            console.error(chalk_1.default.red('❌ Bot process error:'), error);
            if (this.config.restartOnFailure && this.restartCount < this.config.maxRestarts) {
                this.restartBot();
            }
        });
    }
    restartBot() {
        this.restartCount++;
        const delay = Math.min(1000 * Math.pow(2, this.restartCount), 30000); // Exponential backoff, max 30s
        console.log(chalk_1.default.yellow(`🔄 Restarting bot in ${delay / 1000}s (attempt ${this.restartCount}/${this.config.maxRestarts})...`));
        setTimeout(() => {
            this.startBot();
        }, delay);
    }
    startHealthMonitoring() {
        console.log(chalk_1.default.green('✅ Health monitoring started'));
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    performHealthCheck() {
        if (!this.botProcess || this.isShuttingDown) {
            return;
        }
        // Check if process is still running
        if (this.botProcess.killed || this.botProcess.exitCode !== null) {
            console.log(chalk_1.default.red('⚠️ Health check failed: Bot process not running'));
            return;
        }
        // Log health check
        const timestamp = new Date().toISOString();
        console.log(chalk_1.default.blue(`💓 Health check passed - ${timestamp}`));
        // Check memory usage
        const memUsage = process.memoryUsage();
        const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        if (memUsageMB > 2000) { // 2GB threshold
            console.log(chalk_1.default.yellow(`⚠️ High memory usage detected: ${memUsageMB}MB`));
        }
    }
    setupShutdownHandlers() {
        const gracefulShutdown = async (signal) => {
            console.log(chalk_1.default.yellow(`\n🛑 Received ${signal}, initiating graceful shutdown...`));
            await this.shutdown();
        };
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error(chalk_1.default.red('💥 Uncaught Exception:'), error);
            await this.shutdown();
            process.exit(1);
        });
        process.on('unhandledRejection', async (reason, promise) => {
            console.error(chalk_1.default.red('💥 Unhandled Rejection:'), { reason, promise });
            await this.shutdown();
            process.exit(1);
        });
    }
    async shutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        console.log(chalk_1.default.yellow('📊 Generating final reports...'));
        // Stop health monitoring
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        // Gracefully stop the bot
        if (this.botProcess && !this.botProcess.killed) {
            console.log(chalk_1.default.yellow('🛑 Stopping bot process...'));
            // Send SIGTERM for graceful shutdown
            this.botProcess.kill('SIGTERM');
            // Wait up to 30 seconds for graceful shutdown
            const shutdownTimeout = setTimeout(() => {
                if (this.botProcess && !this.botProcess.killed) {
                    console.log(chalk_1.default.red('⚠️ Force killing bot process...'));
                    this.botProcess.kill('SIGKILL');
                }
            }, 30000);
            // Wait for process to exit
            await new Promise((resolve) => {
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
        console.log(chalk_1.default.green('✅ Graceful shutdown completed'));
    }
    async cleanup() {
        // Perform any necessary cleanup
        console.log(chalk_1.default.yellow('🧹 Performing cleanup...'));
        // Log final statistics
        console.log(chalk_1.default.blue('📊 Final Statistics:'));
        console.log(chalk_1.default.gray(`  • Uptime: ${process.uptime().toFixed(0)} seconds`));
        console.log(chalk_1.default.gray(`  • Restart count: ${this.restartCount}`));
        console.log(chalk_1.default.gray(`  • Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`));
        console.log(chalk_1.default.green('✅ Cleanup completed'));
    }
    keepAlive() {
        // Keep the main process running
        const keepAliveInterval = setInterval(() => {
            if (this.isShuttingDown) {
                clearInterval(keepAliveInterval);
            }
            // Process is kept alive by this interval
        }, 1000);
    }
}
exports.ProductionLauncher = ProductionLauncher;
// CLI handling
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};
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
                    console.log(chalk_1.default.yellow(`Unknown argument: ${arg}`));
                }
                break;
        }
    }
    return config;
}
function displayHelp() {
    console.log(chalk_1.default.cyan(`\n🚀 ARBBot2025 Production Launch Tool\n`));
    console.log(chalk_1.default.white('Usage: ts-node scripts/production-launch.ts [options]\n'));
    console.log(chalk_1.default.yellow('Options:'));
    console.log(chalk_1.default.white('  --skip-validation    Skip production readiness validation (not recommended)'));
    console.log(chalk_1.default.white('  --dry-run           Launch in simulation mode (no real trades)'));
    console.log(chalk_1.default.white('  --log-level LEVEL   Set log level (debug, info, warn, error)'));
    console.log(chalk_1.default.white('  --no-restart        Disable automatic restart on failure'));
    console.log(chalk_1.default.white('  --max-restarts NUM  Maximum number of restart attempts (default: 5)'));
    console.log(chalk_1.default.white('  --help              Display this help message'));
    console.log(chalk_1.default.white('\nExamples:'));
    console.log(chalk_1.default.gray('  ts-node scripts/production-launch.ts'));
    console.log(chalk_1.default.gray('  ts-node scripts/production-launch.ts --dry-run'));
    console.log(chalk_1.default.gray('  ts-node scripts/production-launch.ts --log-level debug --max-restarts 10'));
    console.log(chalk_1.default.gray('  npm run production:launch\n'));
}
// Main execution
async function main() {
    const config = parseArgs();
    const launcher = new ProductionLauncher(config);
    try {
        await launcher.launch();
    }
    catch (error) {
        console.error(chalk_1.default.red('Launch failed:', error));
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
