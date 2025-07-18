import { ethers } from "ethers";
import axios from "axios";

export interface VolatileToken {
  symbol: string;
  address: string;
  chainId: number;
  volatility24h: number;
  volume24h: string;
  price: string;
  lastUpdate: number;
}

export interface TokenPair {
  tokenA: VolatileToken;
  tokenB: VolatileToken;
  expectedVolatility: number;
  liquidityScore: number;
}

export class VolatileTokenTracker {
  
  // High-volatility token database with addresses
  private static readonly VOLATILE_TOKENS = {
    // Arbitrum (42161)
    42161: [
      {
        symbol: "ETH",
        address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
        baseVolatility: 0.15
      },
      {
        symbol: "USDT", 
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        baseVolatility: 0.02
      },
      {
        symbol: "USDC",
        address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", 
        baseVolatility: 0.02
      },
      {
        symbol: "WBTC",
        address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        baseVolatility: 0.20
      },
      {
        symbol: "ARB",
        address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        baseVolatility: 0.35
      },
      {
        symbol: "GMX",
        address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
        baseVolatility: 0.45
      },
      {
        symbol: "MAGIC",
        address: "0x539bdE0d7Dbd336b79148AA742883198BBF60342",
        baseVolatility: 0.50
      },
      {
        symbol: "DPX",
        address: "0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55", 
        baseVolatility: 0.55
      },
      {
        symbol: "RDNT",
        address: "0x3082CC23568eA640225c2467653dB90e9250AaA0",
        baseVolatility: 0.40
      },
      {
        symbol: "PENGU",
        address: "0x5Eb2C0d1C7902C8b7E3e12Bb14A4C6b3A5A3F6e9", 
        baseVolatility: 0.75
      },
      {
        symbol: "FUN",
        address: "0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91",
        baseVolatility: 0.60
      },
      {
        symbol: "BONK",
        address: "0x09199d9A5F4448D0848e4395D065e1ad9c4a1F74",
        baseVolatility: 0.85
      },
      {
        symbol: "MOG",
        address: "0x2e9d63788249371f1DFC918a52f8d799F4a38C94",
        baseVolatility: 0.90
      },
      {
        symbol: "XLM",
        address: "0xfc1f3296458f9b2a27a0b91dd7681c4020e09d05",
        baseVolatility: 0.45
      },
      {
        symbol: "1INCH",
        address: "0x6bB7A17AcC227fd1F6781D1EeDeae01B42d65BaB",
        baseVolatility: 0.55
      },
      {
        symbol: "CVX",
        address: "0xb952A807345991BD529FDded05009F5e80Fe8F45",
        baseVolatility: 0.65
      }
    ],
    
    // Optimism (10)
    10: [
      {
        symbol: "ETH",
        address: "0x4200000000000000000000000000000000000006", // WETH
        baseVolatility: 0.15
      },
      {
        symbol: "USDC",
        address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        baseVolatility: 0.02
      },
      {
        symbol: "USDT", 
        address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        baseVolatility: 0.02
      },
      {
        symbol: "WBTC",
        address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
        baseVolatility: 0.20
      },
      {
        symbol: "OP",
        address: "0x4200000000000000000000000000000000000042",
        baseVolatility: 0.40
      },
      {
        symbol: "SNX",
        address: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4",
        baseVolatility: 0.45
      },
      {
        symbol: "PENGU", 
        address: "0x5Eb2C0d1C7902C8b7E3e12Bb14A4C6b3A5A3F6e9",
        baseVolatility: 0.75
      },
      {
        symbol: "FUN",
        address: "0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91", 
        baseVolatility: 0.60
      },
      {
        symbol: "BONK",
        address: "0x09199d9A5F4448D0848e4395D065e1ad9c4a1F74",
        baseVolatility: 0.85
      },
      {
        symbol: "MOG",
        address: "0x2e9d63788249371f1DFC918a52f8d799F4a38C94", 
        baseVolatility: 0.90
      },
      {
        symbol: "XLM",
        address: "0xfc1f3296458f9b2a27a0b91dd7681c4020e09d05",
        baseVolatility: 0.45
      },
      {
        symbol: "1INCH",
        address: "0x6bB7A17AcC227fd1F6781D1EeDeae01B42d65BaB",
        baseVolatility: 0.55
      },
      {
        symbol: "CVX",
        address: "0xb952A807345991BD529FDded05009F5e80Fe8F45",
        baseVolatility: 0.65
      }
    ]
  };

