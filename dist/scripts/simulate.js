"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const winston_1 = __importDefault(require("winston"));
const UniswapV2Router_json_1 = __importDefault(require("../abi/UniswapV2Router.json"));
const SushiSwapRouter_json_1 = __importDefault(require("../abi/SushiSwapRouter.json"));
dotenv_1.default.config();
const logger = winston_1.default.createLogger({
    level: "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.simple()),
    transports: [new winston_1.default.transports.Console()]
});
class ArbitrageSimulator {
    provider;
    uniswapV2Router;
    sushiSwapRouter;
    WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Arbitrum WETH
    USDC_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"; // Arbitrum USDC
    USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"; // Arbitrum USDT
    DAI_ADDRESS = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"; // Arbitrum DAI
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        this.uniswapV2Router = new ethers_1.ethers.Contract(process.env.UNISWAP_V2_ROUTER_ADDRESS, UniswapV2Router_json_1.default, this.provider);
        this.sushiSwapRouter = new ethers_1.ethers.Contract(process.env.SUSHI_ROUTER_ADDRESS, SushiSwapRouter_json_1.default, this.provider);
    }
    async simulateArbitrage(amount, path, sushiFirst) {
        try {
            let amounts1, amounts2;
            if (sushiFirst) {
                amounts1 = await this.sushiSwapRouter.getAmountsOut(amount, path);
                amounts2 = await this.uniswapV2Router.getAmountsOut(amounts1[amounts1.length - 1], path.slice().reverse());
            }
            else {
                amounts1 = await this.uniswapV2Router.getAmountsOut(amount, path);
                amounts2 = await this.sushiSwapRouter.getAmountsOut(amounts1[amounts1.length - 1], path.slice().reverse());
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
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error simulating arbitrage:"), error);
            throw error;
        }
    }
    async scanAllPairs() {
        logger.info(chalk_1.default.blue("🔍 Scanning all token pairs for arbitrage opportunities..."));
        const tokens = [
            { address: this.WETH_ADDRESS, symbol: "WETH", decimals: 18 },
            { address: this.USDC_ADDRESS, symbol: "USDC", decimals: 6 },
            { address: this.USDT_ADDRESS, symbol: "USDT", decimals: 6 },
            { address: this.DAI_ADDRESS, symbol: "DAI", decimals: 18 }
        ];
        const amounts = [
            ethers_1.ethers.parseEther("1"),
            ethers_1.ethers.parseEther("5"),
            ethers_1.ethers.parseEther("10"),
            ethers_1.ethers.parseEther("25")
        ];
        const opportunities = [];
        for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
                const tokenA = tokens[i];
                const tokenB = tokens[j];
                const path = [tokenA.address, tokenB.address];
                logger.info(chalk_1.default.gray(`Checking ${tokenA.symbol} -> ${tokenB.symbol}`));
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
                    }
                    catch (error) {
                        logger.error(chalk_1.default.red(`Error checking ${tokenA.symbol} -> ${tokenB.symbol}:`), error);
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
            logger.info(chalk_1.default.yellow("No arbitrage opportunities found"));
            return;
        }
        logger.info(chalk_1.default.green(`\n📊 Found ${opportunities.length} arbitrage opportunities:`));
        logger.info(chalk_1.default.green("=".repeat(80)));
        opportunities.forEach((opp, index) => {
            const amountStr = ethers_1.ethers.formatEther(opp.amount.toString());
            const profitStr = ethers_1.ethers.formatEther(opp.profit.toString());
            logger.info(chalk_1.default.cyan(`${index + 1}. ${opp.direction}`));
            logger.info(chalk_1.default.white(`   Amount: ${amountStr} ${opp.tokenA}`));
            logger.info(chalk_1.default.green(`   Profit: ${profitStr} ${opp.tokenA} (${opp.profitPercentage.toFixed(4)}%)`));
            logger.info(chalk_1.default.gray(`   Sushi First: ${opp.sushiFirst}`));
            logger.info("");
        });
        // Show summary
        const totalProfit = opportunities.reduce((sum, opp) => sum + opp.profit, 0n);
        const avgProfitPercentage = opportunities.reduce((sum, opp) => sum + opp.profitPercentage, 0) / opportunities.length;
        logger.info(chalk_1.default.blue("📈 Summary:"));
        logger.info(chalk_1.default.blue(`   Total Opportunities: ${opportunities.length}`));
        logger.info(chalk_1.default.blue(`   Total Potential Profit: ${ethers_1.ethers.formatEther(totalProfit.toString())} ETH`));
        logger.info(chalk_1.default.blue(`   Average Profit %: ${avgProfitPercentage.toFixed(4)}%`));
        logger.info(chalk_1.default.blue(`   Best Opportunity: ${opportunities[0].profitPercentage.toFixed(4)}%`));
    }
    async testSpecificPair(tokenA, tokenB, amount) {
        logger.info(chalk_1.default.blue(`\n🧪 Testing specific pair: ${tokenA} -> ${tokenB}`));
        const tokenAddresses = {
            WETH: this.WETH_ADDRESS,
            USDC: this.USDC_ADDRESS,
            USDT: this.USDT_ADDRESS,
            DAI: this.DAI_ADDRESS
        };
        const tokenAAddress = tokenAddresses[tokenA];
        const tokenBAddress = tokenAddresses[tokenB];
        if (!tokenAAddress || !tokenBAddress) {
            logger.error(chalk_1.default.red("Invalid token symbols. Use: WETH, USDC, USDT, DAI"));
            return;
        }
        const path = [tokenAAddress, tokenBAddress];
        const amountBigInt = ethers_1.ethers.parseEther(amount);
        try {
            // Test both directions
            const result1 = await this.simulateArbitrage(amountBigInt, path, true);
            const result2 = await this.simulateArbitrage(amountBigInt, path, false);
            logger.info(chalk_1.default.green("\n📊 Results:"));
            logger.info(chalk_1.default.green("=".repeat(50)));
            logger.info(chalk_1.default.cyan("Sushi -> Uniswap:"));
            logger.info(chalk_1.default.white(`  Input: ${amount} ${tokenA}`));
            logger.info(chalk_1.default.white(`  Final: ${ethers_1.ethers.formatEther(result1.finalAmount)} ${tokenA}`));
            logger.info(chalk_1.default.white(`  Profit: ${ethers_1.ethers.formatEther(result1.profit)} ${tokenA}`));
            logger.info(chalk_1.default.white(`  Profit %: ${result1.profitPercentage.toFixed(4)}%`));
            logger.info(chalk_1.default.cyan("\nUniswap -> Sushi:"));
            logger.info(chalk_1.default.white(`  Input: ${amount} ${tokenA}`));
            logger.info(chalk_1.default.white(`  Final: ${ethers_1.ethers.formatEther(result2.finalAmount)} ${tokenA}`));
            logger.info(chalk_1.default.white(`  Profit: ${ethers_1.ethers.formatEther(result2.profit)} ${tokenA}`));
            logger.info(chalk_1.default.white(`  Profit %: ${result2.profitPercentage.toFixed(4)}%`));
            const bestDirection = result1.profit > result2.profit ? "Sushi -> Uniswap" : "Uniswap -> Sushi";
            const bestProfit = result1.profit > result2.profit ? result1.profit : result2.profit;
            logger.info(chalk_1.default.green(`\n🏆 Best Direction: ${bestDirection}`));
            logger.info(chalk_1.default.green(`💰 Best Profit: ${ethers_1.ethers.formatEther(bestProfit)} ${tokenA}`));
        }
        catch (error) {
            logger.error(chalk_1.default.red("Error testing pair:"), error);
        }
    }
}
async function main() {
    const simulator = new ArbitrageSimulator();
    const args = process.argv.slice(2);
    if (args.length === 0) {
        // Scan all pairs
        await simulator.displayOpportunities();
    }
    else if (args.length === 3) {
        // Test specific pair
        const [tokenA, tokenB, amount] = args;
        await simulator.testSpecificPair(tokenA, tokenB, amount);
    }
    else {
        logger.info(chalk_1.default.yellow("Usage:"));
        logger.info(chalk_1.default.yellow("  npm run bot:simulate                    # Scan all pairs"));
        logger.info(chalk_1.default.yellow("  npm run bot:simulate WETH USDC 10      # Test specific pair"));
    }
}
main().catch((error) => {
    logger.error(chalk_1.default.red("Simulation failed:"), error);
    process.exit(1);
});
