/**
 * Optimization Monitor - Logging and Monitoring Integration
 * Provides comprehensive monitoring and logging for the Market Optimization Protocol
 */

import * as winston from "winston";
import { EventEmitter } from "events";
import { formatEther } from "ethers";

import { OptimizedParameters, OptimizationResult, PerformanceMetrics } from "./types";

export interface OptimizationMetrics {
  timestamp: number;
  optimizationsPerformed: number;
  averageImprovement: number;
  parametersChanged: number;
  validationErrors: number;
  validationWarnings: number;
  uptime: number;
  successRate: number;
  profitImprovement: number;
  gasEfficiencyImprovement: number;
}

export interface AlertThresholds {
  maxValidationErrors: number;
  minSuccessRate: number;
  maxDowntime: number;
  minProfitImprovement: number;
  maxParameterChangeFrequency: number;
}

export class OptimizationMonitor extends EventEmitter {
  private logger: winston.Logger;
  private metrics: OptimizationMetrics[];
  private startTime: number;
  private alertThresholds: AlertThresholds;
  private currentPeriodMetrics: OptimizationMetrics;
  private logFilePath: string;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(logFilePath?: string) {
    super();
    
    this.logFilePath = logFilePath || 'optimization-monitor.log';
    this.startTime = Date.now();
    this.metrics = [];
    
    // Initialize logger with structured logging
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: this.logFilePath,
          level: 'debug'
        }),
        new winston.transports.File({ 
          filename: 'optimization-errors.log', 
          level: 'error' 
        })
      ]
    });

    // Alert thresholds
    this.alertThresholds = {
      maxValidationErrors: 10, // per hour
      minSuccessRate: 0.7, // 70%
      maxDowntime: 300000, // 5 minutes
      minProfitImprovement: 0.05, // 5%
      maxParameterChangeFrequency: 20 // per hour
    };

    // Initialize current period metrics
    this.currentPeriodMetrics = this.createEmptyMetrics();

    // Start metrics collection
    this.startMetricsCollection();

    this.logger.info('OptimizationMonitor initialized', {
      component: 'OptimizationMonitor',
      logFile: this.logFilePath,
      startTime: new Date(this.startTime).toISOString()
    });
  }

  // Event logging methods
  logOptimizationStart(chainId: number): void {
    this.logger.info('Optimization cycle started', {
      event: 'optimization.start',
      chainId,
      timestamp: Date.now()
    });
  }

  logOptimizationComplete(result: OptimizationResult): void {
    this.logger.info('Optimization cycle completed', {
      event: 'optimization.complete',
      timestamp: result.timestamp,
      expectedImprovement: result.expectedImprovement,
      changesApplied: result.changesApplied.length,
      marketAnalysis: {
        recommendation: result.marketAnalysis.recommendation,
        confidence: result.marketAnalysis.confidence,
        regime: result.marketAnalysis.conditions
      },
      previousParameters: this.formatParametersForLogging(result.previousParameters),
      newParameters: this.formatParametersForLogging(result.newParameters)
    });

    // Update metrics
    this.currentPeriodMetrics.optimizationsPerformed++;
    this.currentPeriodMetrics.averageImprovement = 
      (this.currentPeriodMetrics.averageImprovement + result.expectedImprovement) / 2;
    this.currentPeriodMetrics.parametersChanged += result.changesApplied.length;

    // Check for alerts
    this.checkAlertThresholds();
  }

  logOptimizationError(error: Error, context: any): void {
    this.logger.error('Optimization error occurred', {
      event: 'optimization.error',
      error: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });

    // Update error metrics
    this.currentPeriodMetrics.validationErrors++;
    
    // Emit alert if error threshold exceeded
    if (this.currentPeriodMetrics.validationErrors > this.alertThresholds.maxValidationErrors) {
      this.emit('alert', {
        type: 'high_error_rate',
        message: `High optimization error rate: ${this.currentPeriodMetrics.validationErrors} errors`,
        severity: 'critical'
      });
    }
  }

  logParameterValidation(
    originalParameters: OptimizedParameters, 
    validatedParameters: OptimizedParameters,
    warnings: string[],
    errors: string[]
  ): void {
    this.logger.debug('Parameter validation completed', {
      event: 'parameter.validation',
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      errors,
      warnings,
      parametersChanged: JSON.stringify(originalParameters) !== JSON.stringify(validatedParameters),
      timestamp: Date.now()
    });

    // Update validation metrics
    this.currentPeriodMetrics.validationErrors += errors.length;
    this.currentPeriodMetrics.validationWarnings += warnings.length;
  }

  logTradeExecution(
    approved: boolean, 
    parameters: OptimizedParameters, 
    profit: bigint, 
    gasCost: bigint,
    executionTime: number
  ): void {
    this.logger.info('Trade execution with optimized parameters', {
      event: 'trade.execution',
      approved,
      profit: formatEther(profit),
      gasCost: formatEther(gasCost),
      netProfit: formatEther(profit - gasCost),
      executionTime,
      parameters: this.formatParametersForLogging(parameters),
      timestamp: Date.now()
    });

    // Update success rate
    const totalTrades = this.currentPeriodMetrics.optimizationsPerformed;
    const currentSuccessRate = this.currentPeriodMetrics.successRate;
    this.currentPeriodMetrics.successRate = 
      ((currentSuccessRate * totalTrades) + (approved ? 1 : 0)) / (totalTrades + 1);
  }

  logPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.logger.info('Performance metrics updated', {
      event: 'performance.metrics',
      metrics: {
        successRate: metrics.successRate,
        gasEfficiency: metrics.gasEfficiency,
        opportunityCapture: metrics.opportunityCapture,
        totalTrades: metrics.totalTrades
      },
      timestamp: Date.now()
    });

    // Update performance improvement metrics
    this.updatePerformanceImprovements(metrics);
  }

  logMarketConditions(conditions: any): void {
    this.logger.debug('Market conditions analyzed', {
      event: 'market.analysis',
      conditions: {
        volatility: conditions.volatility,
        liquidity: conditions.liquidity,
        competitionLevel: conditions.competitionLevel,
        gasPrice: conditions.gasPrice?.toString(),
        networkCongestion: conditions.networkCongestion,
        regime: conditions.regime
      },
      timestamp: Date.now()
    });
  }

  logSystemHealth(status: 'healthy' | 'degraded' | 'critical', details: any): void {
    const logLevel = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
    
    this.logger.log(logLevel, 'System health status', {
      event: 'system.health',
      status,
      details,
      timestamp: Date.now()
    });

    if (status === 'critical') {
      this.emit('alert', {
        type: 'system_critical',
        message: `System health critical: ${JSON.stringify(details)}`,
        severity: 'critical'
      });
    }
  }

  // Metrics and monitoring methods
  getCurrentMetrics(): OptimizationMetrics {
    return {
      ...this.currentPeriodMetrics,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime
    };
  }

  getHistoricalMetrics(hours: number = 24): OptimizationMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  generatePerformanceReport(): {
    summary: OptimizationMetrics;
    trends: any;
    recommendations: string[];
    alerts: any[];
  } {
    const currentMetrics = this.getCurrentMetrics();
    const historicalMetrics = this.getHistoricalMetrics(24);
    
    // Calculate trends
    const trends = this.calculateTrends(historicalMetrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(currentMetrics, trends);
    
    // Get recent alerts
    const alerts = this.getRecentAlerts();

    this.logger.info('Performance report generated', {
      event: 'report.generated',
      summary: currentMetrics,
      trends,
      recommendationsCount: recommendations.length,
      alertsCount: alerts.length
    });

    return {
      summary: currentMetrics,
      trends,
      recommendations,
      alerts
    };
  }

  // Private methods
  private createEmptyMetrics(): OptimizationMetrics {
    return {
      timestamp: Date.now(),
      optimizationsPerformed: 0,
      averageImprovement: 0,
      parametersChanged: 0,
      validationErrors: 0,
      validationWarnings: 0,
      uptime: 0,
      successRate: 0,
      profitImprovement: 0,
      gasEfficiencyImprovement: 0
    };
  }

  private formatParametersForLogging(parameters: OptimizedParameters): any {
    return {
      minProfitThreshold: formatEther(parameters.minProfitThreshold),
      slippageTolerance: `${parameters.slippageTolerance}bp`,
      maxTradeSize: formatEther(parameters.maxTradeSize),
      gasSettings: {
        maxFeePerGas: parameters.gasSettings.maxFeePerGas.toString(),
        maxPriorityFeePerGas: parameters.gasSettings.maxPriorityFeePerGas.toString(),
        urgency: parameters.gasSettings.urgency
      },
      cooldownPeriod: `${parameters.cooldownPeriod}ms`,
      riskLevel: parameters.riskLevel
    };
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute
    this.metricsCollectionInterval = setInterval(() => {
      const currentMetrics = this.getCurrentMetrics();
      this.metrics.push(currentMetrics);
      
      // Keep only last 24 hours of metrics
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => m.timestamp > dayAgo);
      
      // Reset current period metrics every hour
      if (currentMetrics.timestamp % (60 * 60 * 1000) < 60000) {
        this.currentPeriodMetrics = this.createEmptyMetrics();
      }
    }, 60000); // Every minute
  }

  private checkAlertThresholds(): void {
    const metrics = this.getCurrentMetrics();
    
    // Check success rate
    if (metrics.successRate < this.alertThresholds.minSuccessRate && metrics.optimizationsPerformed > 10) {
      this.emit('alert', {
        type: 'low_success_rate',
        message: `Low optimization success rate: ${(metrics.successRate * 100).toFixed(1)}%`,
        severity: 'warning'
      });
    }
    
    // Check parameter change frequency
    if (metrics.parametersChanged > this.alertThresholds.maxParameterChangeFrequency) {
      this.emit('alert', {
        type: 'high_parameter_churn',
        message: `High parameter change frequency: ${metrics.parametersChanged} changes`,
        severity: 'warning'
      });
    }
  }

  private updatePerformanceImprovements(metrics: PerformanceMetrics): void {
    // Calculate improvement over baseline (simplified)
    const baselineSuccessRate = 0.6; // 60% baseline
    const baselineGasEfficiency = 1.5; // 1.5x baseline
    
    this.currentPeriodMetrics.profitImprovement = 
      ((metrics.successRate - baselineSuccessRate) / baselineSuccessRate);
    this.currentPeriodMetrics.gasEfficiencyImprovement = 
      ((metrics.gasEfficiency - baselineGasEfficiency) / baselineGasEfficiency);
  }

  private calculateTrends(historicalMetrics: OptimizationMetrics[]): any {
    if (historicalMetrics.length < 2) return {};
    
    const recent = historicalMetrics.slice(-6); // Last 6 hours
    const older = historicalMetrics.slice(0, Math.max(1, historicalMetrics.length - 6));
    
    const avgRecent = recent.reduce((sum, m) => sum + m.averageImprovement, 0) / recent.length;
    const avgOlder = older.reduce((sum, m) => sum + m.averageImprovement, 0) / older.length;
    
    return {
      improvementTrend: avgRecent - avgOlder,
      successRateTrend: recent[recent.length - 1].successRate - older[older.length - 1].successRate,
      errorsTrend: recent.reduce((sum, m) => sum + m.validationErrors, 0) - 
                   older.reduce((sum, m) => sum + m.validationErrors, 0)
    };
  }

  private generateRecommendations(metrics: OptimizationMetrics, trends: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.validationErrors > 5) {
      recommendations.push('High validation error rate - review parameter bounds');
    }
    
    if (metrics.successRate < 0.7) {
      recommendations.push('Low success rate - consider more conservative optimization');
    }
    
    if (trends.improvementTrend < 0) {
      recommendations.push('Declining optimization performance - review market conditions');
    }
    
    if (metrics.parametersChanged > 15) {
      recommendations.push('High parameter volatility - consider increasing adaptation speed');
    }
    
    return recommendations;
  }

  private getRecentAlerts(): any[] {
    // In a real implementation, this would return recent alerts from storage
    return [];
  }

  // Public utility methods
  updateAlertThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    this.logger.info('Alert thresholds updated', { thresholds: this.alertThresholds });
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const metrics = this.getHistoricalMetrics(24);
    
    if (format === 'csv') {
      const headers = Object.keys(metrics[0] || {}).join(',');
      const rows = metrics.map(m => Object.values(m).join(','));
      return [headers, ...rows].join('\n');
    }
    
    return JSON.stringify(metrics, null, 2);
  }

  stop(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
    
    this.logger.info('OptimizationMonitor stopped', {
      event: 'monitor.stopped',
      finalMetrics: this.getCurrentMetrics()
    });
  }
}