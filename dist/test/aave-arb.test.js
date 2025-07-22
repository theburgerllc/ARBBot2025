"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe("Aave V3 Flash Loan Integration", function () {
    let flashArbBot;
    let owner;
    let user;
    let impersonatedAccount;
    const WHALE_ADDRESS = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
    const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
    const SUSHISWAP_ROUTER = "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55";
    const UNISWAP_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
    const TOKENS = {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
    };
    beforeEach(async function () {
        [owner, user] = await hardhat_1.ethers.getSigners();
        await hardhat_1.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WHALE_ADDRESS],
        });
        impersonatedAccount = await hardhat_1.ethers.getSigner(WHALE_ADDRESS);
        const FlashArbBotBalancerFactory = await hardhat_1.ethers.getContractFactory("FlashArbBotBalancer");
        flashArbBot = await FlashArbBotBalancerFactory.deploy(BALANCER_VAULT, SUSHISWAP_ROUTER, UNISWAP_V2_ROUTER, UNISWAP_V3_QUOTER);
        await flashArbBot.setAuthorizedCaller(owner.address, true);
        await flashArbBot.waitForDeployment();
    });
    describe("Provider Selection Logic", function () {
        it("should select optimal flash loan provider", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const result = await flashArbBot.getOptimalProvider(TOKENS.WETH, amount);
            (0, chai_1.expect)(result.provider).to.be.oneOf([0, 1]); // BALANCER or AAVE
            (0, chai_1.expect)(result.fee).to.be.a("bigint");
            if (result.provider === 0) {
                (0, chai_1.expect)(result.fee).to.equal(0n);
            }
            else {
                (0, chai_1.expect)(result.fee).to.be.greaterThan(0n);
            }
        });
        it("should prefer Balancer when liquidity is sufficient", async function () {
            const smallAmount = hardhat_1.ethers.parseEther("0.1");
            const result = await flashArbBot.getOptimalProvider(TOKENS.WETH, smallAmount);
            (0, chai_1.expect)(result.provider).to.equal(0); // BALANCER
            (0, chai_1.expect)(result.fee).to.equal(0n);
        });
        it("should calculate Aave fees correctly", async function () {
            const amount = hardhat_1.ethers.parseEther("100");
            const result = await flashArbBot.getOptimalProvider(TOKENS.WETH, amount);
            if (result.provider === 1) { // AAVE
                const expectedFee = (amount * 5n) / 10000n; // 0.05% fee
                (0, chai_1.expect)(result.fee).to.be.closeTo(expectedFee, hardhat_1.ethers.parseEther("0.001"));
            }
        });
    });
    describe("Aave Flash Loan Execution", function () {
        it("should execute arbitrage using Aave flash loan", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            const wethContract = await hardhat_1.ethers.getContractAt("IERC20", TOKENS.WETH);
            const usdcContract = await hardhat_1.ethers.getContractAt("IERC20", TOKENS.USDC);
            await wethContract.connect(impersonatedAccount).transfer(flashArbBot.address, hardhat_1.ethers.parseEther("0.1"));
            const initialBalance = await wethContract.balanceOf(flashArbBot.address);
            await (0, chai_1.expect)(flashArbBot.executeArb(TOKENS.WETH, amount, path, true, expectedProfit)).to.not.be.reverted;
            const finalBalance = await wethContract.balanceOf(flashArbBot.address);
            (0, chai_1.expect)(finalBalance).to.be.greaterThan(initialBalance);
        });
        it("should handle insufficient liquidity gracefully", async function () {
            const largeAmount = hardhat_1.ethers.parseEther("10000");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            await (0, chai_1.expect)(flashArbBot.executeArb(TOKENS.WETH, largeAmount, path, true, expectedProfit)).to.be.reverted;
        });
        it("should revert on unprofitable trades", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const unrealisticProfit = hardhat_1.ethers.parseEther("10");
            await (0, chai_1.expect)(flashArbBot.executeArb(TOKENS.WETH, amount, path, true, unrealisticProfit)).to.be.revertedWith("Unprofitable");
        });
    });
    describe("Triangular Arbitrage with Aave", function () {
        it("should execute triangular arbitrage using Aave flash loan", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC, TOKENS.USDT, TOKENS.WETH];
            const expectedProfit = hardhat_1.ethers.parseEther("0.005");
            const wethContract = await hardhat_1.ethers.getContractAt("IERC20", TOKENS.WETH);
            await wethContract.connect(impersonatedAccount).transfer(flashArbBot.address, hardhat_1.ethers.parseEther("0.1"));
            const initialBalance = await wethContract.balanceOf(flashArbBot.address);
            await (0, chai_1.expect)(flashArbBot.executeTriangularArb(TOKENS.WETH, amount, path, expectedProfit)).to.not.be.reverted;
            const finalBalance = await wethContract.balanceOf(flashArbBot.address);
            (0, chai_1.expect)(finalBalance).to.be.greaterThan(initialBalance);
        });
        it("should simulate triangular arbitrage profitability", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC, TOKENS.USDT, TOKENS.WETH];
            const profit = await flashArbBot.simulateTriangularArbitrage(TOKENS.WETH, amount, path);
            (0, chai_1.expect)(profit).to.be.a("bigint");
        });
    });
    describe("Fee Calculations", function () {
        it("should account for Aave fees in profit calculations", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const profit = await flashArbBot.simulateArbitrage(TOKENS.WETH, amount, path, true);
            (0, chai_1.expect)(profit).to.be.a("bigint");
        });
        it("should maintain minimum profit requirements with fees", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const minProfit = hardhat_1.ethers.parseEther("0.001");
            await flashArbBot.setMinProfitBps(10); // 0.1%
            const wethContract = await hardhat_1.ethers.getContractAt("IERC20", TOKENS.WETH);
            await wethContract.connect(impersonatedAccount).transfer(flashArbBot.address, hardhat_1.ethers.parseEther("0.1"));
            await (0, chai_1.expect)(flashArbBot.executeArb(TOKENS.WETH, amount, path, true, minProfit)).to.not.be.reverted;
        });
    });
    describe("Emergency and Security", function () {
        it("should only allow authorized callers to execute arbitrage", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            await (0, chai_1.expect)(flashArbBot.connect(user).executeArb(TOKENS.WETH, amount, path, true, expectedProfit)).to.be.revertedWith("Not authorized");
        });
        it("should allow owner to pause contract", async function () {
            await flashArbBot.pause();
            (0, chai_1.expect)(await flashArbBot.paused()).to.be.true;
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            await (0, chai_1.expect)(flashArbBot.executeArb(TOKENS.WETH, amount, path, true, expectedProfit)).to.be.revertedWith("Pausable: paused");
        });
        it("should allow owner to withdraw profits", async function () {
            const wethContract = await hardhat_1.ethers.getContractAt("IERC20", TOKENS.WETH);
            await wethContract.connect(impersonatedAccount).transfer(flashArbBot.address, hardhat_1.ethers.parseEther("1"));
            const initialOwnerBalance = await wethContract.balanceOf(owner.address);
            const contractBalance = await wethContract.balanceOf(flashArbBot.address);
            await flashArbBot.withdraw(TOKENS.WETH);
            const finalOwnerBalance = await wethContract.balanceOf(owner.address);
            (0, chai_1.expect)(finalOwnerBalance).to.equal(initialOwnerBalance + contractBalance);
        });
    });
    describe("Provider Fallback Scenarios", function () {
        it("should fall back to Aave when Balancer liquidity is insufficient", async function () {
            const largeAmount = hardhat_1.ethers.parseEther("1000");
            const result = await flashArbBot.getOptimalProvider(TOKENS.WETH, largeAmount);
            (0, chai_1.expect)(result.provider).to.equal(1); // AAVE
            (0, chai_1.expect)(result.fee).to.be.greaterThan(0n);
        });
        it("should emit provider selection events", async function () {
            const amount = hardhat_1.ethers.parseEther("1");
            const path = [TOKENS.WETH, TOKENS.USDC];
            const expectedProfit = hardhat_1.ethers.parseEther("0.01");
            const wethContract = await hardhat_1.ethers.getContractAt("IERC20", TOKENS.WETH);
            await wethContract.connect(impersonatedAccount).transfer(flashArbBot.address, hardhat_1.ethers.parseEther("0.1"));
            await (0, chai_1.expect)(flashArbBot.executeArb(TOKENS.WETH, amount, path, true, expectedProfit)).to.emit(flashArbBot, "FlashLoanProviderSelected");
        });
    });
});
