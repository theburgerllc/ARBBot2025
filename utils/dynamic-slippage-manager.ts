import { JsonRpcProvider, parseUnits, formatUnits } from "ethers";
import axios from "axios";

export interface TokenVolatilityMetrics {
    symbol: string;
    address: string;
    volatility24h: number;      // 24h price volatility %
    liquidityDepth: bigint;     // Available liquidity
    averageSlippage: number;    // Historical slippage %
    priceImpact: number;        // Price impact for typical trade sizes
    lastUpdate: number;         // Timestamp
}

export interface DynamicSlippageConfig {
    baseSlippage: number;       // Base slippage (0.1% = 10 bps)
    volatilityMultiplier: number; // Multiply by volatility
    liquidityAdjustment: number;  // Adjust for liquidity depth
    networkCongestionFactor: number; // Network congestion impact
    maxSlippage: number;        // Maximum allowed slippage
    minSlippage: number;        // Minimum slippage threshold
}

export interface SlippageCalculationResult {
    slippageBps: number;
    confidence: number;
    reasoning: string[];
    adjustments: {
        volatility: number;
        liquidity: number;
        congestion: number;
        final: number;
    };
}

// OPTIMIZATION: Dynamic slippage for 95% opportunity capture
export class DynamicSlippageManager {
    private volatilityCache = new Map<string, TokenVolatilityMetrics>();
    private config: DynamicSlippageConfig;
    private priceHistory = new Map<string, Array<{ price: bigint; timestamp: number }>>();
    
    constructor(private providers: Map<number, JsonRpcProvider>) {
        this.config = {
            baseSlippage: 0.001,        // 0.1% base
            volatilityMultiplier: 2.0,   // 2x volatility impact
            liquidityAdjustment: 0.5,    // 50% liquidity adjustment
            networkCongestionFactor: 1.5, // 1.5x during congestion
            maxSlippage: 0.03,          // 3% maximum
            minSlippage: 0.0005         // 0.05% minimum
        };
    }
    
    // MAIN FUNCTION: Calculate optimal slippage for token pair
    async calculateOptimalSlippage(
        tokenA: string,
        tokenB: string,
        tradeSize: bigint,
        chainId: number
    ): Promise<SlippageCalculationResult> {
        const reasoning: string[] = [];
        const adjustments = { volatility: 0, liquidity: 0, congestion: 0, final: 0 };
        
        // Get token volatility metrics
        const [metricsA, metricsB] = await Promise.all([
            this.getTokenMetrics(tokenA, chainId),
            this.getTokenMetrics(tokenB, chainId)
        ]);
        
        // Calculate base slippage from volatility
        const avgVolatility = (metricsA.volatility24h + metricsB.volatility24h) / 2;
        let slippage = this.config.baseSlippage;
        
        // Volatility adjustment
        const volatilityAdjustment = avgVolatility * this.config.volatilityMultiplier * 0.01; // Convert % to decimal
        slippage += volatilityAdjustment;
        adjustments.volatility = volatilityAdjustment;
        reasoning.push(`Volatility (${avgVolatility.toFixed(2)}%): +${(volatilityAdjustment * 100).toFixed(3)}%`);
        
        // Liquidity depth adjustment
        const minLiquidity = Math.min(Number(metricsA.liquidityDepth), Number(metricsB.liquidityDepth));
        const liquidityRatio = Number(tradeSize) / minLiquidity;
        
        let liquidityAdjustment = 0;
        if (liquidityRatio > 0.05) { // Trade is >5% of liquidity
            liquidityAdjustment = Math.min(liquidityRatio * this.config.liquidityAdjustment, 0.02);
            slippage += liquidityAdjustment;
            adjustments.liquidity = liquidityAdjustment;
            reasoning.push(`Liquidity impact (${(liquidityRatio * 100).toFixed(1)}%): +${(liquidityAdjustment * 100).toFixed(3)}%`);
        }
        
        // Network congestion adjustment
        const congestionLevel = await this.getNetworkCongestion(chainId);
        let congestionAdjustment = 0;
        if (congestionLevel > 0.7) {
            congestionAdjustment = (congestionLevel - 0.7) * this.config.networkCongestionFactor * 0.001;
            slippage += congestionAdjustment;
            adjustments.congestion = congestionAdjustment;
            reasoning.push(`Congestion (${(congestionLevel * 100).toFixed(0)}%): +${(congestionAdjustment * 100).toFixed(3)}%`);
        }
        
        // Apply bounds
        const finalSlippage = Math.max(this.config.minSlippage, Math.min(this.config.maxSlippage, slippage));
        adjustments.final = finalSlippage;
        
        if (finalSlippage === this.config.maxSlippage) {
            reasoning.push(`Capped at maximum: ${(this.config.maxSlippage * 100).toFixed(2)}%`);
        } else if (finalSlippage === this.config.minSlippage) {
            reasoning.push(`Floored at minimum: ${(this.config.minSlippage * 100).toFixed(3)}%`);
        }
        
        // Calculate confidence based on data freshness
        const dataAge = Math.max(
            Date.now() - metricsA.lastUpdate,
            Date.now() - metricsB.lastUpdate
        );
        const confidence = Math.max(0.1, 1 - (dataAge / (5 * 60 * 1000))); // Decay over 5 minutes
        
        return {
            slippageBps: Math.round(finalSlippage * 10000),
            confidence,
            reasoning,
            adjustments
        };
    }
    
