#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

/**
 * Quick setup script for MEV Bot
 * Provides interactive setup with guided prompts
 */

class QuickSetup {
  private envPath = path.join(process.cwd(), '.env');
  
  constructor() {
    this.displayHeader();
  }
  
  private displayHeader(): void {
    console.log(chalk.blue('\n🚀 MEV Bot Quick Setup'));
    console.log(chalk.gray('=======================\n'));
  }
  
  private async prompt(question: string): Promise<string> {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      readline.question(question, (answer: string) => {
        readline.close();
        resolve(answer.trim());
      });
    });
  }
  
  private runCommand(command: string, description: string): void {
    console.log(chalk.yellow(`\n📋 ${description}...`));
    try {
      execSync(command, { stdio: 'inherit' });
      console.log(chalk.green(`✅ ${description} completed`));
    } catch (error) {
      console.error(chalk.red(`❌ ${description} failed`));
      throw error;
    }
  }
  
  private checkPrerequisites(): void {
    console.log(chalk.blue('🔍 Checking prerequisites...'));
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      console.error(chalk.red('❌ Node.js 18+ required'));
      console.log(chalk.yellow('Current version:', nodeVersion));
      console.log(chalk.blue('Download: https://nodejs.org/'));
      process.exit(1);
    }
    
    console.log(chalk.green('✅ Node.js version:', nodeVersion));
    
    // Check if this is a git repository
    try {
      execSync('git status', { stdio: 'ignore' });
      console.log(chalk.green('✅ Git repository detected'));
    } catch {
      console.log(chalk.yellow('⚠️  Not a git repository'));
    }
    
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      console.error(chalk.red('❌ package.json not found'));
      console.log(chalk.yellow('Run this script from the project root directory'));
      process.exit(1);
    }
    
    console.log(chalk.green('✅ Project structure verified'));
  }
  
  private async setupEnvironment(): Promise<void> {
    console.log(chalk.blue('\n🔧 Environment Setup'));
    
    // Check if .env already exists
    if (fs.existsSync(this.envPath)) {
      console.log(chalk.yellow('⚠️  .env file already exists'));
      const overwrite = await this.prompt('Do you want to overwrite it? (y/N): ');
      
      if (overwrite.toLowerCase() !== 'y') {
        console.log(chalk.blue('Keeping existing .env file'));
        return;
      }
      
      // Backup existing .env
      const backupPath = `${this.envPath}.backup.${Date.now()}`;
      fs.copyFileSync(this.envPath, backupPath);
      console.log(chalk.green(`✅ Backed up existing .env to ${backupPath}`));
    }
    
    // Generate new keys
    console.log(chalk.yellow('🔑 Generating cryptographic keys...'));
    
    const createBackup = await this.prompt('Create encrypted backup? (Y/n): ');
    const shouldBackup = createBackup.toLowerCase() !== 'n';
    
    let command = 'ts-node scripts/generate-keys.ts';
    
    if (shouldBackup) {
      const usePassword = await this.prompt('Use password for backup encryption? (Y/n): ');
      if (usePassword.toLowerCase() !== 'n') {
        const password = await this.prompt('Enter backup password: ');
        command += ` --backup --password "${password}"`;
      } else {
        command += ' --backup';
      }
    }
    
    this.runCommand(command, 'Key generation');
  }
  
  private async installDependencies(): Promise<void> {
    console.log(chalk.blue('\n📦 Installing dependencies...'));
    
    const packageManager = fs.existsSync('package-lock.json') ? 'npm' : 
                          fs.existsSync('yarn.lock') ? 'yarn' : 'npm';
    
    console.log(chalk.gray(`Using ${packageManager}...`));
    
    this.runCommand(`${packageManager} install`, 'Dependency installation');
  }
  
  private async compileContracts(): Promise<void> {
    console.log(chalk.blue('\n🔨 Compiling contracts...'));
    
    this.runCommand('npm run compile', 'Contract compilation');
  }
  
  private async validateSetup(): Promise<void> {
    console.log(chalk.blue('\n🔍 Validating setup...'));
    
    this.runCommand('npm run keys:validate', 'Setup validation');
  }
  
  private async deployContracts(): Promise<void> {
    console.log(chalk.blue('\n🚀 Contract deployment...'));
    
    const deployArbitrum = await this.prompt('Deploy to Arbitrum? (Y/n): ');
    if (deployArbitrum.toLowerCase() !== 'n') {
      this.runCommand('npm run deploy:arb', 'Arbitrum deployment');
    }
    
    const deployOptimism = await this.prompt('Deploy to Optimism? (Y/n): ');
    if (deployOptimism.toLowerCase() !== 'n') {
      this.runCommand('npm run deploy:opt', 'Optimism deployment');
    }
  }
  
  private displayNextSteps(): void {
    console.log(chalk.green('\n🎉 Setup Complete!'));
    console.log(chalk.blue('\n📋 Next Steps:'));
    console.log(chalk.white('1. Fund your executor wallet with ~0.1 ETH on each chain'));
    console.log(chalk.white('2. Update contract addresses in .env (if contracts were deployed)'));
    console.log(chalk.white('3. Test the bot: npm run bot:simulate'));
    console.log(chalk.white('4. Start the bot: npm run bot:start'));
    
    console.log(chalk.blue('\n🔗 Useful Commands:'));
    console.log(chalk.gray('  npm run keys:validate     - Validate setup'));
    console.log(chalk.gray('  npm run bot:simulate      - Test bot in simulation mode'));
    console.log(chalk.gray('  npm run bot:start         - Start the bot'));
    console.log(chalk.gray('  npm run emergency:stop    - Emergency stop'));
    
    console.log(chalk.blue('\n📚 Documentation:'));
    console.log(chalk.gray('  KEYGEN_GUIDE.md           - Key generation guide'));
    console.log(chalk.gray('  README.md                 - Main documentation'));
    console.log(chalk.gray('  SETUP_GUIDE.md            - Detailed setup guide'));
    
    console.log(chalk.yellow('\n⚠️  Important Security Notes:'));
    console.log(chalk.red('  • Never share your private keys'));
    console.log(chalk.red('  • Use hardware wallets for production'));
    console.log(chalk.red('  • Enable 2FA on all accounts'));
    console.log(chalk.red('  • Regularly backup your keys'));
    console.log(chalk.red('  • Monitor wallet balances'));
  }
  
  async run(): Promise<void> {
    try {
      console.log(chalk.blue('Starting MEV Bot setup...'));
      console.log(chalk.gray('This will guide you through the complete setup process.\n'));
      
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
      
    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error);
      console.log(chalk.yellow('\n🔧 Troubleshooting:'));
      console.log(chalk.white('1. Check Node.js version (18+ required)'));
      console.log(chalk.white('2. Ensure all dependencies are installed'));
      console.log(chalk.white('3. Verify network connectivity'));
      console.log(chalk.white('4. Check .env file permissions'));
      console.log(chalk.white('5. Run: npm run keys:validate for detailed diagnostics'));
      
      process.exit(1);
    }
  }
}

// CLI execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue('🚀 MEV Bot Quick Setup'));
    console.log(chalk.white('\nUsage: npm run setup:quick [options]'));
    console.log(chalk.white('\nOptions:'));
    console.log(chalk.gray('  --help, -h         Show this help'));
    console.log(chalk.white('\nThis script will guide you through:'));
    console.log(chalk.gray('  ✅ Prerequisites checking'));
    console.log(chalk.gray('  ✅ Dependency installation'));
    console.log(chalk.gray('  ✅ Contract compilation'));
    console.log(chalk.gray('  ✅ Key generation'));
    console.log(chalk.gray('  ✅ Environment setup'));
    console.log(chalk.gray('  ✅ Setup validation'));
    console.log(chalk.gray('  ✅ Optional contract deployment'));
    console.log(chalk.white('\nAlternative commands:'));
    console.log(chalk.cyan('  npm run keys:generate      - Generate keys only'));
    console.log(chalk.cyan('  npm run keys:validate      - Validate setup only'));
    console.log(chalk.cyan('  npm run setup:complete     - Generate + validate'));
    return;
  }
  
  const setup = new QuickSetup();
  await setup.run();
}

// Export for testing
export { QuickSetup };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}