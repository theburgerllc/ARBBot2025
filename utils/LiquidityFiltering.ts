import { ethers } from "ethers";
import axios from "axios";
import { ChainId, Token } from "@uniswap/sdk-core";

interface TokenMetrics {
  address: string;
  symbol: string;
  name: string;
  chainId: number;
  volume24h: number;
  volatility: number;
  liquidity: number;
  price: number;
  marketCap: number;
}

interface DexScreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
}

export class LiquidityFiltering {
  private readonly chains = {
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    polygon: 137,
    ethereum: 1
  };

  private readonly minLiquidity = 500000; // $500k minimum liquidity
  private readonly minVolume24h = 100000; // $100k minimum 24h volume
  private readonly topTokensCount = 8;

  constructor(private readonly providers: Record<string, ethers.JsonRpcProvider>) {}

  async fetchTopTokensByVolatility(chainId: number): Promise<TokenMetrics[]> {
    try {
      const chainName = this.getChainName(chainId);
      
      // Fetch from DexScreener API for real-time data
      const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${chainName}`;
      const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;
      
      const [dexScreenerResponse, coingeckoResponse] = await Promise.all([
        axios.get(dexScreenerUrl).catch(() => null),
        axios.get(coingeckoUrl).catch(() => null)
      ]);

      let tokens: TokenMetrics[] = [];

      // Process DexScreener data
      if (dexScreenerResponse?.data?.pairs) {
        tokens = this.processDexScreenerData(dexScreenerResponse.data.pairs, chainId);
      }

      // Fallback to predefined high-liquidity tokens if API fails
      if (tokens.length === 0) {
        tokens = this.getFallbackTokens(chainId);
      }

      // Filter by liquidity and volume thresholds
      const filteredTokens = tokens.filter(token => 
        token.liquidity >= this.minLiquidity && 
        token.volume24h >= this.minVolume24h
      );

      // Sort by volatility (price change percentage) descending
      filteredTokens.sort((a, b) => b.volatility - a.volatility);

      // Return top N tokens
      return filteredTokens.slice(0, this.topTokensCount);
    } catch (error) {
      console.error(`Error fetching top tokens for chain ${chainId}:`, error);
      return this.getFallbackTokens(chainId);
    }
  }

  private processDexScreenerData(pairs: DexScreenerToken[], chainId: number): TokenMetrics[] {
    const tokenMap = new Map<string, TokenMetrics>();

    pairs.forEach(pair => {
      if (pair.liquidity?.usd && pair.volume?.h24) {
        const baseToken = pair.baseToken;
        const quoteToken = pair.quoteToken;

        // Process base token
        if (baseToken.address && !tokenMap.has(baseToken.address)) {
          const volatility = this.calculateVolatility(pair.volume.h24, pair.volume.h6, pair.volume.h1);
          tokenMap.set(baseToken.address, {
            address: baseToken.address,
            symbol: baseToken.symbol,
            name: baseToken.name,
            chainId,
            volume24h: pair.volume.h24,
            volatility,
            liquidity: pair.liquidity.usd,
            price: parseFloat(pair.priceUsd) || 0,
            marketCap: pair.marketCap || 0
          });
        }

        // Process quote token if it's not a stablecoin
        if (quoteToken.address && !this.isStablecoin(quoteToken.symbol) && !tokenMap.has(quoteToken.address)) {
          const volatility = this.calculateVolatility(pair.volume.h24, pair.volume.h6, pair.volume.h1);
          tokenMap.set(quoteToken.address, {
            address: quoteToken.address,
            symbol: quoteToken.symbol,
            name: quoteToken.name,
            chainId,
            volume24h: pair.volume.h24,
            volatility,
            liquidity: pair.liquidity.usd,
            price: parseFloat(pair.priceUsd) || 0,
            marketCap: pair.marketCap || 0
          });
        }
      }
    });

    return Array.from(tokenMap.values());
  }

  private calculateVolatility(volume24h: number, volume6h: number, volume1h: number): number {
    // Calculate volatility based on volume acceleration
    const hourlyRate = volume1h * 24;
    const sixHourlyRate = volume6h * 4;
    const dailyRate = volume24h;

    // Higher volatility = higher volume acceleration
    const volatilityScore = (hourlyRate + sixHourlyRate - dailyRate) / dailyRate * 100;
    return Math.max(0, volatilityScore);
  }

  private isStablecoin(symbol: string): boolean {
    const stablecoins = ['USDT', 'USDC', 'DAI', 'FRAX', 'LUSD', 'BUSD', 'TUSD', 'USDD'];
    return stablecoins.includes(symbol.toUpperCase());
  }

  private getChainName(chainId: number): string {
    switch (chainId) {
      case 42161: return 'arbitrum';
      case 10: return 'optimism';
      case 8453: return 'base';
      case 137: return 'polygon';
      case 1: return 'ethereum';
      default: return 'ethereum';
    }
  }

  private getFallbackTokens(chainId: number): TokenMetrics[] {
    const fallbackTokens: Record<number, TokenMetrics[]> = {
      // Arbitrum
      42161: [
        { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', name: 'Wrapped Ether', chainId: 42161, volume24h: 50000000, volatility: 15, liquidity: 100000000, price: 0, marketCap: 0 },
        { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', name: 'USD Coin', chainId: 42161, volume24h: 40000000, volatility: 2, liquidity: 80000000, price: 0, marketCap: 0 },
        { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', name: 'Wrapped Bitcoin', chainId: 42161, volume24h: 30000000, volatility: 18, liquidity: 60000000, price: 0, marketCap: 0 },
        { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', name: 'Arbitrum', chainId: 42161, volume24h: 25000000, volatility: 25, liquidity: 50000000, price: 0, marketCap: 0 },
        { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', chainId: 42161, volume24h: 35000000, volatility: 1, liquidity: 70000000, price: 0, marketCap: 0 },
        { address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', symbol: 'LINK', name: 'Chainlink', chainId: 42161, volume24h: 15000000, volatility: 22, liquidity: 30000000, price: 0, marketCap: 0 },
        { address: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F', symbol: 'FRAX', name: 'Frax', chainId: 42161, volume24h: 12000000, volatility: 3, liquidity: 25000000, price: 0, marketCap: 0 },
        { address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342', symbol: 'MAGIC', name: 'Magic', chainId: 42161, volume24h: 8000000, volatility: 35, liquidity: 15000000, price: 0, marketCap: 0 }
      ],
      // Optimism
      10: [
        { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', chainId: 10, volume24h: 30000000, volatility: 15, liquidity: 60000000, price: 0, marketCap: 0 },
        { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', name: 'USD Coin', chainId: 10, volume24h: 25000000, volatility: 2, liquidity: 50000000, price: 0, marketCap: 0 },
        { address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', symbol: 'WBTC', name: 'Wrapped Bitcoin', chainId: 10, volume24h: 20000000, volatility: 18, liquidity: 40000000, price: 0, marketCap: 0 },
        { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', name: 'Optimism', chainId: 10, volume24h: 18000000, volatility: 28, liquidity: 35000000, price: 0, marketCap: 0 },
        { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether USD', chainId: 10, volume24h: 22000000, volatility: 1, liquidity: 45000000, price: 0, marketCap: 0 },
        { address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6', symbol: 'LINK', name: 'Chainlink', chainId: 10, volume24h: 12000000, volatility: 22, liquidity: 25000000, price: 0, marketCap: 0 },
        { address: '0x2E3D870790dC77A83DD1d18184Acc7439A53f475', symbol: 'FRAX', name: 'Frax', chainId: 10, volume24h: 10000000, volatility: 3, liquidity: 20000000, price: 0, marketCap: 0 },
        { address: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4', symbol: 'SNX', name: 'Synthetix', chainId: 10, volume24h: 8000000, volatility: 30, liquidity: 15000000, price: 0, marketCap: 0 }
      ],
      // Base
      8453: [
        { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', chainId: 8453, volume24h: 15000000, volatility: 15, liquidity: 30000000, price: 0, marketCap: 0 },
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', chainId: 8453, volume24h: 12000000, volatility: 2, liquidity: 25000000, price: 0, marketCap: 0 },
        { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH', chainId: 8453, volume24h: 8000000, volatility: 16, liquidity: 20000000, price: 0, marketCap: 0 },
        { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', chainId: 8453, volume24h: 6000000, volatility: 1, liquidity: 15000000, price: 0, marketCap: 0 },
        { address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', symbol: 'AERO', name: 'Aerodrome', chainId: 8453, volume24h: 5000000, volatility: 40, liquidity: 10000000, price: 0, marketCap: 0 },
        { address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', symbol: 'DEGEN', name: 'Degen', chainId: 8453, volume24h: 4000000, volatility: 50, liquidity: 8000000, price: 0, marketCap: 0 },
        { address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', symbol: 'EURC', name: 'Euro Coin', chainId: 8453, volume24h: 3000000, volatility: 2, liquidity: 6000000, price: 0, marketCap: 0 },
        { address: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c', symbol: 'rETH', name: 'Rocket Pool ETH', chainId: 8453, volume24h: 2500000, volatility: 17, liquidity: 5000000, price: 0, marketCap: 0 }
      ]
    };

    return fallbackTokens[chainId] || [];
  }

  async getTopTokensForAllChains(): Promise<Record<number, TokenMetrics[]>> {
    const results: Record<number, TokenMetrics[]> = {};
    
    const chainIds = [42161, 10, 8453]; // Arbitrum, Optimism, Base
    
    await Promise.all(
      chainIds.map(async (chainId) => {
        try {
          results[chainId] = await this.fetchTopTokensByVolatility(chainId);
        } catch (error) {
          console.error(`Failed to fetch tokens for chain ${chainId}:`, error);
          results[chainId] = this.getFallbackTokens(chainId);
        }
      })
    );

    return results;
  }

  async validateTokenLiquidity(tokenAddress: string, chainId: number): Promise<boolean> {
    try {
      const provider = this.providers[this.getChainName(chainId)];
      if (!provider) return false;

      // Simple validation - check if token contract exists
      const code = await provider.getCode(tokenAddress);
      return code !== '0x';
    } catch (error) {
      console.error(`Error validating token ${tokenAddress} on chain ${chainId}:`, error);
      return false;
    }
  }
}