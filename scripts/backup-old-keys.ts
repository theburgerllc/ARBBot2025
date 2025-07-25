import { ethers } from 'ethers';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

interface OldKeyBackup {
  timestamp: string;
  oldPrivateKey: string;
  oldFlashbotsKey: string;
  oldExecutorAddress: string;
  oldFlashbotsAddress: string;
  testnetWalletAddress: string;
  gasFundingWalletAddress: string;
  metadata: {
    backupReason: string;
    version: string;
    checksum: string;
  };
}

class OldKeyBackupManager {
  private readonly BACKUP_DIR = path.join(process.cwd(), 'backups');
  
  constructor() {
    this.ensureBackupDir();
  }
  
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { mode: 0o700 });
    }
  }
  
  async createOldKeyBackup(password: string): Promise<string> {
    console.log(chalk.blue('🔐 Creating backup of current wallet keys...'));
    
    if (!process.env.PRIVATE_KEY) {
      throw new Error('No PRIVATE_KEY found in environment');
    }
    
    if (!process.env.FLASHBOTS_AUTH_KEY) {
      throw new Error('No FLASHBOTS_AUTH_KEY found in environment');
    }
    
    // Derive addresses from current keys
    const executorWallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const flashbotsWallet = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY);
    
    const backupData: OldKeyBackup = {
      timestamp: new Date().toISOString(),
      oldPrivateKey: process.env.PRIVATE_KEY,
      oldFlashbotsKey: process.env.FLASHBOTS_AUTH_KEY,
      oldExecutorAddress: executorWallet.address,
      oldFlashbotsAddress: flashbotsWallet.address,
      testnetWalletAddress: process.env.TESTNET_WALLET_ADDRESS || 'Not set',
      gasFundingWalletAddress: '0x0696674781903E433dc4189a8B4901FEF4920985',
      metadata: {
        backupReason: 'Wallet regeneration for security purposes',
        version: '2.0.0',
        checksum: crypto.createHash('sha256').update(JSON.stringify({
          pk: process.env.PRIVATE_KEY,
          fb: process.env.FLASHBOTS_AUTH_KEY
        })).digest('hex')
      }
    };
    
    console.log(chalk.cyan('📊 Current Wallet Information:'));
    console.log(chalk.white(`   Executor Address: ${backupData.oldExecutorAddress}`));
    console.log(chalk.white(`   Flashbots Address: ${backupData.oldFlashbotsAddress}`));
    console.log(chalk.white(`   Gas Funding Address: ${backupData.gasFundingWalletAddress}`));
    
    // Create encrypted backup
    const backupJson = JSON.stringify(backupData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `old-keys-backup-${timestamp}.json.encrypted`;
    const backupPath = path.join(this.BACKUP_DIR, backupFilename);
    
    // Encrypt backup
    const key = crypto.scryptSync(password, 'salt-old-keys', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(backupJson, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data
    const finalEncrypted = iv.toString('hex') + ':' + encrypted;
    
    fs.writeFileSync(backupPath, finalEncrypted, { mode: 0o600 });
    
    console.log(chalk.green('✅ Old keys backup created successfully'));
    console.log(chalk.yellow('📁 Backup location:'), backupPath);
    console.log(chalk.red('🔒 Keep this backup secure - it contains your old private keys'));
    
    return backupPath;
  }
  
  // Method to decrypt and verify backup (for testing purposes)
  async verifyBackup(backupPath: string, password: string): Promise<boolean> {
    try {
      console.log(chalk.blue('🔍 Verifying backup integrity...'));
      
      const encryptedData = fs.readFileSync(backupPath, 'utf8');
      const [ivHex, encrypted] = encryptedData.split(':');
      
      const key = crypto.scryptSync(password, 'salt-old-keys', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const backupData: OldKeyBackup = JSON.parse(decrypted);
      
      // Verify checksums and data integrity
      const expectedChecksum = crypto.createHash('sha256').update(JSON.stringify({
        pk: backupData.oldPrivateKey,
        fb: backupData.oldFlashbotsKey
      })).digest('hex');
      
      if (expectedChecksum !== backupData.metadata.checksum) {
        throw new Error('Backup checksum verification failed');
      }
      
      // Verify wallet derivation
      const executorWallet = new ethers.Wallet(backupData.oldPrivateKey);
      if (executorWallet.address !== backupData.oldExecutorAddress) {
        throw new Error('Executor wallet derivation verification failed');
      }
      
      const flashbotsWallet = new ethers.Wallet(backupData.oldFlashbotsKey);
      if (flashbotsWallet.address !== backupData.oldFlashbotsAddress) {
        throw new Error('Flashbots wallet derivation verification failed');
      }
      
      console.log(chalk.green('✅ Backup verification successful'));
      console.log(chalk.cyan('📊 Backed up wallet information:'));
      console.log(chalk.white(`   Timestamp: ${backupData.timestamp}`));
      console.log(chalk.white(`   Executor: ${backupData.oldExecutorAddress}`));
      console.log(chalk.white(`   Flashbots: ${backupData.oldFlashbotsAddress}`));
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Backup verification failed:'), error);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'backup';
  
  const backupManager = new OldKeyBackupManager();
  
  try {
    switch (command) {
      case 'backup':
        const password = args[1];
        if (!password) {
          console.error(chalk.red('❌ Please provide a password for encryption'));
          console.log(chalk.cyan('Usage: npx ts-node scripts/backup-old-keys.ts backup <password>'));
          process.exit(1);
        }
        
        if (password.length < 12) {
          console.error(chalk.red('❌ Password must be at least 12 characters long'));
          process.exit(1);
        }
        
        const backupPath = await backupManager.createOldKeyBackup(password);
        
        // Verify the backup was created correctly
        const isValid = await backupManager.verifyBackup(backupPath, password);
        if (isValid) {
          console.log(chalk.green('✅ Backup created and verified successfully'));
        } else {
          console.error(chalk.red('❌ Backup verification failed'));
          process.exit(1);
        }
        break;
        
      case 'verify':
        const verifyPath = args[1];
        const verifyPassword = args[2];
        
        if (!verifyPath || !verifyPassword) {
          console.error(chalk.red('❌ Please provide backup path and password'));
          console.log(chalk.cyan('Usage: npx ts-node scripts/backup-old-keys.ts verify <path> <password>'));
          process.exit(1);
        }
        
        const isValidBackup = await backupManager.verifyBackup(verifyPath, verifyPassword);
        if (isValidBackup) {
          console.log(chalk.green('✅ Backup is valid'));
        } else {
          console.error(chalk.red('❌ Invalid backup or wrong password'));
          process.exit(1);
        }
        break;
        
      default:
        console.log(chalk.blue('Old Keys Backup Manager'));
        console.log(chalk.cyan('Commands:'));
        console.log(chalk.white('  backup <password>        - Create encrypted backup of current keys'));
        console.log(chalk.white('  verify <path> <password> - Verify backup integrity'));
        break;
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default OldKeyBackupManager;