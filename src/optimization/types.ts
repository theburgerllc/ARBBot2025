/**
 * Market Optimization Protocol - Type Definitions
 * Enhanced MEV Bot with Adaptive Intelligence
 */

import { BigNumberish } from "ethers";

// Market Condition Analysis
export interface MarketConditions {
  volatility: number;              // 0-1 scale (0 = stable, 1 = highly volatile)
  liquidity: number;               // Available liquidity depth in ETH
  gasPrice: bigint;                // Current gas price in wei
  networkCongestion: number;       // 0-1 scale (0 = fast, 1 = congested)
  competitionLevel: number;        // 0-1 scale (0 = low, 1 = high MEV competition)
  timeOfDay: 'quiet' | 'active' | 'peak';
  marketTrend: 'bull' | 'bear' | 'sideways';
  blockNumber: number;
  timestamp: number;
}

// Optimization Parameters
export interface OptimizedParameters {
  minProfitThreshold: bigint;      // Minimum profit in wei
  slippageTolerance: number;       // Basis points (100 = 1%)
  maxTradeSize: bigint;            // Maximum trade size in wei
  gasSettings: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
  };
  cooldownPeriod: number;          // Milliseconds between trades
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
}

// Performance Metrics
export interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  successRate: number;             // 0-1 scale
  totalProfit: bigint;
  avgProfitPerTrade: bigint;
  totalGasUsed: bigint;
  avgGasPerTrade: bigint;
  gasEfficiency: number;           // Profit/Gas ratio
  roi24h: number;                  // 24-hour ROI percentage
  opportunityCapture: number;      // Percentage of detected opportunities executed
  avgExecutionTime: number;        // Milliseconds
  lastUpdated: number;
}

// Optimization Configuration
export interface OptimizationConfig {
  enabled: boolean;
  frequency: number;               // Optimization frequency in milliseconds
  minSampleSize: number;          // Minimum trades before optimization
  volatilityWindow: number;       // Blocks to analyze for volatility
  performanceWindow: number;      // Hours to consider for performance metrics
  adaptationSpeed: number;        // 0-1 scale (0 = slow, 1 = fast adaptation)
  safetyBounds: {
    minProfitThreshold: bigint;
    maxProfitThreshold: bigint;
    minSlippage: number;
    maxSlippage: number;
    minTradeSize: bigint;
    maxTradeSize: bigint;
  };
}

// Market Analysis Result
export interface MarketAnalysis {
  conditions: MarketConditions;
  recommendation: 'aggressive' | 'balanced' | 'conservative' | 'pause';
  confidence: number;              // 0-1 scale
  reasoning: string[];
  suggestedParameters: OptimizedParameters;
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigation: string[];
  };
}

// Optimization Result
export interface OptimizationResult {
  timestamp: number;
  previousParameters: OptimizedParameters;
  newParameters: OptimizedParameters;
  marketAnalysis: MarketAnalysis;
  expectedImprovement: number;     // Estimated % improvement
  changesApplied: string[];
  metricsSnapshot: PerformanceMetrics;
}

// Market Regime
export interface MarketRegime {
  type: 'bull_market' | 'bear_market' | 'sideways' | 'high_volatility' | 'low_volatility';
  strength: number;                // 0-1 scale
  duration: number;               // Milliseconds in current regime
  stability: number;              // 0-1 scale (how stable is this regime)
}

// Optimization State
export interface OptimizationState {
  isRunning: boolean;
  lastOptimization: number;
  nextOptimization: number;
  totalOptimizations: number;
  currentRegime: MarketRegime;
  performanceMetrics: PerformanceMetrics;
  currentParameters: OptimizedParameters;
  adaptationHistory: OptimizationResult[];
}

// Trade Execution Context
export interface TradeContext {
  opportunity: {
    id: string;
    profit: bigint;
    gasEstimate: bigint;
    confidence: number;
  };
  marketConditions: MarketConditions;
  parameters: OptimizedParameters;
  timestamp: number;
}

// Optimization Events
export interface OptimizationEvent {
  type: 'parameter_change' | 'regime_change' | 'performance_update' | 'optimization_complete';
  timestamp: number;
  data: any;
  impact: 'low' | 'medium' | 'high';
}

// Configuration Profiles for Different Market Types
export interface MarketProfile {
  name: string;
  description: string;
  conditions: {
    volatilityRange: [number, number];
    liquidityRange: [number, number];
    competitionRange: [number, number];
  };
  parameters: {
    profitMultiplier: number;
    gasUrgency: 'low' | 'medium' | 'high';
    riskTolerance: number;
    adaptationSpeed: number;
  };
}

// Custom Optimization Rules
export interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  condition: (market: MarketConditions, performance: PerformanceMetrics) => boolean;
  action: (params: OptimizedParameters) => OptimizedParameters;
  priority: number;
  enabled: boolean;
}