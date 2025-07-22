"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureKeyGenerator = void 0;
const ethers_1 = require("ethers");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class SecureKeyGenerator {
    ENV_FILE = path_1.default.join(process.cwd(), '.env');
    BACKUP_DIR = path_1.default.join(process.cwd(), 'backups');
    ENTROPY_BYTES = 32;
    constructor() {
        this.ensureBackupDir();
    }
    ensureBackupDir() {
        if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
            fs_1.default.mkdirSync(this.BACKUP_DIR, { mode: 0o700 });
        }
    }
    /**
     * Generate cryptographically secure private key using OpenSSL equivalent
     */
    generateSecurePrivateKey() {
        // Use crypto.randomBytes for maximum entropy
        const entropy = crypto_1.default.randomBytes(this.ENTROPY_BYTES);
        // Ensure the key is within the valid secp256k1 range
        const maxKey = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140');
        let keyBigInt = BigInt('0x' + entropy.toString('hex'));
        // Ensure key is within valid range
        while (keyBigInt >= maxKey || keyBigInt === 0n) {
            const newEntropy = crypto_1.default.randomBytes(this.ENTROPY_BYTES);
            keyBigInt = BigInt('0x' + newEntropy.toString('hex'));
        }
        const privateKey = '0x' + keyBigInt.toString(16).padStart(64, '0');
        return privateKey;
    }
    /**
     * Generate a complete key pair with validation
     */
    generateKeyPair() {
        const privateKey = this.generateSecurePrivateKey();
        const wallet = new ethers_1.ethers.Wallet(privateKey);
        // Generate additional entropy info for verification
        const entropy = crypto_1.default.randomBytes(16).toString('hex');
        return {
            privateKey: wallet.privateKey,
            publicKey: wallet.signingKey.publicKey,
            address: wallet.address,
            entropy: entropy
        };
    }
    /**
     * Validate private key format and derivation
     */
    validateKeyPair(keyPair) {
        try {
            // Validate private key format
            if (!keyPair.privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
                console.error(chalk_1.default.red("❌ Invalid private key format"));
                return false;
            }
            // Validate that private key produces expected address
            const testWallet = new ethers_1.ethers.Wallet(keyPair.privateKey);
            if (testWallet.address !== keyPair.address) {
                console.error(chalk_1.default.red("❌ Private key does not match address"));
                return false;
            }
            // Validate that public key matches
            if (testWallet.signingKey.publicKey !== keyPair.publicKey) {
                console.error(chalk_1.default.red("❌ Public key does not match"));
                return false;
            }
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Key validation failed:"), error);
            return false;
        }
    }
    /**
     * Generate both executor and Flashbots authentication keys
     */
    generateWalletKeys() {
        console.log(chalk_1.default.blue("🔐 Generating secure cryptographic keys..."));
        console.log(chalk_1.default.gray("Using crypto.randomBytes for maximum entropy"));
        // Generate executor wallet (needs funding)
        console.log(chalk_1.default.yellow("📋 Generating executor wallet..."));
        const executorWallet = this.generateKeyPair();
        if (!this.validateKeyPair(executorWallet)) {
            throw new Error("Executor wallet validation failed");
        }
        // Generate Flashbots auth key (no funding needed)
        console.log(chalk_1.default.yellow("📋 Generating Flashbots auth key..."));
        const flashbotsAuthKey = this.generateKeyPair();
        if (!this.validateKeyPair(flashbotsAuthKey)) {
            throw new Error("Flashbots auth key validation failed");
        }
        const walletInfo = {
            executorWallet,
            flashbotsAuthKey,
            timestamp: new Date().toISOString(),
            chainInfo: {
                arbitrum: { chainId: 42161, rpc: "https://arb1.arbitrum.io/rpc" },
                optimism: { chainId: 10, rpc: "https://mainnet.optimism.io" }
            }
        };
        console.log(chalk_1.default.green("✅ Key generation completed successfully"));
        return walletInfo;
    }
    /**
     * Display wallet information with security warnings
     */
    displayWalletInfo(walletInfo) {
        console.log(chalk_1.default.green("\n🔑 EXECUTOR WALLET (Needs Funding)"));
        console.log(chalk_1.default.blue("Address:     "), walletInfo.executorWallet.address);
        console.log(chalk_1.default.yellow("Private Key: "), walletInfo.executorWallet.privateKey);
        console.log(chalk_1.default.gray("Public Key:  "), walletInfo.executorWallet.publicKey);
        console.log(chalk_1.default.green("\n🔐 FLASHBOTS AUTH KEY (No Funding Needed)"));
        console.log(chalk_1.default.blue("Address:     "), walletInfo.flashbotsAuthKey.address);
        console.log(chalk_1.default.yellow("Private Key: "), walletInfo.flashbotsAuthKey.privateKey);
        console.log(chalk_1.default.gray("Public Key:  "), walletInfo.flashbotsAuthKey.publicKey);
        console.log(chalk_1.default.red("\n⚠️  CRITICAL SECURITY WARNINGS:"));
        console.log(chalk_1.default.red("1. Never share these private keys with anyone"));
        console.log(chalk_1.default.red("2. Store them in a secure password manager"));
        console.log(chalk_1.default.red("3. Use hardware wallets for production"));
        console.log(chalk_1.default.red("4. Enable 2FA on all related accounts"));
        console.log(chalk_1.default.red("5. Regularly rotate keys for security"));
        console.log(chalk_1.default.cyan("\n💰 FUNDING INSTRUCTIONS:"));
        console.log(chalk_1.default.white("Fund the EXECUTOR wallet with ~0.1 ETH on each chain:"));
        console.log(chalk_1.default.blue("• Arbitrum: https://bridge.arbitrum.io/"));
        console.log(chalk_1.default.blue("• Optimism: https://app.optimism.io/bridge"));
        console.log(chalk_1.default.gray("• Minimum: 0.05 ETH per chain for gas fees"));
        console.log(chalk_1.default.gray("• Recommended: 0.1 ETH per chain for operations"));
    }
    /**
     * Create .env file with generated keys
     */
    async createEnvFile(walletInfo) {
        console.log(chalk_1.default.yellow("📝 Creating .env file..."));
        const envContent = `# ================================
# MEV ARBITRAGE BOT CONFIGURATION
# Generated: ${walletInfo.timestamp}
# ================================

# Network Configuration
ARB_RPC=https://arb1.arbitrum.io/rpc
OPT_RPC=https://mainnet.optimism.io
MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Fork Configuration
FORK_BLOCK=180000000
FORK_BLOCK_OPT=110000000

# ================================
# WALLET CONFIGURATION (SECURE)
# ================================

# Executor Wallet (NEEDS FUNDING: ~0.1 ETH per chain)
PRIVATE_KEY=${walletInfo.executorWallet.privateKey}

# Flashbots Auth Key (NO FUNDING NEEDED)
FLASHBOTS_AUTH_KEY=${walletInfo.flashbotsAuthKey.privateKey}

# Flashbots Configuration
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
MEV_SHARE_URL=https://mev-share.flashbots.net

# ================================
# CONTRACT ADDRESSES
# ================================

# Deployed Bot Contracts (set after deployment)
BOT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
OPT_BOT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Infrastructure Contracts
BALANCER_VAULT_ADDRESS=0xBA12222222228d8Ba445958a75a0704d566BF2C8
OPT_BALANCER_VAULT_ADDRESS=0xBA12222222228d8Ba445958a75a0704d566BF2C8
UNISWAP_V3_QUOTER_ADDRESS=0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6

# Router Addresses (Mid-2025)
UNI_V2_ROUTER_ARB=0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24
SUSHI_ROUTER_ARB=0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55
UNI_V2_ROUTER_OPT=0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2
SUSHI_ROUTER_OPT=0x2ABf469074dc0b54d793850807E6eb5Faf2625b1

# Token Addresses - Arbitrum
WETH_ARB=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
USDC_ARB=0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
USDT_ARB=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
WBTC_ARB=0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f

# Token Addresses - Optimism
WETH_OPT=0x4200000000000000000000000000000000000006
USDC_OPT=0x7F5c764cBc14f9669B88837ca1490cCa17c31607
USDT_OPT=0x94b008aA00579c1307B0EF2c499aD98a8ce58e58
WBTC_OPT=0x68f180fcCe6836688e9084f035309E29Bf0A2095

# ================================
# MEV BOT CONFIGURATION
# ================================

# Profit Thresholds
MIN_PROFIT_THRESHOLD=0.01
MIN_CROSS_CHAIN_SPREAD=0.0005
CRITICAL_SPREAD_THRESHOLD=0.002

# Gas Configuration
GAS_LIMIT=800000
MAX_PRIORITY_FEE=3
MAX_SLIPPAGE=0.03

# Timing Configuration
COOLDOWN_PERIOD=15000
PRICE_UPDATE_INTERVAL=5000
BUNDLE_TIMEOUT=30000

# Feature Flags
ENABLE_TRIANGULAR_ARBITRAGE=true
ENABLE_CROSS_CHAIN_MONITORING=true
ENABLE_CIRCUIT_BREAKER=true
ENABLE_SIMULATION_MODE=false
ENABLE_METRICS=true

# Risk Management
CIRCUIT_BREAKER_THRESHOLD=10
BRIDGE_COST_ESTIMATE=0.005
MAX_TRADE_SIZE=100
SLIPPAGE_TOLERANCE=200
MIN_PROFIT_BPS=30

# Logging Configuration
LOG_LEVEL=info
METRICS_PORT=3000

# API Keys (replace with actual values)
ARBISCAN_API_KEY=your_arbiscan_api_key
OPTIMISTIC_ETHERSCAN_API_KEY=your_optimistic_etherscan_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Development Configuration
DEBUG_MODE=false
VERBOSE_LOGGING=false
SAVE_BUNDLE_HISTORY=true
PERFORMANCE_MONITORING=true

# Testing Configuration
TEST_WHALE_ADDRESS=0x489ee077994B6658eAfA855C308275EAd8097C4A
TEST_TRIANGULAR_ARBITRAGE=true
TEST_CROSS_CHAIN_SCENARIOS=true
TEST_MEV_BUNDLES=true
REPORT_GAS=false

# ================================
# SECURITY NOTES
# ================================
# Generated: ${walletInfo.timestamp}
# Executor Address: ${walletInfo.executorWallet.address}
# Flashbots Address: ${walletInfo.flashbotsAuthKey.address}
# 
# IMPORTANT:
# - Keep this file secure and never commit to git
# - Fund executor wallet with 0.1 ETH on each chain
# - Flashbots key requires no funding
# - Use hardware wallets for production
# - Enable 2FA on all accounts
# - Regularly rotate keys
`;
        // Write .env file with restricted permissions
        fs_1.default.writeFileSync(this.ENV_FILE, envContent, { mode: 0o600 });
        console.log(chalk_1.default.green("✅ .env file created successfully"));
        console.log(chalk_1.default.yellow("📁 Location: "), this.ENV_FILE);
        console.log(chalk_1.default.gray("🔒 Permissions: 600 (owner read/write only)"));
    }
    /**
     * Create encrypted backup of wallet information
     */
    async createBackup(walletInfo, password) {
        console.log(chalk_1.default.yellow("💾 Creating encrypted backup..."));
        const backupData = {
            walletInfo,
            metadata: {
                version: "2.0.0",
                created: new Date().toISOString(),
                generator: "enhanced-mev-bot",
                checksum: crypto_1.default.createHash('sha256').update(JSON.stringify(walletInfo)).digest('hex')
            }
        };
        const backupJson = JSON.stringify(backupData, null, 2);
        // Create backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `wallet-backup-${timestamp}.json`;
        const backupPath = path_1.default.join(this.BACKUP_DIR, backupFilename);
        if (password) {
            // Encrypt backup with password using secure method
            const key = crypto_1.default.scryptSync(password, 'salt', 32);
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipheriv('aes-256-cbc', key, iv);
            let encrypted = cipher.update(backupJson, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Prepend IV to encrypted data
            const finalEncrypted = iv.toString('hex') + ':' + encrypted;
            fs_1.default.writeFileSync(backupPath + '.encrypted', finalEncrypted, { mode: 0o600 });
            console.log(chalk_1.default.green("✅ Encrypted backup created: "), backupPath + '.encrypted');
            return backupPath + '.encrypted';
        }
        else {
            // Create unencrypted backup (less secure)
            fs_1.default.writeFileSync(backupPath, backupJson, { mode: 0o600 });
            console.log(chalk_1.default.green("✅ Backup created: "), backupPath);
            console.log(chalk_1.default.yellow("⚠️  Backup is not encrypted - consider using password"));
            return backupPath;
        }
    }
    /**
     * Validate network connectivity
     */
    async validateNetworkConnectivity(walletInfo) {
        console.log(chalk_1.default.blue("🌐 Validating network connectivity..."));
        try {
            // Test Arbitrum connection
            const arbProvider = new ethers_1.ethers.JsonRpcProvider(walletInfo.chainInfo.arbitrum.rpc);
            const arbNetwork = await arbProvider.getNetwork();
            const arbBlockNumber = await arbProvider.getBlockNumber();
            console.log(chalk_1.default.green("✅ Arbitrum connection successful"));
            console.log(chalk_1.default.blue("   Chain ID: "), arbNetwork.chainId);
            console.log(chalk_1.default.blue("   Block: "), arbBlockNumber);
            // Test Optimism connection
            const optProvider = new ethers_1.ethers.JsonRpcProvider(walletInfo.chainInfo.optimism.rpc);
            const optNetwork = await optProvider.getNetwork();
            const optBlockNumber = await optProvider.getBlockNumber();
            console.log(chalk_1.default.green("✅ Optimism connection successful"));
            console.log(chalk_1.default.blue("   Chain ID: "), optNetwork.chainId);
            console.log(chalk_1.default.blue("   Block: "), optBlockNumber);
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Network connectivity test failed:"), error);
            return false;
        }
    }
    /**
     * Check wallet balances on both chains
     */
    async checkWalletBalances(walletInfo) {
        console.log(chalk_1.default.blue("💰 Checking wallet balances..."));
        try {
            // Check Arbitrum balance
            const arbProvider = new ethers_1.ethers.JsonRpcProvider(walletInfo.chainInfo.arbitrum.rpc);
            const arbBalance = await arbProvider.getBalance(walletInfo.executorWallet.address);
            console.log(chalk_1.default.blue("Arbitrum Balance:"));
            console.log(chalk_1.default.white("  Address: "), walletInfo.executorWallet.address);
            console.log(chalk_1.default.white("  Balance: "), ethers_1.ethers.formatEther(arbBalance), "ETH");
            if (arbBalance < ethers_1.ethers.parseEther("0.05")) {
                console.log(chalk_1.default.red("  ⚠️  Low balance - fund with at least 0.1 ETH"));
                console.log(chalk_1.default.blue("  📝 Bridge: https://bridge.arbitrum.io/"));
            }
            else {
                console.log(chalk_1.default.green("  ✅ Sufficient balance"));
            }
            // Check Optimism balance
            const optProvider = new ethers_1.ethers.JsonRpcProvider(walletInfo.chainInfo.optimism.rpc);
            const optBalance = await optProvider.getBalance(walletInfo.executorWallet.address);
            console.log(chalk_1.default.blue("\nOptimism Balance:"));
            console.log(chalk_1.default.white("  Address: "), walletInfo.executorWallet.address);
            console.log(chalk_1.default.white("  Balance: "), ethers_1.ethers.formatEther(optBalance), "ETH");
            if (optBalance < ethers_1.ethers.parseEther("0.05")) {
                console.log(chalk_1.default.red("  ⚠️  Low balance - fund with at least 0.1 ETH"));
                console.log(chalk_1.default.blue("  📝 Bridge: https://app.optimism.io/bridge"));
            }
            else {
                console.log(chalk_1.default.green("  ✅ Sufficient balance"));
            }
            // Total balance summary
            const totalBalance = arbBalance + optBalance;
            console.log(chalk_1.default.cyan("\n📊 Total Balance: "), ethers_1.ethers.formatEther(totalBalance), "ETH");
            if (totalBalance < ethers_1.ethers.parseEther("0.1")) {
                console.log(chalk_1.default.red("🚨 CRITICAL: Insufficient funds for MEV operations"));
                console.log(chalk_1.default.yellow("💡 Recommended: At least 0.1 ETH per chain (0.2 ETH total)"));
            }
            else {
                console.log(chalk_1.default.green("✅ Wallet is funded and ready for operations"));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Balance check failed:"), error);
        }
    }
    /**
     * Generate OpenSSL equivalent command for verification
     */
    generateOpenSSLCommand() {
        console.log(chalk_1.default.blue("\n🔧 OpenSSL Equivalent Commands:"));
        console.log(chalk_1.default.gray("For manual key generation verification:"));
        console.log(chalk_1.default.white("\nExecutor Key:"));
        console.log(chalk_1.default.cyan("openssl rand -hex 32"));
        console.log(chalk_1.default.white("\nFlashbots Auth Key:"));
        console.log(chalk_1.default.cyan("openssl rand -hex 32"));
        console.log(chalk_1.default.yellow("\n⚠️  Note: This script uses crypto.randomBytes which is equivalent to OpenSSL's randomness"));
    }
    /**
     * Main setup function
     */
    async setupWallet(options = {}) {
        try {
            console.log(chalk_1.default.green("🚀 MEV Bot Wallet Setup"));
            console.log(chalk_1.default.gray("========================================"));
            // Generate keys
            const walletInfo = this.generateWalletKeys();
            // Display wallet information
            this.displayWalletInfo(walletInfo);
            // Create .env file
            await this.createEnvFile(walletInfo);
            // Create backup if requested
            if (options.createBackup) {
                await this.createBackup(walletInfo, options.password);
            }
            // Validate network connectivity
            await this.validateNetworkConnectivity(walletInfo);
            // Check wallet balances (unless skipped)
            if (!options.skipBalance) {
                await this.checkWalletBalances(walletInfo);
            }
            // Show OpenSSL equivalent commands
            this.generateOpenSSLCommand();
            console.log(chalk_1.default.green("\n✅ Wallet setup completed successfully!"));
            console.log(chalk_1.default.yellow("📋 Next steps:"));
            console.log(chalk_1.default.white("1. Fund executor wallet with 0.1 ETH on each chain"));
            console.log(chalk_1.default.white("2. Deploy contracts: npm run deploy:arb && npm run deploy:opt"));
            console.log(chalk_1.default.white("3. Update contract addresses in .env"));
            console.log(chalk_1.default.white("4. Test setup: npm run bot:simulate"));
            console.log(chalk_1.default.white("5. Start bot: npm run bot:start"));
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Wallet setup failed:"), error);
            throw error;
        }
    }
}
exports.SecureKeyGenerator = SecureKeyGenerator;
// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const generator = new SecureKeyGenerator();
    const options = {
        createBackup: args.includes('--backup'),
        password: args.includes('--password') ? args[args.indexOf('--password') + 1] : undefined,
        skipBalance: args.includes('--skip-balance')
    };
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk_1.default.blue("🔑 MEV Bot Key Generator"));
        console.log(chalk_1.default.white("\nUsage: ts-node scripts/generate-keys.ts [options]"));
        console.log(chalk_1.default.white("\nOptions:"));
        console.log(chalk_1.default.gray("  --backup           Create encrypted backup"));
        console.log(chalk_1.default.gray("  --password <pwd>   Password for backup encryption"));
        console.log(chalk_1.default.gray("  --skip-balance     Skip balance checking"));
        console.log(chalk_1.default.gray("  --help, -h         Show this help"));
        console.log(chalk_1.default.white("\nExamples:"));
        console.log(chalk_1.default.cyan("  ts-node scripts/generate-keys.ts"));
        console.log(chalk_1.default.cyan("  ts-node scripts/generate-keys.ts --backup --password mypassword"));
        console.log(chalk_1.default.cyan("  ts-node scripts/generate-keys.ts --skip-balance"));
        return;
    }
    try {
        await generator.setupWallet(options);
    }
    catch (error) {
        console.error(chalk_1.default.red("Setup failed:"), error);
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
