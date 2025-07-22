import { Contract, Signer } from "ethers";
export declare const WHALE_ADDRESSES: {
    ARB: {
        WETH: string;
        USDC: string;
        USDT: string;
        WBTC: string;
        WETH_ALT: string;
        USDC_ALT: string;
        USDT_ALT: string;
    };
    ETH: {
        WETH: string;
        USDC: string;
        USDT: string;
        WBTC: string;
    };
};
export declare const TOKEN_ADDRESSES: {
    ARB: {
        WETH: string;
        USDC: string;
        USDT: string;
        WBTC: string;
    };
    OPT: {
        WETH: string;
        USDC: string;
        USDT: string;
        WBTC: string;
    };
};
export declare const ROUTER_ADDRESSES: {
    ARB: {
        UNISWAP_V2: string;
        SUSHISWAP: string;
        BALANCER_VAULT: string;
    };
    OPT: {
        UNISWAP_V2: string;
        SUSHISWAP: string;
        BALANCER_VAULT: string;
    };
};
export declare const ERC20_ABI: string[];
/**
 * Impersonate a whale account and get signer
 */
export declare function impersonateAccount(address: string): Promise<Signer>;
/**
 * Stop impersonating an account
 */
export declare function stopImpersonatingAccount(address: string): Promise<void>;
/**
 * Setup token contracts and transfer tokens from whale to recipient
 */
export declare function setupTokensFromWhale(tokenSymbol: 'WETH' | 'USDC' | 'USDT' | 'WBTC', recipient: string, amount: string, network?: 'ARB' | 'OPT'): Promise<{
    token: Contract;
    whale: Signer;
    transferTx: any;
}>;
/**
 * Setup multiple tokens for testing
 */
export declare function setupMultipleTokens(recipient: string, amounts: {
    WETH?: string;
    USDC?: string;
    USDT?: string;
    WBTC?: string;
}, network?: 'ARB' | 'OPT'): Promise<{
    [symbol: string]: {
        token: Contract;
        whale: Signer;
    };
}>;
/**
 * Create realistic market scenario for testing
 */
export declare function createMarketScenario(scenario: 'high_volume' | 'volatile' | 'stable' | 'arbitrage_opportunity'): Promise<{
    description: string;
    tokenAmounts: {
        [symbol: string]: string;
    };
    expectedBehavior: string;
}>;
/**
 * Generate mock price data for testing
 */
export declare function generateMockPriceData(basePrice: number, volatility?: number, // 2% volatility
samples?: number): number[];
/**
 * Calculate expected profit for a given arbitrage scenario
 */
export declare function calculateExpectedProfit(amountIn: bigint, price1: bigint, price2: bigint, gasEstimate: bigint, gasPrice: bigint): {
    grossProfit: bigint;
    gasCost: bigint;
    netProfit: bigint;
    profitability: boolean;
};
/**
 * Verify token balances match expected amounts
 */
export declare function verifyTokenBalances(address: string, expectedBalances: {
    [symbol: string]: string;
}, network?: 'ARB' | 'OPT', tolerance?: number): Promise<void>;
/**
 * Fast forward blockchain time for testing time-sensitive scenarios
 */
export declare function fastForwardTime(seconds: number): Promise<void>;
/**
 * Reset blockchain to specific block for consistent testing
 */
export declare function resetToBlock(blockNumber: number): Promise<void>;
/**
 * Setup complete testing environment with contracts and tokens
 */
export declare function setupTestEnvironment(scenario?: 'high_volume' | 'volatile' | 'stable' | 'arbitrage_opportunity'): Promise<{
    deployer: any;
    user1: any;
    user2: any;
    tokens: {
        [symbol: string]: {
            token: Contract;
            whale: Signer;
        };
    };
    userTokens: {
        [symbol: string]: {
            token: Contract;
            whale: Signer;
        };
    };
    marketScenario: {
        description: string;
        tokenAmounts: {
            [symbol: string]: string;
        };
        expectedBehavior: string;
    };
}>;
/**
 * Clean up impersonated accounts after testing
 */
export declare function cleanupTestEnvironment(whaleAddresses: string[]): Promise<void>;
/**
 * Utility to log gas usage for optimization
 */
export declare function logGasUsage(tx: any, operation: string): void;
/**
 * Create test data for performance benchmarking
 */
export declare function createPerformanceBenchmarks(): {
    gasLimits: {
        flashLoan: bigint;
        simpleArbitrage: bigint;
        triangularArbitrage: bigint;
        crossChainArbitrage: bigint;
    };
    timeouts: {
        blockTime: number;
        bundleSubmission: number;
        simulationTimeout: number;
    };
    profitThresholds: {
        minimum: any;
        target: any;
        optimal: any;
    };
};
declare const _default: {
    WHALE_ADDRESSES: {
        ARB: {
            WETH: string;
            USDC: string;
            USDT: string;
            WBTC: string;
            WETH_ALT: string;
            USDC_ALT: string;
            USDT_ALT: string;
        };
        ETH: {
            WETH: string;
            USDC: string;
            USDT: string;
            WBTC: string;
        };
    };
    TOKEN_ADDRESSES: {
        ARB: {
            WETH: string;
            USDC: string;
            USDT: string;
            WBTC: string;
        };
        OPT: {
            WETH: string;
            USDC: string;
            USDT: string;
            WBTC: string;
        };
    };
    ROUTER_ADDRESSES: {
        ARB: {
            UNISWAP_V2: string;
            SUSHISWAP: string;
            BALANCER_VAULT: string;
        };
        OPT: {
            UNISWAP_V2: string;
            SUSHISWAP: string;
            BALANCER_VAULT: string;
        };
    };
    impersonateAccount: typeof impersonateAccount;
    stopImpersonatingAccount: typeof stopImpersonatingAccount;
    setupTokensFromWhale: typeof setupTokensFromWhale;
    setupMultipleTokens: typeof setupMultipleTokens;
    createMarketScenario: typeof createMarketScenario;
    generateMockPriceData: typeof generateMockPriceData;
    calculateExpectedProfit: typeof calculateExpectedProfit;
    verifyTokenBalances: typeof verifyTokenBalances;
    fastForwardTime: typeof fastForwardTime;
    resetToBlock: typeof resetToBlock;
    setupTestEnvironment: typeof setupTestEnvironment;
    cleanupTestEnvironment: typeof cleanupTestEnvironment;
    logGasUsage: typeof logGasUsage;
    createPerformanceBenchmarks: typeof createPerformanceBenchmarks;
};
export default _default;
