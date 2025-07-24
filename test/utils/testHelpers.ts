import hre, { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";

// Known whale addresses for mainnet fork testing
export const WHALE_ADDRESSES = {
  // Arbitrum mainnet whale addresses
  ARB: {
    WETH: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet
    USDC: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet  
    USDT: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet
    WBTC: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance Hot Wallet
    // Alternative whale addresses
    WETH_ALT: "0x2F2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // Known WBTC/ETH liquidity provider
    USDC_ALT: "0x62383739D68Dd0F844103Db8dFb05a7EdED5BBE6", // Known USDC holder
    USDT_ALT: "0x40D843e0b5e7Be1A5ba82fE9F8f6eEA7f05DfD2a"  // Known USDT holder
  },
  // Ethereum mainnet whale addresses (for reference/future use)
  ETH: {
    WETH: "0x8EB8a3b98659Cce290402893d0123abb75E3ab28", // Avalanche Bridge
    USDC: "0x55FE002aefF02F77364de339a1292923A15844B8", // Circle
    USDT: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643", // Compound
    WBTC: "0xBF72Da2Bd84c5170618Fbe5914B0ECA9638d5eb5"  // Known WBTC holder
  }
};

// Token addresses on different networks
export const TOKEN_ADDRESSES = {
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
export const ROUTER_ADDRESSES = {
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
export const ERC20_ABI = [
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
export async function impersonateAccount(address: string): Promise<Signer> {
  await ethers.provider.send("hardhat_impersonateAccount", [address]);
  
  // Fund the account with ETH for gas
  await ethers.provider.send("hardhat_setBalance", [
    address,
    "0x1000000000000000000" // 1 ETH
  ]);
  
  return await ethers.getSigner(address);
}

/**
 * Stop impersonating an account
 */
export async function stopImpersonatingAccount(address: string): Promise<void> {
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [address]);
}

/**
 * Setup token contracts and transfer tokens from whale to recipient
 */
export async function setupTokensFromWhale(
  tokenSymbol: 'WETH' | 'USDC' | 'USDT' | 'WBTC',
  recipient: string,
  amount: string,
  network: 'ARB' | 'OPT' = 'ARB'
): Promise<{ token: Contract; whale: Signer; transferTx: any }> {
  
  const tokenAddress = TOKEN_ADDRESSES[network][tokenSymbol];
  const whaleAddress = WHALE_ADDRESSES[network][tokenSymbol];
  
  // Impersonate whale account
  const whale = await impersonateAccount(whaleAddress);
  
  // Get token contract
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, whale);
  
  // Check whale balance
  const whaleBalance = await token.balanceOf(whaleAddress);
  console.log(`🐋 Whale ${tokenSymbol} balance: ${ethers.formatUnits(whaleBalance, await token.decimals())}`);
  
  // Transfer tokens to recipient
  const transferTx = await token.transfer(recipient, amount);
  await transferTx.wait();
  
  console.log(`✅ Transferred ${ethers.formatUnits(amount, await token.decimals())} ${tokenSymbol} to ${recipient}`);
  
  return { token, whale, transferTx };
}

/**
 * Setup multiple tokens for testing
 */
export async function setupMultipleTokens(
  recipient: string,
  amounts: {
    WETH?: string;
    USDC?: string; 
    USDT?: string;
    WBTC?: string;
  },
  network: 'ARB' | 'OPT' = 'ARB'
): Promise<{ [symbol: string]: { token: Contract; whale: Signer } }> {
  
  const results: { [symbol: string]: { token: Contract; whale: Signer } } = {};
  
  for (const [symbol, amount] of Object.entries(amounts)) {
    if (amount) {
      const { token, whale } = await setupTokensFromWhale(
        symbol as 'WETH' | 'USDC' | 'USDT' | 'WBTC',
        recipient, 
        amount,
        network
      );
      results[symbol] = { token, whale };
    }
  }
  
  return results;
}

/**
 * Create realistic market scenario for testing
 */
export async function createMarketScenario(
  scenario: 'high_volume' | 'volatile' | 'stable' | 'arbitrage_opportunity'
): Promise<{
  description: string;
  tokenAmounts: { [symbol: string]: string };
  expectedBehavior: string;
}> {
  
  const scenarios = {
    high_volume: {
      description: "High volume trading scenario with large token amounts",
      tokenAmounts: {
        WETH: ethers.parseEther("100").toString(),
        USDC: ethers.parseUnits("500000", 6).toString(),
        USDT: ethers.parseUnits("500000", 6).toString(),
        WBTC: ethers.parseUnits("10", 8).toString()
      },
      expectedBehavior: "Should detect multiple high-value opportunities"
    },
    volatile: {
      description: "Volatile market with medium token amounts", 
      tokenAmounts: {
        WETH: ethers.parseEther("10").toString(),
        USDC: ethers.parseUnits("50000", 6).toString(), 
        USDT: ethers.parseUnits("50000", 6).toString(),
        WBTC: ethers.parseUnits("1", 8).toString()
      },
      expectedBehavior: "Should handle price volatility gracefully"
    },
    stable: {
      description: "Stable market with small token amounts",
      tokenAmounts: {
        WETH: ethers.parseEther("1").toString(),
        USDC: ethers.parseUnits("5000", 6).toString(),
        USDT: ethers.parseUnits("5000", 6).toString(), 
        WBTC: ethers.parseUnits("0.1", 8).toString()
      },
      expectedBehavior: "Should find minimal arbitrage opportunities"
    },
    arbitrage_opportunity: {
      description: "Scenario designed to create arbitrage opportunities",
      tokenAmounts: {
        WETH: ethers.parseEther("50").toString(),
        USDC: ethers.parseUnits("200000", 6).toString(),
        USDT: ethers.parseUnits("200000", 6).toString(),
        WBTC: ethers.parseUnits("5", 8).toString()
      },
      expectedBehavior: "Should detect profitable arbitrage opportunities"
    }
  };
  
  return scenarios[scenario];
}

/**
 * Generate mock price data for testing
 */
export function generateMockPriceData(
  basePrice: number,
  volatility: number = 0.02, // 2% volatility
  samples: number = 100
): number[] {
  const prices: number[] = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < samples; i++) {
    // Random walk with volatility
    const change = (Math.random() - 0.5) * volatility * 2;
    currentPrice = Math.max(currentPrice * (1 + change), basePrice * 0.5); // Prevent negative prices
    prices.push(currentPrice);
  }
  
  return prices;
}

/**
 * Calculate expected profit for a given arbitrage scenario
 */
export function calculateExpectedProfit(
  amountIn: bigint,
  price1: bigint,
  price2: bigint,
  gasEstimate: bigint,
  gasPrice: bigint
): {
  grossProfit: bigint;
  gasCost: bigint; 
  netProfit: bigint;
  profitability: boolean;
} {
  const amountOut1 = (amountIn * price1) / ethers.parseEther("1");
  const amountOut2 = (amountOut1 * ethers.parseEther("1")) / price2;
  
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

/**
 * Verify token balances match expected amounts
 */
export async function verifyTokenBalances(
  address: string,
  expectedBalances: { [symbol: string]: string },
  network: 'ARB' | 'OPT' = 'ARB',
  tolerance: number = 0.01 // 1% tolerance
): Promise<void> {
  
  for (const [symbol, expectedAmount] of Object.entries(expectedBalances)) {
    const tokenAddress = TOKEN_ADDRESSES[network][symbol as keyof typeof TOKEN_ADDRESSES.ARB];
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, ethers.provider);
    
    const actualBalance = await token.balanceOf(address);
    const decimals = await token.decimals();
    
    const expected = BigInt(expectedAmount);
    const toleranceAmount = (expected * BigInt(Math.floor(tolerance * 100))) / 100n;
    
    const isWithinTolerance = 
      actualBalance >= (expected - toleranceAmount) && 
      actualBalance <= (expected + toleranceAmount);
    
    expect(isWithinTolerance).to.be.true;
    
    console.log(`✅ ${symbol} balance verified: ${ethers.formatUnits(actualBalance, decimals)}`);
  }
}

/**
 * Fast forward blockchain time for testing time-sensitive scenarios
 */
export async function fastForwardTime(seconds: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

/**
 * Reset blockchain to specific block for consistent testing
 */
export async function resetToBlock(blockNumber: number): Promise<void> {
  await ethers.provider.send("hardhat_reset", [{
    forking: {
      jsonRpcUrl: process.env.ARB_RPC,
      blockNumber: blockNumber
    }
  }]);
}

/**
 * Setup complete testing environment with contracts and tokens
 */
export async function setupTestEnvironment(scenario: 'high_volume' | 'volatile' | 'stable' | 'arbitrage_opportunity' = 'arbitrage_opportunity') {
  const [deployer, user1, user2] = await ethers.getSigners();
  
  // Create market scenario
  const marketScenario = await createMarketScenario(scenario);
  
  // Setup tokens for the test bot contract (deployer)
  const tokens = await setupMultipleTokens(
    deployer.address,
    marketScenario.tokenAmounts
  );
  
  // Setup tokens for user testing
  const userTokens = await setupMultipleTokens(
    user1.address,
    {
      WETH: ethers.parseEther("10").toString(),
      USDC: ethers.parseUnits("50000", 6).toString()
    }
  );
  
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

/**
 * Clean up impersonated accounts after testing
 */
export async function cleanupTestEnvironment(whaleAddresses: string[]): Promise<void> {
  for (const address of whaleAddresses) {
    await stopImpersonatingAccount(address);
  }
  console.log("🧹 Test environment cleaned up");
}

/**
 * Utility to log gas usage for optimization
 */
export function logGasUsage(tx: any, operation: string): void {
  if (tx.gasUsed) {
    console.log(`⛽ Gas used for ${operation}: ${tx.gasUsed.toString()}`);
  }
}

/**
 * Create test data for performance benchmarking
 */
export function createPerformanceBenchmarks() {
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
      minimum: ethers.parseEther("0.001"), // 0.001 ETH
      target: ethers.parseEther("0.01"),   // 0.01 ETH  
      optimal: ethers.parseEther("0.1")    // 0.1 ETH
    }
  };
}

export default {
  WHALE_ADDRESSES,
  TOKEN_ADDRESSES,
  ROUTER_ADDRESSES,
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