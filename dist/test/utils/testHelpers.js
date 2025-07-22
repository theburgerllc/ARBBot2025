"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPerformanceBenchmarks = exports.logGasUsage = exports.cleanupTestEnvironment = exports.setupTestEnvironment = exports.resetToBlock = exports.fastForwardTime = exports.verifyTokenBalances = exports.calculateExpectedProfit = exports.generateMockPriceData = exports.createMarketScenario = exports.setupMultipleTokens = exports.setupTokensFromWhale = exports.stopImpersonatingAccount = exports.impersonateAccount = exports.ERC20_ABI = exports.ROUTER_ADDRESSES = exports.TOKEN_ADDRESSES = exports.WHALE_ADDRESSES = void 0;
const hardhat_1 = require("hardhat");
const chai_1 = require("chai");
// Known whale addresses for mainnet fork testing
exports.WHALE_ADDRESSES = {
    // Arbitrum mainnet whale addresses
    ARB: {
        WETH: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet
        USDC: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet  
        USDT: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet
        WBTC: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet
        // Alternative whale addresses
        WETH_ALT: "0x2F2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // Known WBTC/ETH liquidity provider
        USDC_ALT: "0x62383739D68Dd0F844103Db8dFb05a7EdED5BBE6", // Known USDC holder
        USDT_ALT: "0x40D843e0b5e7Be1A5ba82fE9F8f6eEA7f05DfD2a" // Known USDT holder
    },
    // Ethereum mainnet whale addresses (for reference/future use)
    ETH: {
        WETH: "0x8EB8a3b98659Cce290402893d0123abb75E3ab28", // Avalanche Bridge
        USDC: "0x55FE002aefF02F77364de339a1292923A15844B8", // Circle
        USDT: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643", // Compound
        WBTC: "0xBF72Da2Bd84c5170618Fbe5914B0ECA9638d5eb5" // Known WBTC holder
    }
};
// Token addresses on different networks
exports.TOKEN_ADDRESSES = {
    ARB: {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
    },
    OPT: {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        WBTC: "0x68f180fcCe6836688e9084f035309E29Bf0A2095"
    }
};
// Router addresses
exports.ROUTER_ADDRESSES = {
    ARB: {
        UNISWAP_V2: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
        SUSHISWAP: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
        BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
    },
    OPT: {
        UNISWAP_V2: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
        SUSHISWAP: "0x2ABf469074dc0b54d793850807E6eb5Faf2625b1",
        BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
    }
};
// Standard ERC20 ABI for token interactions
exports.ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];
/**
 * Impersonate a whale account and get signer
 */
async function impersonateAccount(address) {
    await hardhat_1.ethers.provider.send("hardhat_impersonateAccount", [address]);
    // Fund the account with ETH for gas
    await hardhat_1.ethers.provider.send("hardhat_setBalance", [
        address,
        "0x1000000000000000000" // 1 ETH
    ]);
    return await hardhat_1.ethers.getSigner(address);
}
exports.impersonateAccount = impersonateAccount;
/**
 * Stop impersonating an account
 */
async function stopImpersonatingAccount(address) {
    await hardhat_1.ethers.provider.send("hardhat_stopImpersonatingAccount", [address]);
}
exports.stopImpersonatingAccount = stopImpersonatingAccount;
/**
 * Setup token contracts and transfer tokens from whale to recipient
 */
async function setupTokensFromWhale(tokenSymbol, recipient, amount, network = 'ARB') {
    const tokenAddress = exports.TOKEN_ADDRESSES[network][tokenSymbol];
    const whaleAddress = exports.WHALE_ADDRESSES[network][tokenSymbol];
    // Impersonate whale account
    const whale = await impersonateAccount(whaleAddress);
    // Get token contract
    const token = new hardhat_1.ethers.Contract(tokenAddress, exports.ERC20_ABI, whale);
    // Check whale balance
    const whaleBalance = await token.balanceOf(whaleAddress);
    console.log(`🐋 Whale ${tokenSymbol} balance: ${hardhat_1.ethers.formatUnits(whaleBalance, await token.decimals())}`);
    // Transfer tokens to recipient
    const transferTx = await token.transfer(recipient, amount);
    await transferTx.wait();
    console.log(`✅ Transferred ${hardhat_1.ethers.formatUnits(amount, await token.decimals())} ${tokenSymbol} to ${recipient}`);
    return { token, whale, transferTx };
}
exports.setupTokensFromWhale = setupTokensFromWhale;
/**
 * Setup multiple tokens for testing
 */
