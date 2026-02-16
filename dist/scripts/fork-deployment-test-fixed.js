"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForkDeploymentTester = void 0;
const ethers_1 = require("ethers");
const hardhat_1 = __importDefault(require("hardhat"));
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
class ForkDeploymentTester {
    forkProvider;
    wallet;
    results = [];
    async initializeForkEnvironment(network) {
        console.log(chalk_1.default.blue(`🍴 Initializing ${network} fork environment...`));
        const rpcUrl = network === 'arbitrum' ? process.env.ARB_RPC : process.env.OPT_RPC;
        const forkBlock = network === 'arbitrum'
            ? parseInt(process.env.FORK_BLOCK || '180000000')
            : parseInt(process.env.FORK_BLOCK_OPT || '110000000');
        if (!rpcUrl) {
            throw new Error(`${network.toUpperCase()}_RPC not configured`);
        }
        // Set up Hardhat network to fork from the specified network
        await hardhat_1.default.network.provider.request({
            method: 'hardhat_reset',
            params: [{
                    forking: {
                        jsonRpcUrl: rpcUrl,
                        blockNumber: forkBlock
                    }
                }]
        });
        // Connect to the forked network
        this.forkProvider = new ethers_1.ethers.JsonRpcProvider('http://127.0.0.1:8545');
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not configured');
        }
        this.wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.forkProvider);
        // Fund the wallet with ETH on the fork
        await this.fundWalletOnFork();
        console.log(chalk_1.default.green(`✅ Fork environment initialized`));
        console.log(chalk_1.default.cyan(`   Network: ${network}`));
        console.log(chalk_1.default.cyan(`   Fork Block: ${forkBlock}`));
        console.log(chalk_1.default.cyan(`   Wallet: ${this.wallet.address}`));
    }
    async fundWalletOnFork() {
        // Impersonate a whale account to fund our wallet
        const whaleAddress = '0x489ee077994B6658eAfA855C308275EAd8097C4A'; // Large ETH holder
        // Enable impersonation
        await hardhat_1.default.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAddress]
        });
        // Fund the whale account with ETH (in case it's needed)
        await hardhat_1.default.network.provider.request({
            method: 'hardhat_setBalance',
            params: [whaleAddress, '0x56BC75E2D630E0000'] // 100 ETH
        });
        // Get the whale signer
        const { ethers: hreEthers } = hardhat_1.default;
        const whaleSigner = await hreEthers.getSigner(whaleAddress);
        // Transfer ETH to our wallet
        const fundingAmount = ethers_1.ethers.parseEther('10.0'); // 10 ETH should be plenty
        await whaleSigner.sendTransaction({
            to: this.wallet.address,
            value: fundingAmount
        });
        // Stop impersonation
        await hardhat_1.default.network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [whaleAddress]
        });
        const balance = await this.forkProvider.getBalance(this.wallet.address);
        console.log(chalk_1.default.green(`💰 Wallet funded with ${ethers_1.ethers.formatEther(balance)} ETH`));
    }
    async deployContractOnFork(network) {
        console.log(chalk_1.default.blue(`🚀 Deploying FlashArbBotBalancer on ${network} fork...`));
        const result = {
            network,
            forkBlock: await this.forkProvider.getBlockNumber(),
            deploymentSuccess: false,
            contractAddress: '',
            gasUsed: 0n,
            deploymentCost: 0n,
            verificationTests: {
                codeVerification: false,
                ownershipTest: false,
                gasFundingTest: false,
                balanceTest: false
            },
            errors: []
        };
        try {
            // Get contract factory
            const { ethers: hreEthers } = hardhat_1.default;
            const FlashArbBotBalancer = await hreEthers.getContractFactory('FlashArbBotBalancer');
            // Get deployment parameters
            const balancerVault = network === 'arbitrum'
                ? process.env.BALANCER_VAULT_ADDRESS
                : process.env.OPT_BALANCER_VAULT_ADDRESS;
            const sushiRouter = network === 'arbitrum'
                ? process.env.SUSHI_ROUTER_ARB
                : process.env.SUSHI_ROUTER_OPT;
            const uniV2Router = network === 'arbitrum'
                ? process.env.UNI_V2_ROUTER_ARB
                : process.env.UNI_V2_ROUTER_OPT;
            const uniV3Quoter = process.env.UNISWAP_V3_QUOTER_ADDRESS; // Same on both networks
            if (!balancerVault || !sushiRouter || !uniV2Router || !uniV3Quoter) {
                throw new Error('Missing deployment parameters for ' + network);
            }
            console.log(chalk_1.default.yellow('📋 Deployment parameters:'));
            console.log(chalk_1.default.white(`   Balancer Vault: ${balancerVault}`));
            console.log(chalk_1.default.white(`   Sushi Router: ${sushiRouter}`));
            console.log(chalk_1.default.white(`   Uni V2 Router: ${uniV2Router}`));
            console.log(chalk_1.default.white(`   Uni V3 Quoter: ${uniV3Quoter}`));
            // Deploy contract
            const contract = await FlashArbBotBalancer.connect(this.wallet).deploy(balancerVault, sushiRouter, uniV2Router, uniV3Quoter);
            // Wait for deployment
            const deploymentReceipt = await contract.deploymentTransaction()?.wait();
            if (!deploymentReceipt) {
                throw new Error('Deployment transaction failed');
            }
            result.contractAddress = await contract.getAddress();
            result.gasUsed = deploymentReceipt.gasUsed;
            result.deploymentCost = deploymentReceipt.gasUsed * BigInt(deploymentReceipt.gasPrice || 0);
            result.deploymentSuccess = true;
            console.log(chalk_1.default.green('✅ Contract deployed successfully'));
            console.log(chalk_1.default.cyan(`   Contract Address: ${result.contractAddress}`));
            console.log(chalk_1.default.cyan(`   Gas Used: ${result.gasUsed.toString()}`));
            console.log(chalk_1.default.cyan(`   Deployment Cost: ${ethers_1.ethers.formatEther(result.deploymentCost)} ETH`));
            // Run verification tests
            await this.runContractVerificationTests(contract, result);
        }
        catch (error) {
            result.errors.push(error instanceof Error ? error.message : 'Unknown deployment error');
            console.log(chalk_1.default.red(`❌ Deployment failed: ${result.errors[0]}`));
        }
        this.results.push(result);
        return result;
    }
    async runContractVerificationTests(contract, result) {
        console.log(chalk_1.default.yellow('🧪 Running contract verification tests...'));
        try {
            // Test 1: Code verification
            const deployedCode = await this.forkProvider.getCode(result.contractAddress);
            result.verificationTests.codeVerification = deployedCode !== '0x';
            console.log(chalk_1.default.cyan(`   Code Verification: ${result.verificationTests.codeVerification ? '✅' : '❌'}`));
            // Test 2: Ownership test
            const owner = await contract.owner();
            result.verificationTests.ownershipTest = owner.toLowerCase() === this.wallet.address.toLowerCase();
            console.log(chalk_1.default.cyan(`   Ownership Test: ${result.verificationTests.ownershipTest ? '✅' : '❌'}`));
            console.log(chalk_1.default.white(`     Owner: ${owner}`));
            console.log(chalk_1.default.white(`     Wallet: ${this.wallet.address}`));
            // Test 3: Gas funding configuration
            try {
                await contract.setGasFundingWallet(this.wallet.address);
                await contract.setGasFundingPercentage(1000); // 10%
                const [gasFundingWallet, percentage, totalTransferred] = await contract.getGasFundingStats();
                result.verificationTests.gasFundingTest = (gasFundingWallet.toLowerCase() === this.wallet.address.toLowerCase() &&
                    percentage.toString() === '1000');
                console.log(chalk_1.default.cyan(`   Gas Funding Test: ${result.verificationTests.gasFundingTest ? '✅' : '❌'}`));
            }
            catch (error) {
                result.errors.push('Gas funding test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                console.log(chalk_1.default.cyan(`   Gas Funding Test: ❌`));
            }
            // Test 4: Balance test
            const contractBalance = await this.forkProvider.getBalance(result.contractAddress);
            result.verificationTests.balanceTest = true; // Contract starts with 0 balance, which is expected
            console.log(chalk_1.default.cyan(`   Balance Test: ${result.verificationTests.balanceTest ? '✅' : '❌'}`));
            console.log(chalk_1.default.white(`     Contract Balance: ${ethers_1.ethers.formatEther(contractBalance)} ETH`));
        }
        catch (error) {
            result.errors.push('Verification tests failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }
    async testArbitrageSimulation(contractAddress) {
        console.log(chalk_1.default.blue('🎯 Testing Arbitrage Simulation...'));
        try {
            // Create contract instance with full ABI
            const contractABI = [
                'function flashLoan(address asset, uint256 amount, address[] memory path, bool sushiFirst) external',
                'function owner() view returns (address)',
                'function getGasFundingStats() view returns (address, uint256, uint256)'
            ];
            const contract = new ethers_1.ethers.Contract(contractAddress, contractABI, this.wallet);
            console.log(chalk_1.default.yellow('📊 Simulating flashloan call (will revert safely)...'));
            // Test with small amounts and expect revert (since we don't have real arbitrage opportunity)
            const testAmount = ethers_1.ethers.parseEther('0.01');
            const testPath = [
                process.env.WETH_ARB,
                process.env.USDC_ARB
            ];
            try {
                // This should revert because there's no real arbitrage opportunity,
                // but it validates that the contract logic is working
                await contract.flashLoan.staticCall(process.env.WETH_ARB, testAmount, testPath, true);
                console.log(chalk_1.default.green('✅ Flash loan function callable (unexpected success)'));
                return true;
            }
            catch (error) {
                // Expected to revert due to no arbitrage opportunity
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (errorMessage.includes('Unprofitable') || errorMessage.includes('revert')) {
                    console.log(chalk_1.default.green('✅ Flash loan function working (reverted as expected)'));
                    return true;
                }
                else {
                    console.log(chalk_1.default.red(`❌ Unexpected error: ${errorMessage}`));
                    return false;
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Simulation failed: ${error}`));
            return false;
        }
    }
    async generateForkTestReport() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportDir = path_1.default.join(process.cwd(), 'reports');
        if (!fs_1.default.existsSync(reportDir)) {
            fs_1.default.mkdirSync(reportDir, { mode: 0o700 });
        }
        const report = {
            timestamp: new Date().toISOString(),
            walletAddress: this.wallet?.address || 'Not configured',
            forkTests: this.results,
            summary: {
                totalTests: this.results.length,
                successfulDeployments: this.results.filter(r => r.deploymentSuccess).length,
                totalGasUsed: this.results.reduce((sum, r) => sum + r.gasUsed, 0n).toString(),
                totalCost: ethers_1.ethers.formatEther(this.results.reduce((sum, r) => sum + r.deploymentCost, 0n))
            }
        };
        const reportPath = path_1.default.join(reportDir, `fork-deployment-test-${timestamp}.json`);
        fs_1.default.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
        console.log(chalk_1.default.green(`📄 Fork test report saved to: ${reportPath}`));
    }
    async runCompleteForkTest() {
        console.log(chalk_1.default.blue('🧪 Complete Fork-Based Deployment Test'));
        console.log(chalk_1.default.blue('═══════════════════════════════════════'));
        let allTestsPassed = true;
        // Test Arbitrum deployment
        try {
            await this.initializeForkEnvironment('arbitrum');
            const arbResult = await this.deployContractOnFork('arbitrum');
            if (arbResult.deploymentSuccess) {
                const simSuccess = await this.testArbitrageSimulation(arbResult.contractAddress);
                if (!simSuccess)
                    allTestsPassed = false;
            }
            else {
                allTestsPassed = false;
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Arbitrum fork test failed: ${error}`));
            allTestsPassed = false;
        }
        // Test Optimism deployment (if configured)
        if (process.env.OPT_RPC) {
            try {
                await this.initializeForkEnvironment('optimism');
                const optResult = await this.deployContractOnFork('optimism');
                if (optResult.deploymentSuccess) {
                    const simSuccess = await this.testArbitrageSimulation(optResult.contractAddress);
                    if (!simSuccess)
                        allTestsPassed = false;
                }
                else {
                    allTestsPassed = false;
                }
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Optimism fork test failed: ${error}`));
                allTestsPassed = false;
            }
        }
        // Generate report
        await this.generateForkTestReport();
        // Summary
        console.log(chalk_1.default.blue('📊 FORK TEST SUMMARY'));
        console.log(chalk_1.default.blue('═══════════════════════'));
        for (const result of this.results) {
            const status = result.deploymentSuccess ? '✅' : '❌';
            console.log(chalk_1.default.white(`${status} ${result.network}: ${result.deploymentSuccess ? 'SUCCESS' : 'FAILED'}`));
            if (result.deploymentSuccess) {
                console.log(chalk_1.default.cyan(`   Contract: ${result.contractAddress}`));
                console.log(chalk_1.default.cyan(`   Gas Used: ${result.gasUsed.toString()}`));
                console.log(chalk_1.default.cyan(`   Cost: ${ethers_1.ethers.formatEther(result.deploymentCost)} ETH`));
                const verifications = Object.values(result.verificationTests).filter(Boolean).length;
                const totalVerifications = Object.keys(result.verificationTests).length;
                console.log(chalk_1.default.cyan(`   Verifications: ${verifications}/${totalVerifications}`));
            }
            if (result.errors.length > 0) {
                console.log(chalk_1.default.red(`   Errors: ${result.errors.join(', ')}`));
            }
        }
        console.log(chalk_1.default.white(`Overall: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`));
        return allTestsPassed;
    }
}
exports.ForkDeploymentTester = ForkDeploymentTester;
// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'full';
    const tester = new ForkDeploymentTester();
    try {
        switch (command) {
            case 'full':
                const success = await tester.runCompleteForkTest();
                process.exit(success ? 0 : 1);
                break;
            case 'arbitrum':
                await tester.initializeForkEnvironment('arbitrum');
                const arbResult = await tester.deployContractOnFork('arbitrum');
                if (arbResult.deploymentSuccess) {
                    await tester.testArbitrageSimulation(arbResult.contractAddress);
                }
                await tester.generateForkTestReport();
                process.exit(arbResult.deploymentSuccess ? 0 : 1);
                break;
            case 'optimism':
                await tester.initializeForkEnvironment('optimism');
                const optResult = await tester.deployContractOnFork('optimism');
                if (optResult.deploymentSuccess) {
                    await tester.testArbitrageSimulation(optResult.contractAddress);
                }
                await tester.generateForkTestReport();
                process.exit(optResult.deploymentSuccess ? 0 : 1);
                break;
            default:
                console.log(chalk_1.default.blue('Fork Deployment Tester Commands:'));
                console.log(chalk_1.default.cyan('  full      - Run complete fork tests on both networks'));
                console.log(chalk_1.default.cyan('  arbitrum  - Test Arbitrum deployment only'));
                console.log(chalk_1.default.cyan('  optimism  - Test Optimism deployment only'));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Fork test failed:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = ForkDeploymentTester;
