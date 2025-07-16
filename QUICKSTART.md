# ⚡ Quick Start Guide - Flash Arbitrage Bot

Get your bot running in 5 minutes with these automated setup tools.

## 🚀 Super Quick Setup (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Generate wallets and create .env template
npm run setup:all

# 3. Edit .env file with your RPC URLs (see step 3 below)

# 4. Validate your configuration
npm run setup:validate

# 5. Deploy the contract
npm run deploy:arb

# 6. Start the bot
npm run bot:start
```

## 📋 Step-by-Step Setup

### 1. Get RPC Endpoints
Choose one of these providers:

**Infura (Recommended)**
- Go to https://infura.io → Create account → New Project
- Copy your project ID
- Your URL: `https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID`

**Alchemy**
- Go to https://alchemy.com → Create account → New App
- Copy your API key
- Your URL: `https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY`

**Free (Not recommended for production)**
- Arbitrum: `https://arb1.arbitrum.io/rpc`
- Optimism: `https://mainnet.optimism.io`

### 2. Generate Wallets
```bash
# Generate all wallets and .env template
npm run setup:all

# OR generate individually:
npm run setup:wallet        # Bot wallet
npm run setup:flashbots     # Flashbots auth key
npm run setup:env           # Create .env template
```

### 3. Edit .env File
Open `.env` and update these values:
```env
# Replace with your RPC URLs
ARB_RPC=https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID
MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Replace with generated private keys (from step 2)
PRIVATE_KEY=0x1234567890abcdef...
FLASHBOTS_AUTH_KEY=0xabcdef1234567890...
```

### 4. Fund Your Wallet
- Copy the wallet address from the setup output
- Send 0.1-0.5 ETH to this address for gas fees
- **Important**: Use a dedicated wallet, not your main wallet

### 5. Validate Setup
```bash
npm run setup:validate
```
This will check:
- RPC connections
- Private key validity
- Wallet balance
- All required configuration

### 6. Deploy Contract
```bash
# For Arbitrum
npm run deploy:arb

# For Optimism
npm run deploy:opt
```

Copy the contract address from the output and add it to your `.env` file:
```env
BOT_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
```

### 7. Test the Bot
```bash
# Test in simulation mode (no real trades)
npm run bot:simulate

# Test specific token pair
npm run bot:simulate WETH USDC 1

# Run bot in simulation mode
ENABLE_SIMULATION_MODE=true npm run bot:start
```

### 8. Go Live
```bash
# Start the bot for real
npm run bot:start

# Monitor logs
tail -f bot.log
```

## 🔧 Configuration Options

### Conservative Settings (Beginners)
```env
MIN_PROFIT_THRESHOLD=0.05    # Require 0.05 ETH profit
SLIPPAGE_TOLERANCE=300       # 3% slippage tolerance
MAX_TRADE_SIZE=5             # Max 5 ETH per trade
COOLDOWN_PERIOD=60000        # 1 minute between trades
```

### Aggressive Settings (Advanced)
```env
MIN_PROFIT_THRESHOLD=0.005   # Accept 0.005 ETH profit
SLIPPAGE_TOLERANCE=100       # 1% slippage tolerance
MAX_TRADE_SIZE=50            # Max 50 ETH per trade
COOLDOWN_PERIOD=15000        # 15 seconds between trades
```

## 🔍 Monitoring Your Bot

### Real-time Logs
```bash
# Follow live logs with colors
npm run bot:start

# Monitor log file
tail -f bot.log

# Filter for profits
grep "💰" bot.log

# Filter for errors
grep "❌" bot.log
```

### Key Metrics to Watch
- **Profit vs Gas**: Ensure profits exceed gas costs
- **Success Rate**: Aim for 10-30% success rate
- **MEV Bundle Rate**: Higher = better protection
- **Wallet Balance**: Monitor for unexpected changes

## 🚨 Safety Checklist

- [ ] Using dedicated wallet (not main wallet)
- [ ] Wallet funded with minimal ETH (0.1-0.5 ETH)
- [ ] Tested in simulation mode first
- [ ] Monitoring logs actively
- [ ] Have emergency stop plan
- [ ] Configuration validated with `npm run setup:validate`

## 🆘 Common Issues & Solutions

### "Network mismatch" Error
```bash
# Check your RPC URL is correct
npm run setup:validate
```

### "Insufficient funds" Error
- Add more ETH to your bot wallet
- Check current gas prices aren't too high

### "Unprofitable" Reverts
- Lower `MIN_PROFIT_THRESHOLD` in .env
- Increase `SLIPPAGE_TOLERANCE`
- Wait for more volatile market conditions

### MEV Bundle Failures
- Verify `FLASHBOTS_AUTH_KEY` is correct
- Check internet connectivity
- Bot automatically falls back to regular transactions

## 📊 Performance Expectations

**Typical Performance:**
- **Profit per trade**: 0.001-0.01 ETH
- **Success rate**: 10-30% of opportunities
- **Gas cost**: 0.001-0.003 ETH per transaction
- **Frequency**: 1-10 opportunities per hour

**Good Performance Indicators:**
- Profit > Gas costs over time
- Regular successful arbitrages
- High MEV bundle inclusion rate
- Stable wallet balance growth

## 🛠️ Available Commands

```bash
# Setup commands
npm run setup              # Show setup help
npm run setup:all          # Complete automated setup
npm run setup:wallet       # Generate bot wallet
npm run setup:flashbots    # Generate Flashbots key
npm run setup:env          # Create .env template
npm run setup:validate     # Validate configuration

# Bot commands
npm run bot:start          # Start the bot
npm run bot:simulate       # Test opportunities
npm run bot:simulate WETH USDC 1  # Test specific pair

# Development commands
npm run compile            # Compile contracts
npm run test               # Run all tests
npm run deploy:arb         # Deploy to Arbitrum
npm run deploy:opt         # Deploy to Optimism
```

## 🎯 Success Tips

1. **Start Conservative**: Use high profit thresholds initially
2. **Monitor Closely**: Watch logs for the first few hours
3. **Adjust Settings**: Optimize based on market conditions
4. **Risk Management**: Never risk more than you can afford to lose
5. **Stay Updated**: Keep dependencies and addresses current

---

🎉 **You're ready to arbitrage!** 

Start with simulation mode, monitor carefully, and gradually increase your risk as you become comfortable with the system.

💡 **Need help?** Check the full documentation in README.md or SETUP_GUIDE.md