async function setupMultipleTokens(recipient, amounts, network = 'ARB') {
    const results = {};
    for (const [symbol, amount] of Object.entries(amounts)) {
        if (amount) {
            const { token, whale } = await setupTokensFromWhale(symbol, recipient, amount, network);
            results[symbol] = { token, whale };
        }
    }
    return results;
}
exports.setupMultipleTokens = setupMultipleTokens;
/**
 * Create realistic market scenario for testing
 */
async function createMarketScenario(scenario) {
    const scenarios = {
        high_volume: {
            description: "High volume trading scenario with large token amounts",
            tokenAmounts: {
                WETH: hardhat_1.ethers.parseEther("100").toString(),
                USDC: hardhat_1.ethers.parseUnits("500000", 6).toString(),
                USDT: hardhat_1.ethers.parseUnits("500000", 6).toString(),
                WBTC: hardhat_1.ethers.parseUnits("10", 8).toString()
            },
            expectedBehavior: "Should detect multiple high-value opportunities"
        },
        volatile: {
            description: "Volatile market with medium token amounts",
            tokenAmounts: {
                WETH: hardhat_1.ethers.parseEther("10").toString(),
                USDC: hardhat_1.ethers.parseUnits("50000", 6).toString(),
                USDT: hardhat_1.ethers.parseUnits("50000", 6).toString(),
                WBTC: hardhat_1.ethers.parseUnits("1", 8).toString()
            },
            expectedBehavior: "Should handle price volatility gracefully"
        },
        stable: {
            description: "Stable market with small token amounts",
            tokenAmounts: {
                WETH: hardhat_1.ethers.parseEther("1").toString(),
                USDC: hardhat_1.ethers.parseUnits("5000", 6).toString(),
                USDT: hardhat_1.ethers.parseUnits("5000", 6).toString(),
                WBTC: hardhat_1.ethers.parseUnits("0.1", 8).toString()
            },
            expectedBehavior: "Should find minimal arbitrage opportunities"
        },
        arbitrage_opportunity: {
            description: "Scenario designed to create arbitrage opportunities",
            tokenAmounts: {
                WETH: hardhat_1.ethers.parseEther("50").toString(),
                USDC: hardhat_1.ethers.parseUnits("200000", 6).toString(),
                USDT: hardhat_1.ethers.parseUnits("200000", 6).toString(),
                WBTC: hardhat_1.ethers.parseUnits("5", 8).toString()
            },
            expectedBehavior: "Should detect profitable arbitrage opportunities"
        }
    };
    return scenarios[scenario];
}
exports.createMarketScenario = createMarketScenario;
/**
 * Generate mock price data for testing
 */
function generateMockPriceData(basePrice, volatility = 0.02, // 2% volatility
samples = 100) {
    const prices = [];
    let currentPrice = basePrice;
    for (let i = 0; i < samples; i++) {
        // Random walk with volatility
        const change = (Math.random() - 0.5) * volatility * 2;
        currentPrice = Math.max(currentPrice * (1 + change), basePrice * 0.5); // Prevent negative prices
        prices.push(currentPrice);
    }
    return prices;
}
exports.generateMockPriceData = generateMockPriceData;
/**
 * Calculate expected profit for a given arbitrage scenario
 */
function calculateExpectedProfit(amountIn, price1, price2, gasEstimate, gasPrice) {
    const amountOut1 = (amountIn * price1) / hardhat_1.ethers.parseEther("1");
    const amountOut2 = (amountOut1 * hardhat_1.ethers.parseEther("1")) / price2;
    const grossProfit = amountOut2 > amountIn ? amountOut2 - amountIn : 0n;
    const gasCost = gasEstimate * gasPrice;
    const netProfit = grossProfit > gasCost ? grossProfit - gasCost : 0n;
    return {
        grossProfit,
        gasCost,
        netProfit,
        profitability: netProfit > 0n
    };
}
exports.calculateExpectedProfit = calculateExpectedProfit;
/**
 * Verify token balances match expected amounts
 */
