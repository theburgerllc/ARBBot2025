# 🚀 Flash Arbitrage Bot Setup Guide

This guide will walk you through setting up your `.env` file and getting the bot running.

## 📋 Prerequisites Checklist

- [ ] Node.js 16+ installed
- [ ] Git repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Basic understanding of Ethereum wallets

## 🔑 Step 1: Get RPC Endpoints

### Option A: Infura (Recommended)
1. Go to https://infura.io and create a free account
2. Create a new project
3. Select "Web3 API" 
4. Copy your project ID from the dashboard
5. Your RPC URLs will be:
   - Arbitrum: `https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID`
   - Optimism: `https://optimism-mainnet.infura.io/v3/YOUR_PROJECT_ID`
   - Mainnet: `https://mainnet.infura.io/v3/YOUR_PROJECT_ID`

### Option B: Alchemy
1. Go to https://alchemy.com and create a free account
2. Create a new app for each network
3. Copy the HTTP URLs from each app dashboard
4. Your RPC URLs will be:
   - Arbitrum: `https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
   - Optimism: `https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
   - Mainnet: `https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY`

### Option C: Free Public RPCs (Not Recommended for Production)
- Arbitrum: `https://arb1.arbitrum.io/rpc`
- Optimism: `https://mainnet.optimism.io`
- Mainnet: `https://eth.llamarpc.com`

## 💼 Step 2: Create Bot Wallet

### Method A: Using MetaMask
1. Install MetaMask browser extension
2. Create a new account specifically for the bot
3. **IMPORTANT**: Use a separate account, not your main wallet
4. Send 0.1-0.5 ETH to this wallet for gas fees
5. Export private key:
   - Click the three dots next to account name
   - Select "Account Details"
   - Click "Export Private Key"
   - Enter your password
   - Copy the private key (starts with 0x)

### Method B: Using Node.js (Programmatic)
```javascript
const { ethers } = require('ethers');

// Generate a new random wallet
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
```

## 🔐 Step 3: Generate Flashbots Authentication Key

### Why You Need This
- Flashbots allows you to send transactions privately
- Prevents MEV bots from front-running your arbitrage
- Increases profitability by avoiding gas wars

### How to Generate
1. Create another new wallet (same methods as Step 2)
2. **No funding required** - just need the private key
3. This is purely for authentication with Flashbots
4. Copy the private key for FLASHBOTS_AUTH_KEY

### Alternative: Skip Flashbots (Not Recommended)
If you want to skip Flashbots initially:
- Set `FLASHBOTS_AUTH_KEY` to the same value as `PRIVATE_KEY`
- The bot will fall back to regular transactions
- You may lose profitability to MEV bots

## 📝 Step 4: Create Your .env File

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit the `.env` file with your values:
```env
# Network Configuration
ARB_RPC=https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID
OPT_RPC=https://optimism-mainnet.infura.io/v3/YOUR_PROJECT_ID
MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Wallet Configuration
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
FLASHBOTS_AUTH_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

# Contract Address (leave as placeholder for now)
BOT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Keep all other default values initially
```

## 🚀 Step 5: Deploy the Contract

1. Compile the contracts:
```bash
npm run compile
```

2. Deploy to Arbitrum:
```bash
npm run deploy:arb
```

Or deploy to Optimism:
```bash
npm run deploy:opt
```

3. Copy the deployed contract address from the output
4. Update your `.env` file with the `BOT_CONTRACT_ADDRESS`

## 🧪 Step 6: Test the Setup

1. Test contract compilation:
```bash
npm run compile
```

2. Run simulation mode:
```bash
npm run bot:simulate
```

3. Test specific pair:
```bash
npm run bot:simulate WETH USDC 1
```

## 🤖 Step 7: Run the Bot

1. Start in simulation mode first:
```bash
ENABLE_SIMULATION_MODE=true npm run bot:start
```

2. If everything looks good, run for real:
```bash
npm run bot:start
```

## 🔧 Configuration Optimization

### For Beginners (Conservative)
```env
MIN_PROFIT_THRESHOLD=0.05  # Higher threshold = less risk
SLIPPAGE_TOLERANCE=300     # 3% slippage tolerance
MAX_TRADE_SIZE=5           # Limit trade size to 5 ETH
COOLDOWN_PERIOD=60000      # 1 minute between trades
```

### For Advanced Users (Aggressive)
```env
MIN_PROFIT_THRESHOLD=0.005 # Lower threshold = more opportunities
SLIPPAGE_TOLERANCE=100     # 1% slippage tolerance
MAX_TRADE_SIZE=50          # Larger trades
COOLDOWN_PERIOD=15000      # 15 seconds between trades
```

## 🚨 Security Checklist

- [ ] Using dedicated wallet for bot (not main wallet)
- [ ] Bot wallet has minimal funds (0.1-0.5 ETH)
- [ ] Private keys stored securely
- [ ] .env file added to .gitignore
- [ ] Flashbots auth key is different from trading key
- [ ] Testing in simulation mode first

## 🔍 Monitoring Your Bot

### Check Logs
```bash
# Follow live logs
tail -f bot.log

# Search for profits
grep "💰" bot.log

# Check for errors
grep "❌" bot.log
```

### Monitor Wallet
- Check your bot wallet balance regularly
- Monitor gas spending vs. profits
- Watch for unusual activity

## 🆘 Troubleshooting

### Common Issues

**"Network mismatch" Error**
- Check your RPC URLs are correct
- Ensure you're deploying to the right network

**"Insufficient funds" Error** 
- Add more ETH to your bot wallet
- Check gas prices aren't too high

**"Unprofitable" Reverts**
- Lower MIN_PROFIT_THRESHOLD
- Increase SLIPPAGE_TOLERANCE
- Wait for better market conditions

**MEV Bundle Failures**
- Verify FLASHBOTS_AUTH_KEY is correct
- Check network connectivity
- Bot will fallback to regular transactions

### Getting Help
- Check GitHub issues for similar problems
- Join our Discord community
- Review the troubleshooting section in README.md

## 📊 Expected Performance

### Realistic Expectations
- **Profit**: 0.001-0.01 ETH per successful arbitrage
- **Success Rate**: 10-30% of opportunities (depending on market)
- **Gas Costs**: 0.001-0.003 ETH per transaction
- **Frequency**: 1-10 opportunities per hour (market dependent)

### Monitoring Metrics
- Total profit vs. gas spent
- Success rate of arbitrage attempts
- MEV bundle inclusion rate
- Average profit per trade

---

🎉 **You're now ready to run your flash arbitrage bot!** 

Start with simulation mode, monitor carefully, and gradually increase your risk tolerance as you become more comfortable with the system.