  /**
   * Get high-volatility token pairs for arbitrage scanning
   * Prioritizes ETH-USDT, ETH-BTC, ARB-ETH with 0.05% average spreads
   */
  static getHighVolatilityPairs(chainId: number): TokenPair[] {
    const tokens = this.VOLATILE_TOKENS[chainId] || [];
    const pairs: TokenPair[] = [];
    
    // Priority pairs with historical arbitrage opportunities
    const priorityPairs = [
      ["ETH", "USDT"],   // 0.05% per-minute windows - STABLECORE
      ["ETH", "USDC"],   // High liquidity, frequent spreads - STABLECORE
      ["WBTC", "ETH"],   // BTC-ETH volatility - STABLECORE
      ["ARB", "ETH"],    // Native token arbitrage
      ["GMX", "ETH"],    // High volatility DeFi token
      ["PENGU", "ETH"],  // High volatility meme token
      ["BONK", "ETH"],   // High volatility meme token
      ["MOG", "ETH"],    // Extremely high volatility
      ["FUN", "ETH"],    // Gaming token volatility
      ["XLM", "ETH"],    // Cross-chain bridge token
      ["1INCH", "ETH"],  // DEX aggregator token
      ["CVX", "ETH"],    // DeFi yield token
    ];
    
    // Add triangular arbitrage paths: ETH → volatile → USDC/USDT → ETH
    const triangularPaths = [
      ["ETH", "PENGU", "USDC"],
      ["ETH", "PENGU", "USDT"],
      ["ETH", "BONK", "USDC"],
      ["ETH", "BONK", "USDT"],
      ["ETH", "MOG", "USDC"],
      ["ETH", "MOG", "USDT"],
      ["ETH", "FUN", "USDC"],
      ["ETH", "FUN", "USDT"],
      ["ETH", "XLM", "USDC"],
      ["ETH", "XLM", "USDT"],
      ["ETH", "1INCH", "USDC"],
      ["ETH", "1INCH", "USDT"],
      ["ETH", "CVX", "USDC"],
      ["ETH", "CVX", "USDT"],
    ];
    
    if (chainId === 10) {
      priorityPairs.push(
        ["OP", "ETH"], 
        ["SNX", "ETH"],
        ["PENGU", "ETH"],
        ["BONK", "ETH"],
        ["MOG", "ETH"],
        ["FUN", "ETH"],
        ["XLM", "ETH"],
        ["1INCH", "ETH"],
        ["CVX", "ETH"]
      );
    }
    
    // Create priority pairs first (stablecore + volatile pairs)
    for (const [symbolA, symbolB] of priorityPairs) {
      const tokenA = tokens.find(t => t.symbol === symbolA);
      const tokenB = tokens.find(t => t.symbol === symbolB);
      
      if (tokenA && tokenB) {
        pairs.push({
          tokenA: this.createVolatileToken(tokenA, chainId),
          tokenB: this.createVolatileToken(tokenB, chainId),
          expectedVolatility: (tokenA.baseVolatility + tokenB.baseVolatility) / 2,
          liquidityScore: this.calculateLiquidityScore(tokenA.symbol, tokenB.symbol)
        });
      }
    }
    
    // Add triangular arbitrage pairs: ETH → volatile → stable → ETH
    for (const [symbolA, symbolB, symbolC] of triangularPaths) {
      const tokenA = tokens.find(t => t.symbol === symbolA);
      const tokenB = tokens.find(t => t.symbol === symbolB); 
      const tokenC = tokens.find(t => t.symbol === symbolC);
      
      if (tokenA && tokenB && tokenC) {
        // Create triangular path as composite pair
        pairs.push({
          tokenA: this.createVolatileToken(tokenA, chainId),
          tokenB: this.createVolatileToken(tokenC, chainId), // End with stable
          expectedVolatility: tokenB.baseVolatility * 1.5, // Higher weight for triangular
          liquidityScore: this.calculateLiquidityScore(tokenA.symbol, tokenC.symbol) * 0.8 // Slightly lower due to complexity
        });
      }
    }
    
    // Add additional volatile pairs
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const tokenA = tokens[i];
        const tokenB = tokens[j];
        
        // Skip if already in priority pairs
        const existingPair = pairs.find(p => 
          (p.tokenA.symbol === tokenA.symbol && p.tokenB.symbol === tokenB.symbol) ||
          (p.tokenA.symbol === tokenB.symbol && p.tokenB.symbol === tokenA.symbol)
        );
        
        if (!existingPair && (tokenA.baseVolatility > 0.3 || tokenB.baseVolatility > 0.3)) {
          pairs.push({
            tokenA: this.createVolatileToken(tokenA, chainId),
            tokenB: this.createVolatileToken(tokenB, chainId),
            expectedVolatility: (tokenA.baseVolatility + tokenB.baseVolatility) / 2,
            liquidityScore: this.calculateLiquidityScore(tokenA.symbol, tokenB.symbol)
          });
        }
      }
    }
    
    // Sort by expected volatility and liquidity score
    return pairs.sort((a, b) => {
      const scoreA = a.expectedVolatility * a.liquidityScore;
      const scoreB = b.expectedVolatility * b.liquidityScore;
      return scoreB - scoreA;
    });
  }
  
  /**
   * Get expanded token universe including small-cap and meme coins
   * Carefully monitors liquidity and slippage
   */
  static getExpandedTokenUniverse(chainId: number): VolatileToken[] {
    const baseTokens = this.VOLATILE_TOKENS[chainId] || [];
    const expandedTokens = [...baseTokens];
    
    // Add small-cap/meme tokens with high volatility but lower liquidity
    if (chainId === 42161) {
      expandedTokens.push(
        {
          symbol: "JONES",
          address: "0x10393c20975cF177a3513071bC110f7962CD67da",
          baseVolatility: 0.60
        },
        {
          symbol: "UMAMI", 
          address: "0x1622bF67e6e5747b81866fE0b85178a93C7F86e3",
          baseVolatility: 0.70
        },
        {
          symbol: "PLS",
          address: "0x51318B7D00db7ACc4026C88c3952B66278B6A67F",
          baseVolatility: 0.65
        }
      );
    }
    
    return expandedTokens.map(token => this.createVolatileToken(token, chainId));
  }
  
  /**
   * Fetch real-time volatility data from external APIs
   */
  static async fetchLiveVolatilityData(tokens: string[]): Promise<{ [symbol: string]: number }> {
    try {
      // Mock implementation - in production would use CoinCodex or similar API
      const volatilityData: { [symbol: string]: number } = {};
      
      // Simulate API call with realistic volatility data
      const baseVolatilities = {
        "ETH": 0.15,
        "BTC": 0.18,
        "USDT": 0.01,
        "USDC": 0.01,
        "ARB": 0.35,
        "OP": 0.40,
        "GMX": 0.45,
        "MAGIC": 0.50,
        "SNX": 0.45
      };
      
      for (const token of tokens) {
        const baseVol = baseVolatilities[token] || 0.30;
        // Add random variation ±50% to simulate real market conditions
        const variation = (Math.random() - 0.5) * 0.5;
        volatilityData[token] = Math.max(0.01, baseVol * (1 + variation));
      }
      
      return volatilityData;
      
    } catch (error) {
      console.error("Failed to fetch live volatility data:", error);
      return {};
    }
  }
  
  /**
   * Update token volatility with live data
   */
  static async updateTokenVolatility(pairs: TokenPair[]): Promise<TokenPair[]> {
    const symbols = pairs.flatMap(p => [p.tokenA.symbol, p.tokenB.symbol]);
    const uniqueSymbols = [...new Set(symbols)];
    
    const liveVolatility = await this.fetchLiveVolatilityData(uniqueSymbols);
    
    return pairs.map(pair => ({
      ...pair,
      tokenA: {
        ...pair.tokenA,
        volatility24h: liveVolatility[pair.tokenA.symbol] || pair.tokenA.volatility24h
      },
      tokenB: {
        ...pair.tokenB,
        volatility24h: liveVolatility[pair.tokenB.symbol] || pair.tokenB.volatility24h
      },
      expectedVolatility: (
        (liveVolatility[pair.tokenA.symbol] || pair.tokenA.volatility24h) +
        (liveVolatility[pair.tokenB.symbol] || pair.tokenB.volatility24h)
      ) / 2
    }));
  }
  
  private static createVolatileToken(tokenData: any, chainId: number): VolatileToken {
    return {
      symbol: tokenData.symbol,
      address: tokenData.address,
      chainId,
      volatility24h: tokenData.baseVolatility,
      volume24h: "0", // Would be fetched from API
      price: "0",     // Would be fetched from API  
      lastUpdate: Date.now()
    };
  }
  
  private static calculateLiquidityScore(symbolA: string, symbolB: string): number {
    // Higher scores for major pairs with deep liquidity
    const majorTokens = ["ETH", "WETH", "USDC", "USDT", "WBTC"]; // STABLECORE
    const defiTokens = ["ARB", "OP", "GMX", "SNX", "1INCH", "CVX"];
    const volatileTokens = ["PENGU", "FUN", "BONK", "MOG", "XLM"];
    
    let score = 1.0;
    
    // STABLECORE pairs get highest priority
    if (majorTokens.includes(symbolA) && majorTokens.includes(symbolB)) {
      score = 5.0; // Highest liquidity pairs (ETH-USDC, ETH-USDT, WBTC-ETH)
    } else if (majorTokens.includes(symbolA) || majorTokens.includes(symbolB)) {
      // Volatile token paired with major token
      if (volatileTokens.includes(symbolA) || volatileTokens.includes(symbolB)) {
        score = 4.0; // High priority for volatile/major pairs
      } else {
        score = 3.0; // Standard major token pairing
      }
    } else if (defiTokens.includes(symbolA) || defiTokens.includes(symbolB)) {
      score = 2.5; // DeFi tokens have good liquidity
    } else if (volatileTokens.includes(symbolA) || volatileTokens.includes(symbolB)) {
      score = 2.0; // Volatile tokens have moderate liquidity
    }
    
    return score;
  }
  
  /**
   * Get the most volatile tokens for dynamic expansion
   */
  static getMostVolatileTokens(chainId: number, limit: number = 10): VolatileToken[] {
    const tokens = this.getExpandedTokenUniverse(chainId);
    return tokens
      .sort((a, b) => b.volatility24h - a.volatility24h)
      .slice(0, limit);
  }
  
  /**
   * Format volatility data for logging
   */
  static formatVolatilityInfo(pair: TokenPair): string {
    return `${pair.tokenA.symbol}/${pair.tokenB.symbol} (vol: ${(pair.expectedVolatility * 100).toFixed(1)}%, liq: ${pair.liquidityScore.toFixed(1)})`;
  }
}