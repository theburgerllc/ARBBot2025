import { ethers } from "ethers";
import dotenv from "dotenv";
import chalk from "chalk";
import winston from "winston";

import uniswapV2RouterABI from "../abi/UniswapV2Router.json";
import sushiSwapRouterABI from "../abi/SushiSwapRouter.json";

dotenv.config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

class ArbitrageSimulator {
  private provider: ethers.JsonRpcProvider;
  private uniswapV2Router: ethers.Contract;
  private sushiSwapRouter: ethers.Contract;
  
  private readonly WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Arbitrum WETH
  private readonly USDC_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"; // Arbitrum USDC
  private readonly USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"; // Arbitrum USDT
  private readonly DAI_ADDRESS = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";  // Arbitrum DAI

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ARB_RPC!);
    
    this.uniswapV2Router = new ethers.Contract(
      process.env.UNISWAP_V2_ROUTER_ADDRESS!,
      uniswapV2RouterABI,
      this.provider
    );
    
    this.sushiSwapRouter = new ethers.Contract(
      process.env.SUSHI_ROUTER_ADDRESS!,
      sushiSwapRouterABI,
      this.provider
    );
  }

  async simulateArbitrage(
    amount: bigint,
    path: string[],
    sushiFirst: boolean
  ): Promise<{
    profit: bigint;
    profitPercentage: number;
    amounts1: bigint[];
    amounts2: bigint[];
    finalAmount: bigint;
  }> {
    try {
      let amounts1: bigint[], amounts2: bigint[];
      
      if (sushiFirst) {
        amounts1 = await this.sushiSwapRouter.getAmountsOut(amount, path);
        amounts2 = await this.uniswapV2Router.getAmountsOut(
          amounts1[amounts1.length - 1],
          path.slice().reverse()
        );
      } else {
        amounts1 = await this.uniswapV2Router.getAmountsOut(amount, path);
        amounts2 = await this.sushiSwapRouter.getAmountsOut(
          amounts1[amounts1.length - 1],
          path.slice().reverse()
        );
      }
      
      const finalAmount = amounts2[amounts2.length - 1];
      const profit = finalAmount > amount ? finalAmount - amount : 0n;
      const profitPercentage = Number(profit * 10000n / amount) / 100;
      
      return {
        profit,
        profitPercentage,
        amounts1,
        amounts2,
        finalAmount
      };
      
    } catch (error) {
      logger.error(chalk.red("Error simulating arbitrage:"), error);
      throw error;
    }
  }

  async scanAllPairs() {
    logger.info(chalk.blue("🔍 Scanning all token pairs for arbitrage opportunities..."));
    
    const tokens = [
      { address: this.WETH_ADDRESS, symbol: "WETH", decimals: 18 },
      { address: this.USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      { address: this.USDT_ADDRESS, symbol: "USDT", decimals: 6 },
      { address: this.DAI_ADDRESS, symbol: "DAI", decimals: 18 }
    ];
    
    const amounts = [
      ethers.parseEther("1"),
      ethers.parseEther("5"),
      ethers.parseEther("10"),
      ethers.parseEther("25")
    ];
    
    const opportunities = [];
    
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const tokenA = tokens[i];
        const tokenB = tokens[j];
        const path = [tokenA.address, tokenB.address];
        
        logger.info(chalk.gray(`Checking ${tokenA.symbol} -> ${tokenB.symbol}`));
        
        for (const amount of amounts) {
          // Adjust amount based on token decimals
          const adjustedAmount = tokenA.decimals === 18 ? amount : amount / BigInt(10 ** (18 - tokenA.decimals));
          
          try {
            // Test Sushi -> Uniswap
            const result1 = await this.simulateArbitrage(adjustedAmount, path, true);
            if (result1.profit > 0n) {
              opportunities.push({
                tokenA: tokenA.symbol,
                tokenB: tokenB.symbol,
                path,
                amount: adjustedAmount,
                profit: result1.profit,
                profitPercentage: result1.profitPercentage,
                sushiFirst: true,
                direction: `${tokenA.symbol} -> ${tokenB.symbol} (Sushi -> Uniswap)`
              });
            }
            
            // Test Uniswap -> Sushi
            const result2 = await this.simulateArbitrage(adjustedAmount, path, false);
            if (result2.profit > 0n) {
              opportunities.push({
                tokenA: tokenA.symbol,
                tokenB: tokenB.symbol,
                path,
                amount: adjustedAmount,
                profit: result2.profit,
                profitPercentage: result2.profitPercentage,
                sushiFirst: false,
                direction: `${tokenA.symbol} -> ${tokenB.symbol} (Uniswap -> Sushi)`
              });
            }
            
          } catch (error) {
            logger.error(chalk.red(`Error checking ${tokenA.symbol} -> ${tokenB.symbol}:`), error);
          }
        }
      }
    }
    
    // Sort by profit percentage
    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
    
    return opportunities;
  }

  async displayOpportunities() {
    const opportunities = await this.scanAllPairs();
    
    if (opportunities.length === 0) {
      logger.info(chalk.yellow("No arbitrage opportunities found"));
      return;
    }
    
    logger.info(chalk.green(`\n📊 Found ${opportunities.length} arbitrage opportunities:`));
    logger.info(chalk.green("=" .repeat(80)));
    
    opportunities.forEach((opp, index) => {
      const amountStr = ethers.formatEther(opp.amount.toString());
      const profitStr = ethers.formatEther(opp.profit.toString());
      
      logger.info(chalk.cyan(`${index + 1}. ${opp.direction}`));
      logger.info(chalk.white(`   Amount: ${amountStr} ${opp.tokenA}`));
      logger.info(chalk.green(`   Profit: ${profitStr} ${opp.tokenA} (${opp.profitPercentage.toFixed(4)}%)`));
      logger.info(chalk.gray(`   Sushi First: ${opp.sushiFirst}`));
      logger.info("");
    });
    
    // Show summary
    const totalProfit = opportunities.reduce((sum, opp) => sum + opp.profit, 0n);
    const avgProfitPercentage = opportunities.reduce((sum, opp) => sum + opp.profitPercentage, 0) / opportunities.length;
    
    logger.info(chalk.blue("📈 Summary:"));
    logger.info(chalk.blue(`   Total Opportunities: ${opportunities.length}`));
    logger.info(chalk.blue(`   Total Potential Profit: ${ethers.formatEther(totalProfit.toString())} ETH`));
    logger.info(chalk.blue(`   Average Profit %: ${avgProfitPercentage.toFixed(4)}%`));
    logger.info(chalk.blue(`   Best Opportunity: ${opportunities[0].profitPercentage.toFixed(4)}%`));
  }

  async testSpecificPair(tokenA: string, tokenB: string, amount: string) {
    logger.info(chalk.blue(`\n🧪 Testing specific pair: ${tokenA} -> ${tokenB}`));
    
    const tokenAddresses = {
      WETH: this.WETH_ADDRESS,
      USDC: this.USDC_ADDRESS,
      USDT: this.USDT_ADDRESS,
      DAI: this.DAI_ADDRESS
    };
    
    const tokenAAddress = tokenAddresses[tokenA as keyof typeof tokenAddresses];
    const tokenBAddress = tokenAddresses[tokenB as keyof typeof tokenAddresses];
    
    if (!tokenAAddress || !tokenBAddress) {
      logger.error(chalk.red("Invalid token symbols. Use: WETH, USDC, USDT, DAI"));
      return;
    }
    
    const path = [tokenAAddress, tokenBAddress];
    const amountBigInt = ethers.parseEther(amount);
    
    try {
      // Test both directions
      const result1 = await this.simulateArbitrage(amountBigInt, path, true);
      const result2 = await this.simulateArbitrage(amountBigInt, path, false);
      
      logger.info(chalk.green("\n📊 Results:"));
      logger.info(chalk.green("=" .repeat(50)));
      
      logger.info(chalk.cyan("Sushi -> Uniswap:"));
      logger.info(chalk.white(`  Input: ${amount} ${tokenA}`));
      logger.info(chalk.white(`  Final: ${ethers.formatEther(result1.finalAmount)} ${tokenA}`));
      logger.info(chalk.white(`  Profit: ${ethers.formatEther(result1.profit)} ${tokenA}`));
      logger.info(chalk.white(`  Profit %: ${result1.profitPercentage.toFixed(4)}%`));
      
      logger.info(chalk.cyan("\nUniswap -> Sushi:"));
      logger.info(chalk.white(`  Input: ${amount} ${tokenA}`));
      logger.info(chalk.white(`  Final: ${ethers.formatEther(result2.finalAmount)} ${tokenA}`));
      logger.info(chalk.white(`  Profit: ${ethers.formatEther(result2.profit)} ${tokenA}`));
      logger.info(chalk.white(`  Profit %: ${result2.profitPercentage.toFixed(4)}%`));
      
      const bestDirection = result1.profit > result2.profit ? "Sushi -> Uniswap" : "Uniswap -> Sushi";
      const bestProfit = result1.profit > result2.profit ? result1.profit : result2.profit;
      
      logger.info(chalk.green(`\n🏆 Best Direction: ${bestDirection}`));
      logger.info(chalk.green(`💰 Best Profit: ${ethers.formatEther(bestProfit)} ${tokenA}`));
      
    } catch (error) {
      logger.error(chalk.red("Error testing pair:"), error);
    }
  }
}

async function main() {
  const simulator = new ArbitrageSimulator();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Scan all pairs
    await simulator.displayOpportunities();
  } else if (args.length === 3) {
    // Test specific pair
    const [tokenA, tokenB, amount] = args;
    await simulator.testSpecificPair(tokenA, tokenB, amount);
  } else {
    logger.info(chalk.yellow("Usage:"));
    logger.info(chalk.yellow("  npm run bot:simulate                    # Scan all pairs"));
    logger.info(chalk.yellow("  npm run bot:simulate WETH USDC 10      # Test specific pair"));
  }
}

main().catch((error) => {
  logger.error(chalk.red("Simulation failed:"), error);
  process.exit(1);
});