import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

async function verifyWalletAddresses() {
  console.log(chalk.blue('🔍 VERIFYING WALLET ADDRESSES'));
  console.log(chalk.blue('════════════════════════════'));

  if (!process.env.PRIVATE_KEY) {
    console.error(chalk.red('❌ PRIVATE_KEY not found in environment'));
    return;
  }

  if (!process.env.ARB_RPC) {
    console.error(chalk.red('❌ ARB_RPC not found in environment'));
    return;
  }

  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
    const connectedWallet = wallet.connect(provider);

    console.log(chalk.cyan('\n📋 WALLET CONFIGURATION'));
    console.log(chalk.white(`Private Key: ${process.env.PRIVATE_KEY.substring(0, 10)}...`));
    console.log(chalk.white(`Derived Address: ${wallet.address}`));
    console.log(chalk.white(`Gas Funding Wallet (configured): 0xF68c01BaE2Daa708C004F485631C7213b45d1Cac`));
    console.log(chalk.white(`Testnet Wallet (configured): ${process.env.TESTNET_WALLET_ADDRESS || 'Not set'}`));

    // Check if addresses match
    const gasFundingWallet = '0xF68c01BaE2Daa708C004F485631C7213b45d1Cac';
    const addressesMatch = wallet.address.toLowerCase() === gasFundingWallet.toLowerCase();
    
    console.log(chalk.cyan('\n🔄 ADDRESS MATCHING'));
    console.log(chalk.white(`Executor == Gas Funding: ${addressesMatch ? '✅ YES' : '❌ NO'}`));

    if (addressesMatch) {
      console.log(chalk.green('✅ Configuration is correct - executor and gas funding use same wallet'));
    } else {
      console.log(chalk.red('⚠️ MISMATCH: Executor and gas funding wallets are different!'));
      console.log(chalk.yellow(`This means the executor wallet is: ${wallet.address}`));
      console.log(chalk.yellow(`But gas funding is configured for: ${gasFundingWallet}`));
    }

    // Check balances
    console.log(chalk.cyan('\n💰 BALANCE CHECK'));
    
    const executorBalance = await provider.getBalance(wallet.address);
    console.log(chalk.white(`Executor Wallet (${wallet.address}): ${ethers.formatEther(executorBalance)} ETH`));
    
    if (!addressesMatch) {
      const gasFundingBalance = await provider.getBalance(gasFundingWallet);
      console.log(chalk.white(`Gas Funding Wallet (${gasFundingWallet}): ${ethers.formatEther(gasFundingBalance)} ETH`));
    }

    const suspiciousBalance = await provider.getBalance('0x541b9034c82d7fb564f12ca07037947ff5b4ef2f');
    console.log(chalk.white(`Suspicious Address: ${ethers.formatEther(suspiciousBalance)} ETH`));

    // Transaction counts
    console.log(chalk.cyan('\n📊 TRANSACTION COUNTS'));
    const executorTxCount = await provider.getTransactionCount(wallet.address);
    console.log(chalk.white(`Executor Wallet: ${executorTxCount} transactions`));
    
    if (!addressesMatch) {
      const gasFundingTxCount = await provider.getTransactionCount(gasFundingWallet);
      console.log(chalk.white(`Gas Funding Wallet: ${gasFundingTxCount} transactions`));
    }

    const suspiciousTxCount = await provider.getTransactionCount('0x541b9034c82d7fb564f12ca07037947ff5b4ef2f');
    console.log(chalk.white(`Suspicious Address: ${suspiciousTxCount} transactions`));

    // Summary
    console.log(chalk.blue('\n📝 SUMMARY'));
    console.log(chalk.blue('═══════════'));

    if (executorBalance > 0n) {
      console.log(chalk.green(`✅ Executor wallet has funds: ${ethers.formatEther(executorBalance)} ETH`));
    } else {
      console.log(chalk.red(`❌ Executor wallet is empty (${wallet.address})`));
    }

    if (executorTxCount > 0) {
      console.log(chalk.yellow(`⚠️ Executor wallet has ${executorTxCount} transactions - check history`));
    } else {
      console.log(chalk.green(`✅ Executor wallet has no transaction history (fresh wallet)`));
    }

    if (suspiciousBalance > 0n) {
      console.log(chalk.red(`🚨 Suspicious address has ${ethers.formatEther(suspiciousBalance)} ETH`));
    } else {
      console.log(chalk.green(`✅ Suspicious address is empty`));
    }

    if (suspiciousTxCount > 0) {
      console.log(chalk.red(`🚨 Suspicious address has ${suspiciousTxCount} transactions`));
    } else {
      console.log(chalk.green(`✅ Suspicious address has no transactions`));
    }

  } catch (error) {
    console.error(chalk.red('❌ Error verifying wallet addresses:'), error);
  }
}

verifyWalletAddresses().catch(console.error);