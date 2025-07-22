"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = __importDefault(require("hardhat"));
const ethers_1 = require("ethers");
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
async function deployToNetwork(networkName, addresses) {
    console.log(chalk_1.default.blue(`\n🚀 Deploying to ${networkName}...`));
    const [deployer] = await hardhat_1.default.ethers.getSigners();
    console.log(chalk_1.default.green(`Deploying with account: ${deployer.address}`));
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(chalk_1.default.green(`Account balance: ${(0, ethers_1.formatEther)(balance)} ETH`));
    // Deploy the FlashArbBotBalancer contract
    const FlashArbBotBalancer = await hardhat_1.default.ethers.getContractFactory("FlashArbBotBalancer");
    const bot = await FlashArbBotBalancer.deploy(addresses.balancerVault, addresses.sushiRouter, addresses.uniRouter, addresses.uniV3Quoter);
    await bot.waitForDeployment();
    const contractAddress = await bot.getAddress();
    console.log(chalk_1.default.green(`✅ FlashArbBotBalancer deployed to: ${contractAddress}`));
    // Verify deployment
    const owner = await bot.owner();
    const chainId = await bot.currentChainId();
    console.log(chalk_1.default.blue(`Contract owner: ${owner}`));
    console.log(chalk_1.default.blue(`Chain ID: ${chainId}`));
    // Set up authorized caller
    await bot.setAuthorizedCaller(deployer.address, true);
    console.log(chalk_1.default.green(`✅ Authorized caller set: ${deployer.address}`));
    return {
        contractAddress,
        owner,
        chainId: chainId.toString(),
        deployer: deployer.address
    };
}
async function main() {
    const networkName = (await hardhat_1.default.ethers.provider.getNetwork()).name;
    const chainId = (await hardhat_1.default.ethers.provider.getNetwork()).chainId;
    console.log(chalk_1.default.yellow(`🔗 Deploying to network: ${networkName} (Chain ID: ${chainId})`));
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
        console.log(chalk_1.default.magenta("\n📋 Arbitrum Configuration:"));
        console.log(chalk_1.default.cyan("Token Addresses:"));
        console.log(chalk_1.default.white(`  WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`));
        console.log(chalk_1.default.white(`  USDC: 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`));
        console.log(chalk_1.default.white(`  USDT: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`));
        console.log(chalk_1.default.white(`  WBTC: 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f`));
    }
    else if (chainId === 10n) {
        // Optimism
        addresses = {
            balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
            sushiRouter: "0x2ABf469074dc0b54d793850807E6eb5Faf2625b1",
            uniRouter: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
            uniV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
        };
        deploymentInfo = await deployToNetwork("Optimism", addresses);
        console.log(chalk_1.default.magenta("\n📋 Optimism Configuration:"));
        console.log(chalk_1.default.cyan("Token Addresses:"));
        console.log(chalk_1.default.white(`  WETH: 0x4200000000000000000000000000000000000006`));
        console.log(chalk_1.default.white(`  USDC: 0x7F5c764cBc14f9669B88837ca1490cCa17c31607`));
        console.log(chalk_1.default.white(`  USDT: 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58`));
        console.log(chalk_1.default.white(`  WBTC: 0x68f180fcCe6836688e9084f035309E29Bf0A2095`));
    }
    else if (chainId === 421614n) {
        // Arbitrum Sepolia
        addresses = {
            balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Same on all networks
            sushiRouter: "0x0000000000000000000000000000000000000000", // Not deployed on Sepolia
            uniRouter: "0x101F443B4d1b059569D643917553c771E1b9663E", // Uniswap V2 Router on Sepolia
            uniV3Quoter: "0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B" // Uniswap V3 Quoter on Sepolia
        };
        deploymentInfo = await deployToNetwork("Arbitrum Sepolia", addresses);
        console.log(chalk_1.default.magenta("\n📋 Arbitrum Sepolia Configuration:"));
        console.log(chalk_1.default.yellow("⚠️  This is a TESTNET deployment"));
        console.log(chalk_1.default.cyan("Token Addresses:"));
        console.log(chalk_1.default.white(`  WETH: 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73`));
        console.log(chalk_1.default.white(`  USDC: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`));
        console.log(chalk_1.default.gray(`  USDT: Not available on Sepolia`));
        console.log(chalk_1.default.gray(`  WBTC: Not available on Sepolia`));
    }
    else if (chainId === 11155420n) {
        // Optimism Sepolia
        addresses = {
            balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Same on all networks
            sushiRouter: "0x0000000000000000000000000000000000000000", // Not deployed on Sepolia
            uniRouter: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Uniswap V2 Router on OP Sepolia
            uniV3Quoter: "0xC195976fEF0985886E37036E2DF62bF371E12Df0" // Uniswap V3 Quoter on OP Sepolia
        };
        deploymentInfo = await deployToNetwork("Optimism Sepolia", addresses);
        console.log(chalk_1.default.magenta("\n📋 Optimism Sepolia Configuration:"));
        console.log(chalk_1.default.yellow("⚠️  This is a TESTNET deployment"));
        console.log(chalk_1.default.cyan("Token Addresses:"));
        console.log(chalk_1.default.white(`  WETH: 0x4200000000000000000000000000000000000006`));
        console.log(chalk_1.default.white(`  USDC: 0x5fd84259d66Cd46123540766Be93DFE6D43130D7`));
        console.log(chalk_1.default.gray(`  USDT: Not available on Sepolia`));
        console.log(chalk_1.default.gray(`  WBTC: Not available on Sepolia`));
    }
    else {
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
    (0, fs_1.writeFileSync)(filename, JSON.stringify(deployment, null, 2));
    console.log(chalk_1.default.green(`\n✅ Deployment complete!`));
    console.log(chalk_1.default.blue(`📄 Deployment info saved to: ${filename}`));
    console.log(chalk_1.default.yellow("\n🔧 Next steps:"));
    console.log(chalk_1.default.white("1. Update your .env file with the new contract address:"));
    if (chainId === 42161n) {
        console.log(chalk_1.default.cyan(`   BOT_CONTRACT_ADDRESS=${deploymentInfo.contractAddress}`));
    }
    else if (chainId === 10n) {
        console.log(chalk_1.default.cyan(`   OPT_BOT_CONTRACT_ADDRESS=${deploymentInfo.contractAddress}`));
    }
    else if (chainId === 421614n) {
        console.log(chalk_1.default.cyan(`   BOT_CONTRACT_ADDRESS_ARB_SEPOLIA=${deploymentInfo.contractAddress}`));
    }
    else if (chainId === 11155420n) {
        console.log(chalk_1.default.cyan(`   BOT_CONTRACT_ADDRESS_OPT_SEPOLIA=${deploymentInfo.contractAddress}`));
    }
    if (chainId === 421614n || chainId === 11155420n) {
        console.log(chalk_1.default.white("2. Get testnet ETH from faucets:"));
        if (chainId === 421614n) {
            console.log(chalk_1.default.blue("   - Arbitrum Sepolia: https://faucet.arbitrum.io/"));
        }
        else {
            console.log(chalk_1.default.blue("   - Optimism Sepolia: https://faucet.optimism.io/"));
        }
        console.log(chalk_1.default.white("3. Run the bot in testnet mode: npm run bot:testnet"));
    }
    else {
        console.log(chalk_1.default.white("2. Fund the contract with some ETH for gas"));
        console.log(chalk_1.default.white("3. Run the bot: npm run bot:start"));
    }
    console.log(chalk_1.default.magenta("\n🎯 Supported Trading Pairs:"));
    if (chainId === 421614n || chainId === 11155420n) {
        console.log(chalk_1.default.white("• ETH/USDC (Limited testnet liquidity)"));
        console.log(chalk_1.default.gray("• ETH/USDT (Not available on testnet)"));
        console.log(chalk_1.default.gray("• WBTC/ETH (Not available on testnet)"));
        console.log(chalk_1.default.gray("• Triangular arbitrage (Limited on testnet)"));
        console.log(chalk_1.default.yellow("\n⚠️  Note: Testnet has limited liquidity and fewer trading pairs"));
    }
    else {
        console.log(chalk_1.default.white("• ETH/USDC"));
        console.log(chalk_1.default.white("• ETH/USDT"));
        console.log(chalk_1.default.white("• WBTC/ETH"));
        console.log(chalk_1.default.white("• Triangular: ETH → USDT → USDC → ETH"));
    }
    return deploymentInfo;
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(chalk_1.default.red("❌ Deployment failed:"), error);
    process.exit(1);
});
