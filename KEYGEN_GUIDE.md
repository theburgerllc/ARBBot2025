# 🔑 MEV Bot Key Generation Guide

Complete guide for generating and managing cryptographic keys for the Enhanced MEV Arbitrage Bot.

## 🚀 Quick Start

### A. Generate Keys (Automated)

```bash
# Generate keys and create .env file
npm run keys:generate

# Generate with encrypted backup
npm run keys:generate-backup

# Generate with password-protected backup
npm run keys:generate-secure
```

### B. Generate Keys (Manual - OpenSSL)

```bash
# Generate Executor Key (needs funding)
openssl rand -hex 32
# Output: 64-character hex string

# Generate Flashbots Auth Key (no funding needed)
openssl rand -hex 32
# Output: 64-character hex string
```

### C. Validate Setup

```bash
# Comprehensive validation
npm run keys:validate

# Quick validation (skip slow tests)
npm run keys:validate-quick
```

## 📋 Complete Setup Process

### 1. Key Generation

Run the automated key generator:

```bash
ts-node scripts/generate-keys.ts
```

This will:
- ✅ Generate cryptographically secure private keys
- ✅ Create wallet addresses for both chains
- ✅ Generate .env file with all configurations
- ✅ Set secure file permissions (600)
- ✅ Validate key formats and derivation
- ✅ Check network connectivity
- ✅ Display funding instructions

### 2. Key Information

The generator creates two keys:

**🔑 Executor Key** (PRIVATE_KEY)
- **Purpose**: Transaction execution and gas payments
- **Funding**: Requires ~0.1 ETH on each chain
- **Chains**: Arbitrum + Optimism
- **Security**: Critical - store securely

**🔐 Flashbots Auth Key** (FLASHBOTS_AUTH_KEY)  
- **Purpose**: MEV bundle authentication
- **Funding**: No funding required
- **Usage**: Flashbots relay authentication only
- **Security**: Important - keep private

### 3. Wallet Funding

Fund the **Executor wallet** with ETH:

#### Arbitrum
```bash
# Bridge ETH to Arbitrum
# URL: https://bridge.arbitrum.io/
# Amount: 0.1 ETH minimum, 0.2 ETH recommended
```

#### Optimism
```bash
# Bridge ETH to Optimism  
# URL: https://app.optimism.io/bridge
# Amount: 0.1 ETH minimum, 0.2 ETH recommended
```

### 4. Setup Validation

Validate your complete setup:

```bash
npm run setup:validate
```

This checks:
- ✅ Environment file and permissions
- ✅ Private key formats and derivation
- ✅ Network connectivity (Arbitrum + Optimism)
- ✅ Wallet balances on both chains
- ✅ Contract addresses and deployment
- ✅ Flashbots connectivity
- ✅ Bot configuration values

## 🔧 Advanced Usage

### Custom Key Generation

```bash
# Generate with specific options
ts-node scripts/generate-keys.ts --backup --password mySecurePassword

# Skip balance checking (faster)
ts-node scripts/generate-keys.ts --skip-balance

# Show help
ts-node scripts/generate-keys.ts --help
```

### Manual .env Configuration

If you prefer manual setup, add these keys to your `.env`:

```ini
# Executor Wallet (Fund with 0.1 ETH per chain)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Flashbots Auth Key (No funding needed)
FLASHBOTS_AUTH_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Network Configuration
ARB_RPC=https://arb1.arbitrum.io/rpc
OPT_RPC=https://mainnet.optimism.io
MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Flashbots Configuration
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
MEV_SHARE_URL=https://mev-share.flashbots.net
```

### Backup and Recovery

```bash
# Create encrypted backup
ts-node scripts/generate-keys.ts --backup --password yourPassword

# Backup location
ls -la backups/wallet-backup-*.json.encrypted

# Restore from backup (manual process)
# Decrypt and extract keys from backup file
```

## 🔒 Security Best Practices

### Key Management
1. **Never commit private keys** to version control
2. **Use hardware wallets** for production deployments
3. **Store keys in secure password managers**
4. **Enable 2FA** on all related accounts
5. **Regularly rotate keys** for security
6. **Use separate wallets** for different purposes
7. **Monitor wallet activity** for unauthorized access

### File Security
```bash
# Set secure permissions
chmod 600 .env
chmod 700 backups/

# Verify permissions
ls -la .env
# Should show: -rw------- (600)
```

### Network Security
- Use **VPN** for bot operations
- Enable **firewall** on bot server
- Use **SSH keys** instead of passwords
- **Monitor network traffic** for anomalies
- **Keep software updated** regularly

## 🌐 Network Information

### Arbitrum One
- **Chain ID**: 42161
- **RPC**: https://arb1.arbitrum.io/rpc
- **Bridge**: https://bridge.arbitrum.io/
- **Explorer**: https://arbiscan.io/
- **Gas**: ~0.1 Gwei typical

### Optimism
- **Chain ID**: 10
- **RPC**: https://mainnet.optimism.io
- **Bridge**: https://app.optimism.io/bridge
- **Explorer**: https://optimistic.etherscan.io/
- **Gas**: ~1 Gwei typical

## 📊 Validation Results

The validator checks multiple aspects:

### ✅ Environment
- File existence and permissions
- Required variable presence
- Variable format validation

### ✅ Keys
- Private key format (64 hex chars)
- Address derivation correctness
- Key uniqueness verification

### ✅ Networks
- RPC connectivity
- Chain ID verification
- Block number retrieval

### ✅ Wallets
- Balance checking
- Minimum funding verification
- Multi-chain balance summary

### ✅ Contracts
- Contract code verification
- Address validation
- Router availability

### ✅ Flashbots
- Auth key validation
- Provider creation
- Bundle simulation testing

## 🚨 Troubleshooting

### Common Issues

**❌ "Private key invalid format"**
```bash
# Solution: Regenerate keys
npm run keys:generate
```

**❌ "Network connection failed"**
```bash
# Solution: Check RPC endpoints
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://arb1.arbitrum.io/rpc
```

**❌ "Insufficient wallet balance"**
```bash
# Solution: Fund wallet with ETH
# Arbitrum: https://bridge.arbitrum.io/
# Optimism: https://app.optimism.io/bridge
```

**❌ "Contract not found"**
```bash
# Solution: Deploy contracts first
npm run deploy:arb
npm run deploy:opt
```

**❌ "Flashbots connection failed"**
```bash
# Solution: Verify auth key format
# Ensure key is 64 hex characters with 0x prefix
```

### Getting Help

1. **Check validation output** for specific errors
2. **Review .env file** for missing/incorrect values
3. **Test network connectivity** manually
4. **Verify wallet balances** on block explorers
5. **Check contract deployment** status

## 📚 Additional Resources

- [Flashbots Documentation](https://docs.flashbots.net/)
- [Arbitrum Bridge Guide](https://bridge.arbitrum.io/)
- [Optimism Bridge Guide](https://app.optimism.io/bridge)
- [MEV Bot Architecture](./README.md)
- [Security Best Practices](./SECURITY.md)

## ⚡ Quick Commands Reference

```bash
# Generate keys
npm run keys:generate

# Validate setup
npm run keys:validate

# Deploy contracts
npm run deploy:arb && npm run deploy:opt

# Test bot
npm run bot:simulate

# Start bot
npm run bot:start

# Emergency stop
npm run emergency:stop
```

---

**⚠️ Security Warning**: Never share private keys or commit them to version control. Use hardware wallets and secure key management practices for production deployments.