    // OPTIMIZATION: Get comprehensive token metrics
    private async getTokenMetrics(token: string, chainId: number): Promise<TokenVolatilityMetrics> {
        const cacheKey = `${token}_${chainId}`;
        const cached = this.volatilityCache.get(cacheKey);
        
        // Return cached if fresh (< 2 minutes old)
        if (cached && Date.now() - cached.lastUpdate < 120000) {
            return cached;
        }
        
        try {
            // Get current and historical prices
            const priceData = await this.fetchPriceData(token, chainId);
            const volatility = this.calculateVolatility(token, priceData);
            const liquidityDepth = await this.estimateLiquidityDepth(token, chainId);
            
            const metrics: TokenVolatilityMetrics = {
                symbol: await this.getTokenSymbol(token, chainId),
                address: token,
                volatility24h: volatility,
                liquidityDepth,
                averageSlippage: await this.calculateHistoricalSlippage(token, chainId),
                priceImpact: await this.estimatePriceImpact(token, chainId),
                lastUpdate: Date.now()
            };
            
            this.volatilityCache.set(cacheKey, metrics);
            return metrics;
            
        } catch (error) {
            console.error(`Error fetching metrics for ${token}:`, error);
            
            // Return fallback metrics
            return {
                symbol: 'UNKNOWN',
                address: token,
                volatility24h: 0.05, // 5% default volatility
                liquidityDepth: parseUnits("100", 18), // Assume 100 token liquidity
                averageSlippage: 0.002, // 0.2% default slippage
                priceImpact: 0.001, // 0.1% default impact
                lastUpdate: Date.now()
            };
        }
    }
    
    // OPTIMIZATION: Calculate 24h volatility from price history
    private calculateVolatility(token: string, prices: Array<{ price: bigint; timestamp: number }>): number {
        if (prices.length < 2) return 0.05; // Default 5%
        
        // Calculate returns
        const returns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            const prevPrice = Number(prices[i - 1].price);
            const currentPrice = Number(prices[i].price);
            const returnValue = (currentPrice - prevPrice) / prevPrice;
            returns.push(returnValue);
        }
        
