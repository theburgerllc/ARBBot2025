# Flash-Loan Arbitrage Bot

A production-ready flash-loan arbitrage bot for Ethereum Layer-2 networks (Arbitrum & Optimism) that uses Balancer V2 fee-free flash loans to execute profitable arbitrage trades between Uniswap V2/V3 and SushiSwap V2.

## 🚀 Features

- **Fee-Free Flash Loans**: Uses Balancer V2 Vault for zero-fee flash loans
- **Multi-DEX Arbitrage**: Executes arbitrage between Uniswap V2/V3 and SushiSwap V2
- **MEV Protection**: Integrates with Flashbots MEV-Share for private transaction pools
- **Advanced Safety**: Slippage protection, profitability validation, and circuit breakers
- **Real-Time Monitoring**: Continuous scanning for profitable opportunities
- **Comprehensive Testing**: Unit tests, integration tests, and mainnet fork testing
- **Layer-2 Optimized**: Designed for Arbitrum and Optimism networks

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- NPM or Yarn package manager
- An Ethereum wallet with funds for gas fees
- RPC endpoints for Arbitrum/Optimism networks
- Flashbots authentication key (optional but recommended)

## 🛠️ Installation

1. **Clone the repository**:
```bash
git clone https://github.com/your-username/ARBBot2025.git
cd ARBBot2025
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Compile contracts**:
```bash
npm run compile
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Required Configuration
ARB_RPC=https://arb1.arbitrum.io/rpc
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
FLASHBOTS_AUTH_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Contract Addresses (set after deployment)
BOT_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
```

### Key Configuration Options

- **MIN_PROFIT_THRESHOLD**: Minimum profit in ETH to execute trades (default: 0.01)
- **SLIPPAGE_TOLERANCE**: Maximum acceptable slippage in basis points (default: 200 = 2%)
- **GAS_LIMIT**: Gas limit for transactions (default: 500000)
- **COOLDOWN_PERIOD**: Minimum time between executions in milliseconds (default: 30000)

## 🚀 Deployment

### Deploy to Arbitrum

```bash
npm run deploy:arb
```

### Deploy to Optimism

```bash
npm run deploy:opt
```

### Local Development

```bash
npm run deploy:local
```

The deployment script will:
- Verify all contract addresses
- Deploy the FlashArbBotBalancer contract
- Test basic functionality
- Provide next steps and verification links

## 🤖 Running the Bot

### Start the Arbitrage Bot

```bash
npm run bot:start
```

### Simulate Opportunities (No Execution)

```bash
npm run bot:simulate
```

### Test Specific Token Pairs

```bash
npm run bot:simulate WETH USDC 10
```

## 🧪 Testing

### Run Unit Tests

```bash
npm run test:unit
```

### Run Integration Tests (Requires Forked Network)

```bash
npm run test:integration
```

### Run All Tests

```bash
npm test
```

## 📊 Monitoring

The bot provides comprehensive logging and monitoring:

```bash
# View real-time logs
tail -f bot.log

# Monitor with colored output
npm run bot:start | grep -E "(🚀|💰|❌)"
```

### Log Levels

- **🔍 INFO**: Opportunity scanning
- **🚀 SUCCESS**: Arbitrage execution
- **💰 PROFIT**: Profit withdrawal
- **⚠️ WARNING**: Non-critical issues
- **❌ ERROR**: Critical failures

## 📈 Performance Optimization

### Gas Optimization

- Set appropriate `GAS_LIMIT` based on network conditions
- Adjust `MAX_PRIORITY_FEE` for faster inclusion
- Use MEV bundles to avoid gas wars

### Profitability Tuning

- Lower `MIN_PROFIT_THRESHOLD` for more opportunities
- Increase `SLIPPAGE_TOLERANCE` for volatile markets
- Adjust `MIN_PROFIT_BPS` based on market conditions

## 🔒 Security Best Practices

1. **Wallet Security**:
   - Use a dedicated wallet for the bot
   - Never share your private key
   - Keep minimal funds in the bot wallet

2. **Operational Security**:
   - Run the bot on a secure server
   - Monitor logs for unusual activity
   - Set up alerts for large losses

3. **Smart Contract Security**:
   - The contract includes reentrancy protection
   - Owner-only functions for critical operations
   - Circuit breakers for risk management

## 🛡️ Risk Management

### Built-in Safety Features

- **Slippage Protection**: Prevents execution with excessive slippage
- **Profitability Validation**: Ensures trades are profitable after fees
- **Circuit Breakers**: Pauses bot during unusual market conditions
- **Cooldown Periods**: Prevents rapid-fire execution

### Manual Risk Controls

```bash
# Pause the bot
# Call bot.pause() from owner account

# Withdraw profits
# Call bot.withdraw(tokenAddress) from owner account

# Emergency shutdown
# Call bot.emergencyWithdraw(tokenAddress) from owner account
```

## 📚 Architecture

### Smart Contract Components

- **FlashArbBotBalancer.sol**: Main arbitrage logic with flash loan integration
- **Slippage Protection**: Calculates minimum output amounts
- **Price Feed Integration**: Oracle-based price validation
- **Access Control**: Owner and authorized caller management

### Off-Chain Components

- **ArbitrageBot Class**: Main bot logic and monitoring
- **Opportunity Scanner**: Real-time DEX price monitoring
- **MEV Bundle Submission**: Flashbots integration
- **Risk Management**: Circuit breakers and safety checks

## 🔍 Troubleshooting

### Common Issues

1. **"Unprofitable" Reverts**:
   - Check gas costs vs. expected profit
   - Verify slippage tolerance settings
   - Ensure sufficient liquidity in DEX pools

2. **MEV Bundle Failures**:
   - Verify Flashbots authentication key
   - Check network connectivity
   - Fallback to direct transactions if needed

3. **High Gas Costs**:
   - Adjust `MAX_PRIORITY_FEE` setting
   - Use MEV bundles to avoid gas wars
   - Consider transaction timing optimization

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run bot:start

# Run simulation mode
ENABLE_SIMULATION_MODE=true npm run bot:start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes only. Cryptocurrency trading involves substantial risk of loss. The authors are not responsible for any financial losses incurred through the use of this bot.

## 📞 Support

- GitHub Issues: Report bugs and request features
- Documentation: Comprehensive guides and API reference
- Community: Join our Discord for discussions and support

## 🙏 Acknowledgments

- Balancer Protocol for fee-free flash loans
- Flashbots for MEV protection
- Uniswap and SushiSwap for DEX liquidity
- OpenZeppelin for security patterns
- Hardhat for development framework

---

**Happy Arbitraging! 🚀💰**