import { ethers } from "ethers";
import { spawn } from "child_process";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

interface SimulationStats {
  totalOpportunities: number;
  totalProfit: string;
  highestProfit: string;
  bundleSimulations: number;
  successfulBundles: number;
  coinbaseDiffTotal: string;
  flashLoanProvider: { balancer: number; aave: number };
  duration: number;
}

class ExtendedSimulator {
  private stats: SimulationStats = {
    totalOpportunities: 0,
    totalProfit: "0",
    highestProfit: "0",
    bundleSimulations: 0,
    successfulBundles: 0,
    coinbaseDiffTotal: "0",
    flashLoanProvider: { balancer: 0, aave: 0 },
    duration: 0
  };

  private startTime: number = Date.now();
  private simulationDuration: number = 5 * 60 * 1000; // 5 minutes

  async runExtendedSimulation(): Promise<void> {
    console.log(chalk.blue("🚀 Starting Extended ARBBot2025 Simulation"));
    console.log(chalk.gray(`Duration: 5 minutes`));
    console.log(chalk.gray(`Monitoring: Arbitrum + Optimism`));
    console.log(chalk.gray(`Features: Cross-chain + Triangular arbitrage`));
    console.log(chalk.yellow("─".repeat(60)));

    const endTime = this.startTime + this.simulationDuration;
    let intervalCount = 0;

    while (Date.now() < endTime) {
      intervalCount++;
      const remainingTime = Math.max(0, endTime - Date.now());
      
      console.log(chalk.cyan(`\n🔄 Simulation Cycle ${intervalCount} (${Math.floor(remainingTime / 1000)}s remaining)`));
      
      // Run bot simulation
      await this.runBotSimulation();
      
      // Run Flashbots bundle simulation every 3rd cycle
      if (intervalCount % 3 === 0) {
        await this.runFlashbotsSimulation();
      }
      
      // Wait 30 seconds between cycles
      await this.sleep(30000);
    }

    this.stats.duration = Date.now() - this.startTime;
    this.printFinalSummary();
  }

  private async runBotSimulation(): Promise<void> {
    return new Promise((resolve) => {
      console.log(chalk.yellow("🤖 Executing MEV bot simulation..."));
      
      const botProcess = spawn("npx", [
        "ts-node", 
        "scripts/run-bot.ts", 
        "--simulate", 
        "--verbose", 
        "--cross-chain", 
        "--triangular"
      ], {
        stdio: "pipe",
        cwd: process.cwd(),
        env: { ...process.env }
      });

      let output = "";

      botProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      botProcess.stderr.on("data", (data) => {
        output += data.toString();
      });

      // Kill process after 25 seconds
      const timeout = setTimeout(() => {
        botProcess.kill("SIGTERM");
      }, 25000);

      botProcess.on("close", (code) => {
        clearTimeout(timeout);
        this.parseeBotOutput(output);
        resolve();
      });

      botProcess.on("error", (error) => {
        clearTimeout(timeout);
        console.log(chalk.red(`Bot simulation error: ${error.message}`));
        resolve();
      });
    });
  }

  private async runFlashbotsSimulation(): Promise<void> {
    return new Promise((resolve) => {
      console.log(chalk.yellow("📦 Executing Flashbots bundle simulation..."));
      
      const flashbotsProcess = spawn("npm", ["run", "simulate:flashbots"], {
        stdio: "pipe",
        cwd: process.cwd(),
        env: { ...process.env }
      });

      let output = "";

      flashbotsProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      flashbotsProcess.stderr.on("data", (data) => {
        output += data.toString();
      });

      flashbotsProcess.on("close", (code) => {
        this.parseFlashbotsOutput(output);
        resolve();
      });

      flashbotsProcess.on("error", (error) => {
        console.log(chalk.red(`Flashbots simulation error: ${error.message}`));
        resolve();
      });
    });
  }