async function verifyTokenBalances(address, expectedBalances, network = 'ARB', tolerance = 0.01 // 1% tolerance
) {
    for (const [symbol, expectedAmount] of Object.entries(expectedBalances)) {
        const tokenAddress = exports.TOKEN_ADDRESSES[network][symbol];
        const token = new hardhat_1.ethers.Contract(tokenAddress, exports.ERC20_ABI, hardhat_1.ethers.provider);
        const actualBalance = await token.balanceOf(address);
        const decimals = await token.decimals();
        const expected = BigInt(expectedAmount);
        const toleranceAmount = (expected * BigInt(Math.floor(tolerance * 100))) / 100n;
        const isWithinTolerance = actualBalance >= (expected - toleranceAmount) &&
            actualBalance <= (expected + toleranceAmount);
        (0, chai_1.expect)(isWithinTolerance).to.be.true;
        console.log(`✅ ${symbol} balance verified: ${hardhat_1.ethers.formatUnits(actualBalance, decimals)}`);
    }
}
exports.verifyTokenBalances = verifyTokenBalances;
/**
 * Fast forward blockchain time for testing time-sensitive scenarios
 */
async function fastForwardTime(seconds) {
    await hardhat_1.ethers.provider.send("evm_increaseTime", [seconds]);
    await hardhat_1.ethers.provider.send("evm_mine", []);
}
exports.fastForwardTime = fastForwardTime;
/**
 * Reset blockchain to specific block for consistent testing
 */
async function resetToBlock(blockNumber) {
    await hardhat_1.ethers.provider.send("hardhat_reset", [{
            forking: {
                jsonRpcUrl: process.env.ARB_RPC,
                blockNumber: blockNumber
            }
        }]);
}
exports.resetToBlock = resetToBlock;
/**
 * Setup complete testing environment with contracts and tokens
 */
async function setupTestEnvironment(scenario = 'arbitrage_opportunity') {
    const [deployer, user1, user2] = await hardhat_1.ethers.getSigners();
    // Create market scenario
    const marketScenario = await createMarketScenario(scenario);
    // Setup tokens for the test bot contract (deployer)
    const tokens = await setupMultipleTokens(deployer.address, marketScenario.tokenAmounts);
    // Setup tokens for user testing
    const userTokens = await setupMultipleTokens(user1.address, {
        WETH: hardhat_1.ethers.parseEther("10").toString(),
        USDC: hardhat_1.ethers.parseUnits("50000", 6).toString()
    });
    console.log(`🎭 Test environment setup complete: ${marketScenario.description}`);
    console.log(`📈 Expected behavior: ${marketScenario.expectedBehavior}`);
    return {
        deployer,
        user1,
        user2,
        tokens,
        userTokens,
        marketScenario
    };
}
exports.setupTestEnvironment = setupTestEnvironment;
/**
 * Clean up impersonated accounts after testing
 */
async function cleanupTestEnvironment(whaleAddresses) {
    for (const address of whaleAddresses) {
        await stopImpersonatingAccount(address);
    }
    console.log("🧹 Test environment cleaned up");
}
exports.cleanupTestEnvironment = cleanupTestEnvironment;
/**
 * Utility to log gas usage for optimization
 */
function logGasUsage(tx, operation) {
    if (tx.gasUsed) {
        console.log(`⛽ Gas used for ${operation}: ${tx.gasUsed.toString()}`);
    }
}
exports.logGasUsage = logGasUsage;
/**
 * Create test data for performance benchmarking
 */
function createPerformanceBenchmarks() {
    return {
        gasLimits: {
            flashLoan: 500000n,
            simpleArbitrage: 300000n,
            triangularArbitrage: 800000n,
            crossChainArbitrage: 1000000n
        },
        timeouts: {
            blockTime: 2000, // 2 seconds
            bundleSubmission: 30000, // 30 seconds
            simulationTimeout: 10000 // 10 seconds
        },
        profitThresholds: {
            minimum: hardhat_1.ethers.parseEther("0.001"), // 0.001 ETH
            target: hardhat_1.ethers.parseEther("0.01"), // 0.01 ETH  
            optimal: hardhat_1.ethers.parseEther("0.1") // 0.1 ETH
        }
    };
}
exports.createPerformanceBenchmarks = createPerformanceBenchmarks;
exports.default = {
    WHALE_ADDRESSES: exports.WHALE_ADDRESSES,
    TOKEN_ADDRESSES: exports.TOKEN_ADDRESSES,
    ROUTER_ADDRESSES: exports.ROUTER_ADDRESSES,
    impersonateAccount,
    stopImpersonatingAccount,
    setupTokensFromWhale,
    setupMultipleTokens,
    createMarketScenario,
    generateMockPriceData,
    calculateExpectedProfit,
    verifyTokenBalances,
    fastForwardTime,
    resetToBlock,
    setupTestEnvironment,
    cleanupTestEnvironment,
    logGasUsage,
    createPerformanceBenchmarks
};
