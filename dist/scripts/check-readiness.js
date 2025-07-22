"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARBBotValidator = void 0;
const ethers_1 = require("ethers");
const ethers_provider_bundle_1 = require("@flashbots/ethers-provider-bundle");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
dotenv_1.default.config();
class ARBBotValidator {
    results = [];
    startTime = Date.now();
    addResult(category, name, status, message, details, duration) {
        this.results.push({ category, name, status, message, details, duration });
        const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
        const color = status === 'pass' ? chalk_1.default.green : status === 'fail' ? chalk_1.default.red : chalk_1.default.yellow;
        console.log(`${icon} ${color(`[${category}]`)} ${name}: ${message}`);
        if (details) {
            console.log(`   ${chalk_1.default.gray(details)}`);
        }
        if (duration !== undefined) {
            console.log(`   ${chalk_1.default.blue(`Duration: ${duration}ms`)}`);
        }
    }
    // Environment Variable Validation
    async validateEnvironmentVariables() {
        console.log(chalk_1.default.cyan('\n🔍 Validating Environment Variables...\n'));
        const requiredVars = [
            { name: 'PRIVATE_KEY', pattern: /^0x[a-fA-F0-9]{64}$/, description: 'Private key (64 hex chars with 0x prefix)' },
            { name: 'FLASHBOTS_AUTH_KEY', pattern: /^0x[a-fA-F0-9]{64}$/, description: 'Flashbots auth key (64 hex chars with 0x prefix)' },
            { name: 'ARB_RPC', pattern: /^https?:\/\/.+/, description: 'Arbitrum RPC URL' },
            { name: 'OPT_RPC', pattern: /^https?:\/\/.+/, description: 'Optimism RPC URL' },
            { name: 'MAINNET_RPC', pattern: /^https?:\/\/.+/, description: 'Mainnet RPC URL' },
            { name: 'FORK_BLOCK', pattern: /^\d+$/, description: 'Fork block number' },
            { name: 'BOT_CONTRACT_ADDRESS', pattern: /^0x[a-fA-F0-9]{40}$/, description: 'Bot contract address' },
            { name: 'BALANCER_VAULT_ADDRESS', pattern: /^0x[a-fA-F0-9]{40}$/, description: 'Balancer vault address' }
        ];
        const optionalVars = [
            { name: 'OPT_BOT_CONTRACT_ADDRESS', pattern: /^0x[a-fA-F0-9]{40}$/, description: 'Optimism bot contract address' },
            { name: 'ARBISCAN_API_KEY', pattern: /.+/, description: 'Arbiscan API key' },
            { name: 'OPTIMISTIC_ETHERSCAN_API_KEY', pattern: /.+/, description: 'Optimistic Etherscan API key' }
        ];
        // Validate required variables
        for (const variable of requiredVars) {
            const value = process.env[variable.name];
            if (!value) {
                this.addResult('Environment', variable.name, 'fail', 'Missing required variable', variable.description);
                continue;
            }
            if (!variable.pattern.test(value)) {
                this.addResult('Environment', variable.name, 'fail', 'Invalid format', `Expected: ${variable.description}, Got: ${value.substring(0, 20)}...`);
                continue;
            }
            this.addResult('Environment', variable.name, 'pass', 'Valid format');
        }
        // Validate optional variables
        for (const variable of optionalVars) {
            const value = process.env[variable.name];
            if (!value) {
                this.addResult('Environment', variable.name, 'warning', 'Optional variable not set', variable.description);
                continue;
            }
            if (!variable.pattern.test(value)) {
                this.addResult('Environment', variable.name, 'warning', 'Invalid format', variable.description);
                continue;
            }
            this.addResult('Environment', variable.name, 'pass', 'Valid format');
        }
        // Validate feature flags
        const featureFlags = ['ENABLE_TRIANGULAR_ARBITRAGE', 'ENABLE_CROSS_CHAIN_MONITORING', 'ENABLE_SIMULATION_MODE'];
        for (const flag of featureFlags) {
            const value = process.env[flag];
            if (value && !['true', 'false'].includes(value)) {
                this.addResult('Environment', flag, 'warning', 'Invalid boolean value', 'Should be "true" or "false"');
            }
            else {
                this.addResult('Environment', flag, 'pass', `Set to: ${value || 'undefined'}`);
            }
        }
    }
    // Network Connectivity Validation
    async validateNetworkConnectivity() {
        console.log(chalk_1.default.cyan('\n🌐 Validating Network Connectivity...\n'));
        const networks = [
            { name: 'Arbitrum', rpc: process.env.ARB_RPC, expectedChainId: 42161 },
            { name: 'Optimism', rpc: process.env.OPT_RPC, expectedChainId: 10 },
            { name: 'Mainnet', rpc: process.env.MAINNET_RPC, expectedChainId: 1 }
        ];
        for (const network of networks) {
            if (!network.rpc) {
                this.addResult('Network', `${network.name} RPC`, 'fail', 'RPC URL not configured');
                continue;
            }
            try {
                const startTime = Date.now();
                const provider = new ethers_1.JsonRpcProvider(network.rpc);
                // Test connection with timeout
                const blockNumber = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]);
                const duration = Date.now() - startTime;
                // Verify chain ID
                const chainId = await provider.getNetwork();
                if (Number(chainId.chainId) !== network.expectedChainId) {
                    this.addResult('Network', `${network.name} Chain ID`, 'fail', `Wrong chain ID: expected ${network.expectedChainId}, got ${chainId.chainId}`, undefined, duration);
                    continue;
                }
                // Check if block is recent (within last 1000 blocks for mainnet, 10000 for L2s)
                const maxBlockAge = network.name === 'Mainnet' ? 1000 : 10000;
                const latestBlock = await provider.getBlock('latest');
                const blockAge = blockNumber - (latestBlock?.number || 0);
                if (Math.abs(blockAge) > maxBlockAge) {
                    this.addResult('Network', `${network.name} Block Height`, 'warning', `Block might be stale: ${blockNumber}`, `Age: ${blockAge} blocks`, duration);
                }
                else {
                    this.addResult('Network', `${network.name} Block Height`, 'pass', `Current block: ${blockNumber}`, `Chain ID: ${chainId.chainId}`, duration);
                }
                // Performance check
                if (duration > 5000) {
                    this.addResult('Network', `${network.name} Performance`, 'warning', 'Slow response time', `${duration}ms (>5s)`);
                }
                else if (duration > 2000) {
                    this.addResult('Network', `${network.name} Performance`, 'warning', 'Moderate response time', `${duration}ms`);
                }
                else {
                    this.addResult('Network', `${network.name} Performance`, 'pass', 'Good response time', `${duration}ms`);
                }
            }
            catch (error) {
                this.addResult('Network', `${network.name} RPC`, 'fail', 'Connection failed', error instanceof Error ? error.message : String(error));
            }
        }
    }
    // Wallet Validation
    async validateWalletConfiguration() {
        console.log(chalk_1.default.cyan('\n👛 Validating Wallet Configuration...\n'));
        try {
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                this.addResult('Wallet', 'Private Key', 'fail', 'Private key not configured');
                return;
            }
            // Test wallet derivation
            const wallet = new ethers_1.ethers.Wallet(privateKey);
            this.addResult('Wallet', 'Key Derivation', 'pass', 'Wallet created successfully', `Address: ${wallet.address}`);
            // Test balance checks on all networks
            const networks = [
                { name: 'Arbitrum', rpc: process.env.ARB_RPC },
                { name: 'Optimism', rpc: process.env.OPT_RPC },
                { name: 'Mainnet', rpc: process.env.MAINNET_RPC }
            ];
            for (const network of networks) {
                if (!network.rpc)
                    continue;
                try {
                    const provider = new ethers_1.JsonRpcProvider(network.rpc);
                    const connectedWallet = wallet.connect(provider);
                    const balance = await connectedWallet.provider.getBalance(wallet.address);
                    const balanceEth = (0, ethers_1.formatEther)(balance);
                    const status = parseFloat(balanceEth) > 0.001 ? 'pass' : 'warning';
                    const message = parseFloat(balanceEth) > 0.001 ? 'Sufficient balance' : 'Low balance';
                    this.addResult('Wallet', `${network.name} Balance`, status, message, `${balanceEth} ETH`);
                }
                catch (error) {
                    this.addResult('Wallet', `${network.name} Balance`, 'fail', 'Balance check failed', error instanceof Error ? error.message : String(error));
                }
            }
            // Test Flashbots authentication
            try {
                const flashbotsAuthKey = process.env.FLASHBOTS_AUTH_KEY;
                if (!flashbotsAuthKey) {
                    this.addResult('Wallet', 'Flashbots Auth', 'fail', 'Flashbots auth key not configured');
                    return;
                }
                const authWallet = new ethers_1.ethers.Wallet(flashbotsAuthKey);
                this.addResult('Wallet', 'Flashbots Auth Derivation', 'pass', 'Auth wallet created', `Address: ${authWallet.address}`);
                // Test Flashbots provider creation (without actually connecting)
                const arbProvider = new ethers_1.JsonRpcProvider(process.env.ARB_RPC);
                const flashbotsProvider = await ethers_provider_bundle_1.FlashbotsBundleProvider.create(arbProvider, authWallet, process.env.FLASHBOTS_RELAY_URL || "https://relay.flashbots.net", "arbitrum");
                this.addResult('Wallet', 'Flashbots Provider', 'pass', 'Provider created successfully');
            }
            catch (error) {
                this.addResult('Wallet', 'Flashbots Setup', 'fail', 'Flashbots setup failed', error instanceof Error ? error.message : String(error));
            }
        }
        catch (error) {
            this.addResult('Wallet', 'Configuration', 'fail', 'Wallet validation failed', error instanceof Error ? error.message : String(error));
        }
    }
    // Contract Verification
    async validateContractDeployments() {
        console.log(chalk_1.default.cyan('\n📄 Validating Contract Deployments...\n'));
        const contracts = [
            { name: 'Arbitrum Bot Contract', address: process.env.BOT_CONTRACT_ADDRESS, network: 'ARB_RPC' },
            { name: 'Optimism Bot Contract', address: process.env.OPT_BOT_CONTRACT_ADDRESS, network: 'OPT_RPC', optional: true },
            { name: 'Balancer Vault', address: process.env.BALANCER_VAULT_ADDRESS, network: 'ARB_RPC' },
            { name: 'Arbitrum WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', network: 'ARB_RPC' },
            { name: 'Arbitrum USDC', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', network: 'ARB_RPC' },
            { name: 'Uniswap V2 Router (ARB)', address: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24', network: 'ARB_RPC' },
            { name: 'SushiSwap Router (ARB)', address: '0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55', network: 'ARB_RPC' }
        ];
        for (const contract of contracts) {
            if (!contract.address) {
                const status = contract.optional ? 'warning' : 'fail';
                this.addResult('Contracts', contract.name, status, 'Address not configured');
                continue;
            }
            const rpcUrl = process.env[contract.network];
            if (!rpcUrl) {
                this.addResult('Contracts', contract.name, 'fail', `RPC not configured: ${contract.network}`);
                continue;
            }
            try {
                const provider = new ethers_1.JsonRpcProvider(rpcUrl);
                const code = await provider.getCode(contract.address);
                if (code === '0x' || code === '0x0') {
                    this.addResult('Contracts', contract.name, 'fail', 'No code at address', `Address: ${contract.address}`);
                }
                else {
                    this.addResult('Contracts', contract.name, 'pass', 'Contract deployed', `Address: ${contract.address}, Code size: ${code.length} chars`);
                }
            }
            catch (error) {
                this.addResult('Contracts', contract.name, 'fail', 'Code check failed', error instanceof Error ? error.message : String(error));
            }
        }
    }
    // Test Mode Validation
    async validateTestModeReadiness() {
        console.log(chalk_1.default.cyan('\n🧪 Validating Test Mode Readiness...\n'));
        // Check if test files exist
        const testFiles = [
            'test/arb-simulation.test.ts',
            'scripts/simulate-flashbots.ts',
            'scripts/run-bot.ts'
        ];
        for (const file of testFiles) {
            if (fs_1.default.existsSync(file)) {
                this.addResult('Test Files', path_1.default.basename(file), 'pass', 'File exists');
            }
            else {
                this.addResult('Test Files', path_1.default.basename(file), 'fail', 'File missing');
            }
        }
        // Test CLI flags
        try {
            const helpOutput = (0, child_process_1.execSync)('timeout 10s ts-node scripts/run-bot.ts --help 2>&1 || true', {
                encoding: 'utf8',
                cwd: process.cwd()
            });
            if (helpOutput.includes('Enhanced MEV Arbitrage Bot')) {
                this.addResult('CLI', 'Help Flag', 'pass', 'Help command works');
            }
            else {
                this.addResult('CLI', 'Help Flag', 'warning', 'Help output unexpected', helpOutput.substring(0, 100));
            }
        }
        catch (error) {
            this.addResult('CLI', 'Help Flag', 'fail', 'Help command failed', error instanceof Error ? error.message : String(error));
        }
        // Test simulation mode (quick check)
        try {
            const simulateOutput = (0, child_process_1.execSync)('timeout 5s ts-node scripts/run-bot.ts --simulate 2>&1 | head -10 || true', {
                encoding: 'utf8',
                cwd: process.cwd()
            });
            if (simulateOutput.includes('SIMULATION MODE') || simulateOutput.includes('Configuration initialized')) {
                this.addResult('CLI', 'Simulate Flag', 'pass', 'Simulation mode starts correctly');
            }
            else {
                this.addResult('CLI', 'Simulate Flag', 'warning', 'Simulation output unexpected', simulateOutput.substring(0, 100));
            }
        }
        catch (error) {
            this.addResult('CLI', 'Simulate Flag', 'fail', 'Simulation mode failed', error instanceof Error ? error.message : String(error));
        }
        // Test TypeScript compilation
        try {
            (0, child_process_1.execSync)('npx tsc --noEmit --skipLibCheck', { encoding: 'utf8', stdio: 'pipe' });
            this.addResult('Compilation', 'TypeScript Check', 'pass', 'No TypeScript errors');
        }
        catch (error) {
            this.addResult('Compilation', 'TypeScript Check', 'warning', 'TypeScript issues detected', error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200));
        }
        // Test Hardhat compilation
        try {
            (0, child_process_1.execSync)('npx hardhat compile --quiet', { encoding: 'utf8', stdio: 'pipe' });
            this.addResult('Compilation', 'Hardhat Compile', 'pass', 'Contracts compile successfully');
        }
        catch (error) {
            this.addResult('Compilation', 'Hardhat Compile', 'fail', 'Contract compilation failed', error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200));
        }
    }
    // Performance and Security Checks
    async validatePerformanceAndSecurity() {
        console.log(chalk_1.default.cyan('\n⚡ Validating Performance & Security...\n'));
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
        if (majorVersion >= 18) {
            this.addResult('Performance', 'Node.js Version', 'pass', `Compatible version: ${nodeVersion}`);
        }
        else {
            this.addResult('Performance', 'Node.js Version', 'warning', `Old version: ${nodeVersion}`, 'Recommend Node.js 18+');
        }
        // Check package.json for security
        try {
            const packageJson = JSON.parse(fs_1.default.readFileSync('package.json', 'utf8'));
            const devDeps = Object.keys(packageJson.devDependencies || {});
            const deps = Object.keys(packageJson.dependencies || {});
            this.addResult('Security', 'Dependencies', 'pass', `${deps.length} dependencies, ${devDeps.length} dev dependencies`);
            // Check for audit
            try {
                (0, child_process_1.execSync)('npm audit --audit-level=high --quiet', { stdio: 'pipe' });
                this.addResult('Security', 'NPM Audit', 'pass', 'No high-severity vulnerabilities');
            }
            catch (error) {
                this.addResult('Security', 'NPM Audit', 'warning', 'Security issues detected', 'Run: npm audit fix');
            }
        }
        catch (error) {
            this.addResult('Security', 'Package Analysis', 'fail', 'Package.json analysis failed');
        }
        // Check .env security
        if (fs_1.default.existsSync('.env')) {
            const envContent = fs_1.default.readFileSync('.env', 'utf8');
            // Check for example values
            if (envContent.includes('1234567890abcdef') || envContent.includes('YOUR_')) {
                this.addResult('Security', 'Environment Security', 'fail', 'Example values detected in .env', 'Replace all placeholder values');
            }
            else {
                this.addResult('Security', 'Environment Security', 'pass', 'No obvious placeholder values');
            }
            // Check file permissions (Unix systems)
            try {
                const stats = fs_1.default.statSync('.env');
                const mode = stats.mode.toString(8);
                if (mode.endsWith('600') || mode.endsWith('644')) {
                    this.addResult('Security', 'File Permissions', 'pass', `Secure permissions: ${mode}`);
                }
                else {
                    this.addResult('Security', 'File Permissions', 'warning', `Permissions: ${mode}`, 'Consider: chmod 600 .env');
                }
            }
            catch (error) {
                this.addResult('Security', 'File Permissions', 'warning', 'Cannot check permissions');
            }
        }
        else {
            this.addResult('Security', 'Environment File', 'fail', '.env file not found');
        }
    }
    // Generate comprehensive summary
    generateSummary() {
        const passed = this.results.filter(r => r.status === 'pass').length;
        const failed = this.results.filter(r => r.status === 'fail').length;
        const warnings = this.results.filter(r => r.status === 'warning').length;
        let overallStatus = 'pass';
        if (failed > 0) {
            overallStatus = 'fail';
        }
        else if (warnings > 0) {
            overallStatus = 'warning';
        }
        return {
            results: this.results,
            totalChecks: this.results.length,
            passed,
            failed,
            warnings,
            overallStatus
        };
    }
    // Print final summary
    printSummary(summary) {
        const totalTime = Date.now() - this.startTime;
        console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
        console.log(chalk_1.default.cyan('                    VALIDATION SUMMARY'));
        console.log(chalk_1.default.cyan('='.repeat(60)));
        console.log(`\n📊 ${chalk_1.default.white('Total Checks:')} ${summary.totalChecks}`);
        console.log(`✅ ${chalk_1.default.green('Passed:')} ${summary.passed}`);
        console.log(`❌ ${chalk_1.default.red('Failed:')} ${summary.failed}`);
        console.log(`⚠️  ${chalk_1.default.yellow('Warnings:')} ${summary.warnings}`);
        console.log(`⏱️  ${chalk_1.default.blue('Total Time:')} ${totalTime}ms`);
        console.log(`\n🎯 ${chalk_1.default.white('Overall Status:')} ${summary.overallStatus === 'pass' ? chalk_1.default.green('✅ READY') :
            summary.overallStatus === 'warning' ? chalk_1.default.yellow('⚠️ READY WITH WARNINGS') :
                chalk_1.default.red('❌ NOT READY')}`);
        if (summary.failed > 0) {
            console.log(chalk_1.default.red('\n🚨 Critical Issues Found:'));
            summary.results
                .filter(r => r.status === 'fail')
                .forEach(r => console.log(`   • ${r.category}/${r.name}: ${r.message}`));
        }
        if (summary.warnings > 0) {
            console.log(chalk_1.default.yellow('\n⚠️ Warnings:'));
            summary.results
                .filter(r => r.status === 'warning')
                .forEach(r => console.log(`   • ${r.category}/${r.name}: ${r.message}`));
        }
        console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
        if (summary.overallStatus === 'pass') {
            console.log(chalk_1.default.green('🚀 ARBBot2025 is ready for testing and deployment!'));
        }
        else if (summary.overallStatus === 'warning') {
            console.log(chalk_1.default.yellow('⚠️ ARBBot2025 has warnings but may be usable. Review issues above.'));
        }
        else {
            console.log(chalk_1.default.red('❌ ARBBot2025 is not ready. Fix critical issues before proceeding.'));
        }
    }
    // Main validation runner
    async runValidation() {
        console.log(chalk_1.default.magenta(`
╔══════════════════════════════════════════════════════════════╗
║                   🤖 ARBBot2025 Validator                    ║
║              Senior DeFi Engineer Validation Suite          ║
╚══════════════════════════════════════════════════════════════╝
    `));
        await this.validateEnvironmentVariables();
        await this.validateNetworkConnectivity();
        await this.validateWalletConfiguration();
        await this.validateContractDeployments();
        await this.validateTestModeReadiness();
        await this.validatePerformanceAndSecurity();
        const summary = this.generateSummary();
        this.printSummary(summary);
        return summary;
    }
}
exports.ARBBotValidator = ARBBotValidator;
// Main execution
async function main() {
    const validator = new ARBBotValidator();
    try {
        const summary = await validator.runValidation();
        // Exit with appropriate code
        if (summary.overallStatus === 'fail') {
            process.exit(1);
        }
        else if (summary.overallStatus === 'warning') {
            process.exit(2);
        }
        else {
            process.exit(0);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Validation failed with error:'), error);
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
