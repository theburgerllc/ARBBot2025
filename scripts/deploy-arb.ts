import { ethers } from "hardhat";
import { config } from "dotenv";
import { isAddress } from "ethers";
import * as fs from "fs";
import * as path from "path";

config();

interface DeploymentConfig {
  privateKey: string;
  rpcUrl: string;
  uniV2Router: string;
  sushiRouter: string;
  balancerVault: string;
  botContractAddress?: string;
}

function validateConfig(): DeploymentConfig {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.ARB_RPC;
  const uniV2Router = process.env.UNI_V2_ROUTER_ARB;
  const sushiRouter = process.env.SUSHI_ROUTER_ARB;
  const balancerVault = process.env.BALANCER_VAULT_ADDRESS;
  const botContractAddress = process.env.BOT_CONTRACT_ADDRESS;

  if (!privateKey || !privateKey.startsWith("0x") || privateKey.length !== 66) {
    throw new Error("PRIVATE_KEY is missing or invalid format");
  }

  if (!rpcUrl || !rpcUrl.startsWith("http")) {
    throw new Error("ARB_RPC is missing or invalid format");
  }

  if (!uniV2Router || !isAddress(uniV2Router)) {
    throw new Error("UNI_V2_ROUTER_ARB is missing or invalid checksummed address");
  }

  if (!sushiRouter || !isAddress(sushiRouter)) {
    throw new Error("SUSHI_ROUTER_ARB is missing or invalid checksummed address");
  }

  if (!balancerVault || !isAddress(balancerVault)) {
    throw new Error("BALANCER_VAULT_ADDRESS is missing or invalid checksummed address");
  }

  return {
    privateKey,
    rpcUrl,
    uniV2Router,
    sushiRouter,
    balancerVault,
    botContractAddress: botContractAddress && isAddress(botContractAddress) ? botContractAddress : undefined
  };
}

async function deployContract(config: DeploymentConfig) {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying FlashArbBotBalancer to Arbitrum...");
  console.log("Deployer address:", deployer.address);
  console.log("Network:", "arbitrum");

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  const FlashArbBotBalancer = await ethers.getContractFactory("FlashArbBotBalancer");
  const flashArbBot = await FlashArbBotBalancer.deploy(
    config.uniV2Router,
    config.sushiRouter,
    config.balancerVault
  );

  await flashArbBot.waitForDeployment();
  const contractAddress = await flashArbBot.getAddress();

  console.log("FlashArbBotBalancer deployed to:", contractAddress);

  const provider = deployer.provider;
  const deploymentBlock = await provider.getBlockNumber();
  console.log("Deployment block:", deploymentBlock);

  const code = await provider.getCode(contractAddress);
  if (code === "0x") {
    throw new Error("Contract deployment failed - no code at address");
  }

  console.log("✅ Contract verified on-chain");
  console.log("✅ Deployment successful");

  return { contractAddress, deploymentBlock };
}

function saveDeploymentData(contractAddress: string, deploymentBlock: number) {
  const deploymentDir = path.join(__dirname, "..", "deployment");
  
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentData = {
    contractAddress,
    deploymentBlock,
    network: "arbitrum",
    chainId: 42161,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(deploymentDir, "arbitrum.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    
    if (envContent.includes("BOT_CONTRACT_ADDRESS=")) {
      envContent = envContent.replace(
        /BOT_CONTRACT_ADDRESS=.*/,
        `BOT_CONTRACT_ADDRESS=${contractAddress}`
      );
    } else {
      envContent += `\nBOT_CONTRACT_ADDRESS=${contractAddress}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
  }

  console.log("📁 Deployment data saved to deployment/arbitrum.json");
  console.log("🔧 .env file updated with contract address");
}

async function main() {
  try {
    console.log("🚀 Starting Arbitrum deployment...");
    
    const deploymentConfig = validateConfig();
    console.log("✅ Configuration validated");
    
    const { contractAddress, deploymentBlock } = await deployContract(deploymentConfig);
    
    saveDeploymentData(contractAddress, deploymentBlock);
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Block Number: ${deploymentBlock}`);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}