import chalk from "chalk";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface MonitoringStats {
  startTime: number;
  currentTime: number;
  durationMinutes: number;
  totalOpportunities: number;
  profitableOpportunities: number;
  currentProfit: string;
  lastCycleTime: string;
  memoryUsageMB: number;
  systemStatus: 'running' | 'idle' | 'error';
}

class DryRunMonitor {
  private monitoringActive = false;
  private stats: MonitoringStats = {
    startTime: Date.now(),
    currentTime: Date.now(),
    durationMinutes: 0,
    totalOpportunities: 0,
    profitableOpportunities: 0,
    currentProfit: '0.0000',
    lastCycleTime: 'N/A',
    memoryUsageMB: 0,
    systemStatus: 'idle'
  };

  async startMonitoring(): Promise<void> {
    console.log(chalk.blue('🔍 ARBBot2025 Dry Run Monitor Starting...\n'));
    this.monitoringActive = true;
    
    // Display header
    this.displayHeader();
    
    // Start monitoring loop
    const monitorInterval = setInterval(async () => {
      if (!this.monitoringActive) {
        clearInterval(monitorInterval);
        return;
      }
      
      await this.updateStats();
      this.displayStats();
      
    }, 5000); // Update every 5 seconds
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n📊 Monitoring stopped by user'));
      this.monitoringActive = false;
      clearInterval(monitorInterval);
      process.exit(0);
    });
  }
  
  private displayHeader(): void {
    console.clear();
    console.log(chalk.blue('════════════════════════════════════════════════════════════════'));
    console.log(chalk.blue('                 ARBBot2025 DRY RUN MONITOR                    '));
    console.log(chalk.blue('════════════════════════════════════════════════════════════════'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
  }
  
  private async updateStats(): Promise<void> {
    this.stats.currentTime = Date.now();
    this.stats.durationMinutes = (this.stats.currentTime - this.stats.startTime) / (1000 * 60);
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.stats.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Try to read latest log data
    await this.parseLogFiles();
    
    // Check if dry run process is still running
    await this.checkProcessStatus();
  }
  
  private async parseLogFiles(): Promise<void> {
    try {
      // Check for recent dry run log files
      const logFiles = await this.getRecentLogFiles();
      
      if (logFiles.length > 0) {
        const latestLog = logFiles[0];
        await this.parseLogFile(latestLog);
      }
      
    } catch (error) {
      // Logs not available yet, continue monitoring
    }
  }
  
  private async getRecentLogFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('find logs -name "mainnet-dry-run-*.json" -mmin -5 2>/dev/null || echo ""');
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      return [];
    }
  }
  
  private async parseLogFile(logFile: string): Promise<void> {
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const logData = JSON.parse(content);
      
      if (logData.summary) {
        this.stats.totalOpportunities = logData.summary.totalOpportunitiesDetected || 0;
        this.stats.profitableOpportunities = logData.summary.profitableOpportunities || 0;
        
        // Convert BigInt to string for display
        const profitBigInt = BigInt(logData.summary.totalEstimatedProfit || '0');
        this.stats.currentProfit = (Number(profitBigInt) / 1e18).toFixed(4);
      }
      
      if (logData.cycleResults && logData.cycleResults.length > 0) {
        const lastCycle = logData.cycleResults[logData.cycleResults.length - 1];
        this.stats.lastCycleTime = new Date(lastCycle.timestamp).toLocaleTimeString();
      }
      
    } catch (error) {
      // Log parsing failed, continue with current stats
    }
  }
  
  private async checkProcessStatus(): Promise<void> {
    try {
      // Check if mainnet-dry-run process is running
      const { stdout } = await execAsync('pgrep -f "mainnet-dry-run" || echo "none"');
      
      if (stdout.trim() === 'none') {
        this.stats.systemStatus = 'idle';
      } else {
        this.stats.systemStatus = 'running';
      }
      
    } catch (error) {
      this.stats.systemStatus = 'error';
    }
  }
  
  private displayStats(): void {
    // Clear previous stats (keep header)
    process.stdout.write('\x1b[8;1H'); // Move cursor to line 8
    process.stdout.write('\x1b[J');    // Clear from cursor to end
    
    const durationHours = this.stats.durationMinutes / 60;
    const successRate = this.stats.totalOpportunities > 0 ? 
      (this.stats.profitableOpportunities / this.stats.totalOpportunities * 100) : 0;
    
    // Status indicator
    const statusEmoji = this.stats.systemStatus === 'running' ? '🟢' : 
                       this.stats.systemStatus === 'idle' ? '🟡' : '🔴';
    
    console.log(chalk.cyan('📊 REAL-TIME STATISTICS'));
    console.log(chalk.cyan('========================'));
    console.log(chalk.white(`System Status: ${statusEmoji} ${this.stats.systemStatus.toUpperCase()}`));
    console.log(chalk.white(`Duration: ${durationHours.toFixed(2)} hours (${this.stats.durationMinutes.toFixed(1)} minutes)`));
    console.log(chalk.white(`Last Cycle: ${this.stats.lastCycleTime}`));
    console.log('');
    
    console.log(chalk.green('💰 OPPORTUNITY TRACKING'));
    console.log(chalk.green('========================'));
    console.log(chalk.white(`Total Opportunities: ${this.stats.totalOpportunities}`));
    console.log(chalk.white(`Profitable Opportunities: ${this.stats.profitableOpportunities}`));
    console.log(chalk.white(`Success Rate: ${successRate.toFixed(1)}% ${this.getPerformanceEmoji(successRate, 20)}`));
    console.log(chalk.white(`Estimated Profit: ${this.stats.currentProfit} ETH`));
    
    if (durationHours > 0) {
      const hourlyRate = parseFloat(this.stats.currentProfit) / durationHours;
      const projectedDaily = hourlyRate * 24;
      const projectedMonthly = projectedDaily * 30;
      
      console.log(chalk.white(`Hourly Rate: ${hourlyRate.toFixed(4)} ETH/hour`));
      console.log(chalk.white(`Projected Daily: ${projectedDaily.toFixed(3)} ETH/day`));
      console.log(chalk.white(`Projected Monthly: ${projectedMonthly.toFixed(1)} ETH/month ${this.getPerformanceEmoji(projectedMonthly, 5)}`));
    }
    console.log('');
    
    console.log(chalk.gray('🖥️ SYSTEM RESOURCES'));
    console.log(chalk.gray('==================='));
    console.log(chalk.white(`Memory Usage: ${this.stats.memoryUsageMB}MB ${this.getResourceEmoji(this.stats.memoryUsageMB, 1000)}`));
    console.log(chalk.white(`CPU Load: ${this.getCPUUsage()}%`));
    console.log('');
    
    // Progress indicators
    this.displayProgressIndicators(durationHours);
    
    console.log(chalk.blue('────────────────────────────────────────────────────────────────'));
    console.log(chalk.gray(`Last Updated: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.gray('Monitoring... Press Ctrl+C to stop'));
  }
  
  private displayProgressIndicators(durationHours: number): void {
    const targetDuration = parseFloat(process.env.DRY_RUN_DURATION_HOURS || '4');
    const progress = Math.min(durationHours / targetDuration * 100, 100);
    
    console.log(chalk.yellow('⏱️ PROGRESS TRACKING'));
    console.log(chalk.yellow('===================='));
    console.log(chalk.white(`Duration Progress: ${this.createProgressBar(progress, 30)} ${progress.toFixed(1)}%`));
    
    if (this.stats.totalOpportunities > 0) {
      const targetOpportunities = Math.max(50, this.stats.totalOpportunities); // Dynamic target
      const opportunityProgress = Math.min(this.stats.totalOpportunities / targetOpportunities * 100, 100);
      console.log(chalk.white(`Opportunity Progress: ${this.createProgressBar(opportunityProgress, 30)} ${opportunityProgress.toFixed(1)}%`));
    }
    
    console.log('');
  }
  
  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round(percentage / 100 * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
  
  private getPerformanceEmoji(value: number, threshold: number): string {
    if (value >= threshold * 1.5) return '🔥'; // Excellent
    if (value >= threshold) return '✅';      // Good
    if (value >= threshold * 0.7) return '⚠️';  // Warning
    return '❌';                              // Poor
  }
  
  private getResourceEmoji(value: number, threshold: number): string {
    if (value >= threshold * 2) return '🔴'; // High usage
    if (value >= threshold) return '🟡';     // Medium usage
    return '🟢';                           // Low usage
  }
  
  private getCPUUsage(): string {
    // Simplified CPU usage estimation based on memory growth
    const baseUsage = Math.min(this.stats.memoryUsageMB / 10, 100);
    return baseUsage.toFixed(1);
  }
}

// Command line interface
async function main() {
  const monitor = new DryRunMonitor();
  
  console.log(chalk.blue('🚀 Starting ARBBot2025 Dry Run Monitor...'));
  console.log(chalk.gray('This will monitor the dry run in real-time\n'));
  
  try {
    await monitor.startMonitoring();
  } catch (error) {
    console.error(chalk.red('❌ Monitoring failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DryRunMonitor };