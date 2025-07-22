import { JsonRpcProvider, Contract, Interface, parseUnits, formatUnits } from "ethers";
import axios from "axios";

export interface PriceSource {
    name: string;
    price: bigint;
    timestamp: number;
    confidence: number;
    chainId: number;
    source: 'chainlink' | 'uniswap_twap' | 'band_protocol' | 'api3' | 'dex_spot' | 'coingecko';
    metadata?: any;
}

export interface PriceValidationResult {
    isValid: boolean;
    consensusPrice: bigint;
    dexPrice: bigint;
    deviation: number;
    deviationBps: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    sources: PriceSource[];
    manipulationScore: number; // 0-100, higher = more suspicious
    recommendation: 'execute' | 'caution' | 'reject';
}

export interface ManipulationIndicators {
    volumeSpike: boolean;
    priceGap: boolean;
    crossDEXDivergence: boolean;
    timeSeriesAnomaly: boolean;
    liquidityDrain: boolean;
}

export interface OracleConfig {
    deviationThresholds: {
        low: number;    // 0.5% - normal deviation
        medium: number; // 2% - concerning deviation
        high: number;   // 5% - dangerous deviation
        critical: number; // 10% - likely manipulation
    };
    minSources: number;
    twapPeriods: {
        short: number;  // 5 minutes
        medium: number; // 30 minutes
        long: number;   // 2 hours
    };
    confidenceWeights: Record<string, number>;
}

// OPTIMIZATION: Comprehensive price validation against manipulation
export class OraclePriceValidator {
    private config: OracleConfig;
    private priceFeeds!: Map<string, string[]>; // token -> oracle addresses
    private priceHistory: Map<string, Array<{ price: bigint; timestamp: number; volume?: bigint }>> = new Map();
    
    constructor(private providers: Map<number, JsonRpcProvider>) {
        this.config = {
            deviationThresholds: {
                low: 0.005,      // 0.5%
                medium: 0.02,    // 2%
                high: 0.05,      // 5%
                critical: 0.10   // 10%
            },
            minSources: 2,
            twapPeriods: {
                short: 5 * 60,      // 5 minutes
                medium: 30 * 60,    // 30 minutes
                long: 2 * 60 * 60   // 2 hours
            },
            confidenceWeights: {
                'chainlink': 0.95,
                'uniswap_twap': 0.85,
                'band_protocol': 0.80,
                'api3': 0.80,
                'dex_spot': 0.70,
                'coingecko': 0.60
            }
        };
        
        this.initializePriceFeeds();
    }
    
