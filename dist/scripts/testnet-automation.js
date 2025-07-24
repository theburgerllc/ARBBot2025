#!/usr/bin/env ts-node
"use strict";
/**
 * Testnet Automation Script - ARBBot2025
 *
 * Automated testnet setup including:
 * - Faucet token requests
 * - RPC endpoint configuration
 * - Balance validation
 * - Cross-chain bridging
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestnetAutomation = void 0;
const playwright_1 = require("playwright");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
class TestnetAutomation {
    browser = null;
    page = null;
    walletAddress = '';
    TESTNET_CONFIGS = [
        {
            name: 'Arbitrum Sepolia',
            chainId: 421614,
            rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
            explorerUrl: 'https://sepolia.arbiscan.io',
            faucetUrl: 'https://faucets.chain.link/arbitrum-sepolia',
            alternativeFaucets: [
                'https://faucet.quicknode.com/arbitrum/sepolia',
                'https://www.alchemy.com/faucets/arbitrum-sepolia',
                'https://tokentool.bitbond.com/faucet/arbitrum-sepolia',
                'https://learnweb3.io/faucets/arbitrum_sepolia'
            ],
            requiredBalance: '0.05',
            priority: 1,
            estimatedWaitTime: 10,
            amount: '0.05'
        },
        {
            name: 'Ethereum Sepolia',
            chainId: 11155111,
            rpcUrl: 'https://rpc.sepolia.org',
            explorerUrl: 'https://sepolia.etherscan.io',
            faucetUrl: 'https://sepolia-faucet.pk910.de',
            alternativeFaucets: [
                'https://faucets.chain.link/sepolia',
                'https://faucet.quicknode.com/ethereum/sepolia',
                'https://www.alchemy.com/faucets/ethereum-sepolia'
            ],
            bridgeUrl: 'https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia&sourceChain=sepolia',
            requiredBalance: '0.05',
            priority: 2,
            estimatedWaitTime: 600, // PK910 mining takes longer
            amount: '1.5'
        },
        {
            name: 'Optimism Sepolia',
            chainId: 11155420,
            rpcUrl: 'https://sepolia.optimism.io',
            explorerUrl: 'https://sepolia-optimistic.etherscan.io',
            faucetUrl: 'https://faucets.chain.link/optimism-sepolia',
            alternativeFaucets: [
                'https://faucet.quicknode.com/optimism/sepolia',
                'https://www.alchemy.com/faucets/optimism-sepolia'
            ],
            requiredBalance: '0.05',
            priority: 3,
            estimatedWaitTime: 15,
            amount: '0.05'
        }
    ];
    constructor() {
        // Initialize wallet address from environment
        if (process.env.PRIVATE_KEY) {
            const wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY);
            this.walletAddress = wallet.address;
        }
    }
    async initialize() {
        console.log(chalk_1.default.blue('🚀 Initializing Testnet Automation System'));
        if (!this.walletAddress) {
            throw new Error('PRIVATE_KEY not found in environment');
        }
        console.log(chalk_1.default.cyan(`💼 Wallet Address: ${this.walletAddress}`));
        // Launch browser with stealth configuration
        this.browser = await playwright_1.chromium.launch({
            headless: process.env.NODE_ENV === 'production',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        this.page = await this.browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        // Add stealth behaviors
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
        console.log(chalk_1.default.green('✅ Browser automation initialized'));
    }
    async checkAllBalances() {
        console.log(chalk_1.default.blue('\n💰 Checking balances across all testnets...'));
        const balances = {};
        for (const config of this.TESTNET_CONFIGS) {
            try {
                const provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
                const balance = await provider.getBalance(this.walletAddress);
                const balanceEth = ethers_1.ethers.formatEther(balance);
                balances[config.name] = balanceEth;
                const hasEnough = parseFloat(balanceEth) >= parseFloat(config.requiredBalance);
                const status = hasEnough ? '✅' : '❌';
                console.log(chalk_1.default.white(`  ${status} ${config.name}: ${balanceEth} ETH (need ${config.requiredBalance} ETH)`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`  ❌ ${config.name}: Connection failed - ${error}`));
                balances[config.name] = '0';
            }
        }
        return balances;
    }
    async requestFromMultipleFaucets(config) {
        console.log(chalk_1.default.cyan(`\n🎯 Smart faucet strategy for ${config.name}...`));
        // Create list of all faucets to try (primary + alternatives)
        const allFaucets = [config.faucetUrl];
        if (config.alternativeFaucets) {
            allFaucets.push(...config.alternativeFaucets);
        }
        console.log(chalk_1.default.white(`  📋 Found ${allFaucets.length} faucet sources to try`));
        // Try faucets in parallel (for speed) but with fallback logic
        const results = [];
        for (let i = 0; i < Math.min(3, allFaucets.length); i++) {
            const faucetUrl = allFaucets[i];
            const faucetConfig = { ...config, faucetUrl };
            console.log(chalk_1.default.gray(`  🚀 Attempting faucet ${i + 1}: ${faucetUrl.substring(0, 40)}...`));
            // Add a slight delay between requests to avoid being flagged
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            results.push(this.requestFaucetTokens(faucetConfig));
        }
        // Wait for first successful result or all to complete
        try {
            const raceResult = await Promise.race(results.map(async (promise, index) => {
                try {
                    const result = await promise;
                    return { ...result, sourceIndex: index };
                }
                catch (error) {
                    throw { error, sourceIndex: index };
                }
            }));
            if (raceResult.success) {
                const faucetName = new URL(allFaucets[raceResult.sourceIndex]).hostname;
                console.log(chalk_1.default.green(`  ✅ Success from ${faucetName} (source ${raceResult.sourceIndex + 1})`));
                return raceResult;
            }
        }
        catch (firstError) {
            console.log(chalk_1.default.yellow(`  ⚠️ First attempt failed, waiting for other attempts...`));
        }
        // If race didn't work, wait for all results and return first successful one
        try {
            const allResults = await Promise.allSettled(results);
            for (let i = 0; i < allResults.length; i++) {
                const result = allResults[i];
                if (result.status === 'fulfilled' && result.value.success) {
                    const faucetName = new URL(allFaucets[i]).hostname;
                    console.log(chalk_1.default.green(`  ✅ Success from ${faucetName} (fallback result)`));
                    return result.value;
                }
            }
            // All failed, return combined error
            const errors = allResults
                .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
                .map((r, i) => `${new URL(allFaucets[i]).hostname}: ${r.status === 'rejected'
                ? r.reason
                : r.value.error}`);
            return {
                success: false,
                error: `All ${allFaucets.length} faucets failed: ${errors.join('; ')}`
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Parallel faucet request failed: ${error}`
            };
        }
    }
    async requestFaucetTokens(config, retryCount = 0) {
        if (!this.page)
            throw new Error('Browser not initialized');
        const maxRetries = 2;
        const faucetName = new URL(config.faucetUrl).hostname;
        console.log(chalk_1.default.yellow(`\n🚰 Requesting tokens from ${faucetName}${retryCount > 0 ? ` (retry ${retryCount})` : ''}...`));
        try {
            // Enhanced navigation with longer timeout and better error handling
            console.log(chalk_1.default.gray(`  📡 Navigating to ${config.faucetUrl}...`));
            await this.page.goto(config.faucetUrl, {
                waitUntil: 'networkidle',
                timeout: 45000 // Increased timeout to 45 seconds
            });
            // Wait for page to fully load
            await this.page.waitForTimeout(3000);
            console.log(chalk_1.default.gray(`  ✅ Page loaded successfully`));
            // Handle different faucet types
            let result;
            if (config.faucetUrl.includes('chain.link')) {
                result = await this.handleChainlinkFaucet(config);
            }
            else if (config.faucetUrl.includes('pk910.de')) {
                result = await this.handlePK910Faucet(config);
            }
            else if (config.faucetUrl.includes('faucet.quicknode.com')) {
                result = await this.handleQuickNodeFaucet(config);
            }
            else if (config.faucetUrl.includes('alchemy.com')) {
                result = await this.handleAlchemyFaucet(config);
            }
            else if (config.faucetUrl.includes('bitbond.com')) {
                result = await this.handleBitbondFaucet(config);
            }
            else if (config.faucetUrl.includes('learnweb3.io')) {
                result = await this.handleLearnWeb3Faucet(config);
            }
            else {
                result = await this.handleGenericFaucet(config);
            }
            // If successful, return result
            if (result.success) {
                console.log(chalk_1.default.green(`  🎉 ${faucetName} request successful!`));
                return result;
            }
            // If not successful and we have retries left, retry
            if (retryCount < maxRetries) {
                console.log(chalk_1.default.yellow(`  ⚠️ ${faucetName} failed, retrying in 5 seconds...`));
                await new Promise(resolve => setTimeout(resolve, 5000));
                return await this.requestFaucetTokens(config, retryCount + 1);
            }
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(chalk_1.default.red(`  ❌ ${faucetName} error: ${errorMsg}`));
            // Retry logic for network/timeout errors
            if (retryCount < maxRetries && (errorMsg.includes('Timeout') ||
                errorMsg.includes('timeout') ||
                errorMsg.includes('Network') ||
                errorMsg.includes('ERR_') ||
                errorMsg.includes('ECONNRESET'))) {
                console.log(chalk_1.default.yellow(`  🔄 Network error detected, retrying ${faucetName} in 10 seconds...`));
                await new Promise(resolve => setTimeout(resolve, 10000));
                return await this.requestFaucetTokens(config, retryCount + 1);
            }
            return {
                success: false,
                error: `${faucetName}: ${errorMsg}${retryCount > 0 ? ` (after ${retryCount} retries)` : ''}`
            };
        }
    }
    async handleChainlinkFaucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            // Look for wallet connect button
            await this.page.waitForSelector('button:has-text("Connect wallet"), button:has-text("Connect Wallet")', { timeout: 10000 });
            await this.page.click('button:has-text("Connect wallet"), button:has-text("Connect Wallet")');
            await this.page.waitForTimeout(2000);
            // Handle MetaMask connection (if available)
            try {
                await this.page.waitForSelector('[data-testid="rk-wallet-option-metaMask"], button:has-text("MetaMask")', { timeout: 5000 });
                await this.page.click('[data-testid="rk-wallet-option-metaMask"], button:has-text("MetaMask")');
                await this.page.waitForTimeout(3000);
            }
            catch {
                // If MetaMask not available, try manual address input
                console.log(chalk_1.default.yellow('  ⚠️ MetaMask not detected, trying manual address input'));
            }
            // Look for address input field
            const addressInput = await this.page.locator('input[placeholder*="address"], input[placeholder*="Address"]').first();
            if (await addressInput.isVisible()) {
                await addressInput.fill(this.walletAddress);
                await this.page.waitForTimeout(1000);
            }
            // Find and click request button
            const requestButton = this.page.locator('button:has-text("Send request"), button:has-text("Request"), button:has-text("Get"), button[type="submit"]').first();
            if (await requestButton.isVisible()) {
                await requestButton.click();
                console.log(chalk_1.default.green('  ✅ Faucet request submitted'));
                // Wait for confirmation
                await this.page.waitForTimeout(5000);
                return {
                    success: true,
                    amount: config.requiredBalance,
                    waitTime: 300 // 5 minutes typical wait
                };
            }
            else {
                throw new Error('Request button not found');
            }
        }
        catch (error) {
            return {
                success: false,
                error: `Chainlink faucet error: ${error}`
            };
        }
    }
    async handlePK910Faucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            // PK910 faucet uses mining - look for address input
            await this.page.waitForSelector('input[placeholder*="address"], #targetAddr', { timeout: 10000 });
            const addressInput = this.page.locator('input[placeholder*="address"], #targetAddr').first();
            await addressInput.fill(this.walletAddress);
            // Start mining
            const startButton = this.page.locator('button:has-text("Start Mining"), #startBtn, .start-btn').first();
            if (await startButton.isVisible()) {
                await startButton.click();
                console.log(chalk_1.default.green('  ✅ Mining started (this may take several minutes)'));
                return {
                    success: true,
                    amount: '1.5',
                    waitTime: 600 // 10 minutes for mining
                };
            }
            throw new Error('Start mining button not found');
        }
        catch (error) {
            return {
                success: false,
                error: `PK910 faucet error: ${error}`
            };
        }
    }
    async handleQuickNodeFaucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            // QuickNode faucet - look for address input
            await this.page.waitForSelector('input[placeholder*="address"]', { timeout: 10000 });
            const addressInput = this.page.locator('input[placeholder*="address"]').first();
            await addressInput.fill(this.walletAddress);
            // Submit request
            const submitButton = this.page.locator('button:has-text("Continue"), button[type="submit"]').first();
            await submitButton.click();
            console.log(chalk_1.default.green('  ✅ QuickNode faucet request submitted'));
            return {
                success: true,
                amount: '0.025',
                waitTime: 180 // 3 minutes
            };
        }
        catch (error) {
            return {
                success: false,
                error: `QuickNode faucet error: ${error}`
            };
        }
    }
    async handleGenericFaucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            // Generic faucet handler - try common selectors
            let addressFilled = false;
            // Try different address input selectors
            const addressSelectors = [
                'input[placeholder*="address"]',
                'input[placeholder*="Address"]',
                'input[name="address"]',
                'input[id*="address"]',
                '#address',
                '.address-input input'
            ];
            for (const selector of addressSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    await this.page.fill(selector, this.walletAddress);
                    addressFilled = true;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!addressFilled) {
                throw new Error('Could not find address input field');
            }
            // Try different submit button selectors
            const buttonSelectors = [
                'button:has-text("Request")',
                'button:has-text("Send")',
                'button:has-text("Get")',
                'button:has-text("Claim")',
                'button[type="submit"]',
                '.submit-btn',
                '#submit'
            ];
            for (const selector of buttonSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    await this.page.click(selector);
                    console.log(chalk_1.default.green(`  ✅ Generic faucet request submitted for ${config.name}`));
                    return {
                        success: true,
                        amount: config.requiredBalance,
                        waitTime: 300
                    };
                }
                catch {
                    continue;
                }
            }
            throw new Error('Could not find submit button');
        }
        catch (error) {
            return {
                success: false,
                error: `Generic faucet error: ${error}`
            };
        }
    }
    async handleAlchemyFaucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            console.log(chalk_1.default.blue('  🔗 Using Alchemy faucet...'));
            // Wait for page to load
            await this.page.waitForTimeout(3000);
            // Look for wallet connect button
            const connectSelectors = [
                'button:has-text("Connect Wallet")',
                'button:has-text("Connect")',
                '[data-testid="connect-wallet"]',
                '.connect-wallet-button'
            ];
            let connected = false;
            for (const selector of connectSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    await this.page.click(selector);
                    await this.page.waitForTimeout(2000);
                    connected = true;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!connected) {
                // Try manual address input
                const addressInputs = [
                    'input[placeholder*="address"]',
                    'input[placeholder*="Address"]',
                    'input[name="address"]',
                    '#address'
                ];
                for (const selector of addressInputs) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 3000 });
                        await this.page.fill(selector, this.walletAddress);
                        await this.page.waitForTimeout(1000);
                        break;
                    }
                    catch {
                        continue;
                    }
                }
            }
            // Find and click request/claim button
            const requestSelectors = [
                'button:has-text("Send me ETH")',
                'button:has-text("Request")',
                'button:has-text("Claim")',
                'button:has-text("Get")',
                'button[type="submit"]'
            ];
            for (const selector of requestSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    await this.page.click(selector);
                    console.log(chalk_1.default.green('  ✅ Alchemy faucet request submitted'));
                    return {
                        success: true,
                        amount: config.amount,
                        waitTime: 180 // 3 minutes
                    };
                }
                catch {
                    continue;
                }
            }
            throw new Error('Could not find request button');
        }
        catch (error) {
            return {
                success: false,
                error: `Alchemy faucet error: ${error}`
            };
        }
    }
    async handleBitbondFaucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            console.log(chalk_1.default.blue('  🔗 Using Bitbond faucet...'));
            // Wait for page to load
            await this.page.waitForTimeout(3000);
            // Look for wallet connection - Bitbond supports MetaMask and Coinbase
            const connectSelectors = [
                'button:has-text("Connect Wallet")',
                'button:has-text("Connect MetaMask")',
                'button:has-text("Connect Coinbase")',
                '.wallet-connect-button',
                '[data-wallet="metamask"]',
                '[data-wallet="coinbase"]'
            ];
            let connected = false;
            for (const selector of connectSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    await this.page.click(selector);
                    await this.page.waitForTimeout(3000);
                    connected = true;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!connected) {
                // Try address input fallback
                const addressInputs = [
                    'input[placeholder*="wallet"]',
                    'input[placeholder*="address"]',
                    'input[name="walletAddress"]',
                    '#walletAddress'
                ];
                for (const selector of addressInputs) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 3000 });
                        await this.page.fill(selector, this.walletAddress);
                        await this.page.waitForTimeout(1000);
                        break;
                    }
                    catch {
                        continue;
                    }
                }
            }
            // Look for claim/request button
            const claimSelectors = [
                'button:has-text("Claim")',
                'button:has-text("Get ETH")',
                'button:has-text("Request")',
                'button:has-text("Send")',
                '.claim-button',
                '[data-action="claim"]'
            ];
            for (const selector of claimSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    await this.page.click(selector);
                    console.log(chalk_1.default.green('  ✅ Bitbond faucet request submitted'));
                    return {
                        success: true,
                        amount: config.amount,
                        waitTime: 300 // 5 minutes as per research
                    };
                }
                catch {
                    continue;
                }
            }
            throw new Error('Could not find claim button');
        }
        catch (error) {
            return {
                success: false,
                error: `Bitbond faucet error: ${error}`
            };
        }
    }
    async handleLearnWeb3Faucet(config) {
        if (!this.page)
            throw new Error('Page not initialized');
        try {
            console.log(chalk_1.default.blue('  🔗 Using LearnWeb3 faucet...'));
            // Wait for page to load
            await this.page.waitForTimeout(3000);
            // LearnWeb3 typically requires account login or wallet connection
            const authSelectors = [
                'button:has-text("Connect Wallet")',
                'button:has-text("Sign In")',
                'button:has-text("Login")',
                '.auth-button',
                '[data-testid="wallet-connect"]'
            ];
            let authenticated = false;
            for (const selector of authSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    await this.page.click(selector);
                    await this.page.waitForTimeout(2000);
                    authenticated = true;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!authenticated) {
                // Try direct address input
                const addressInputs = [
                    'input[placeholder*="address"]',
                    'input[name="address"]',
                    '#address-input'
                ];
                for (const selector of addressInputs) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 3000 });
                        await this.page.fill(selector, this.walletAddress);
                        break;
                    }
                    catch {
                        continue;
                    }
                }
            }
            // Find request button
            const requestSelectors = [
                'button:has-text("Request Testnet ETH")',
                'button:has-text("Get ETH")',
                'button:has-text("Claim")',
                'button:has-text("Request")',
                '.faucet-button'
            ];
            for (const selector of requestSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    await this.page.click(selector);
                    console.log(chalk_1.default.green('  ✅ LearnWeb3 faucet request submitted'));
                    return {
                        success: true,
                        amount: config.amount,
                        waitTime: 240 // 4 minutes
                    };
                }
                catch {
                    continue;
                }
            }
            throw new Error('Could not find request button');
        }
        catch (error) {
            return {
                success: false,
                error: `LearnWeb3 faucet error: ${error}`
            };
        }
    }
    async automateEthereumToBridging() {
        console.log(chalk_1.default.blue('\n🌉 Attempting to bridge Ethereum Sepolia to Arbitrum Sepolia...'));
        if (!this.page)
            throw new Error('Browser not initialized');
        const bridgeUrl = 'https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia&sourceChain=sepolia';
        try {
            await this.page.goto(bridgeUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);
            console.log(chalk_1.default.yellow('  ⚠️ Bridge automation requires manual wallet connection'));
            console.log(chalk_1.default.cyan('  📋 Bridge URL opened: ' + bridgeUrl));
            console.log(chalk_1.default.cyan('  💡 Manually connect wallet and bridge funds if needed'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Bridge navigation failed: ${error}`));
        }
    }
    async updateEnvironmentFile(balances) {
        console.log(chalk_1.default.blue('\n📝 Updating environment configuration...'));
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        try {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        catch {
            console.log(chalk_1.default.yellow('  ⚠️ .env file not found, creating new one'));
        }
        // Update RPC endpoints
        const updates = [
            'ARB_SEPOLIA_RPC="https://sepolia-rollup.arbitrum.io/rpc"',
            'OPT_SEPOLIA_RPC="https://sepolia.optimism.io"',
            'ETH_SEPOLIA_RPC="https://rpc.sepolia.org"',
            '',
            '# Testnet Configuration',
            `TESTNET_WALLET_ADDRESS="${this.walletAddress}"`,
            `TESTNET_BALANCES_UPDATED="${new Date().toISOString()}"`
        ];
        // Add testnet balance info as comments
        for (const [network, balance] of Object.entries(balances)) {
            updates.push(`# ${network}: ${balance} ETH`);
        }
        // Append updates to env file
        const updatedContent = envContent + '\n\n' + updates.join('\n') + '\n';
        fs.writeFileSync(envPath, updatedContent);
        console.log(chalk_1.default.green('  ✅ Environment file updated with testnet configuration'));
    }
    async generateReport(balances, faucetResults) {
        const report = {
            timestamp: new Date().toISOString(),
            walletAddress: this.walletAddress,
            balances,
            faucetResults,
            recommendations: this.generateRecommendations(balances)
        };
        const reportPath = path.join(process.cwd(), 'testnet-automation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk_1.default.blue('\n📊 TESTNET AUTOMATION REPORT'));
        console.log(chalk_1.default.white('═'.repeat(50)));
        console.log(chalk_1.default.cyan('\n💰 Current Balances:'));
        for (const [network, balance] of Object.entries(balances)) {
            const hasEnough = parseFloat(balance) >= 0.05;
            const status = hasEnough ? '✅' : '❌';
            console.log(chalk_1.default.white(`  ${status} ${network}: ${balance} ETH`));
        }
        console.log(chalk_1.default.cyan('\n🚰 Faucet Results:'));
        faucetResults.forEach((result, i) => {
            const status = result.success ? '✅' : '❌';
            console.log(chalk_1.default.white(`  ${status} Request ${i + 1}: ${result.success ? 'Success' : result.error}`));
        });
        console.log(chalk_1.default.cyan('\n💡 Recommendations:'));
        report.recommendations.forEach(rec => {
            console.log(chalk_1.default.yellow(`  • ${rec}`));
        });
        console.log(chalk_1.default.green(`\n📄 Detailed report saved: ${reportPath}`));
    }
    generateRecommendations(balances) {
        const recommendations = [];
        // Check if we have enough for deployment
        const arbBalance = parseFloat(balances['Arbitrum Sepolia'] || '0');
        if (arbBalance < 0.05) {
            recommendations.push('Get more Arbitrum Sepolia ETH for contract deployment (need 0.05+ ETH)');
        }
        // Check if we need bridging
        const ethBalance = parseFloat(balances['Ethereum Sepolia'] || '0');
        if (ethBalance > 0.1 && arbBalance < 0.05) {
            recommendations.push('Consider bridging Ethereum Sepolia ETH to Arbitrum Sepolia');
        }
        // General recommendations
        if (Object.values(balances).every(b => parseFloat(b) < 0.01)) {
            recommendations.push('All balances are very low - try multiple faucets and wait for confirmation');
        }
        if (recommendations.length === 0) {
            recommendations.push('Balances look good for testnet deployment!');
        }
        return recommendations;
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log(chalk_1.default.green('🔄 Browser automation cleaned up'));
        }
    }
    async runFullAutomation() {
        try {
            await this.initialize();
            // Step 1: Check current balances
            const initialBalances = await this.checkAllBalances();
            // Step 2: Identify networks needing funds (priority-ordered)
            const needsFunding = this.TESTNET_CONFIGS
                .filter(config => {
                const balance = parseFloat(initialBalances[config.name] || '0');
                return balance < parseFloat(config.requiredBalance);
            })
                .sort((a, b) => a.priority - b.priority); // Sort by priority (1 = highest)
            console.log(chalk_1.default.cyan('\n🎯 Smart Faucet Acquisition Strategy'));
            console.log(chalk_1.default.white('═'.repeat(50)));
            // Step 3: Request from faucets using enhanced strategy
            const faucetResults = [];
            if (needsFunding.length > 0) {
                console.log(chalk_1.default.yellow(`\n🚰 ${needsFunding.length} networks need funding (priority order):`));
                needsFunding.forEach((config, i) => {
                    console.log(chalk_1.default.white(`  ${i + 1}. ${config.name} (Priority: ${config.priority}, Need: ${config.requiredBalance} ETH)`));
                });
                // Focus on Arbitrum Sepolia first (highest priority for deployment)
                for (const config of needsFunding) {
                    console.log(chalk_1.default.magenta(`\n${'='.repeat(60)}`));
                    console.log(chalk_1.default.magenta(`🎯 Targeting ${config.name.toUpperCase()} (Priority ${config.priority})`));
                    console.log(chalk_1.default.magenta('='.repeat(60)));
                    const result = await this.requestFromMultipleFaucets(config);
                    faucetResults.push(result);
                    // If we got Arbitrum Sepolia successfully, that's our main goal
                    if (config.name === 'Arbitrum Sepolia' && result.success) {
                        console.log(chalk_1.default.green(`\n🎉 SUCCESS! Got Arbitrum Sepolia ETH - primary goal achieved!`));
                        console.log(chalk_1.default.cyan(`⏭️ Continuing with other networks for completeness...`));
                    }
                    // Shorter wait between network requests (since we're doing parallel requests within each network)
                    if (needsFunding.indexOf(config) < needsFunding.length - 1) {
                        console.log(chalk_1.default.gray('\n  ⏳ Waiting 15 seconds before next network...'));
                        await new Promise(resolve => setTimeout(resolve, 15000));
                    }
                }
                // Step 4: Wait for transactions and recheck balances
                console.log(chalk_1.default.yellow('\n⏳ Waiting 5 minutes for faucet transactions to confirm...'));
                await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
            }
            // Step 5: Final balance check
            const finalBalances = await this.checkAllBalances();
            // Step 6: Update environment and generate report
            await this.updateEnvironmentFile(finalBalances);
            await this.generateReport(finalBalances, faucetResults);
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Automation failed: ${error}`));
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
}
exports.TestnetAutomation = TestnetAutomation;
// CLI execution
async function main() {
    const automation = new TestnetAutomation();
    try {
        await automation.runFullAutomation();
        console.log(chalk_1.default.green('\n🎉 Testnet automation completed successfully!'));
    }
    catch (error) {
        console.log(chalk_1.default.red('\n💥 Automation failed:', error));
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
