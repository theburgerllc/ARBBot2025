"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedDEXManager = void 0;
const ethers_1 = require("ethers");
class EnhancedDEXManager {
    // Comprehensive DEX router database
    static DEX_ROUTERS = {
        // Arbitrum (42161)
        42161: [
            // Uniswap V2/V3
            {
                name: "Uniswap V2",
                address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
                routerType: 'UNISWAP_V2',
                gasLimit: 300000n,
                feeStructure: "0.3%",
                liquidityScore: 9.0
            },
            {
                name: "Uniswap V3",
                address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
                routerType: 'UNISWAP_V3',
                gasLimit: 350000n,
                feeStructure: "0.05%/0.3%/1%",
                liquidityScore: 9.5
            },
            // SushiSwap
            {
                name: "SushiSwap",
                address: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
                routerType: 'UNISWAP_V2',
                gasLimit: 320000n,
                feeStructure: "0.3%",
                liquidityScore: 8.0
            },
            // Curve (Stable swaps + Crypto pools)
            {
                name: "Curve 2Pool",
                address: "0x7f90122BF0700F9E7e1F688fe926940E8839F353", // USDC/USDT
                routerType: 'CURVE',
                gasLimit: 250000n,
                feeStructure: "0.04%",
                liquidityScore: 8.5
            },
            {
                name: "Curve 3Pool",
                address: "0x960ea3e3C7FB317332d990873d354E18d7645590", // USDC/USDT/DAI
                routerType: 'CURVE',
                gasLimit: 280000n,
                feeStructure: "0.04%",
                liquidityScore: 8.0
            },
            {
                name: "Curve TriCrypto",
                address: "0x960ea3e3C7FB317332d990873d354E18d7645590", // USDT/WBTC/WETH
                routerType: 'CURVE',
                gasLimit: 400000n,
                feeStructure: "0.04-0.4%",
                liquidityScore: 7.5
            },
            // GMX (Perpetuals with spot trading)
            {
                name: "GMX Router",
                address: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
                routerType: 'GMX',
                gasLimit: 500000n,
                feeStructure: "0.1-0.8%",
                liquidityScore: 6.0
            },
            // Balancer V2
            {
                name: "Balancer V2",
                address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
                routerType: 'BALANCER',
                gasLimit: 400000n,
                feeStructure: "0.1-1%",
                liquidityScore: 7.0
            },
            // Camelot (Native Arbitrum DEX)
            {
                name: "Camelot",
                address: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
                routerType: 'UNISWAP_V2',
                gasLimit: 350000n,
                feeStructure: "0.3%",
                liquidityScore: 6.5
            }
        ],
        // Optimism (10)
        10: [
            // Uniswap V3
            {
                name: "Uniswap V3",
                address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
                routerType: 'UNISWAP_V3',
                gasLimit: 350000n,
                feeStructure: "0.05%/0.3%/1%",
                liquidityScore: 9.0
            },
            // Uniswap V2 style
            {
                name: "Uniswap V2",
                address: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
                routerType: 'UNISWAP_V2',
                gasLimit: 300000n,
                feeStructure: "0.3%",
                liquidityScore: 8.5
            },
            // Curve
            {
                name: "Curve 3Pool",
                address: "0x1337BedC9D22ecbe766dF105c9623922A27963EC", // USDC/USDT/DAI
                routerType: 'CURVE',
                gasLimit: 280000n,
                feeStructure: "0.04%",
                liquidityScore: 8.0
            },
            // Balancer V2
            {
                name: "Balancer V2",
                address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
                routerType: 'BALANCER',
                gasLimit: 400000n,
                feeStructure: "0.1-1%",
                liquidityScore: 7.5
            },
            // Velodrome (Native Optimism DEX)
            {
                name: "Velodrome",
                address: "0x9c12939390052919aF3155f41Bf4160Fd3666A6f",
                routerType: 'UNISWAP_V2',
                gasLimit: 320000n,
                feeStructure: "0.02-0.05%",
                liquidityScore: 7.0
            }
        ]
    };
    /**
     * Get all available DEX routers for a chain, sorted by liquidity score
     */
    static getAllRouters(chainId) {
        const routers = this.DEX_ROUTERS[chainId] || [];
        return routers
            .map((router) => ({ ...router, chainId }))
            .sort((a, b) => b.liquidityScore - a.liquidityScore);
    }
    /**
     * Get routers filtered by type and minimum liquidity score
     */
    static getRoutersByType(chainId, types, minLiquidityScore = 6.0) {
        return this.getAllRouters(chainId)
            .filter(router => types.includes(router.routerType) &&
            router.liquidityScore >= minLiquidityScore);
    }
    /**
     * Get optimal router combination for arbitrage
     * Prioritizes different fee structures and liquidity
     */
    static getArbitrageRouterPairs(chainId) {
        const routers = this.getAllRouters(chainId);
        const pairs = [];
        // Create all possible router combinations
        for (let i = 0; i < routers.length; i++) {
            for (let j = i + 1; j < routers.length; j++) {
                const routerA = routers[i];
                const routerB = routers[j];
                // Prioritize combinations with different fee structures
                const feeStructureDiff = routerA.feeStructure !== routerB.feeStructure;
                const bothHighLiquidity = routerA.liquidityScore >= 7.0 && routerB.liquidityScore >= 7.0;
                if (feeStructureDiff || bothHighLiquidity) {
                    pairs.push({ routerA, routerB });
                }
            }
        }
        // Sort by combined liquidity score
        return pairs.sort((a, b) => {
            const scoreA = a.routerA.liquidityScore + a.routerB.liquidityScore;
            const scoreB = b.routerA.liquidityScore + b.routerB.liquidityScore;
            return scoreB - scoreA;
        });
    }
    /**
     * Get specialized routers for specific token types
     */
    static getSpecializedRouters(chainId, tokenType) {
        const allRouters = this.getAllRouters(chainId);
        switch (tokenType) {
            case 'STABLE':
                // Curve excels at stable swaps, Balancer for stable pools
                return allRouters.filter(r => r.routerType === 'CURVE' || r.routerType === 'BALANCER');
            case 'VOLATILE':
                // Uniswap V3 for concentrated liquidity, V2 for simplicity
                return allRouters.filter(r => r.routerType === 'UNISWAP_V3' || r.routerType === 'UNISWAP_V2');
            case 'EXOTIC':
                // All routers for maximum coverage
                return allRouters;
            default:
                return allRouters;
        }
    }
    /**
     * Estimate gas costs for different router combinations
     */
    static estimateArbitrageGasCost(routerA, routerB) {
        // Base arbitrage transaction overhead
        const baseGas = 150000n;
        // Router-specific gas costs
        const gasA = routerA.gasLimit;
        const gasB = routerB.gasLimit;
        // Additional overhead for complex routers (Curve, GMX)
        const complexityMultiplier = (routerA.routerType === 'CURVE' || routerA.routerType === 'GMX' ||
            routerB.routerType === 'CURVE' || routerB.routerType === 'GMX') ? 1.2 : 1.0;
        return BigInt(Math.floor(Number(baseGas + gasA + gasB) * complexityMultiplier));
    }
    /**
     * Get router interface for quote generation
     */
    static getRouterInterface(routerType) {
        switch (routerType) {
            case 'UNISWAP_V2':
                return new ethers_1.Interface([
                    "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)",
                    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)"
                ]);
            case 'UNISWAP_V3':
                return new ethers_1.Interface([
                    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)"
                ]);
            case 'CURVE':
                return new ethers_1.Interface([
                    "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
                    "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)"
                ]);
            case 'GMX':
                return new ethers_1.Interface([
                    "function swap(address[] path, uint256 amountIn, uint256 minOut, address receiver) returns (uint256)"
                ]);
            case 'BALANCER':
                return new ethers_1.Interface([
                    "function queryBatchSwap(uint8 kind, (bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, (address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds) view returns (int256[] assetDeltas)"
                ]);
            default:
                return new ethers_1.Interface([]);
        }
    }
    /**
     * Calculate expected slippage for router type and amount
     */
    static calculateExpectedSlippage(router, amountIn, liquidityDepth) {
        const tradeSize = Number(amountIn) / Number(liquidityDepth);
        // Router-specific slippage models
        switch (router.routerType) {
            case 'CURVE':
                // Curve has lower slippage for stable swaps
                return Math.min(0.001, tradeSize * 0.1); // 0.1% max for stables
            case 'UNISWAP_V3':
                // V3 concentrated liquidity can have higher slippage
                return Math.min(0.02, tradeSize * 0.5);
            case 'GMX':
                // GMX has dynamic fees based on utilization
                return Math.min(0.008, tradeSize * 0.3);
            default:
                // Standard AMM slippage
                return Math.min(0.015, tradeSize * 0.4);
        }
    }
    /**
     * Format DEX information for logging
     */
    static formatDEXInfo(router) {
        return `${router.name} (${router.routerType}, liq: ${router.liquidityScore}, fee: ${router.feeStructure})`;
    }
    /**
     * Get coverage statistics for a chain
     */
    static getCoverageStats(chainId) {
        const routers = this.getAllRouters(chainId);
        const routerTypes = {};
        let totalLiquidityScore = 0;
        let totalGasLimit = 0n;
        for (const router of routers) {
            routerTypes[router.routerType] = (routerTypes[router.routerType] || 0) + 1;
            totalLiquidityScore += router.liquidityScore;
            totalGasLimit += router.gasLimit;
        }
        return {
            totalRouters: routers.length,
            routerTypes,
            averageLiquidityScore: totalLiquidityScore / routers.length,
            totalGasLimit
        };
    }
}
exports.EnhancedDEXManager = EnhancedDEXManager;
