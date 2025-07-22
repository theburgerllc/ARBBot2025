"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = __importDefault(require("hardhat"));
const dotenv_1 = require("dotenv");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, dotenv_1.config)();
console.log("ARB PRIVATE_KEY:", process.env.PRIVATE_KEY);
function validateConfig() {
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
    if (!uniV2Router || !(0, ethers_1.isAddress)(uniV2Router)) {
        throw new Error("UNI_V2_ROUTER_ARB is missing or invalid checksummed address");
    }
    if (!sushiRouter || !(0, ethers_1.isAddress)(sushiRouter)) {
        throw new Error("SUSHI_ROUTER_ARB is missing or invalid checksummed address");
    }
    if (!balancerVault || !(0, ethers_1.isAddress)(balancerVault)) {
        throw new Error("BALANCER_VAULT_ADDRESS is missing or invalid checksummed address");
    }
    return {
        privateKey,
        rpcUrl,
        uniV2Router,
        sushiRouter,
        balancerVault,
        botContractAddress: botContractAddress && (0, ethers_1.isAddress)(botContractAddress) ? botContractAddress : undefined
    };
}
async function deployContract(config) {
    const [deployer] = await hardhat_1.default.ethers.getSigners();
    console.log("Deploying FlashArbBotBalancer to Arbitrum...");
    console.log("Deployer address:", deployer.address);
    console.log("Network:", "arbitrum");
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer balance:", hardhat_1.default.ethers.formatEther(balance), "ETH");
    const FlashArbBotBalancer = await hardhat_1.default.ethers.getContractFactory("FlashArbBotBalancer");
    const flashArbBot = await FlashArbBotBalancer.deploy(config.balancerVault, config.sushiRouter, config.uniV2Router, process.env.UNISWAP_V3_QUOTER_ADDRESS);
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
function saveDeploymentData(contractAddress, deploymentBlock) {
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
    fs.writeFileSync(path.join(deploymentDir, "arbitrum.json"), JSON.stringify(deploymentData, null, 2));
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf8");
        if (envContent.includes("BOT_CONTRACT_ADDRESS=")) {
            envContent = envContent.replace(/BOT_CONTRACT_ADDRESS=.*/, `BOT_CONTRACT_ADDRESS=${contractAddress}`);
        }
        else {
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
    }
    catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
