"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const networkConfigs = {
    arbitrum: {
        balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        sushiRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        uniswapV2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
        uniswapV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        usdc: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        chainId: 42161
    },
    optimism: {
        balancerVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        sushiRouter: "0x4C5D5234f232BD2D76B96aA33F5AE4FCF0E4BFaB",
        uniswapV2Router: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
        uniswapV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        weth: "0x4200000000000000000000000000000000000006",
        usdc: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        chainId: 10
    }
};
async function main() {
    const hre = require("hardhat");
    const network = hre.network.name;
    console.log(`\n🚀 Deploying FlashArbBotBalancer to ${network}...`);
    if (!networkConfigs[network]) {
        throw new Error(`Network ${network} not supported. Use 'arbitrum' or 'optimism'`);
    }
    const config = networkConfigs[network];
    const [deployer] = await hre.ethers.getSigners();
    console.log(`📝 Deploying with account: ${deployer.address}`);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} ETH`);
    // Verify network
    const networkData = await hre.ethers.provider.getNetwork();
    if (Number(networkData.chainId) !== config.chainId) {
        throw new Error(`Network mismatch! Expected chain ID ${config.chainId}, got ${networkData.chainId}`);
    }
    console.log(`\n🔧 Network Configuration:`);
    console.log(`   Chain ID: ${config.chainId}`);
    console.log(`   Balancer Vault: ${config.balancerVault}`);
    console.log(`   Sushi Router: ${config.sushiRouter}`);
    console.log(`   Uniswap V2 Router: ${config.uniswapV2Router}`);
    console.log(`   Uniswap V3 Quoter: ${config.uniswapV3Quoter}`);
    console.log(`   WETH: ${config.weth}`);
    console.log(`   USDC: ${config.usdc}`);
    // Verify contracts exist
    console.log(`\n🔍 Verifying contract addresses...`);
    const contracts = [
        { name: "Balancer Vault", address: config.balancerVault },
        { name: "Sushi Router", address: config.sushiRouter },
        { name: "Uniswap V2 Router", address: config.uniswapV2Router },
        { name: "Uniswap V3 Quoter", address: config.uniswapV3Quoter },
        { name: "WETH", address: config.weth },
        { name: "USDC", address: config.usdc }
    ];
    for (const contract of contracts) {
        const code = await hre.ethers.provider.getCode(contract.address);
        if (code === "0x") {
            throw new Error(`Contract ${contract.name} not found at ${contract.address}`);
        }
        console.log(`   ✅ ${contract.name}: ${contract.address}`);
    }
    // Deploy the flash arbitrage bot
    console.log(`\n📦 Deploying FlashArbBotBalancer...`);
    const Factory = await hre.ethers.getContractFactory("FlashArbBotBalancer");
    const bot = await Factory.deploy(config.balancerVault, config.sushiRouter, config.uniswapV2Router, config.uniswapV3Quoter);
    console.log(`⏳ Waiting for deployment confirmation...`);
    await bot.waitForDeployment();
    const botAddress = await bot.getAddress();
    console.log(`\n✅ FlashArbBotBalancer deployed successfully!`);
    console.log(`📍 Contract Address: ${botAddress}`);
    // Verify deployment
    console.log(`\n🔍 Verifying deployment...`);
    const owner = await bot.owner();
    const vault = await bot.vault();
    const sushiRouter = await bot.sushiRouter();
    const uniRouter = await bot.uniRouter();
    const uniV3Quoter = await bot.uniV3Quoter();
    console.log(`   Owner: ${owner}`);
    console.log(`   Vault: ${vault}`);
    console.log(`   Sushi Router: ${sushiRouter}`);
    console.log(`   Uni Router: ${uniRouter}`);
    console.log(`   Uni V3 Quoter: ${uniV3Quoter}`);
    // Test basic functionality
    console.log(`\n🧪 Testing basic functionality...`);
    try {
        const slippageTolerance = await bot.slippageTolerance();
        const minProfitBps = await bot.minProfitBps();
        console.log(`   ✅ Slippage Tolerance: ${slippageTolerance} (${Number(slippageTolerance) / 100}%)`);
        console.log(`   ✅ Min Profit BPS: ${minProfitBps} (${Number(minProfitBps) / 100}%)`);
        // Test simulation
        const path = [config.weth, config.usdc];
        const amount = hre.ethers.parseEther("1");
        const profit = await bot.simulateArbitrage(config.weth, amount, path, true);
        console.log(`   ✅ Simulation test: ${hre.ethers.formatEther(profit)} ETH profit`);
    }
    catch (error) {
        console.log(`   ⚠️  Basic functionality test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Save deployment info
    const deploymentInfo = {
        network: network,
        chainId: config.chainId,
        contractAddress: botAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        config: config,
        transactionHash: bot.deploymentTransaction()?.hash
    };
    console.log(`\n📄 Deployment Summary:`);
    console.log(JSON.stringify(deploymentInfo, null, 2));
    // Instructions for next steps
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Set BOT_CONTRACT_ADDRESS=${botAddress} in your .env file`);
    console.log(`   2. Authorize your bot caller: await bot.setAuthorizedCaller(address, true)`);
    console.log(`   3. Fund the bot with ETH for gas fees`);
    console.log(`   4. Run the bot: npm run bot:start`);
    console.log(`   5. Monitor logs for arbitrage opportunities`);
    // Verify on block explorer
    console.log(`\n🔍 Verify on Block Explorer:`);
    if (network === "arbitrum") {
        console.log(`   https://arbiscan.io/address/${botAddress}`);
    }
    else if (network === "optimism") {
        console.log(`   https://optimistic.etherscan.io/address/${botAddress}`);
    }
    return {
        contractAddress: botAddress,
        network: network,
        deployer: deployer.address
    };
}
main()
    .then((result) => {
    console.log(`\n🎉 Deployment completed successfully!`);
    console.log(`Contract: ${result.contractAddress}`);
    process.exit(0);
})
    .catch((error) => {
    console.error(`\n❌ Deployment failed:`, error);
    process.exit(1);
});