        // Calculate standard deviation of returns
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);
        
        // Annualize to 24h (assuming 1-minute intervals)
        return volatility * Math.sqrt(1440); // 1440 minutes in 24h
    }
    
    // OPTIMIZATION: Estimate available liquidity depth
    private async estimateLiquidityDepth(token: string, chainId: number): Promise<bigint> {
        try {
            // For major DEXs, estimate combined liquidity
            const provider = this.providers.get(chainId);
            if (!provider) return parseUnits("50", 18); // Fallback
            
            // Simplified liquidity estimation
            // In practice, would query multiple DEX pools
            let totalLiquidity = 0n;
            
            // Query major DEXs for this token
            const dexes = ['Uniswap V3', 'Uniswap V2', 'SushiSwap'];
            for (const dex of dexes) {
                try {
                    const liquidity = await this.queryDEXLiquidity(token, chainId, dex);
                    totalLiquidity += liquidity;
                } catch (error) {
                    // Ignore errors for individual DEX queries
                }
            }
            
            // Minimum fallback liquidity
            return totalLiquidity > 0n ? totalLiquidity : parseUnits("25", 18);
            
        } catch (error) {
            return parseUnits("25", 18); // Conservative fallback
        }
    }
    
    // Helper method to fetch price data
    private async fetchPriceData(
        token: string, 
        chainId: number
    ): Promise<Array<{ price: bigint; timestamp: number }>> {
        const cacheKey = `prices_${token}_${chainId}`;
        const cached = this.priceHistory.get(cacheKey) || [];
        
        try {
            // Get current price from multiple sources
            const currentPrice = await this.getCurrentTokenPrice(token, chainId);
            
            // Add to history
            cached.push({
                price: currentPrice,
                timestamp: Date.now()
            });
            
            // Keep only last 24 hours of data
            const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const filtered = cached.filter(p => p.timestamp > dayAgo);
            
            this.priceHistory.set(cacheKey, filtered);
            return filtered;
            
        } catch (error) {
            // Return cached data if available
            return cached.length > 0 ? cached : [
                { price: parseUnits("1", 18), timestamp: Date.now() }
            ];
        }
    }
    
    private async getCurrentTokenPrice(token: string, chainId: number): Promise<bigint> {
        // Implementation would query DEX pools, price feeds, etc.
        // For now, return placeholder
        return parseUnits("1", 18);
    }
    
    private async queryDEXLiquidity(token: string, chainId: number, dex: string): Promise<bigint> {
        // Implementation would query specific DEX contracts
        // For now, return estimated liquidity based on DEX
        const baseAmounts = {
            'Uniswap V3': parseUnits("100", 18),
            'Uniswap V2': parseUnits("50", 18),
            'SushiSwap': parseUnits("25", 18)
        };
        
        return baseAmounts[dex as keyof typeof baseAmounts] || parseUnits("10", 18);
    }
    
    private async getNetworkCongestion(chainId: number): Promise<number> {
        try {
            const provider = this.providers.get(chainId);
            if (!provider) return 0.5; // Medium congestion default
            
            // Get current gas price and recent block utilization
            const feeData = await provider.getFeeData();
            const currentGasPrice = feeData.gasPrice || parseUnits("20", "gwei");
            
            // Estimate congestion based on gas price levels
            const gasGwei = Number(formatUnits(currentGasPrice, "gwei"));
            
            if (gasGwei < 20) return 0.2;      // Low congestion
            if (gasGwei < 50) return 0.5;      // Medium congestion  
            if (gasGwei < 100) return 0.7;     // High congestion
            return 0.9;                        // Very high congestion
            
        } catch (error) {
            return 0.5; // Default to medium congestion
        }
    }
    
    private async calculateHistoricalSlippage(token: string, chainId: number): Promise<number> {
        // Placeholder - would analyze historical transaction data
        return 0.002; // 0.2% default
    }
    
    private async estimatePriceImpact(token: string, chainId: number): Promise<number> {
        // Placeholder - would calculate price impact for standard trade sizes
        return 0.001; // 0.1% default
    }
    
    private async getTokenSymbol(token: string, chainId: number): Promise<string> {
        // Placeholder - would query token contract
        return "TOKEN";
    }
    
    // OPTIMIZATION: Update configuration based on performance
    updateSlippageConfig(newConfig: Partial<DynamicSlippageConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
    
    // OPTIMIZATION: Get slippage recommendations for opportunity
    async getSlippageRecommendation(
        tokenA: string,
        tokenB: string,
        tradeSize: bigint,
        chainId: number,
        urgency: 'low' | 'medium' | 'high' = 'medium'
    ): Promise<{
        conservative: number;
        balanced: number;
        aggressive: number;
        recommended: number;
        reasoning: string;
    }> {
        const baseResult = await this.calculateOptimalSlippage(tokenA, tokenB, tradeSize, chainId);
        
        // Create different risk profiles
        const conservative = baseResult.slippageBps * 1.5; // 50% higher
        const balanced = baseResult.slippageBps;
        const aggressive = baseResult.slippageBps * 0.7;   // 30% lower
        
        // Choose recommendation based on urgency
        let recommended: number;
        let reasoning: string;
        
        switch (urgency) {
            case 'low':
                recommended = aggressive;
                reasoning = "Low urgency allows for tighter slippage to maximize profit";
                break;
            case 'high':
                recommended = conservative;
                reasoning = "High urgency requires wider slippage to ensure execution";
                break;
            default:
                recommended = balanced;
                reasoning = "Balanced approach optimizes for execution probability and profit";
        }
        
        return {
            conservative: Math.round(conservative),
            balanced: Math.round(balanced),
            aggressive: Math.round(aggressive),
            recommended: Math.round(recommended),
            reasoning
        };
    }
}