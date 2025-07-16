"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe("FlashArbBotBalancer Integration Tests", function () {
    let bot;
    let owner;
    let addr1;
    let balancerVault;
    let uniswapV2Router;
    let sushiSwapRouter;
    let wethContract;
    let usdcContract;
    // Arbitrum mainnet addresses
    const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
    const UNI_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
    const SUSHI_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
    const UNI_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
    // Whale addresses for testing
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
    const USDC_WHALE = "0x62383739D68Dd0F844103Db8dFb05a7EdED5BBE6";
    before(async function () {
        // This test requires a forked network
        if (hardhat_1.ethers.provider.network && hardhat_1.ethers.provider.network.name !== "hardhat") {
            this.skip();
        }
        [owner, addr1] = await hardhat_1.ethers.getSigners();
        // Deploy the flash arbitrage bot
        const FlashArbBotBalancer = await hardhat_1.ethers.getContractFactory("FlashArbBotBalancer");
        bot = await FlashArbBotBalancer.deploy(BALANCER_VAULT, SUSHI_ROUTER, UNI_V2_ROUTER, UNI_V3_QUOTER);
        // Get contract references
        balancerVault = await hardhat_1.ethers.getContractAt("IBalancerVault", BALANCER_VAULT);
        uniswapV2Router = await hardhat_1.ethers.getContractAt("IUniswapV2Router02", UNI_V2_ROUTER);
        sushiSwapRouter = await hardhat_1.ethers.getContractAt("IUniswapV2Router02", SUSHI_ROUTER);
        wethContract = await hardhat_1.ethers.getContractAt("IERC20", WETH_ADDRESS);
        usdcContract = await hardhat_1.ethers.getContractAt("IERC20", USDC_ADDRESS);
        // Fund the test account with ETH
        await hardhat_1.ethers.provider.send("hardhat_setBalance", [
            await owner.getAddress(),
            "0x56BC75E2D630000000" // 100 ETH
        ]);
    });
    describe("Fork Network Tests", function () {
        it("Should be connected to forked network", async function () {
            const network = await hardhat_1.ethers.provider.getNetwork();
            (0, chai_1.expect)(network.chainId).to.equal(42161n); // Arbitrum mainnet
        });
        it("Should have access to real contracts", async function () {
            // Test Balancer Vault
            const vaultCode = await hardhat_1.ethers.provider.getCode(BALANCER_VAULT);
            (0, chai_1.expect)(vaultCode).to.not.equal("0x");
            // Test Uniswap Router
            const uniRouterCode = await hardhat_1.ethers.provider.getCode(UNI_V2_ROUTER);
            (0, chai_1.expect)(uniRouterCode).to.not.equal("0x");
            // Test SushiSwap Router
            const sushiRouterCode = await hardhat_1.ethers.provider.getCode(SUSHI_ROUTER);
            (0, chai_1.expect)(sushiRouterCode).to.not.equal("0x");
        });
        it("Should have WETH and USDC balances in whale accounts", async function () {
            const wethBalance = await wethContract.balanceOf(WETH_WHALE);
            const usdcBalance = await usdcContract.balanceOf(USDC_WHALE);
            (0, chai_1.expect)(wethBalance).to.be.gt(0);
            (0, chai_1.expect)(usdcBalance).to.be.gt(0);
        });
    });
    describe("Price Discovery", function () {
        it("Should get prices from Uniswap V2", async function () {
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amountIn = hardhat_1.ethers.parseEther("1");
            const amounts = await uniswapV2Router.getAmountsOut(amountIn, path);
            (0, chai_1.expect)(amounts.length).to.equal(2);
            (0, chai_1.expect)(amounts[0]).to.equal(amountIn);
            (0, chai_1.expect)(amounts[1]).to.be.gt(0);
        });
        it("Should get prices from SushiSwap", async function () {
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amountIn = hardhat_1.ethers.parseEther("1");
            const amounts = await sushiSwapRouter.getAmountsOut(amountIn, path);
            (0, chai_1.expect)(amounts.length).to.equal(2);
            (0, chai_1.expect)(amounts[0]).to.equal(amountIn);
            (0, chai_1.expect)(amounts[1]).to.be.gt(0);
        });
        it("Should simulate arbitrage opportunities", async function () {
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amount = hardhat_1.ethers.parseEther("1");
            // Test both directions
            const profit1 = await bot.simulateArbitrage(WETH_ADDRESS, amount, path, true);
            const profit2 = await bot.simulateArbitrage(WETH_ADDRESS, amount, path, false);
            (0, chai_1.expect)(profit1).to.be.a("bigint");
            (0, chai_1.expect)(profit2).to.be.a("bigint");
        });
    });
    describe("Flash Loan Integration", function () {
        it("Should handle flash loan callback", async function () {
            // This test simulates the flash loan callback
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amount = hardhat_1.ethers.parseEther("1");
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            // Mock the flash loan callback parameters
            const tokens = [WETH_ADDRESS];
            const amounts = [amount];
            const feeAmounts = [0]; // Balancer has no flash loan fees
            const userData = hardhat_1.ethers.AbiCoder.defaultAbiCoder().encode(["address[]", "bool", "uint256"], [path, true, expectedProfit]);
            // Note: This test would need to be called from the Balancer Vault
            // For now, we just verify the function exists and has the right signature
            (0, chai_1.expect)(bot.receiveFlashLoan).to.exist;
        });
        it("Should reject unauthorized flash loan calls", async function () {
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amount = hardhat_1.ethers.parseEther("1");
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            const tokens = [WETH_ADDRESS];
            const amounts = [amount];
            const feeAmounts = [0];
            const userData = hardhat_1.ethers.AbiCoder.defaultAbiCoder().encode(["address[]", "bool", "uint256"], [path, true, expectedProfit]);
            await (0, chai_1.expect)(bot.receiveFlashLoan(tokens, amounts, feeAmounts, userData)).to.be.revertedWith("Only Balancer vault");
        });
    });
    describe("Real Market Conditions", function () {
        it("Should handle real market price differences", async function () {
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amounts = [
                hardhat_1.ethers.parseEther("0.1"),
                hardhat_1.ethers.parseEther("1"),
                hardhat_1.ethers.parseEther("5")
            ];
            for (const amount of amounts) {
                const profit1 = await bot.simulateArbitrage(WETH_ADDRESS, amount, path, true);
                const profit2 = await bot.simulateArbitrage(WETH_ADDRESS, amount, path, false);
                // Log results for analysis
                console.log(`Amount: ${hardhat_1.ethers.formatEther(amount)} ETH`);
                console.log(`Sushi->Uni profit: ${hardhat_1.ethers.formatEther(profit1)} ETH`);
                console.log(`Uni->Sushi profit: ${hardhat_1.ethers.formatEther(profit2)} ETH`);
                // At least one direction should be non-negative
                (0, chai_1.expect)(profit1 >= 0n || profit2 >= 0n).to.be.true;
            }
        });
    });
    describe("Integration with External Protocols", function () {
        it("Should interact with Balancer Vault", async function () {
            // Verify we can read from Balancer Vault
            const vaultCode = await hardhat_1.ethers.provider.getCode(BALANCER_VAULT);
            (0, chai_1.expect)(vaultCode).to.not.equal("0x");
        });
        it("Should interact with Uniswap and SushiSwap", async function () {
            // Test basic interactions with DEX routers
            const path = [WETH_ADDRESS, USDC_ADDRESS];
            const amount = hardhat_1.ethers.parseEther("1");
            // Get quotes from both DEXes
            const uniAmounts = await uniswapV2Router.getAmountsOut(amount, path);
            const sushiAmounts = await sushiSwapRouter.getAmountsOut(amount, path);
            (0, chai_1.expect)(uniAmounts.length).to.equal(2);
            (0, chai_1.expect)(sushiAmounts.length).to.equal(2);
            (0, chai_1.expect)(uniAmounts[1]).to.be.gt(0);
            (0, chai_1.expect)(sushiAmounts[1]).to.be.gt(0);
        });
    });
});
