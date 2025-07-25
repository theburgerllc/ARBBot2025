"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config();
class SetupHelper {
    static generateWallet() {
        const wallet = ethers_1.ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic?.phrase || "No mnemonic available"
        };
    }
    static displayWalletInfo(walletInfo) {
        console.log(chalk_1.default.green("\n🔑 New Wallet Generated:"));
        console.log(chalk_1.default.blue("Address: "), walletInfo.address);
        console.log(chalk_1.default.yellow("Private Key: "), walletInfo.privateKey);
        console.log(chalk_1.default.gray("Mnemonic: "), walletInfo.mnemonic);
        console.log(chalk_1.default.red("\n⚠️  SECURITY WARNING:"));
        console.log(chalk_1.default.red("- Never share your private key with anyone"));
        console.log(chalk_1.default.red("- Store it in a secure password manager"));
        console.log(chalk_1.default.red("- Fund this wallet with minimal ETH for gas fees only"));
    }
    static async validateRPC(rpcUrl, networkName) {
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
            const network = await provider.getNetwork();
            const blockNumber = await provider.getBlockNumber();
            console.log(chalk_1.default.green(`✅ ${networkName} RPC Connection:`));
            console.log(chalk_1.default.blue(`   URL: ${rpcUrl}`));
            console.log(chalk_1.default.blue(`   Chain ID: ${network.chainId}`));
            console.log(chalk_1.default.blue(`   Block Number: ${blockNumber}`));
            console.log(chalk_1.default.blue(`   Network Name: ${network.name}`));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ ${networkName} RPC Connection Failed:`));
            console.log(chalk_1.default.red(`   URL: ${rpcUrl}`));
            console.log(chalk_1.default.red(`   Error: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }
    static async checkWalletBalance(privateKey, rpcUrl) {
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
            const balance = await provider.getBalance(wallet.address);
            console.log(chalk_1.default.green(`\n💰 Wallet Balance Check:`));
            console.log(chalk_1.default.blue(`   Address: ${wallet.address}`));
            console.log(chalk_1.default.blue(`   Balance: ${ethers_1.ethers.formatEther(balance)} ETH`));
            if (balance === 0n) {
                console.log(chalk_1.default.yellow(`   ⚠️  Warning: Wallet has no ETH for gas fees`));
            }
            else if (balance < ethers_1.ethers.parseEther("0.01")) {
                console.log(chalk_1.default.yellow(`   ⚠️  Warning: Low balance - consider adding more ETH`));
            }
            else {
                console.log(chalk_1.default.green(`   ✅ Balance sufficient for gas fees`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Wallet Balance Check Failed:`));
            console.log(chalk_1.default.red(`   Error: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    static validatePrivateKey(privateKey) {
        try {
            if (!privateKey.startsWith('0x')) {
                console.log(chalk_1.default.red(`❌ Private key must start with 0x`));
                return false;
            }
            if (privateKey.length !== 66) {
                console.log(chalk_1.default.red(`❌ Private key must be 64 hex characters (66 including 0x)`));
                return false;
            }
            // Try to create a wallet to validate
            const wallet = new ethers_1.ethers.Wallet(privateKey);
            console.log(chalk_1.default.green(`✅ Private key is valid`));
            console.log(chalk_1.default.blue(`   Address: ${wallet.address}`));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Invalid private key: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }
    static async validateEnvironment() {
        console.log(chalk_1.default.blue("\n🔍 Validating Environment Configuration...\n"));
        let allValid = true;
        // Check required variables
        const requiredVars = [
            'ARB_RPC',
            'PRIVATE_KEY',
            'FLASHBOTS_AUTH_KEY'
        ];
        for (const varName of requiredVars) {
            const value = process.env[varName];
            if (!value || value.includes('YOUR_') || value.includes('1234567890')) {
                console.log(chalk_1.default.red(`❌ ${varName} is missing or contains placeholder value`));
                allValid = false;
            }
            else {
                console.log(chalk_1.default.green(`✅ ${varName} is set`));
            }
        }
        // Validate private keys
        if (process.env.PRIVATE_KEY && !process.env.PRIVATE_KEY.includes('1234567890')) {
            console.log(chalk_1.default.blue("\n🔑 Validating Private Key:"));
            allValid = this.validatePrivateKey(process.env.PRIVATE_KEY) && allValid;
        }
        if (process.env.FLASHBOTS_AUTH_KEY && !process.env.FLASHBOTS_AUTH_KEY.includes('1234567890')) {
            console.log(chalk_1.default.blue("\n🔑 Validating Flashbots Auth Key:"));
            allValid = this.validatePrivateKey(process.env.FLASHBOTS_AUTH_KEY) && allValid;
        }
        // Test RPC connections
        if (process.env.ARB_RPC && !process.env.ARB_RPC.includes('YOUR_')) {
            console.log(chalk_1.default.blue("\n🌐 Testing RPC Connections:"));
            allValid = await this.validateRPC(process.env.ARB_RPC, "Arbitrum") && allValid;
        }
        if (process.env.OPT_RPC && !process.env.OPT_RPC.includes('YOUR_')) {
            allValid = await this.validateRPC(process.env.OPT_RPC, "Optimism") && allValid;
        }
        // Check wallet balance
        if (allValid && process.env.PRIVATE_KEY && process.env.ARB_RPC) {
            await this.checkWalletBalance(process.env.PRIVATE_KEY, process.env.ARB_RPC);
        }
        return allValid;
    }
    static createEnvTemplate() {
        const envTemplate = `# ================================
# FLASH ARBITRAGE BOT CONFIGURATION
# ================================

# Network Configuration (REPLACE WITH YOUR VALUES)
ARB_RPC=https://arbitrum-mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
OPT_RPC=https://optimism-mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Wallet Configuration (REPLACE WITH YOUR VALUES)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
FLASHBOTS_AUTH_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

# Contract Address (SET AFTER DEPLOYMENT)
BOT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Pre-configured Addresses (DO NOT CHANGE)
BALANCER_VAULT_ADDRESS=0xBA12222222228d8Ba445958a75a0704d566BF2C8
UNISWAP_V2_ROUTER_ADDRESS=0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
SUSHI_ROUTER_ADDRESS=0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506
UNISWAP_V3_QUOTER_ADDRESS=0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6
WETH_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
USDC_ADDRESS=0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8

# Bot Configuration (ADJUST AS NEEDED)
MIN_PROFIT_THRESHOLD=0.01
GAS_LIMIT=500000
MAX_PRIORITY_FEE=2
COOLDOWN_PERIOD=30000
SLIPPAGE_TOLERANCE=200
MIN_PROFIT_BPS=30
`;
        const envPath = path_1.default.join(process.cwd(), '.env');
        if (fs_1.default.existsSync(envPath)) {
            console.log(chalk_1.default.yellow("⚠️  .env file already exists. Backup created as .env.backup"));
            fs_1.default.copyFileSync(envPath, envPath + '.backup');
        }
        fs_1.default.writeFileSync(envPath, envTemplate);
        console.log(chalk_1.default.green("✅ .env file created successfully"));
        console.log(chalk_1.default.blue("📝 Edit the .env file with your actual values"));
    }
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(chalk_1.default.blue("🚀 Flash Arbitrage Bot Setup Helper\n"));
        console.log("Usage:");
        console.log("  npm run setup:wallet          # Generate new wallet");
        console.log("  npm run setup:flashbots       # Generate Flashbots auth key");
        console.log("  npm run setup:validate        # Validate configuration");
        console.log("  npm run setup:env             # Create .env template");
        console.log("  npm run setup:all             # Generate wallets and create .env");
        return;
    }
    const command = args[0];
    switch (command) {
        case 'wallet':
            console.log(chalk_1.default.blue("🔑 Generating new wallet for bot..."));
            const walletInfo = SetupHelper.generateWallet();
            SetupHelper.displayWalletInfo(walletInfo);
            console.log(chalk_1.default.green("\n✅ Copy the private key to your .env file as PRIVATE_KEY"));
            break;
        case 'flashbots':
            console.log(chalk_1.default.blue("🔑 Generating Flashbots authentication key..."));
            const flashbotsWallet = SetupHelper.generateWallet();
            console.log(chalk_1.default.green("\n🔐 Flashbots Auth Key Generated:"));
            console.log(chalk_1.default.blue("Private Key: "), flashbotsWallet.privateKey);
            console.log(chalk_1.default.gray("Address: "), flashbotsWallet.address);
            console.log(chalk_1.default.green("\n✅ Copy the private key to your .env file as FLASHBOTS_AUTH_KEY"));
            console.log(chalk_1.default.yellow("💡 No funding required for this wallet"));
            break;
        case 'validate':
            const isValid = await SetupHelper.validateEnvironment();
            if (isValid) {
                console.log(chalk_1.default.green("\n🎉 Configuration is valid! Ready to deploy and run."));
            }
            else {
                console.log(chalk_1.default.red("\n❌ Configuration has issues. Please fix the problems above."));
                process.exit(1);
            }
            break;
        case 'env':
            console.log(chalk_1.default.blue("📝 Creating .env template..."));
            SetupHelper.createEnvTemplate();
            break;
        case 'all':
            console.log(chalk_1.default.blue("🚀 Complete setup process...\n"));
            // Generate bot wallet
            console.log(chalk_1.default.blue("1. Generating bot wallet..."));
            const botWallet = SetupHelper.generateWallet();
            // Generate Flashbots key
            console.log(chalk_1.default.blue("\n2. Generating Flashbots authentication key..."));
            const flashbotsKey = SetupHelper.generateWallet();
            // Create .env file
            console.log(chalk_1.default.blue("\n3. Creating .env template..."));
            SetupHelper.createEnvTemplate();
            // Display summary
            console.log(chalk_1.default.green("\n🎉 Setup Complete! Next steps:\n"));
            console.log(chalk_1.default.yellow("1. Edit .env file with these values:"));
            console.log(chalk_1.default.blue(`   PRIVATE_KEY=${botWallet.privateKey}`));
            console.log(chalk_1.default.blue(`   FLASHBOTS_AUTH_KEY=${flashbotsKey.privateKey}`));
            console.log(chalk_1.default.yellow("\n2. Add your RPC URLs to .env file"));
            console.log(chalk_1.default.yellow("3. Fund the bot wallet with ETH:"));
            console.log(chalk_1.default.blue(`   Address: ${botWallet.address}`));
            console.log(chalk_1.default.yellow("4. Validate configuration: npm run setup:validate"));
            console.log(chalk_1.default.yellow("5. Deploy contract: npm run deploy:arb"));
            console.log(chalk_1.default.yellow("6. Run bot: npm run bot:start"));
            break;
        default:
            console.log(chalk_1.default.red(`❌ Unknown command: ${command}`));
            console.log(chalk_1.default.blue("Run without arguments to see usage"));
    }
}
main().catch(console.error);
