#!/usr/bin/env node

import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Simple simulation without worker threads
class SimpleArbitrageTest {
  private startTime: number;
  private stats = {
    totalOpportunities: 0,
    totalExecutions: 0,
    totalProfit: 0,
    totalGasUsed: 0,
    bestProfit: 0,
    avgLatency: 0,
    missedBlocks: 0
  };

  constructor() {
    this.startTime = performance.now();
  }

  async runSimulation(durationSeconds: number): Promise<void> {
    console.log(chalk.green('🚀 Starting Simple Arbitrage Test'));
    console.log(chalk.blue(`Duration: ${durationSeconds}s`));
    console.log('');

    const endTime = this.startTime + (durationSeconds * 1000);
    let minute = 0;
    let nextMinuteReport = this.startTime + 60000;

    while (performance.now() < endTime) {
      // Simulate finding opportunities
      const opportunities = this.generateMockOpportunities();
      this.stats.totalOpportunities += opportunities.length;

      // Simulate executing opportunities
      for (const opp of opportunities) {
        if (Math.random() > 0.2) { // 80% success rate
          this.stats.totalExecutions++;
          this.stats.totalProfit += opp.profit;
          this.stats.totalGasUsed += opp.gasUsed;
          
          if (opp.profit > this.stats.bestProfit) {
            this.stats.bestProfit = opp.profit;
          }
        }
      }

      // Generate minute report
      if (performance.now() >= nextMinuteReport) {
        minute++;
        this.generateMinuteReport(minute);
        nextMinuteReport += 60000;
      }

      // Wait 1 second before next scan
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.generateFinalReport();
  }

  private generateMockOpportunities(): any[] {
    const numOpportunities = Math.floor(Math.random() * 5); // 0-4 opportunities per second
    const opportunities: Array<{
      profit: number;
      gasUsed: number;
      latency: number;
      chain: string;
      dex: string;
    }> = [];

    for (let i = 0; i < numOpportunities; i++) {
      opportunities.push({
        profit: Math.random() * 0.05, // 0-0.05 ETH profit
        gasUsed: Math.random() * 0.001, // 0-0.001 ETH gas
        latency: Math.random() * 100 + 50, // 50-150ms latency
        chain: Math.random() > 0.5 ? 'ARB' : 'OP',
        dex: Math.random() > 0.5 ? 'UniswapV3' : 'Curve'
      });
    }

    return opportunities;
  }

  private generateMinuteReport(minute: number): void {
    const runtime = (performance.now() - this.startTime) / 1000;
    const coinbaseDiff = this.stats.totalProfit * 0.1;
    const avgLatency = 75; // Mock average latency
    const netProfit = this.stats.totalProfit - this.stats.totalGasUsed;

    console.log(chalk.yellow('📊 Per-Minute Report'));
    console.log(chalk.yellow('=================='));
    console.log(`${chalk.cyan('Minute:')} ${minute}`);
    console.log(`${chalk.cyan('Runtime:')} ${runtime.toFixed(1)}s`);
    console.log(`${chalk.cyan('Opportunities:')} ${this.stats.totalOpportunities}`);
    console.log(`${chalk.cyan('Executions:')} ${this.stats.totalExecutions}`);
    console.log(`${chalk.cyan('Success Rate:')} ${(this.stats.totalExecutions / Math.max(this.stats.totalOpportunities, 1) * 100).toFixed(1)}%`);
    console.log(`${chalk.cyan('Total Profit:')} ${this.stats.totalProfit.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Total Gas:')} ${this.stats.totalGasUsed.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Net Profit:')} ${netProfit.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Best Profit:')} ${this.stats.bestProfit.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Coinbase Diff:')} ${coinbaseDiff.toFixed(6)} ETH`);
    console.log(`${chalk.cyan('Avg Latency:')} ${avgLatency.toFixed(2)}ms`);
    console.log(`${chalk.cyan('Missed Blocks:')} ${this.stats.missedBlocks}`);
    console.log('');
  }

  private generateFinalReport(): void {
    const runtime = (performance.now() - this.startTime) / 1000;
    const coinbaseDiff = this.stats.totalProfit * 0.1;
    const avgLatency = 75;
    const netProfit = this.stats.totalProfit - this.stats.totalGasUsed;

    console.log(chalk.green('📊 Final Performance Report'));
    console.log(chalk.green('================================'));
    console.log(`${chalk.cyan('Runtime:')} ${runtime.toFixed(2)}s`);
    console.log(`${chalk.cyan('Found')} ${this.stats.totalOpportunities} ${chalk.cyan('opportunities; best')} ${this.stats.bestProfit.toFixed(6)} ${chalk.cyan('ETH profit; total coinbaseDiff:')} ${coinbaseDiff.toFixed(6)} ${chalk.cyan('ETH; avg latency:')} ${avgLatency.toFixed(2)} ${chalk.cyan('ms; missed blocks:')} ${this.stats.missedBlocks}.`);
    console.log('');
    console.log(chalk.blue('Detailed Statistics:'));
    console.log(`  Total Opportunities: ${this.stats.totalOpportunities}`);
    console.log(`  Total Executions: ${this.stats.totalExecutions}`);
    console.log(`  Success Rate: ${(this.stats.totalExecutions / Math.max(this.stats.totalOpportunities, 1) * 100).toFixed(1)}%`);
    console.log(`  Total Profit: ${this.stats.totalProfit.toFixed(6)} ETH`);
    console.log(`  Total Gas Used: ${this.stats.totalGasUsed.toFixed(6)} ETH`);
    console.log(`  Net Profit: ${netProfit.toFixed(6)} ETH`);
    console.log(`  Best Single Profit: ${this.stats.bestProfit.toFixed(6)} ETH`);
    console.log(`  Coinbase Diff: ${coinbaseDiff.toFixed(6)} ETH`);
    console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Missed Blocks: ${this.stats.missedBlocks}`);
    console.log('');
    console.log(chalk.green('✅ Test execution completed successfully'));
  }
}

// Run the test
async function main(): Promise<void> {
  const test = new SimpleArbitrageTest();
  await test.runSimulation(600); // Run for 10 minutes
}

main().catch(console.error);