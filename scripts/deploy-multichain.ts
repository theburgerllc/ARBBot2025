import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import chalk from "chalk";

async function deployToNetwork(networkName: string, addresses: any) {
  console.log(chalk.blue(`\n🚀 Deploying to ${networkName}...`));
  
  const [deployer] = await ethers.getSigners();
  
  console.log(chalk.green(`Deploying with account: ${deployer.address}`));
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(chalk.green(`Account balance: ${ethers.formatEther(balance)} ETH`));
  
  // Deploy the FlashArbBotBalancer contract
  const FlashArbBotBalancer = await ethers.getContractFactory("FlashArbBotBalancer");
  
  const bot = await FlashArbBotBalancer.deploy(
    addresses.balancerVault,
    addresses.sushiRouter,
    addresses.uniRouter,
    addresses.uniV3Quoter
  );
  
  await bot.waitForDeployment();
  
  const contractAddress = await bot.getAddress();
  console.log(chalk.green(`✅ FlashArbBotBalancer deployed to: ${contractAddress}`));
  
  // Verify deployment
  const owner = await bot.owner();
  const chainId = await bot.currentChainId();
  console.log(chalk.blue(`Contract owner: ${owner}`));
  console.log(chalk.blue(`Chain ID: ${chainId}`));
  
  // Set up authorized caller
  await bot.setAuthorizedCaller(deployer.address, true);
  console.log(chalk.green(`✅ Authorized caller set: ${deployer.address}`));
  
  return {
    contractAddress,
    owner,
    chainId: chainId.toString(),
    deployer: deployer.address
  };
}

async function main() {
  const networkName = (await ethers.provider.getNetwork()).name;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  
  console.log(chalk.yellow(`🔗 Deploying to network: ${networkName} (Chain ID: ${chainId})`));
  
  let addresses;
  let deploymentInfo;
  
  if (chainId === 42161n) {
    // Arbitrum One
    addresses = {
      balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      sushiRouter: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
      uniRouter: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
      uniV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
    };
    
    deploymentInfo = await deployToNetwork("Arbitrum One", addresses);
    
    console.log(chalk.magenta("\n📋 Arbitrum Configuration:"));
    console.log(chalk.cyan("Token Addresses:"));
    console.log(chalk.white(`  WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`));
    console.log(chalk.white(`  USDC: 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`));
    console.log(chalk.white(`  USDT: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`));
    console.log(chalk.white(`  WBTC: 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f`));
    
  } else if (chainId === 10n) {
    // Optimism
    addresses = {
      balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      sushiRouter: "0x2ABf469074dc0b54d793850807E6eb5Faf2625b1",
      uniRouter: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
      uniV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
    };
    
    deploymentInfo = await deployToNetwork("Optimism", addresses);
    
    console.log(chalk.magenta("\n📋 Optimism Configuration:"));
    console.log(chalk.cyan("Token Addresses:"));
    console.log(chalk.white(`  WETH: 0x4200000000000000000000000000000000000006`));
    console.log(chalk.white(`  USDC: 0x7F5c764cBc14f9669B88837ca1490cCa17c31607`));
    console.log(chalk.white(`  USDT: 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58`));
    console.log(chalk.white(`  WBTC: 0x68f180fcCe6836688e9084f035309E29Bf0A2095`));
    
  } else {
    // Local/other network
    addresses = {
      balancerVault: process.env.BALANCER_VAULT_ADDRESS || "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      sushiRouter: process.env.SUSHI_ROUTER_ADDRESS || "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
      uniRouter: process.env.UNISWAP_V2_ROUTER_ADDRESS || "0x4752ba5DBc23f44D87826276BF6Fd6b1C372ad24",
      uniV3Quoter: process.env.UNISWAP_V3_QUOTER_ADDRESS || "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
    };
    
    deploymentInfo = await deployToNetwork("Local/Custom", addresses);
  }
  
  // Save deployment info
  const deployment = {
    network: networkName,
    chainId: deploymentInfo.chainId,
    timestamp: new Date().toISOString(),
    contractAddress: deploymentInfo.contractAddress,
    owner: deploymentInfo.owner,
    deployer: deploymentInfo.deployer,
    addresses: addresses
  };
  
  const filename = `deployment-${networkName}-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(deployment, null, 2));
  
  console.log(chalk.green(`\n✅ Deployment complete!`));
  console.log(chalk.blue(`📄 Deployment info saved to: ${filename}`));
  
  console.log(chalk.yellow("\n🔧 Next steps:"));
  console.log(chalk.white("1. Update your .env file with the new contract address:"));
  console.log(chalk.cyan(`   BOT_CONTRACT_ADDRESS=${deploymentInfo.contractAddress}`));
  
  if (chainId === 10n) {
    console.log(chalk.cyan(`   OPT_BOT_CONTRACT_ADDRESS=${deploymentInfo.contractAddress}`));
  }
  
  console.log(chalk.white("2. Fund the contract with some ETH for gas"));
  console.log(chalk.white("3. Run the bot: npm run bot:start"));
  
  console.log(chalk.magenta("\n🎯 Supported Trading Pairs:"));
  console.log(chalk.white("• ETH/USDC"));
  console.log(chalk.white("• ETH/USDT"));
  console.log(chalk.white("• WBTC/ETH"));
  console.log(chalk.white("• Triangular: ETH → USDT → USDC → ETH"));
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("❌ Deployment failed:"), error);
    process.exit(1);
  });