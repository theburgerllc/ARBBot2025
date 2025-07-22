#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickSetup = void 0;
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Quick setup script for MEV Bot
 * Provides interactive setup with guided prompts
 */
class QuickSetup {
    envPath = path_1.default.join(process.cwd(), '.env');
    constructor() {
        this.displayHeader();
    }
    displayHeader() {
        console.log(chalk_1.default.blue('\n🚀 MEV Bot Quick Setup'));
        console.log(chalk_1.default.gray('=======================\n'));
    }
    async prompt(question) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise((resolve) => {
            readline.question(question, (answer) => {
                readline.close();
                resolve(answer.trim());
            });
        });
    }
    runCommand(command, description) {
        console.log(chalk_1.default.yellow(`\n📋 ${description}...`));
        try {
            (0, child_process_1.execSync)(command, { stdio: 'inherit' });
            console.log(chalk_1.default.green(`✅ ${description} completed`));
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ ${description} failed`));
            throw error;
        }
    }
    checkPrerequisites() {
        console.log(chalk_1.default.blue('🔍 Checking prerequisites...'));
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 18) {
            console.error(chalk_1.default.red('❌ Node.js 18+ required'));
            console.log(chalk_1.default.yellow('Current version:', nodeVersion));
            console.log(chalk_1.default.blue('Download: https://nodejs.org/'));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✅ Node.js version:', nodeVersion));
        // Check if this is a git repository
        try {
            (0, child_process_1.execSync)('git status', { stdio: 'ignore' });
            console.log(chalk_1.default.green('✅ Git repository detected'));
        }
        catch {
            console.log(chalk_1.default.yellow('⚠️  Not a git repository'));
        }
        // Check if package.json exists
        if (!fs_1.default.existsSync('package.json')) {
            console.error(chalk_1.default.red('❌ package.json not found'));
            console.log(chalk_1.default.yellow('Run this script from the project root directory'));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✅ Project structure verified'));
    }
    async setupEnvironment() {
        console.log(chalk_1.default.blue('\n🔧 Environment Setup'));
        // Check if .env already exists
        if (fs_1.default.existsSync(this.envPath)) {
            console.log(chalk_1.default.yellow('⚠️  .env file already exists'));
            const overwrite = await this.prompt('Do you want to overwrite it? (y/N): ');
            if (overwrite.toLowerCase() !== 'y') {
                console.log(chalk_1.default.blue('Keeping existing .env file'));
                return;
            }
            // Backup existing .env
            const backupPath = `${this.envPath}.backup.${Date.now()}`;
            fs_1.default.copyFileSync(this.envPath, backupPath);
            console.log(chalk_1.default.green(`✅ Backed up existing .env to ${backupPath}`));
        }
        // Generate new keys
        console.log(chalk_1.default.yellow('🔑 Generating cryptographic keys...'));
        const createBackup = await this.prompt('Create encrypted backup? (Y/n): ');
        const shouldBackup = createBackup.toLowerCase() !== 'n';
        let command = 'ts-node scripts/generate-keys.ts';
        if (shouldBackup) {
            const usePassword = await this.prompt('Use password for backup encryption? (Y/n): ');
            if (usePassword.toLowerCase() !== 'n') {
                const password = await this.prompt('Enter backup password: ');
                command += ` --backup --password "${password}"`;
            }
            else {
                command += ' --backup';
            }
        }
        this.runCommand(command, 'Key generation');
    }
    async installDependencies() {
        console.log(chalk_1.default.blue('\n📦 Installing dependencies...'));
        const packageManager = fs_1.default.existsSync('package-lock.json') ? 'npm' :
            fs_1.default.existsSync('yarn.lock') ? 'yarn' : 'npm';
        console.log(chalk_1.default.gray(`Using ${packageManager}...`));
        this.runCommand(`${packageManager} install`, 'Dependency installation');
    }
    async compileContracts() {
        console.log(chalk_1.default.blue('\n🔨 Compiling contracts...'));
        this.runCommand('npm run compile', 'Contract compilation');
    }
    async validateSetup() {
        console.log(chalk_1.default.blue('\n🔍 Validating setup...'));
        this.runCommand('npm run keys:validate', 'Setup validation');
    }
    async deployContracts() {
        console.log(chalk_1.default.blue('\n🚀 Contract deployment...'));
        const deployArbitrum = await this.prompt('Deploy to Arbitrum? (Y/n): ');
        if (deployArbitrum.toLowerCase() !== 'n') {
            this.runCommand('npm run deploy:arb', 'Arbitrum deployment');
        }
        const deployOptimism = await this.prompt('Deploy to Optimism? (Y/n): ');
        if (deployOptimism.toLowerCase() !== 'n') {
            this.runCommand('npm run deploy:opt', 'Optimism deployment');
        }
    }
    displayNextSteps() {
        console.log(chalk_1.default.green('\n🎉 Setup Complete!'));
        console.log(chalk_1.default.blue('\n📋 Next Steps:'));
        console.log(chalk_1.default.white('1. Fund your executor wallet with ~0.1 ETH on each chain'));
        console.log(chalk_1.default.white('2. Update contract addresses in .env (if contracts were deployed)'));
        console.log(chalk_1.default.white('3. Test the bot: npm run bot:simulate'));
        console.log(chalk_1.default.white('4. Start the bot: npm run bot:start'));
        console.log(chalk_1.default.blue('\n🔗 Useful Commands:'));
        console.log(chalk_1.default.gray('  npm run keys:validate     - Validate setup'));
        console.log(chalk_1.default.gray('  npm run bot:simulate      - Test bot in simulation mode'));
        console.log(chalk_1.default.gray('  npm run bot:start         - Start the bot'));
        console.log(chalk_1.default.gray('  npm run emergency:stop    - Emergency stop'));
        console.log(chalk_1.default.blue('\n📚 Documentation:'));
        console.log(chalk_1.default.gray('  KEYGEN_GUIDE.md           - Key generation guide'));
        console.log(chalk_1.default.gray('  README.md                 - Main documentation'));
        console.log(chalk_1.default.gray('  SETUP_GUIDE.md            - Detailed setup guide'));
        console.log(chalk_1.default.yellow('\n⚠️  Important Security Notes:'));
        console.log(chalk_1.default.red('  • Never share your private keys'));
        console.log(chalk_1.default.red('  • Use hardware wallets for production'));
        console.log(chalk_1.default.red('  • Enable 2FA on all accounts'));
        console.log(chalk_1.default.red('  • Regularly backup your keys'));
        console.log(chalk_1.default.red('  • Monitor wallet balances'));
    }
    async run() {
        try {
            console.log(chalk_1.default.blue('Starting MEV Bot setup...'));
            console.log(chalk_1.default.gray('This will guide you through the complete setup process.\n'));
            // Step 1: Prerequisites
            this.checkPrerequisites();
            // Step 2: Install dependencies
            await this.installDependencies();
            // Step 3: Compile contracts
            await this.compileContracts();
            // Step 4: Environment setup
            await this.setupEnvironment();
            // Step 5: Validate setup
            await this.validateSetup();
            // Step 6: Optional contract deployment
            const shouldDeploy = await this.prompt('\nDeploy contracts now? (y/N): ');
            if (shouldDeploy.toLowerCase() === 'y') {
                await this.deployContracts();
            }
            // Step 7: Display next steps
            this.displayNextSteps();
        }
        catch (error) {
            console.error(chalk_1.default.red('\n❌ Setup failed:'), error);
            console.log(chalk_1.default.yellow('\n🔧 Troubleshooting:'));
            console.log(chalk_1.default.white('1. Check Node.js version (18+ required)'));
            console.log(chalk_1.default.white('2. Ensure all dependencies are installed'));
            console.log(chalk_1.default.white('3. Verify network connectivity'));
            console.log(chalk_1.default.white('4. Check .env file permissions'));
            console.log(chalk_1.default.white('5. Run: npm run keys:validate for detailed diagnostics'));
            process.exit(1);
        }
    }
}
exports.QuickSetup = QuickSetup;
// CLI execution
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk_1.default.blue('🚀 MEV Bot Quick Setup'));
        console.log(chalk_1.default.white('\nUsage: npm run setup:quick [options]'));
        console.log(chalk_1.default.white('\nOptions:'));
        console.log(chalk_1.default.gray('  --help, -h         Show this help'));
        console.log(chalk_1.default.white('\nThis script will guide you through:'));
        console.log(chalk_1.default.gray('  ✅ Prerequisites checking'));
        console.log(chalk_1.default.gray('  ✅ Dependency installation'));
        console.log(chalk_1.default.gray('  ✅ Contract compilation'));
        console.log(chalk_1.default.gray('  ✅ Key generation'));
        console.log(chalk_1.default.gray('  ✅ Environment setup'));
        console.log(chalk_1.default.gray('  ✅ Setup validation'));
        console.log(chalk_1.default.gray('  ✅ Optional contract deployment'));
        console.log(chalk_1.default.white('\nAlternative commands:'));
        console.log(chalk_1.default.cyan('  npm run keys:generate      - Generate keys only'));
        console.log(chalk_1.default.cyan('  npm run keys:validate      - Validate setup only'));
        console.log(chalk_1.default.cyan('  npm run setup:complete     - Generate + validate'));
        return;
    }
    const setup = new QuickSetup();
    await setup.run();
}
// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
