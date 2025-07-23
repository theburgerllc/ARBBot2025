#!/bin/bash

echo "📊 ARBBot2025 LIVE Mainnet Validation Monitor"
echo "⏰ Started: $(date)"
echo "🎯 Criteria: ≥10 opportunities, ≥15% success rate, ≥5 optimizations"
echo "🔗 Network: Arbitrum One (Live)"
echo ""

# Function to extract metrics from live output
extract_metrics() {
    if [ -f "validation-results-real.json" ]; then
        echo "📊 Latest Live Metrics:"
        node -e "
            try {
                const data = JSON.parse(require('fs').readFileSync('validation-results-real.json', 'utf8'));
                console.log('🔍 Detected:', data.metrics.totalDetected);
                console.log('✅ Success Rate:', data.metrics.successRate.toFixed(2) + '%');
                console.log('🚀 Optimized:', data.metrics.phase3Optimized);
                console.log('💰 Potential:', data.metrics.totalPotentialProfit + ' wei');
                console.log('🔗 Block:', data.chainData.blockNumber);
                console.log('⛽ Gas:', (BigInt(data.chainData.gasPrice) / 1000000000n).toString() + ' gwei');
            } catch(e) {
                console.log('📡 Live validation in progress...');
            }
        " 2>/dev/null || echo "📡 Live validation in progress..."
    else
        echo "📡 Connecting to live Arbitrum network..."
    fi
}

# Start background validation if not already running
if ! pgrep -f "production-dry-run-real.ts" > /dev/null; then
    echo "🚀 Starting live validation process..."
    timeout 1800 npx ts-node scripts/production-dry-run-real.ts > live-validation.log 2>&1 &
    VALIDATOR_PID=$!
    echo "📝 Process ID: $VALIDATOR_PID"
    echo "📋 Log file: live-validation.log"
else
    echo "✅ Live validation already running"
    VALIDATOR_PID=$(pgrep -f "production-dry-run-real.ts")
fi

echo ""
echo "🔄 Monitoring live validation (30 minutes max)..."
echo "───────────────────────────────────────────────"

START_TIME=$(date +%s)
MONITOR_DURATION=1800  # 30 minutes max monitoring

while [ $(($(date +%s) - START_TIME)) -lt $MONITOR_DURATION ]; do
    clear
    echo "🔄 LIVE ARBITRUM VALIDATION MONITOR"
    echo "⏰ Monitoring Time: $(($(date +%s) - START_TIME)) seconds"
    echo "🎯 Max Monitor Duration: $MONITOR_DURATION seconds"
    echo ""
    
    # Show live progress
    extract_metrics
    
    echo ""
    echo "📋 Recent log activity:"
    if [ -f "live-validation.log" ]; then
        tail -5 live-validation.log | grep -E "(Progress|Detected|Profitable|ERROR|Decision)" || echo "📡 Scanning for opportunities..."
    fi
    
    echo ""
    echo "🔄 Next update in 30 seconds..."
    echo "Press Ctrl+C to view current results"
    
    # Check if validation completed
    if [ -f "validation-results-real.json" ]; then
        echo ""
        echo "✅ Live validation completed!"
        break
    fi
    
    # Check if process is still running
    if ! kill -0 $VALIDATOR_PID 2>/dev/null; then
        echo ""
        echo "⚠️  Validation process ended - checking results..."
        break
    fi
    
    sleep 30
done

echo ""
echo "📊 FINAL LIVE VALIDATION RESULTS"
echo "═══════════════════════════════════"

if [ -f "validation-results-real.json" ]; then
    echo "📊 Production Readiness Assessment:"
    node -e "
        const data = JSON.parse(require('fs').readFileSync('validation-results-real.json', 'utf8'));
        console.log('🎯 Decision:', data.decision);
        console.log('⏰ Runtime:', data.runtime.toFixed(1), 'minutes');
        console.log('🔍 Total Detected:', data.metrics.totalDetected);
        console.log('📈 Success Rate:', data.metrics.successRate.toFixed(2) + '%');
        console.log('🚀 Optimized:', data.metrics.phase3Optimized);
        console.log('💰 Potential Profit:', (BigInt(data.metrics.totalPotentialProfit) / 1000000000000000000n).toString() + ' ETH');
        console.log('🔗 Final Block:', data.chainData.blockNumber);
        console.log('');
        console.log('📋 RECOMMENDATION:');
        console.log(data.recommendation);
    "
else
    echo "❌ No results file found - validation may have failed or timed out"
    echo "📋 Check live-validation.log for details"
    if [ -f "live-validation.log" ]; then
        echo ""
        echo "📄 Last 10 log entries:"
        tail -10 live-validation.log
    fi
fi

echo ""
echo "🎯 Live Arbitrum validation monitoring complete"
echo "📁 Results: validation-results-real.json"
echo "📋 Logs: live-validation.log"