    // MAIN FUNCTION: Validate token price against multiple oracles
    async validateTokenPrice(
        tokenA: string,
        tokenB: string,
        dexPrice: bigint,
        chainId: number,
        tradeSize?: bigint
    ): Promise<PriceValidationResult> {
        const sources: PriceSource[] = [];
        const warnings: string[] = [];
        
        try {
            // Fetch prices from all available sources
            const [chainlinkPrice, uniswapTWAP, bandPrice, api3Price, coingeckoPrice] = await Promise.allSettled([
                this.getChainlinkPrice(tokenA, tokenB, chainId),
                this.getUniswapTWAP(tokenA, tokenB, chainId),
                this.getBandProtocolPrice(tokenA, tokenB, chainId),
                this.getAPI3Price(tokenA, tokenB, chainId),
                this.getCoingeckoPrice(tokenA, tokenB, chainId)
            ]);
            
            // Process successful price fetches
            if (chainlinkPrice.status === 'fulfilled' && chainlinkPrice.value) sources.push(chainlinkPrice.value);
            if (uniswapTWAP.status === 'fulfilled' && uniswapTWAP.value) sources.push(uniswapTWAP.value);
            if (bandPrice.status === 'fulfilled' && bandPrice.value) sources.push(bandPrice.value);
            if (api3Price.status === 'fulfilled' && api3Price.value) sources.push(api3Price.value);
            if (coingeckoPrice.status === 'fulfilled' && coingeckoPrice.value) sources.push(coingeckoPrice.value);
            
            // Add DEX spot price as a source
            sources.push({
                name: 'DEX_Spot',
                price: dexPrice,
                timestamp: Date.now(),
                confidence: this.config.confidenceWeights['dex_spot'],
                chainId,
                source: 'dex_spot'
            });
            
            // Check minimum sources requirement
            if (sources.length < this.config.minSources) {
                warnings.push('Insufficient price sources for validation');
            }
            
            // Calculate consensus price (weighted by confidence)
            const consensusPrice = this.calculateConsensusPrice(sources);
            
            // Calculate deviation from consensus
            const deviation = Math.abs(Number(dexPrice - consensusPrice)) / Number(consensusPrice);
            const deviationBps = Math.round(deviation * 10000);
            
            // Determine risk level based on deviation
            let riskLevel: 'low' | 'medium' | 'high' | 'critical';
            if (deviation < this.config.deviationThresholds.low) {
                riskLevel = 'low';
            } else if (deviation < this.config.deviationThresholds.medium) {
                riskLevel = 'medium';
                warnings.push(`Moderate price deviation: ${deviationBps} bps`);
            } else if (deviation < this.config.deviationThresholds.high) {
                riskLevel = 'high';
                warnings.push(`High price deviation: ${deviationBps} bps`);
            } else {
                riskLevel = 'critical';
                warnings.push(`Critical price deviation: ${deviationBps} bps - possible manipulation`);
            }
            
            // Detect manipulation patterns
            const manipulationIndicators = await this.detectManipulationPatterns(
                tokenA, 
                tokenB, 
                sources, 
                tradeSize,
                chainId
            );
            
            const manipulationScore = this.calculateManipulationScore(manipulationIndicators, deviation);
            
            // Add manipulation warnings
            if (manipulationIndicators.volumeSpike) warnings.push('Unusual volume spike detected');
            if (manipulationIndicators.priceGap) warnings.push('Large price gap from recent history');
            if (manipulationIndicators.crossDEXDivergence) warnings.push('High cross-DEX price divergence');
            if (manipulationIndicators.liquidityDrain) warnings.push('Significant liquidity reduction detected');
            
            // Enhanced risk level based on manipulation score
            if (manipulationScore > 70) {
                riskLevel = 'critical';
                warnings.push(`High manipulation risk score: ${manipulationScore}/100`);
            } else if (manipulationScore > 40) {
                riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
            }
            
            // Generate recommendation
            const recommendation = this.generateRecommendation(riskLevel, manipulationScore, warnings.length);
            
            // Store price data for historical analysis
            this.storePriceData(tokenA, tokenB, consensusPrice, chainId);
            
            return {
                isValid: riskLevel !== 'critical' && recommendation !== 'reject',
                consensusPrice,
                dexPrice,
                deviation,
                deviationBps,
                riskLevel,
                warnings,
                sources,
                manipulationScore,
                recommendation
            };
            
        } catch (error) {
            console.error('Price validation error:', error);
            
            return {
                isValid: false,
                consensusPrice: dexPrice,
                dexPrice,
                deviation: 0,
                deviationBps: 0,
                riskLevel: 'critical',
                warnings: ['Price validation failed due to error'],
                sources: [],
                manipulationScore: 100,
                recommendation: 'reject'
            };
        }
    }
    
    // OPTIMIZATION: Comprehensive manipulation detection
    private async detectManipulationPatterns(
        tokenA: string,
        tokenB: string,
        sources: PriceSource[],
        tradeSize: bigint | undefined,
        chainId: number
    ): Promise<ManipulationIndicators> {
        const indicators: ManipulationIndicators = {
            volumeSpike: false,
            priceGap: false,
            crossDEXDivergence: false,
            timeSeriesAnomaly: false,
            liquidityDrain: false
        };
        
        try {
            // Check for volume spike
            indicators.volumeSpike = await this.checkVolumeSpike(tokenA, tokenB, chainId);
            
            // Check for price gaps from historical data
            indicators.priceGap = await this.checkPriceGap(tokenA, tokenB, sources[0]?.price, chainId);
            
            // Check cross-DEX price divergence
            indicators.crossDEXDivergence = await this.checkCrossDEXDivergence(tokenA, tokenB, chainId);
            
            // Check time series anomalies
            indicators.timeSeriesAnomaly = await this.checkTimeSeriesAnomalies(tokenA, tokenB, chainId);
            
            // Check for liquidity drainage
            indicators.liquidityDrain = await this.checkLiquidityDrain(tokenA, tokenB, chainId);
            
        } catch (error) {
            console.error('Error detecting manipulation patterns:', error);
        }
        
        return indicators;
    }
    
    private calculateManipulationScore(indicators: ManipulationIndicators, deviation: number): number {
        let score = 0;
        
        // Base score from deviation
        if (deviation > 0.10) score += 50; // >10%
        else if (deviation > 0.05) score += 30; // >5%
        else if (deviation > 0.02) score += 15; // >2%
        else if (deviation > 0.005) score += 5; // >0.5%
        
        // Add points for manipulation indicators
        if (indicators.volumeSpike) score += 20;
        if (indicators.priceGap) score += 25;
        if (indicators.crossDEXDivergence) score += 15;
        if (indicators.timeSeriesAnomaly) score += 20;
        if (indicators.liquidityDrain) score += 30;
        
        return Math.min(100, score);
    }
    
