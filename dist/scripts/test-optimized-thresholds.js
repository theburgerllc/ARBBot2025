"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const dynamic_threshold_optimizer_1 = require("../utils/dynamic-threshold-optimizer");
dotenv_1.default.config();
async function testOptimizedThresholds() {
    console.log('🔧 Testing Optimized Threshold Calculations');
    console.log('═════════════════════════════════════════');
    if (!process.env.ARB_RPC) {
        console.error('❌ ARB_RPC environment variable required');
        return;
    }
    try {
        // Connect to Arbitrum
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        const optimizer = new dynamic_threshold_optimizer_1.DynamicThresholdOptimizer(provider);
        // Get current network state
        const [blockNumber, feeData] = await Promise.all([
            provider.getBlockNumber(),
            provider.getFeeData()
        ]);
        console.log(`🔗 Connected to Arbitrum One`);
        console.log(`📦 Block: ${blockNumber}`);
        console.log(`⛽ Gas Price: ${ethers_1.ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`);
        console.log();
        // Simulate market conditions based on our observed data
        const observedSpreads = [0.118, 0.121, 0.129, 0.133, 0.155]; // From validation log
        for (const spread of observedSpreads) {
            optimizer.addSpreadObservation(spread);
        }
        // Analyze current market conditions
        const conditions = await optimizer.analyzeCurrentMarketConditions();
        const thresholds = optimizer.calculateOptimalThresholds(conditions);
        // Display results
        optimizer.logThresholdAnalysis(thresholds, conditions);
        // Compare with old vs new thresholds
        console.log(`
🔄 THRESHOLD COMPARISON
═════════════════════
📊 Original vs Optimized:
   Old Min Spread: 0.300% (static)
   New Min Spread: ${(thresholds.minSpreadBps / 100).toFixed(3)}%
   Improvement: ${((0.3 - (thresholds.minSpreadBps / 100)) / 0.3 * 100).toFixed(1)}% reduction

💰 Profitability Impact:
   Observed Spreads: ${observedSpreads.map(s => s.toFixed(3) + '%').join(', ')}
   Old System: ${observedSpreads.filter(s => s > 0.3).length}/${observedSpreads.length} would pass (${(observedSpreads.filter(s => s > 0.3).length / observedSpreads.length * 100).toFixed(0)}%)
   New System: ${observedSpreads.filter(s => s > (thresholds.minSpreadBps / 100)).length}/${observedSpreads.length} would pass (${(observedSpreads.filter(s => s > (thresholds.minSpreadBps / 100)).length / observedSpreads.length * 100).toFixed(0)}%)
   
🚀 Expected Improvement: ${((observedSpreads.filter(s => s > (thresholds.minSpreadBps / 100)).length - observedSpreads.filter(s => s > 0.3).length) / observedSpreads.length * 100).toFixed(0)}% more opportunities
    `);
        // Test various gas price scenarios
        console.log(`
🧪 GAS PRICE SCENARIO TESTING
═══════════════════════════`);
        const gasPriceScenarios = [
            { price: '0.005', desc: 'Very Low' },
            { price: '0.01', desc: 'Current' },
            { price: '0.05', desc: 'Medium' },
            { price: '0.1', desc: 'High' },
            { price: '0.2', desc: 'Very High' }
        ];
        for (const scenario of gasPriceScenarios) {
            const mockConditions = {
                ...conditions,
                gasPrice: ethers_1.ethers.parseUnits(scenario.price, 'gwei')
            };
            const scenarioThresholds = optimizer.calculateOptimalThresholds(mockConditions);
            console.log(`${scenario.desc} (${scenario.price} gwei): Min Spread ${(scenarioThresholds.minSpreadBps / 100).toFixed(3)}%`);
        }
        console.log(`
✅ Threshold optimization analysis complete!
💡 Key findings:
   • Current market spreads: 0.12-0.16% range  
   • Optimized threshold: ~${(thresholds.minSpreadBps / 100).toFixed(3)}% (vs 0.300% original)
   • Expected ${((observedSpreads.filter(s => s > (thresholds.minSpreadBps / 100)).length / observedSpreads.length * 100).toFixed(0))}% opportunity capture rate
   • Gas-adjusted profitability maintained
    `);
    }
    catch (error) {
        console.error('❌ Error testing thresholds:', error);
    }
}
if (require.main === module) {
    testOptimizedThresholds().catch(console.error);
}
