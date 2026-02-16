"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
dotenv_1.default.config();
async function verifyWalletAddresses() {
    console.log(chalk_1.default.blue('🔍 VERIFYING WALLET ADDRESSES'));
    console.log(chalk_1.default.blue('════════════════════════════'));
    if (!process.env.PRIVATE_KEY) {
        console.error(chalk_1.default.red('❌ PRIVATE_KEY not found in environment'));
        return;
    }
    if (!process.env.ARB_RPC) {
        console.error(chalk_1.default.red('❌ ARB_RPC not found in environment'));
        return;
    }
    try {
        // Create wallet from private key
        const wallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY);
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.ARB_RPC);
        const connectedWallet = wallet.connect(provider);
        console.log(chalk_1.default.cyan('\n📋 WALLET CONFIGURATION'));
        console.log(chalk_1.default.white(`Private Key: ${process.env.PRIVATE_KEY.substring(0, 10)}...`));
        console.log(chalk_1.default.white(`Derived Address: ${wallet.address}`));
        console.log(chalk_1.default.white(`Gas Funding Wallet (configured): 0xF68c01BaE2Daa708C004F485631C7213b45d1Cac`));
        console.log(chalk_1.default.white(`Testnet Wallet (configured): ${process.env.TESTNET_WALLET_ADDRESS || 'Not set'}`));
        // Check if addresses match
        const gasFundingWallet = '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac';
        const addressesMatch = wallet.address.toLowerCase() === gasFundingWallet.toLowerCase();
        console.log(chalk_1.default.cyan('\n🔄 ADDRESS MATCHING'));
        console.log(chalk_1.default.white(`Executor == Gas Funding: ${addressesMatch ? '✅ YES' : '❌ NO'}`));
        if (addressesMatch) {
            console.log(chalk_1.default.green('✅ Configuration is correct - executor and gas funding use same wallet'));
        }
        else {
            console.log(chalk_1.default.red('⚠️ MISMATCH: Executor and gas funding wallets are different!'));
            console.log(chalk_1.default.yellow(`This means the executor wallet is: ${wallet.address}`));
            console.log(chalk_1.default.yellow(`But gas funding is configured for: ${gasFundingWallet}`));
        }
        // Check balances
        console.log(chalk_1.default.cyan('\n💰 BALANCE CHECK'));
        const executorBalance = await provider.getBalance(wallet.address);
        console.log(chalk_1.default.white(`Executor Wallet (${wallet.address}): ${ethers_1.ethers.formatEther(executorBalance)} ETH`));
        if (!addressesMatch) {
            const gasFundingBalance = await provider.getBalance(gasFundingWallet);
            console.log(chalk_1.default.white(`Gas Funding Wallet (${gasFundingWallet}): ${ethers_1.ethers.formatEther(gasFundingBalance)} ETH`));
        }
        const suspiciousBalance = await provider.getBalance('0x541b9034c82d7fb564f12ca07037947ff5b4ef2f');
        console.log(chalk_1.default.white(`Suspicious Address: ${ethers_1.ethers.formatEther(suspiciousBalance)} ETH`));
        // Transaction counts
        console.log(chalk_1.default.cyan('\n📊 TRANSACTION COUNTS'));
        const executorTxCount = await provider.getTransactionCount(wallet.address);
        console.log(chalk_1.default.white(`Executor Wallet: ${executorTxCount} transactions`));
        if (!addressesMatch) {
            const gasFundingTxCount = await provider.getTransactionCount(gasFundingWallet);
            console.log(chalk_1.default.white(`Gas Funding Wallet: ${gasFundingTxCount} transactions`));
        }
        const suspiciousTxCount = await provider.getTransactionCount('0x541b9034c82d7fb564f12ca07037947ff5b4ef2f');
        console.log(chalk_1.default.white(`Suspicious Address: ${suspiciousTxCount} transactions`));
        // Summary
        console.log(chalk_1.default.blue('\n📝 SUMMARY'));
        console.log(chalk_1.default.blue('═══════════'));
        if (executorBalance > 0n) {
            console.log(chalk_1.default.green(`✅ Executor wallet has funds: ${ethers_1.ethers.formatEther(executorBalance)} ETH`));
        }
        else {
            console.log(chalk_1.default.red(`❌ Executor wallet is empty (${wallet.address})`));
        }
        if (executorTxCount > 0) {
            console.log(chalk_1.default.yellow(`⚠️ Executor wallet has ${executorTxCount} transactions - check history`));
        }
        else {
            console.log(chalk_1.default.green(`✅ Executor wallet has no transaction history (fresh wallet)`));
        }
        if (suspiciousBalance > 0n) {
            console.log(chalk_1.default.red(`🚨 Suspicious address has ${ethers_1.ethers.formatEther(suspiciousBalance)} ETH`));
        }
        else {
            console.log(chalk_1.default.green(`✅ Suspicious address is empty`));
        }
        if (suspiciousTxCount > 0) {
            console.log(chalk_1.default.red(`🚨 Suspicious address has ${suspiciousTxCount} transactions`));
        }
        else {
            console.log(chalk_1.default.green(`✅ Suspicious address has no transactions`));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error verifying wallet addresses:'), error);
    }
}
verifyWalletAddresses().catch(console.error);