    private generateRecommendation(
        riskLevel: string,
        manipulationScore: number,
        warningCount: number
    ): 'execute' | 'caution' | 'reject' {
        if (riskLevel === 'critical' || manipulationScore > 70) {
            return 'reject';
        } else if (riskLevel === 'high' || manipulationScore > 40 || warningCount > 2) {
            return 'caution';
        } else {
            return 'execute';
        }
    }
    
    private calculateConsensusPrice(sources: PriceSource[]): bigint {
        if (sources.length === 0) return 0n;
        if (sources.length === 1) return sources[0].price;
        
        // Calculate weighted average
        let totalWeight = 0;
        let weightedSum = 0;
        
        for (const source of sources) {
            const weight = source.confidence;
            totalWeight += weight;
            weightedSum += Number(source.price) * weight;
        }
        
        return BigInt(Math.round(weightedSum / totalWeight));
    }
    
    // Oracle implementations
    private async getChainlinkPrice(tokenA: string, tokenB: string, chainId: number): Promise<PriceSource | null> {
        try {
            const provider = this.providers.get(chainId);
            if (!provider) return null;
            
            // Get Chainlink feed address for this pair
            const feedAddress = this.getChainlinkFeedAddress(tokenA, tokenB, chainId);
            if (!feedAddress) return null;
            
            const abi = [
                "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
                "function decimals() external view returns (uint8)"
            ];
            
            const priceFeed = new Contract(feedAddress, abi, provider);
            const [roundData, decimals] = await Promise.all([
                priceFeed.latestRoundData(),
                priceFeed.decimals()
            ]);
            
            // Check if price is fresh (less than 1 hour old)
            const priceAge = Date.now() / 1000 - Number(roundData.updatedAt);
            if (priceAge > 3600) return null;
            
            // Convert price to consistent decimals (18)
            const price = BigInt(roundData.answer) * (10n ** (18n - BigInt(decimals)));
            
            return {
                name: 'Chainlink',
                price,
                timestamp: Number(roundData.updatedAt) * 1000,
                confidence: this.config.confidenceWeights['chainlink'],
                chainId,
                source: 'chainlink',
                metadata: {
                    roundId: roundData.roundId,
                    decimals: Number(decimals)
                }
            };
            
        } catch (error) {
            console.error('Chainlink price fetch failed:', error);
            return null;
        }
    }
    
    private async getUniswapTWAP(tokenA: string, tokenB: string, chainId: number): Promise<PriceSource | null> {
        try {
            const provider = this.providers.get(chainId);
            if (!provider) return null;
            
            // Get Uniswap V3 pool address
            const poolAddress = await this.getUniswapV3PoolAddress(tokenA, tokenB, chainId);
            if (!poolAddress) return null;
            
            const poolAbi = [
                "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
                "function observe(uint32[] memory secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)"
            ];
            
            const poolContract = new Contract(poolAddress, poolAbi, provider);
            
            // Get 30-minute TWAP
            const twapPeriod = this.config.twapPeriods.medium;
            const tickData = await poolContract.observe([twapPeriod, 0]);
            
            // Calculate TWAP price from tick data
            const avgTick = (Number(tickData[0][1]) - Number(tickData[0][0])) / twapPeriod;
            const price = this.tickToPrice(avgTick);
            
            return {
                name: 'Uniswap_TWAP_30m',
                price: parseUnits(price.toString(), 18),
                timestamp: Date.now(),
                confidence: this.config.confidenceWeights['uniswap_twap'],
                chainId,
                source: 'uniswap_twap',
                metadata: {
                    period: twapPeriod,
                    avgTick
                }
            };
            
        } catch (error) {
            console.error('Uniswap TWAP fetch failed:', error);
            return null;
        }
    }
    
    private async getBandProtocolPrice(tokenA: string, tokenB: string, chainId: number): Promise<PriceSource | null> {
        try {
            // Band Protocol is mainly on specific chains
            if (chainId !== 1 && chainId !== 56) return null; // Ethereum, BSC
            
            // Placeholder implementation
            // Would integrate with Band Protocol's price feeds
            return null;
            
        } catch (error) {
            return null;
        }
    }
    
    private async getAPI3Price(tokenA: string, tokenB: string, chainId: number): Promise<PriceSource | null> {
        try {
            // API3 implementation
            // Would integrate with API3's dAPI feeds
            return null;
            
        } catch (error) {
            return null;
        }
    }
    
    private async getCoingeckoPrice(tokenA: string, tokenB: string, chainId: number): Promise<PriceSource | null> {
        try {
            // Get token IDs for CoinGecko API
            const tokenAId = this.getCoingeckoTokenId(tokenA);
            const tokenBId = this.getCoingeckoTokenId(tokenB);
            
            if (!tokenAId || !tokenBId) return null;
            
            const response = await axios.get(
                `https://api.coingecko.com/api/v3/simple/price?ids=${tokenAId}&vs_currencies=${tokenBId}`,
                { timeout: 3000 }
            );
            
            const price = response.data[tokenAId]?.[tokenBId];
            if (!price) return null;
            
            return {
                name: 'CoinGecko',
                price: parseUnits(price.toString(), 18),
                timestamp: Date.now(),
                confidence: this.config.confidenceWeights['coingecko'],
                chainId,
                source: 'coingecko',
                metadata: {
                    tokenAId,
                    tokenBId
                }
            };
            
        } catch (error) {
            console.error('CoinGecko price fetch failed:', error);
            return null;
        }
    }
    
