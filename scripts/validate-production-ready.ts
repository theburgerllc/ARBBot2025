import chalk from "chalk";
import { ethers } from "ethers";
import fs from "fs";
import { execSync } from "child_process";

interface ValidationResult {
  category: string;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }[];
}

async function validateProductionReadiness(): Promise<boolean> {
  console.log(chalk.blue('🔍 ARBBot2025 Production Readiness Validation\n'));
  
  const results: ValidationResult[] = [];
  let allChecks = true;
  
  // Check 1: Environment Variables
  console.log(chalk.cyan('📋 Checking Environment Configuration...'));
  const envResult: ValidationResult = {
    category: 'Environment Configuration',
    checks: []
  };
  
  const requiredEnvVars = [
    'PRIVATE_KEY',
    'ARB_RPC',
    'OPT_RPC',
    'FLASHBOTS_AUTH_KEY',
    'ARB_BOT_CONTRACT_ADDRESS',
    'OPT_BOT_CONTRACT_ADDRESS'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.log(chalk.red(`❌ Missing environment variable: ${envVar}`));
      envResult.checks.push({
        name: envVar,
        status: 'fail',
        details: 'Environment variable not set'
      });
      allChecks = false;
    } else {
      console.log(chalk.green(`✅ ${envVar} configured`));
      envResult.checks.push({
        name: envVar,
        status: 'pass'
      });
    }
  }
  
  results.push(envResult);
  
  // Check 2: Contract Deployments
  console.log(chalk.cyan('\n📋 Checking Contract Deployments...'));
  const contractResult: ValidationResult = {
    category: 'Contract Deployments',
    checks: []
  };
  
  if (process.env.ARB_RPC && process.env.ARB_BOT_CONTRACT_ADDRESS) {
    try {
      const arbProvider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
      const code = await arbProvider.getCode(process.env.ARB_BOT_CONTRACT_ADDRESS);
      
      if (code === '0x') {
        console.log(chalk.red('❌ Arbitrum contract not deployed'));
        contractResult.checks.push({
          name: 'Arbitrum Contract',
          status: 'fail',
          details: 'No code found at contract address'
        });
        allChecks = false;
      } else {
        console.log(chalk.green('✅ Arbitrum contract deployed'));
        contractResult.checks.push({
          name: 'Arbitrum Contract',
          status: 'pass',
          details: `Contract size: ${(code.length - 2) / 2} bytes`
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Arbitrum RPC connection failed'));
      contractResult.checks.push({
        name: 'Arbitrum RPC',
        status: 'fail',
        details: error instanceof Error ? error.message : 'RPC connection failed'
      });
      allChecks = false;
    }
  }
  
  if (process.env.OPT_RPC && process.env.OPT_BOT_CONTRACT_ADDRESS) {
    try {
      const optProvider = new ethers.JsonRpcProvider(process.env.OPT_RPC);
      const code = await optProvider.getCode(process.env.OPT_BOT_CONTRACT_ADDRESS);
      
      if (code === '0x') {
        console.log(chalk.red('❌ Optimism contract not deployed'));
        contractResult.checks.push({
          name: 'Optimism Contract',
          status: 'fail',
          details: 'No code found at contract address'
        });
        allChecks = false;
      } else {
        console.log(chalk.green('✅ Optimism contract deployed'));
        contractResult.checks.push({
          name: 'Optimism Contract',
          status: 'pass',
          details: `Contract size: ${(code.length - 2) / 2} bytes`
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Optimism RPC connection failed'));
      contractResult.checks.push({
        name: 'Optimism RPC',
        status: 'fail',
        details: error instanceof Error ? error.message : 'RPC connection failed'
      });
      allChecks = false;
    }
  }
  
  results.push(contractResult);
  
  // Check 3: Wallet Funding
  console.log(chalk.cyan('\n📋 Checking Wallet Funding...'));
  const walletResult: ValidationResult = {
    category: 'Wallet Funding',
    checks: []
  };
  
  if (process.env.PRIVATE_KEY && process.env.ARB_RPC) {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      const balance = await provider.getBalance(wallet.address);
      const balanceETH = Number(ethers.formatEther(balance));
      
      if (balanceETH < 0.1) {
        console.log(chalk.yellow(`⚠️ Low wallet balance: ${balanceETH.toFixed(4)} ETH`));
        walletResult.checks.push({
          name: 'Arbitrum Wallet Balance',
          status: 'warning',
          details: `${balanceETH.toFixed(4)} ETH - Consider funding for gas costs`
        });
      } else {
        console.log(chalk.green(`✅ Wallet funded: ${balanceETH.toFixed(4)} ETH`));
        walletResult.checks.push({
          name: 'Arbitrum Wallet Balance',
          status: 'pass',
          details: `${balanceETH.toFixed(4)} ETH`
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Wallet validation failed'));
      walletResult.checks.push({
        name: 'Wallet Access',
        status: 'fail',
        details: error instanceof Error ? error.message : 'Wallet validation failed'
      });
      allChecks = false;
    }
  }
  
  results.push(walletResult);
  
  // Check 4: Phase 1-3 Module Files
  console.log(chalk.cyan('\n📋 Checking Phase 1-3 Optimization Modules...'));
  const moduleResult: ValidationResult = {
    category: 'Optimization Modules',
    checks: []
  };
  
  const requiredFiles = [
    'utils/gas-optimizer.ts',
    'utils/l2-gas-manager.ts', 
    'utils/mev-bundle-optimizer.ts',
    'strategies/triangular-arbitrage.ts',
    'utils/dynamic-slippage-manager.ts',
    'utils/adaptive-profit-manager.ts',
    'utils/advanced-risk-manager.ts',
    'utils/oracle-price-validator.ts',
    'monitoring/production-monitor.ts',
    'utils/auto-maintenance.ts'
  ];
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      console.log(chalk.green(`✅ ${file}`));
      moduleResult.checks.push({
        name: file,
        status: 'pass'
      });
    } else {
      console.log(chalk.red(`❌ Missing: ${file}`));
      moduleResult.checks.push({
        name: file,
        status: 'fail',
        details: 'Required optimization module not found'
      });
      allChecks = false;
    }
  }
  
  results.push(moduleResult);
  
  // Check 5: TypeScript Compilation
  console.log(chalk.cyan('\n📋 Checking TypeScript Compilation...'));
  const compileResult: ValidationResult = {
    category: 'TypeScript Compilation',
    checks: []
  };
  
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    console.log(chalk.green('✅ TypeScript compilation successful'));
    compileResult.checks.push({
      name: 'TypeScript Compilation',
      status: 'pass'
    });
  } catch (error) {
    console.log(chalk.red('❌ TypeScript compilation failed'));
    console.log(chalk.gray('Run: npm run typecheck for details'));
    compileResult.checks.push({
      name: 'TypeScript Compilation',
      status: 'fail',
      details: 'Compilation errors found - run npm run typecheck'
    });
    allChecks = false;
  }
  
  results.push(compileResult);
  
  // Check 6: Node.js Version
  console.log(chalk.cyan('\n📋 Checking Node.js Version...'));
  const nodeResult: ValidationResult = {
    category: 'Runtime Environment',
    checks: []
  };
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    console.log(chalk.green(`✅ Node.js version: ${nodeVersion}`));
    nodeResult.checks.push({
      name: 'Node.js Version',
      status: 'pass',
      details: nodeVersion
    });
  } else {
    console.log(chalk.red(`❌ Node.js version too old: ${nodeVersion} (requires >=18.0.0)`));
    nodeResult.checks.push({
      name: 'Node.js Version',
      status: 'fail',
      details: `${nodeVersion} - requires >= 18.0.0`
    });
    allChecks = false;
  }
  
  results.push(nodeResult);
  
  // Check 7: Dependencies
  console.log(chalk.cyan('\n📋 Checking Critical Dependencies...'));
  const depsResult: ValidationResult = {
    category: 'Dependencies',
    checks: []
  };
  
  const criticalDeps = [
    'ethers',
    '@flashbots/ethers-provider-bundle',
    'winston',
    'axios',
    'chalk'
  ];
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    for (const dep of criticalDeps) {
      if (allDeps[dep]) {
        console.log(chalk.green(`✅ ${dep} v${allDeps[dep]}`));
        depsResult.checks.push({
          name: dep,
          status: 'pass',
          details: allDeps[dep]
        });
      } else {
        console.log(chalk.red(`❌ Missing dependency: ${dep}`));
        depsResult.checks.push({
          name: dep,
          status: 'fail',
          details: 'Critical dependency not found'
        });
        allChecks = false;
      }
    }
  } catch (error) {
    console.log(chalk.red('❌ Could not read package.json'));
    depsResult.checks.push({
      name: 'package.json',
      status: 'fail',
      details: 'Cannot read package.json file'
    });
    allChecks = false;
  }
  
  results.push(depsResult);
  
  // Final Assessment
  console.log(chalk.cyan('\n📊 Production Readiness Assessment:'));
  
  // Generate detailed report
  console.log(chalk.blue('\n📋 Detailed Validation Report:'));
  for (const result of results) {
    console.log(chalk.yellow(`\n${result.category}:`));
    for (const check of result.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      const color = check.status === 'pass' ? chalk.green : check.status === 'warning' ? chalk.yellow : chalk.red;
      console.log(color(`  ${icon} ${check.name}${check.details ? ` - ${check.details}` : ''}`));
    }
  }
  
  // Summary statistics
  const totalChecks = results.reduce((sum, result) => sum + result.checks.length, 0);
  const passedChecks = results.reduce((sum, result) => 
    sum + result.checks.filter(check => check.status === 'pass').length, 0);
  const warningChecks = results.reduce((sum, result) => 
    sum + result.checks.filter(check => check.status === 'warning').length, 0);
  const failedChecks = results.reduce((sum, result) => 
    sum + result.checks.filter(check => check.status === 'fail').length, 0);
  
  console.log(chalk.blue(`\n📈 Validation Summary:`));
  console.log(chalk.green(`  ✅ Passed: ${passedChecks}/${totalChecks}`));
  console.log(chalk.yellow(`  ⚠️ Warnings: ${warningChecks}/${totalChecks}`));
  console.log(chalk.red(`  ❌ Failed: ${failedChecks}/${totalChecks}`));
  
  const successRate = (passedChecks / totalChecks) * 100;
  console.log(chalk.blue(`  📊 Success Rate: ${successRate.toFixed(1)}%`));
  
  if (allChecks && failedChecks === 0) {
    console.log(chalk.green('\n🚀 READY FOR PRODUCTION DEPLOYMENT'));
    console.log(chalk.green('All critical systems validated and operational'));
    
    if (warningChecks > 0) {
      console.log(chalk.yellow(`⚠️ Note: ${warningChecks} warning(s) detected - monitor closely`));
    }
    
    return true;
  } else {
    console.log(chalk.red('\n❌ NOT READY FOR PRODUCTION'));
    console.log(chalk.yellow('Please resolve the issues above before deployment'));
    
    if (failedChecks > 0) {
      console.log(chalk.red(`❗ Critical: ${failedChecks} failed check(s) must be fixed`));
    }
    
    return false;
  }
}

// Run validation
if (require.main === module) {
  validateProductionReadiness()
    .then(ready => {
      process.exit(ready ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Validation failed:', error));
      process.exit(1);
    });
}

export { validateProductionReadiness };