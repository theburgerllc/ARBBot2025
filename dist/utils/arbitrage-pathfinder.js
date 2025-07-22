"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedArbitragePathfinder = void 0;
const ethers_1 = require("ethers");
const dex_routers_1 = require("./dex-routers");
const volatile_tokens_1 = require("./volatile-tokens");
class EnhancedArbitragePathfinder {
    providers;
    routerCache;
    tokenGraph;
    constructor(providers) {
        this.providers = providers;
        this.routerCache = new Map();
        this.tokenGraph = new Map();
    }
    /**
     * Enhanced Bellman-Ford algorithm for arbitrage detection
     * Finds both loops and non-loop paths with negative weights (profitable trades)
     */
    async findArbitrageOpportunities(chainId, maxHops = 4, minProfitThreshold = 0.005) {
        // Build token graph with all possible edges
        await this.buildTokenGraph(chainId);
        const opportunities = [];
        const volatilePairs = volatile_tokens_1.VolatileTokenTracker.getHighVolatilityPairs(chainId);
        console.log(`🔍 Scanning ${volatilePairs.length} volatile pairs with enhanced pathfinding...`);
        for (const pair of volatilePairs) {
            // Find direct arbitrage paths
            const directPaths = await this.findDirectArbitragePaths(pair, maxHops);
            // Find triangular arbitrage loops
            const triangularPaths = await this.findTriangularArbitragePaths(pair, maxHops);
            // Find multi-hop cross-DEX paths
            const multiHopPaths = await this.findMultiHopPaths(pair, maxHops);
            const allPaths = [...directPaths, ...triangularPaths, ...multiHopPaths];
            if (allPaths.length > 0) {
                const bestPath = this.selectOptimalPath(allPaths);
                if (bestPath.profitMargin >= minProfitThreshold) {
                    opportunities.push({
                        id: `arb-${chainId}-${pair.tokenA.symbol}-${pair.tokenB.symbol}-${Date.now()}`,
                        paths: allPaths,
                        bestPath,
                        tokenPair: pair,
                        amountIn: (0, ethers_1.parseEther)("1"), // Base amount for calculation
                        expectedAmountOut: bestPath.estimatedProfit,
                        netProfit: bestPath.estimatedProfit,
                        confidence: this.calculateConfidence(bestPath),
                        timeWindow: this.estimateTimeWindow(bestPath)
                    });
                }
            }
        }
        return opportunities.sort((a, b) => Number(b.netProfit - a.netProfit));
    }
    /**
     * Build comprehensive token graph with all DEX routers
     */
    async buildTokenGraph(chainId) {
        const routers = dex_routers_1.EnhancedDEXManager.getAllRouters(chainId);
        const tokens = volatile_tokens_1.VolatileTokenTracker.getExpandedTokenUniverse(chainId);
        this.tokenGraph.clear();
        console.log(`📊 Building token graph: ${tokens.length} tokens × ${routers.length} DEXes`);
        // Create edges for all token pairs across all routers
        for (const tokenA of tokens) {
            if (!this.tokenGraph.has(tokenA.address)) {
                this.tokenGraph.set(tokenA.address, []);
            }
            for (const tokenB of tokens) {
                if (tokenA.address === tokenB.address)
                    continue;
                for (const router of routers) {
                    try {
                        const edge = await this.createArbitrageEdge(tokenA, tokenB, router, chainId);
                        if (edge) {
                            this.tokenGraph.get(tokenA.address).push(edge);
                        }
                    }
                    catch (error) {
                        // Skip invalid pairs
                    }
                }
            }
        }
        console.log(`✅ Token graph built: ${this.tokenGraph.size} nodes`);
    }
    /**
     * Create arbitrage edge with rate calculation
     */
    async createArbitrageEdge(tokenA, tokenB, router, chainId) {
        try {
            const provider = this.providers.get(chainId);
            if (!provider)
                return null;
            // Mock rate calculation (in production, would query actual DEX)
            const baseRate = this.calculateMockRate(tokenA, tokenB);
            const routerFee = this.parseRouterFee(router.feeStructure);
            const effectiveRate = baseRate * (1 - routerFee);
            // Add volatility-based rate adjustment
            const volatilityAdjustment = 1 + (Math.random() - 0.5) * tokenA.volatility24h * 0.1;
            const adjustedRate = effectiveRate * volatilityAdjustment;
            return {
                from: tokenA.address,
                to: tokenB.address,
                router,
                rate: adjustedRate,
                fee: routerFee,
                gaseCost: router.gasLimit,
                liquidityDepth: this.estimateLiquidityDepth(tokenA, tokenB, router),
                weight: -Math.log(adjustedRate) // Negative log for Bellman-Ford
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Find direct arbitrage paths between two DEXes
     */
    async findDirectArbitragePaths(pair, maxHops) {
        const paths = [];
        // Get router pairs for arbitrage
        const routerPairs = dex_routers_1.EnhancedDEXManager.getArbitrageRouterPairs(pair.tokenA.chainId);
        for (const { routerA, routerB } of routerPairs.slice(0, 10)) { // Limit combinations
            try {
                // Path: TokenA -> RouterA -> TokenB -> RouterB -> TokenA
                const pathA = await this.calculateDirectPath([pair.tokenA.address, pair.tokenB.address, pair.tokenA.address], [routerA, routerB]);
                if (pathA && pathA.profitMargin > 0) {
                    paths.push(pathA);
                }
                // Reverse path: TokenA -> RouterB -> TokenB -> RouterA -> TokenA
                const pathB = await this.calculateDirectPath([pair.tokenA.address, pair.tokenB.address, pair.tokenA.address], [routerB, routerA]);
                if (pathB && pathB.profitMargin > 0) {
                    paths.push(pathB);
                }
            }
            catch (error) {
                continue;
            }
        }
        return paths;
    }
    /**
     * Find triangular arbitrage loops using modified Bellman-Ford
     */
    async findTriangularArbitragePaths(pair, maxHops) {
        const paths = [];
        const startToken = pair.tokenA.address;
        // Use Bellman-Ford to detect negative cycles (profitable loops)
        const distances = new Map();
        const predecessors = new Map();
        // Initialize distances
        for (const node of this.tokenGraph.keys()) {
            distances.set(node, node === startToken ? 0 : Infinity);
        }
        // Relax edges for V-1 iterations
        const nodes = Array.from(this.tokenGraph.keys());
        for (let i = 0; i < nodes.length - 1; i++) {
            for (const from of nodes) {
                const edges = this.tokenGraph.get(from) || [];
                for (const edge of edges) {
                    const currentDist = distances.get(from);
                    const newDist = currentDist + edge.weight;
                    if (newDist < distances.get(edge.to)) {
                        distances.set(edge.to, newDist);
                        predecessors.set(edge.to, edge);
                    }
                }
            }
        }
        // Detect negative cycles
        for (const from of nodes) {
            const edges = this.tokenGraph.get(from) || [];
            for (const edge of edges) {
                const currentDist = distances.get(from);
                const newDist = currentDist + edge.weight;
                if (newDist < distances.get(edge.to)) {
                    // Found negative cycle - extract triangular path
                    const triangularPath = this.extractTriangularPath(edge.to, predecessors);
                    if (triangularPath) {
                        paths.push(triangularPath);
                    }
                }
            }
        }
        return paths;
    }
    /**
     * Find multi-hop paths using line graph transformation
     */
    async findMultiHopPaths(pair, maxHops) {
        const paths = [];
        // Implement line graph algorithm for complex path finding
        const lineGraph = this.buildLineGraph();
        const multiHopPaths = this.findPathsInLineGraph(pair.tokenA.address, pair.tokenB.address, lineGraph, maxHops);
        for (const path of multiHopPaths) {
            const calculatedPath = await this.calculateMultiHopPath(path);
            if (calculatedPath && calculatedPath.profitMargin > 0) {
                paths.push(calculatedPath);
            }
        }
        return paths;
    }
    /**
     * Build line graph for advanced path finding
     */
    buildLineGraph() {
        const lineGraph = new Map();
        // Transform edge graph to line graph where edges become nodes
        for (const [node, edges] of this.tokenGraph.entries()) {
            for (const edge of edges) {
                const edgeId = `${edge.from}-${edge.to}-${edge.router.name}`;
                if (!lineGraph.has(edgeId)) {
                    lineGraph.set(edgeId, []);
                }
                // Connect to other edges that start where this edge ends
                const nextEdges = this.tokenGraph.get(edge.to) || [];
                for (const nextEdge of nextEdges) {
                    const nextEdgeId = `${nextEdge.from}-${nextEdge.to}-${nextEdge.router.name}`;
                    lineGraph.get(edgeId).push(nextEdgeId);
                }
            }
        }
        return lineGraph;
    }
    /**
     * Find paths in line graph using BFS
     */
    findPathsInLineGraph(startToken, endToken, lineGraph, maxHops) {
        const paths = [];
        const queue = [];
        // Initialize with all edges starting from startToken
        for (const [edgeId] of lineGraph.entries()) {
            if (edgeId.startsWith(startToken)) {
                queue.push({ path: [edgeId], token: edgeId.split('-')[1] });
            }
        }
        while (queue.length > 0) {
            const { path, token } = queue.shift();
            if (path.length >= maxHops)
                continue;
            if (token === endToken && path.length >= 2) {
                paths.push(path);
                continue;
            }
            const lastEdgeId = path[path.length - 1];
            const nextEdges = lineGraph.get(lastEdgeId) || [];
            for (const nextEdgeId of nextEdges) {
                const nextToken = nextEdgeId.split('-')[1];
                queue.push({
                    path: [...path, nextEdgeId],
                    token: nextToken
                });
            }
        }
        return paths.slice(0, 20); // Limit paths for performance
    }
    /**
     * Calculate direct arbitrage path
     */
    async calculateDirectPath(tokenPath, routers) {
        try {
            let totalRate = 1;
            let totalFees = 0;
            let totalGasCost = 0n;
            const edges = [];
            for (let i = 0; i < tokenPath.length - 1; i++) {
                const from = tokenPath[i];
                const to = tokenPath[i + 1];
                const router = routers[i % routers.length];
                const edgeList = this.tokenGraph.get(from) || [];
                const edge = edgeList.find(e => e.to === to && e.router.name === router.name);
                if (!edge)
                    return null;
                totalRate *= edge.rate;
                totalFees += edge.fee;
                totalGasCost += edge.gaseCost;
                edges.push(edge);
            }
            const profitMargin = totalRate - 1 - totalFees;
            const estimatedProfit = (0, ethers_1.parseEther)(Math.max(0, profitMargin).toString());
            return {
                path: tokenPath,
                routers,
                edges,
                totalRate,
                totalFees,
                totalGasCost,
                estimatedProfit,
                profitMargin,
                isTriangular: false,
                complexity: tokenPath.length - 1
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Extract triangular path from Bellman-Ford predecessors
     */
    extractTriangularPath(node, predecessors) {
        try {
            const path = [];
            const edges = [];
            const routers = [];
            let current = node;
            // Follow predecessors to build path
            do {
                path.unshift(current);
                const edge = predecessors.get(current);
                if (edge) {
                    edges.unshift(edge);
                    routers.unshift(edge.router);
                    current = edge.from;
                }
            } while (current !== node && predecessors.has(current));
            if (current === node && path.length >= 3) {
                const totalRate = edges.reduce((acc, edge) => acc * edge.rate, 1);
                const totalFees = edges.reduce((acc, edge) => acc + edge.fee, 0);
                const totalGasCost = edges.reduce((acc, edge) => acc + edge.gaseCost, 0n);
                const profitMargin = totalRate - 1 - totalFees;
                return {
                    path,
                    routers,
                    edges,
                    totalRate,
                    totalFees,
                    totalGasCost,
                    estimatedProfit: (0, ethers_1.parseEther)(Math.max(0, profitMargin).toString()),
                    profitMargin,
                    isTriangular: true,
                    complexity: path.length
                };
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Calculate multi-hop path from line graph
     */
    async calculateMultiHopPath(edgeIds) {
        try {
            const edges = [];
            const path = [];
            const routers = [];
            for (const edgeId of edgeIds) {
                const [from, to, routerName] = edgeId.split('-');
                const edgeList = this.tokenGraph.get(from) || [];
                const edge = edgeList.find(e => e.to === to && e.router.name === routerName);
                if (!edge)
                    return null;
                edges.push(edge);
                routers.push(edge.router);
                if (path.length === 0)
                    path.push(from);
                path.push(to);
            }
            const totalRate = edges.reduce((acc, edge) => acc * edge.rate, 1);
            const totalFees = edges.reduce((acc, edge) => acc + edge.fee, 0);
            const totalGasCost = edges.reduce((acc, edge) => acc + edge.gaseCost, 0n);
            const profitMargin = totalRate - 1 - totalFees;
            return {
                path,
                routers,
                edges,
                totalRate,
                totalFees,
                totalGasCost,
                estimatedProfit: (0, ethers_1.parseEther)(Math.max(0, profitMargin).toString()),
                profitMargin,
                isTriangular: path[0] === path[path.length - 1],
                complexity: edges.length
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Select optimal path from multiple options
     */
    selectOptimalPath(paths) {
        return paths.reduce((best, current) => {
            // Prioritize by profit margin, then by simplicity
            const bestScore = best.profitMargin - (best.complexity * 0.001);
            const currentScore = current.profitMargin - (current.complexity * 0.001);
            return currentScore > bestScore ? current : best;
        });
    }
    /**
     * Calculate confidence score for path
     */
    calculateConfidence(path) {
        let confidence = 0.8; // Base confidence
        // Reduce confidence for complex paths
        confidence -= path.complexity * 0.05;
        // Increase confidence for high liquidity routers
        const avgLiquidity = path.routers.reduce((acc, r) => acc + r.liquidityScore, 0) / path.routers.length;
        confidence += (avgLiquidity - 5) * 0.02;
        // Reduce confidence for high fees
        confidence -= path.totalFees * 2;
        return Math.max(0.1, Math.min(0.95, confidence));
    }
    /**
     * Estimate time window for opportunity
     */
    estimateTimeWindow(path) {
        // Base window of 10-20 seconds for L2
        let timeWindow = 15;
        // Shorter window for high-complexity paths
        timeWindow -= path.complexity * 2;
        // Longer window for high-liquidity pairs
        const avgLiquidity = path.routers.reduce((acc, r) => acc + r.liquidityScore, 0) / path.routers.length;
        timeWindow += (avgLiquidity - 5) * 2;
        return Math.max(5, Math.min(30, timeWindow));
    }
    /**
     * Helper methods
     */
    calculateMockRate(tokenA, tokenB) {
        // Mock rate calculation based on symbols
        const baseRates = {
            "ETH": 2000,
            "WETH": 2000,
            "WBTC": 45000,
            "USDC": 1,
            "USDT": 1,
            "ARB": 0.8,
            "OP": 1.2,
            "GMX": 35
        };
        const rateA = baseRates[tokenA.symbol] || 1;
        const rateB = baseRates[tokenB.symbol] || 1;
        return rateA / rateB;
    }
    parseRouterFee(feeStructure) {
        const match = feeStructure.match(/(\d+\.?\d*)%/);
        return match ? parseFloat(match[1]) / 100 : 0.003;
    }
    estimateLiquidityDepth(tokenA, tokenB, router) {
        // Mock liquidity estimation
        const baseDepth = router.liquidityScore * 100000;
        return (0, ethers_1.parseEther)(baseDepth.toString());
    }
}
exports.EnhancedArbitragePathfinder = EnhancedArbitragePathfinder;