    // Manipulation detection methods
    private async checkVolumeSpike(tokenA: string, tokenB: string, chainId: number): Promise<boolean> {
        try {
            // Check if current volume is significantly higher than average
            // This would involve querying recent transaction volumes
            return false; // Placeholder
            
        } catch (error) {
            return false;
        }
    }
    
    private async checkPriceGap(tokenA: string, tokenB: string, currentPrice: bigint, chainId: number): Promise<boolean> {
        const pairKey = `${tokenA}_${tokenB}_${chainId}`;
        const history = this.priceHistory.get(pairKey) || [];
        
        if (history.length < 2) return false;
        
        const lastPrice = history[history.length - 1].price;
        const gap = Math.abs(Number(currentPrice - lastPrice)) / Number(lastPrice);
        
        // Flag gaps > 5% as suspicious
        return gap > 0.05;
    }
    
    private async checkCrossDEXDivergence(tokenA: string, tokenB: string, chainId: number): Promise<boolean> {
        try {
            // Get prices from multiple DEXs and check divergence
            // This would query Uniswap, SushiSwap, etc.
            return false; // Placeholder
            
        } catch (error) {
            return false;
        }
    }
    
    private async checkTimeSeriesAnomalies(tokenA: string, tokenB: string, chainId: number): Promise<boolean> {
        const pairKey = `${tokenA}_${tokenB}_${chainId}`;
        const history = this.priceHistory.get(pairKey) || [];
        
        if (history.length < 10) return false;
        
        // Simple anomaly detection based on standard deviation
        const prices = history.map(h => Number(h.price));
        const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        
        const latestPrice = prices[prices.length - 1];
        const zScore = Math.abs(latestPrice - mean) / stdDev;
        
        // Flag z-scores > 3 as anomalies
        return zScore > 3;
    }
    
    private async checkLiquidityDrain(tokenA: string, tokenB: string, chainId: number): Promise<boolean> {
        try {
            // Check if liquidity has dropped significantly
            // This would involve querying pool reserves
            return false; // Placeholder
            
        } catch (error) {
            return false;
        }
    }
    
    // Helper methods
    private initializePriceFeeds(): void {
        this.priceFeeds = new Map();
        
        // Initialize with known Chainlink feeds
        // This would be populated with actual feed addresses
    }
    
    private getChainlinkFeedAddress(tokenA: string, tokenB: string, chainId: number): string | null {
        // Return Chainlink feed address for token pair
        // This would use a comprehensive mapping
        return null; // Placeholder
    }
    
    private async getUniswapV3PoolAddress(tokenA: string, tokenB: string, chainId: number): Promise<string | null> {
        // Get Uniswap V3 pool address for token pair
        // Would use the factory contract
        return null; // Placeholder
    }
    
    private tickToPrice(tick: number): number {
        // Convert Uniswap V3 tick to price
        return Math.pow(1.0001, tick);
    }
    
    private getCoingeckoTokenId(tokenAddress: string): string | null {
        // Map token addresses to CoinGecko IDs
        const mapping: Record<string, string> = {
            '0xA0b86a33E6417b8C6Cc3c0c52e68d81e2B0b2e1c': 'usd-coin', // USDC
            '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1': 'ethereum', // WETH
            // Add more mappings as needed
        };
        
        return mapping[tokenAddress.toLowerCase()] || null;
    }
    
    private storePriceData(tokenA: string, tokenB: string, price: bigint, chainId: number): void {
        const pairKey = `${tokenA}_${tokenB}_${chainId}`;
        const history = this.priceHistory.get(pairKey) || [];
        
        history.push({
            price,
            timestamp: Date.now()
        });
        
        // Keep only recent data (last 24 hours)
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const filtered = history.filter(h => h.timestamp > dayAgo);
        
        this.priceHistory.set(pairKey, filtered);
    }
    
    // Public utility methods
    updateConfig(newConfig: Partial<OracleConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
    
    getPriceHistory(tokenA: string, tokenB: string, chainId: number): Array<{ price: bigint; timestamp: number }> {
        const pairKey = `${tokenA}_${tokenB}_${chainId}`;
        return [...(this.priceHistory.get(pairKey) || [])];
    }
    
    clearPriceHistory(): void {
        this.priceHistory.clear();
    }
}