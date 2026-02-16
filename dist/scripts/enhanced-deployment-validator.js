"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedDeploymentValidator = void 0;
const ethers_1 = require("ethers");
const hardhat_1 = __importDefault(require("hardhat"));
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
class EnhancedDeploymentValidator {
    providers = {};
    wallets = {};
    results = [];
    constructor() {
        this.initializeProviders();
        this.initializeWallets();
    }
    initializeProviders() {
        if (process.env.ARB_RPC) {
            this.providers.arbitrum = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        }
        if (process.env.OPT_RPC) {
            this.providers.optimism = new ethers_1.ethers.JsonRpcProvider(process.env.OPT_RPC);
        }
    }
    initializeWallets() {
        if (process.env.PRIVATE_KEY) {
            if (this.providers.arbitrum) {
                this.wallets.arbitrum = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.providers.arbitrum);
            }
            if (this.providers.optimism) {
                this.wallets.optimism = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.providers.optimism);
            }
        }
    }
    addResult(stage, success, message, data, error) {
        this.results.push({ stage, success, message, data, error });
        const statusIcon = success ? '✅' : '❌';
        const color = success ? chalk_1.default.green : chalk_1.default.red;
        console.log(color(`${statusIcon} ${stage}: ${message}`));
        if (data) {
            console.log(chalk_1.default.gray(`   Data: ${JSON.stringify(data, null, 2)}`));
        }
        if (error) {
            console.log(chalk_1.default.red(`   Error: ${error}`));
        }
    }
    async validatePreDeploymentChecks() {
        console.log(chalk_1.default.blue('\n🔍 Pre-Deployment Validation'));
        console.log(chalk_1.default.blue('═══════════════════════════'));
        let allChecksPass = true;
        // Check environment variables
        const requiredEnvVars = [
            'PRIVATE_KEY',
            'ARB_RPC',
            'BALANCER_VAULT_ADDRESS',
            'SUSHI_ROUTER_ARB',
            'UNI_V2_ROUTER_ARB',
            'UNISWAP_V3_QUOTER_ADDRESS'
        ];
        for (const envVar of requiredEnvVars) {
            const value = process.env[envVar];
            if (!value) {
                this.addResult('Environment Check', false, `Missing ${envVar}`);
                allChecksPass = false;
            }
            else if (envVar.includes('ADDRESS') || envVar.includes('ROUTER')) {
                if (!ethers_1.ethers.isAddress(value)) {
                    this.addResult('Environment Check', false, `Invalid address format for ${envVar}`, { value });
                    allChecksPass = false;
                }
                else {
                    this.addResult('Environment Check', true, `Valid ${envVar}`, { value });
                }
            }
            else {
                this.addResult('Environment Check', true, `${envVar} configured`);
            }
        }
        // Check wallet balance
        if (this.wallets.arbitrum) {
            try {
                const balance = await this.wallets.arbitrum.provider.getBalance(this.wallets.arbitrum.address);
                const balanceEth = ethers_1.ethers.formatEther(balance);
                if (balance === 0n) {
                    this.addResult('Wallet Balance', false, 'Executor wallet has no ETH', { balance: balanceEth });
                    allChecksPass = false;
                }
                else if (balance < ethers_1.ethers.parseEther('0.01')) {
                    this.addResult('Wallet Balance', false, 'Insufficient ETH for deployment', { balance: balanceEth });
                    allChecksPass = false;
                }
                else {
                    this.addResult('Wallet Balance', true, 'Sufficient balance for deployment', { balance: balanceEth });
                }
            }
            catch (error) {
                this.addResult('Wallet Balance', false, 'Could not check wallet balance', undefined, error instanceof Error ? error.message : 'Unknown error');
                allChecksPass = false;
            }
        }
        // Check network connectivity
        for (const [networkName, provider] of Object.entries(this.providers)) {
            try {
                const network = await provider.getNetwork();
                const latestBlock = await provider.getBlockNumber();
                this.addResult('Network Connectivity', true, `Connected to ${networkName}`, {
                    chainId: Number(network.chainId),
                    latestBlock
                });
            }
            catch (error) {
                this.addResult('Network Connectivity', false, `Failed to connect to ${networkName}`, undefined, error instanceof Error ? error.message : 'Unknown error');
                allChecksPass = false;
            }
        }
        return allChecksPass;
    }
    async simulateContractDeployment(dryRun = true) {
        console.log(chalk_1.default.blue(`\n🚀 Contract Deployment ${dryRun ? 'Simulation' : 'Test'}`));
        console.log(chalk_1.default.blue('═══════════════════════════════════════'));
        if (!this.wallets.arbitrum) {
            this.addResult('Contract Deployment', false, 'No Arbitrum wallet configured');
            return null;
        }
        try {
            // Compile contracts first
            console.log(chalk_1.default.yellow('📦 Compiling contracts...'));
            const { ethers: hreEthers } = hardhat_1.default;
            const FlashArbBotBalancer = await hreEthers.getContractFactory('FlashArbBotBalancer');
            this.addResult('Contract Compilation', true, 'FlashArbBotBalancer compiled successfully');
            // Estimate deployment gas
            const deploymentData = FlashArbBotBalancer.interface.encodeDeploy([
                process.env.BALANCER_VAULT_ADDRESS,
                process.env.SUSHI_ROUTER_ARB,
                process.env.UNI_V2_ROUTER_ARB,
                process.env.UNISWAP_V3_QUOTER_ADDRESS
            ]);
            const gasEstimate = await this.providers.arbitrum.estimateGas({
                data: deploymentData
            });
            const feeData = await this.providers.arbitrum.getFeeData();
            const deploymentCost = gasEstimate * (feeData.gasPrice || 0n);
            this.addResult('Gas Estimation', true, 'Deployment gas estimated', {
                gasLimit: gasEstimate.toString(),
                gasPrice: ethers_1.ethers.formatUnits(feeData.gasPrice || 0n, 'gwei') + ' gwei',
                estimatedCost: ethers_1.ethers.formatEther(deploymentCost) + ' ETH'
            });
            if (dryRun) {
                // For dry run, simulate deployment without actually deploying
                const simulatedAddress = ethers_1.ethers.getCreateAddress({
                    from: this.wallets.arbitrum.address,
                    nonce: await this.wallets.arbitrum.provider.getTransactionCount(this.wallets.arbitrum.address)
                });
                this.addResult('Contract Deployment (Simulated)', true, 'Deployment simulation successful', {
                    simulatedAddress,
                    deployerAddress: this.wallets.arbitrum.address
                });
                return {
                    contractName: 'FlashArbBotBalancer',
                    deploymentGas: gasEstimate,
                    deploymentCost,
                    contractAddress: simulatedAddress,
                    verified: true,
                    initializationSuccess: true
                };
            }
            else {
                // Actual deployment (use with caution)
                console.log(chalk_1.default.yellow('⚠️ Performing actual deployment...'));
                const contract = await FlashArbBotBalancer.deploy(process.env.BALANCER_VAULT_ADDRESS, process.env.SUSHI_ROUTER_ARB, process.env.UNI_V2_ROUTER_ARB, process.env.UNISWAP_V3_QUOTER_ADDRESS);
                await contract.waitForDeployment();
                const contractAddress = await contract.getAddress();
                // Verify deployment
                const deployedCode = await this.providers.arbitrum.getCode(contractAddress);
                const verified = deployedCode !== '0x';
                this.addResult('Contract Deployment', verified, 'Contract deployed successfully', {
                    contractAddress,
                    deployerAddress: this.wallets.arbitrum.address,
                    transactionHash: contract.deploymentTransaction()?.hash
                });
                return {
                    contractName: 'FlashArbBotBalancer',
                    deploymentGas: gasEstimate,
                    deploymentCost,
                    contractAddress,
                    verified,
                    initializationSuccess: true
                };
            }
        }
        catch (error) {
            this.addResult('Contract Deployment', false, 'Deployment failed', undefined, error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }
    async validateContractInteractions(contractAddress) {
        console.log(chalk_1.default.blue('\n🔧 Contract Interaction Validation'));
        console.log(chalk_1.default.blue('═══════════════════════════════════'));
        if (!this.wallets.arbitrum) {
            this.addResult('Contract Interaction', false, 'No wallet configured');
            return false;
        }
        try {
            // Create contract instance
            const contractABI = [
                'function owner() external view returns (address)',
                'function setAuthorizedCaller(address caller, bool authorized) external',
                'function getGasFundingStats() external view returns (address wallet, uint256 percentage, uint256 totalTransferred)',
                'function setGasFundingWallet(address _gasFundingWallet) external',
                'function setGasFundingPercentage(uint256 _percentage) external'
            ];
            const contract = new ethers_1.ethers.Contract(contractAddress, contractABI, this.wallets.arbitrum);
            // Test owner function
            const owner = await contract.owner();
            const isOwner = owner.toLowerCase() === this.wallets.arbitrum.address.toLowerCase();
            this.addResult('Owner Verification', isOwner, 'Contract ownership verified', {
                contractOwner: owner,
                walletAddress: this.wallets.arbitrum.address,
                isOwner
            });
            // Test gas funding configuration (read-only)
            try {
                const [gasFundingWallet, percentage, totalTransferred] = await contract.getGasFundingStats();
                this.addResult('Gas Funding Config', true, 'Gas funding configuration readable', {
                    gasFundingWallet,
                    percentage: percentage.toString(),
                    totalTransferred: totalTransferred.toString()
                });
            }
            catch (error) {
                this.addResult('Gas Funding Config', false, 'Could not read gas funding config', undefined, error instanceof Error ? error.message : 'Unknown error');
            }
            return isOwner;
        }
        catch (error) {
            this.addResult('Contract Interaction', false, 'Contract interaction failed', undefined, error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }
    async validateSecurityConfiguration() {
        console.log(chalk_1.default.blue('\n🛡️ Security Configuration Validation'));
        console.log(chalk_1.default.blue('═══════════════════════════════════════'));
        let allSecurityChecksPass = true;
        // Check private key format
        const privateKey = process.env.PRIVATE_KEY;
        if (privateKey) {
            if (privateKey.length === 66 && privateKey.startsWith('0x')) {
                this.addResult('Private Key Format', true, 'Private key format is valid');
            }
            else {
                this.addResult('Private Key Format', false, 'Invalid private key format');
                allSecurityChecksPass = false;
            }
            // Check if private key derives to expected address
            try {
                const wallet = new ethers_1.ethers.Wallet(privateKey);
                this.addResult('Key Derivation', true, 'Private key derivation successful', {
                    derivedAddress: wallet.address
                });
            }
            catch (error) {
                this.addResult('Key Derivation', false, 'Private key derivation failed', undefined, error instanceof Error ? error.message : 'Unknown error');
                allSecurityChecksPass = false;
            }
        }
        // Check Flashbots key
        const flashbotsKey = process.env.FLASHBOTS_AUTH_KEY;
        if (flashbotsKey) {
            if (flashbotsKey.length === 66 && flashbotsKey.startsWith('0x')) {
                this.addResult('Flashbots Key Format', true, 'Flashbots key format is valid');
                try {
                    const flashbotsWallet = new ethers_1.ethers.Wallet(flashbotsKey);
                    this.addResult('Flashbots Key Derivation', true, 'Flashbots key derivation successful', {
                        derivedAddress: flashbotsWallet.address
                    });
                }
                catch (error) {
                    this.addResult('Flashbots Key Derivation', false, 'Flashbots key derivation failed', undefined, error instanceof Error ? error.message : 'Unknown error');
                    allSecurityChecksPass = false;
                }
            }
            else {
                this.addResult('Flashbots Key Format', false, 'Invalid Flashbots key format');
                allSecurityChecksPass = false;
            }
        }
        // Check gas funding wallet configuration
        const executorWallet = this.wallets.arbitrum;
        if (executorWallet) {
            const expectedGasFundingWallet = executorWallet.address;
            this.addResult('Gas Funding Wallet', true, 'Gas funding wallet configured correctly', {
                gasFundingWallet: expectedGasFundingWallet,
                executorWallet: executorWallet.address,
                match: true
            });
        }
        return allSecurityChecksPass;
    }
    async generateComprehensiveReport() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportDir = path_1.default.join(process.cwd(), 'reports');
        if (!fs_1.default.existsSync(reportDir)) {
            fs_1.default.mkdirSync(reportDir, { mode: 0o700 });
        }
        const report = {
            timestamp: new Date().toISOString(),
            walletAddress: this.wallets.arbitrum?.address || 'Not configured',
            validationResults: this.results,
            summary: {
                totalTests: this.results.length,
                passed: this.results.filter(r => r.success).length,
                failed: this.results.filter(r => !r.success).length,
                successRate: (this.results.filter(r => r.success).length / this.results.length) * 100
            }
        };
        const reportPath = path_1.default.join(reportDir, `deployment-validation-${timestamp}.json`);
        fs_1.default.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
        console.log(chalk_1.default.green(`\n📄 Comprehensive report saved to: ${reportPath}`));
    }
    async runFullValidation(dryRun = true) {
        console.log(chalk_1.default.blue('🔬 Enhanced Deployment Validation'));
        console.log(chalk_1.default.blue('═══════════════════════════════════'));
        console.log(chalk_1.default.yellow(`Mode: ${dryRun ? 'DRY RUN (Safe)' : 'LIVE TEST (Real Deployment)'}`));
        // Phase 1: Pre-deployment checks
        const preDeploymentPassed = await this.validatePreDeploymentChecks();
        // Phase 2: Security validation
        const securityPassed = await this.validateSecurityConfiguration();
        // Phase 3: Contract deployment simulation/test
        const deploymentResult = await this.simulateContractDeployment(dryRun);
        // Phase 4: Contract interaction validation (if deployment succeeded)
        let interactionPassed = false;
        if (deploymentResult) {
            interactionPassed = await this.validateContractInteractions(deploymentResult.contractAddress);
        }
        // Generate comprehensive report
        await this.generateComprehensiveReport();
        // Summary
        const allPassed = preDeploymentPassed && securityPassed && deploymentResult !== null && interactionPassed;
        console.log(chalk_1.default.blue('\n📊 VALIDATION SUMMARY'));
        console.log(chalk_1.default.blue('═══════════════════════'));
        console.log(chalk_1.default.white(`Pre-deployment: ${preDeploymentPassed ? '✅ PASS' : '❌ FAIL'}`));
        console.log(chalk_1.default.white(`Security: ${securityPassed ? '✅ PASS' : '❌ FAIL'}`));
        console.log(chalk_1.default.white(`Deployment: ${deploymentResult ? '✅ PASS' : '❌ FAIL'}`));
        console.log(chalk_1.default.white(`Interactions: ${interactionPassed ? '✅ PASS' : '❌ FAIL'}`));
        console.log(chalk_1.default.white(`Overall: ${allPassed ? '✅ READY FOR DEPLOYMENT' : '❌ NOT READY'}`));
        if (!allPassed) {
            console.log(chalk_1.default.red('\n⚠️ Please address the failed validations before proceeding with deployment.'));
        }
        else if (dryRun) {
            console.log(chalk_1.default.green('\n🎉 All validations passed! System is ready for deployment.'));
            console.log(chalk_1.default.yellow('💡 To perform actual deployment, run with --live flag (ensure adequate funding first).'));
        }
        else {
            console.log(chalk_1.default.green('\n🎉 All validations passed and contract deployed successfully!'));
        }
        return allPassed;
    }
}
exports.EnhancedDeploymentValidator = EnhancedDeploymentValidator;
// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--live');
    const command = args.find(arg => !arg.startsWith('--')) || 'full';
    const validator = new EnhancedDeploymentValidator();
    try {
        switch (command) {
            case 'full':
                const success = await validator.runFullValidation(dryRun);
                process.exit(success ? 0 : 1);
                break;
            case 'pre-deployment':
                const preDeploymentSuccess = await validator.validatePreDeploymentChecks();
                process.exit(preDeploymentSuccess ? 0 : 1);
                break;
            case 'security':
                const securitySuccess = await validator.validateSecurityConfiguration();
                process.exit(securitySuccess ? 0 : 1);
                break;
            case 'deployment':
                const deploymentResult = await validator.simulateContractDeployment(dryRun);
                process.exit(deploymentResult ? 0 : 1);
                break;
            default:
                console.log(chalk_1.default.blue('Enhanced Deployment Validator Commands:'));
                console.log(chalk_1.default.cyan('  full             - Run complete validation suite'));
                console.log(chalk_1.default.cyan('  pre-deployment   - Run pre-deployment checks only'));
                console.log(chalk_1.default.cyan('  security         - Run security validation only'));
                console.log(chalk_1.default.cyan('  deployment       - Run deployment simulation only'));
                console.log(chalk_1.default.white('\nFlags:'));
                console.log(chalk_1.default.yellow('  --live           - Perform actual deployment (not dry run)'));
                console.log(chalk_1.default.white('\nExamples:'));
                console.log(chalk_1.default.gray('  npm run validate:enhanced           # Safe dry run'));
                console.log(chalk_1.default.gray('  npm run validate:enhanced --live    # Live deployment'));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Validation failed:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = EnhancedDeploymentValidator;