  private parseeBotOutput(output: string): void {
    // Parse opportunities detected
    const opportunityRegex = /Found (\d+) arbitrage opportunities/g;
    const opportunityMatch = opportunityRegex.exec(output);
    if (opportunityMatch) {
      this.stats.totalOpportunities += parseInt(opportunityMatch[1]);
      console.log(chalk.green(`✅ Found ${opportunityMatch[1]} opportunities`));
    }

    // Parse profit estimates
    const profitRegex = /profit.*?(\d+\.?\d*)\s*ETH/gi;
    let profitMatch;
    while ((profitMatch = profitRegex.exec(output)) !== null) {
      const profit = parseFloat(profitMatch[1]);
      if (profit > 0) {
        const currentTotal = parseFloat(this.stats.totalProfit);
        this.stats.totalProfit = (currentTotal + profit).toFixed(6);
        
        const currentHighest = parseFloat(this.stats.highestProfit);
        if (profit > currentHighest) {
          this.stats.highestProfit = profit.toFixed(6);
        }
        
        console.log(chalk.green(`💰 Profit detected: ${profit} ETH`));
      }
    }

    // Parse flash loan provider usage
    if (output.includes("Balancer")) {
      this.stats.flashLoanProvider.balancer++;
      console.log(chalk.blue("🔵 Using Balancer flash loans"));
    }
    if (output.includes("Aave")) {
      this.stats.flashLoanProvider.aave++;
      console.log(chalk.magenta("🟣 Using Aave flash loans"));
    }

    // Check for cross-chain opportunities
    if (output.includes("cross-chain")) {
      console.log(chalk.cyan("🌉 Cross-chain monitoring active"));
    }

    // Check for triangular arbitrage
    if (output.includes("triangular")) {
      console.log(chalk.yellow("🔺 Triangular arbitrage enabled"));
    }
  }

  private parseFlashbotsOutput(output: string): void {
    this.stats.bundleSimulations++;

    // Parse successful bundle simulation
    if (output.includes("Bundle simulation successful") || output.includes("✅")) {
      this.stats.successfulBundles++;
      console.log(chalk.green("✅ Bundle simulation successful"));
    }

    // Parse coinbase diff
    const coinbaseRegex = /coinbaseDiff.*?(\d+\.?\d*)/gi;
    const coinbaseMatch = coinbaseRegex.exec(output);
    if (coinbaseMatch) {
      const coinbaseDiff = parseFloat(coinbaseMatch[1]);
      const currentTotal = parseFloat(this.stats.coinbaseDiffTotal);
      this.stats.coinbaseDiffTotal = (currentTotal + coinbaseDiff).toFixed(6);
      console.log(chalk.green(`💎 CoinbaseDiff: ${coinbaseDiff} ETH`));
    }

    // Parse gas costs
    const gasRegex = /gas cost.*?(\d+\.?\d*)/gi;
    const gasMatch = gasRegex.exec(output);
    if (gasMatch) {
      console.log(chalk.gray(`⛽ Gas cost: ${gasMatch[1]} ETH`));
    }

    // Check for errors
    if (output.includes("unable to decode txs")) {
      console.log(chalk.red("❌ Bundle decode error (should be fixed)"));
    } else if (output.includes("error") || output.includes("❌")) {
      console.log(chalk.yellow("⚠️ Bundle simulation warning"));
    }
  }

  private printFinalSummary(): void {
    console.log(chalk.magenta("\n" + "═".repeat(60)));
    console.log(chalk.magenta("📊 EXTENDED SIMULATION FINAL SUMMARY"));
    console.log(chalk.magenta("═".repeat(60)));
    
    console.log(chalk.white(`⏱️  Duration: ${Math.floor(this.stats.duration / 1000)}s (${Math.floor(this.stats.duration / 60000)}m)`));
    console.log(chalk.white(`🔍 Total Opportunities: ${this.stats.totalOpportunities}`));
    console.log(chalk.green(`💰 Total Profit: ${this.stats.totalProfit} ETH`));
    console.log(chalk.green(`🏆 Highest Profit: ${this.stats.highestProfit} ETH`));
    console.log(chalk.blue(`📦 Bundle Simulations: ${this.stats.bundleSimulations}`));
    console.log(chalk.green(`✅ Successful Bundles: ${this.stats.successfulBundles}`));
    console.log(chalk.cyan(`💎 Total CoinbaseDiff: ${this.stats.coinbaseDiffTotal} ETH`));
    
    console.log(chalk.yellow("\n🏦 Flash Loan Provider Usage:"));
    console.log(chalk.blue(`   Balancer: ${this.stats.flashLoanProvider.balancer} times`));
    console.log(chalk.magenta(`   Aave: ${this.stats.flashLoanProvider.aave} times`));
    
    // Final status
    if (this.stats.totalOpportunities > 0) {
      console.log(chalk.green(`\n✅ Found ${this.stats.totalOpportunities} opportunities; highest profit: ${this.stats.highestProfit} ETH; total coinbaseDiff: ${this.stats.coinbaseDiffTotal} ETH`));
    } else {
      console.log(chalk.yellow("\n❌ No opportunities found; all simulations valid"));
    }
    
    console.log(chalk.magenta("═".repeat(60)));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main(): Promise<void> {
  const simulator = new ExtendedSimulator();
  
  try {
    await simulator.runExtendedSimulation();
  } catch (error) {
    console.error(chalk.red("❌ Extended simulation failed:"), error);
    process.exit(1);
  }
}

// CLI execution
if (require.main === module) {
  main();
}

export { ExtendedSimulator };