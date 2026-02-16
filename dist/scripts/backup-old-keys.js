"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class OldKeyBackupManager {
    BACKUP_DIR = path_1.default.join(process.cwd(), 'backups');
    constructor() {
        this.ensureBackupDir();
    }
    ensureBackupDir() {
        if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
            fs_1.default.mkdirSync(this.BACKUP_DIR, { mode: 0o700 });
        }
    }
    async createOldKeyBackup(password) {
        console.log(chalk_1.default.blue('🔐 Creating backup of current wallet keys...'));
        if (!process.env.PRIVATE_KEY) {
            throw new Error('No PRIVATE_KEY found in environment');
        }
        if (!process.env.FLASHBOTS_AUTH_KEY) {
            throw new Error('No FLASHBOTS_AUTH_KEY found in environment');
        }
        // Derive addresses from current keys
        const executorWallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY);
        const flashbotsWallet = new ethers_1.ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY);
        const backupData = {
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
                checksum: crypto_1.default.createHash('sha256').update(JSON.stringify({
                    pk: process.env.PRIVATE_KEY,
                    fb: process.env.FLASHBOTS_AUTH_KEY
                })).digest('hex')
            }
        };
        console.log(chalk_1.default.cyan('📊 Current Wallet Information:'));
        console.log(chalk_1.default.white(`   Executor Address: ${backupData.oldExecutorAddress}`));
        console.log(chalk_1.default.white(`   Flashbots Address: ${backupData.oldFlashbotsAddress}`));
        console.log(chalk_1.default.white(`   Gas Funding Address: ${backupData.gasFundingWalletAddress}`));
        // Create encrypted backup
        const backupJson = JSON.stringify(backupData, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `old-keys-backup-${timestamp}.json.encrypted`;
        const backupPath = path_1.default.join(this.BACKUP_DIR, backupFilename);
        // Encrypt backup
        const key = crypto_1.default.scryptSync(password, 'salt-old-keys', 32);
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(backupJson, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        // Prepend IV to encrypted data
        const finalEncrypted = iv.toString('hex') + ':' + encrypted;
        fs_1.default.writeFileSync(backupPath, finalEncrypted, { mode: 0o600 });
        console.log(chalk_1.default.green('✅ Old keys backup created successfully'));
        console.log(chalk_1.default.yellow('📁 Backup location:'), backupPath);
        console.log(chalk_1.default.red('🔒 Keep this backup secure - it contains your old private keys'));
        return backupPath;
    }
    // Method to decrypt and verify backup (for testing purposes)
    async verifyBackup(backupPath, password) {
        try {
            console.log(chalk_1.default.blue('🔍 Verifying backup integrity...'));
            const encryptedData = fs_1.default.readFileSync(backupPath, 'utf8');
            const [ivHex, encrypted] = encryptedData.split(':');
            const key = crypto_1.default.scryptSync(password, 'salt-old-keys', 32);
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            const backupData = JSON.parse(decrypted);
            // Verify checksums and data integrity
            const expectedChecksum = crypto_1.default.createHash('sha256').update(JSON.stringify({
                pk: backupData.oldPrivateKey,
                fb: backupData.oldFlashbotsKey
            })).digest('hex');
            if (expectedChecksum !== backupData.metadata.checksum) {
                throw new Error('Backup checksum verification failed');
            }
            // Verify wallet derivation
            const executorWallet = new ethers_1.ethers.Wallet(backupData.oldPrivateKey);
            if (executorWallet.address !== backupData.oldExecutorAddress) {
                throw new Error('Executor wallet derivation verification failed');
            }
            const flashbotsWallet = new ethers_1.ethers.Wallet(backupData.oldFlashbotsKey);
            if (flashbotsWallet.address !== backupData.oldFlashbotsAddress) {
                throw new Error('Flashbots wallet derivation verification failed');
            }
            console.log(chalk_1.default.green('✅ Backup verification successful'));
            console.log(chalk_1.default.cyan('📊 Backed up wallet information:'));
            console.log(chalk_1.default.white(`   Timestamp: ${backupData.timestamp}`));
            console.log(chalk_1.default.white(`   Executor: ${backupData.oldExecutorAddress}`));
            console.log(chalk_1.default.white(`   Flashbots: ${backupData.oldFlashbotsAddress}`));
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Backup verification failed:'), error);
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
                    console.error(chalk_1.default.red('❌ Please provide a password for encryption'));
                    console.log(chalk_1.default.cyan('Usage: npx ts-node scripts/backup-old-keys.ts backup <password>'));
                    process.exit(1);
                }
                if (password.length < 12) {
                    console.error(chalk_1.default.red('❌ Password must be at least 12 characters long'));
                    process.exit(1);
                }
                const backupPath = await backupManager.createOldKeyBackup(password);
                // Verify the backup was created correctly
                const isValid = await backupManager.verifyBackup(backupPath, password);
                if (isValid) {
                    console.log(chalk_1.default.green('✅ Backup created and verified successfully'));
                }
                else {
                    console.error(chalk_1.default.red('❌ Backup verification failed'));
                    process.exit(1);
                }
                break;
            case 'verify':
                const verifyPath = args[1];
                const verifyPassword = args[2];
                if (!verifyPath || !verifyPassword) {
                    console.error(chalk_1.default.red('❌ Please provide backup path and password'));
                    console.log(chalk_1.default.cyan('Usage: npx ts-node scripts/backup-old-keys.ts verify <path> <password>'));
                    process.exit(1);
                }
                const isValidBackup = await backupManager.verifyBackup(verifyPath, verifyPassword);
                if (isValidBackup) {
                    console.log(chalk_1.default.green('✅ Backup is valid'));
                }
                else {
                    console.error(chalk_1.default.red('❌ Invalid backup or wrong password'));
                    process.exit(1);
                }
                break;
            default:
                console.log(chalk_1.default.blue('Old Keys Backup Manager'));
                console.log(chalk_1.default.cyan('Commands:'));
                console.log(chalk_1.default.white('  backup <password>        - Create encrypted backup of current keys'));
                console.log(chalk_1.default.white('  verify <path> <password> - Verify backup integrity'));
                break;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = OldKeyBackupManager;
