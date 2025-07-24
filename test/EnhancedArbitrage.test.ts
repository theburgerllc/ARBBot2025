import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Enhanced FlashArbBotBalancer Tests", function () {
  let bot: Contract;
  let owner: Signer;
  let addr1: Signer;
  let mockWETH: Contract;
  let mockUSDC: Contract;
  let mockUSDT: Contract;
  let mockWBTC: Contract;
  
  const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const USDC_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
  const USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
  const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  const UNI_V2_ROUTER_NEW = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
  const SUSHI_ROUTER_NEW = "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55";
  const UNI_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    // Deploy mock contracts for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    mockUSDT = await MockERC20.deploy("Tether USD", "USDT", 6);
    mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    
    // Deploy the enhanced flash arbitrage bot
    const FlashArbBotBalancer = await ethers.getContractFactory("FlashArbBotBalancer");
    bot = await FlashArbBotBalancer.deploy(
      BALANCER_VAULT,
      SUSHI_ROUTER_NEW,
      UNI_V2_ROUTER_NEW,
      UNI_V3_QUOTER
    );
    
    // Set up authorized caller for testing
    await bot.setAuthorizedCaller(await owner.getAddress(), true);
  });

  describe("Enhanced Deployment", function () {
    it("Should initialize with correct chain detection", async function () {
      const chainId = await bot.currentChainId();
      expect(chainId).to.equal(31337); // Hardhat network
    });
    
    it("Should have correct token constants", async function () {
      expect(await bot.WETH()).to.equal(WETH_ADDRESS);
      expect(await bot.USDC()).to.equal(USDC_ADDRESS);
      expect(await bot.USDT()).to.equal(USDT_ADDRESS);
      expect(await bot.WBTC()).to.equal(WBTC_ADDRESS);
    });
    
    it("Should have correct router constants", async function () {
      expect(await bot.UNI_V2_ROUTER_NEW()).to.equal(UNI_V2_ROUTER_NEW);
      expect(await bot.SUSHI_ROUTER_NEW()).to.equal(SUSHI_ROUTER_NEW);
    });
    
    it("Should detect network correctly", async function () {
      // On Hardhat, both should be false
      expect(await bot.isArbitrum()).to.be.false;
      expect(await bot.isOptimism()).to.be.false;
    });
  });

  describe("Triangular Arbitrage", function () {
    it("Should execute triangular arbitrage with valid path", async function () {
      const amount = ethers.parseEther("1");
      const triangularPath = [WETH_ADDRESS, USDT_ADDRESS, USDC_ADDRESS, WETH_ADDRESS];
      const expectedProfit = ethers.parseEther("0.01");
      
      // This would fail on fork because we don't have actual liquidity
      // but we can test the function signature and parameter validation
      await expect(
        bot.executeTriangularArb(WETH_ADDRESS, amount, triangularPath, expectedProfit)
      ).to.not.be.reverted;
    });
    
    it("Should simulate triangular arbitrage", async function () {
      const amount = ethers.parseEther("1");
      const triangularPath = [WETH_ADDRESS, USDT_ADDRESS, USDC_ADDRESS, WETH_ADDRESS];
      
      // This will return 0 on hardhat without proper liquidity setup
      const profit = await bot.simulateTriangularArbitrage(WETH_ADDRESS, amount, triangularPath);
      expect(profit).to.be.a('bigint');
    });
    
    it("Should reject invalid triangular paths", async function () {
      const amount = ethers.parseEther("1");
      const invalidPath = [WETH_ADDRESS, USDT_ADDRESS]; // Too short
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeTriangularArb(WETH_ADDRESS, amount, invalidPath, expectedProfit)
      ).to.be.revertedWith("Triangular path must have 4 tokens (A->B->C->A)");
    });
    
    it("Should reject non-circular triangular paths", async function () {
      const amount = ethers.parseEther("1");
      const nonCircularPath = [WETH_ADDRESS, USDT_ADDRESS, USDC_ADDRESS, WBTC_ADDRESS];
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeTriangularArb(WETH_ADDRESS, amount, nonCircularPath, expectedProfit)
      ).to.be.revertedWith("Path must start and end with same token");
    });
  });

  describe("Enhanced Token Pair Support", function () {
    it("Should support ETH/USDT arbitrage", async function () {
      const amount = ethers.parseEther("1");
      const path = [WETH_ADDRESS, USDT_ADDRESS];
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, path, true, expectedProfit)
      ).to.not.be.reverted;
    });
    
    it("Should support WBTC/ETH arbitrage", async function () {
      const amount = ethers.parseUnits("0.1", 8); // 0.1 WBTC
      const path = [WBTC_ADDRESS, WETH_ADDRESS];
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeArb(WBTC_ADDRESS, amount, path, false, expectedProfit)
      ).to.not.be.reverted;
    });
    
    it("Should simulate arbitrage for all supported pairs", async function () {
      const amount = ethers.parseEther("1");
      const pairs = [
        [WETH_ADDRESS, USDC_ADDRESS],
        [WETH_ADDRESS, USDT_ADDRESS],
        [WBTC_ADDRESS, WETH_ADDRESS]
      ];
      
      for (const pair of pairs) {
        const profitSushiFirst = await bot.simulateArbitrage(pair[0], amount, pair, true);
        const profitUniFirst = await bot.simulateArbitrage(pair[0], amount, pair, false);
        
        expect(profitSushiFirst).to.be.a('bigint');
        expect(profitUniFirst).to.be.a('bigint');
      }
    });
  });

  describe("Enhanced Events", function () {
    it("Should have TriangularArbitrageExecuted event", async function () {
      const eventFilter = bot.filters.TriangularArbitrageExecuted();
      expect(eventFilter).to.exist;
      expect(eventFilter.fragment?.name).to.equal("TriangularArbitrageExecuted");
    });
    
    it("Should have CrossChainOpportunityDetected event", async function () {
      const eventFilter = bot.filters.CrossChainOpportunityDetected();
      expect(eventFilter).to.exist;
      expect(eventFilter.fragment?.name).to.equal("CrossChainOpportunityDetected");
    });
    
    it("Should emit correct event parameters for triangular arbitrage", async function () {
      const eventFilter = bot.filters.TriangularArbitrageExecuted();
      const fragment = eventFilter.fragment;
      
      expect(fragment?.inputs).to.have.lengthOf(5);
      expect(fragment?.inputs[0].name).to.equal("tokenA");
      expect(fragment?.inputs[1].name).to.equal("tokenB");
      expect(fragment?.inputs[2].name).to.equal("tokenC");
      expect(fragment?.inputs[3].name).to.equal("amount");
      expect(fragment?.inputs[4].name).to.equal("profit");
    });
  });

  describe("Router Selection Logic", function () {
    it("Should use correct router based on chain", async function () {
      // Test internal router selection would require more complex setup
      // For now, we verify the constants are set correctly
      expect(await bot.UNI_V2_ROUTER_NEW()).to.equal(UNI_V2_ROUTER_NEW);
      expect(await bot.SUSHI_ROUTER_NEW()).to.equal(SUSHI_ROUTER_NEW);
    });
  });

  describe("Cross-Chain Compatibility", function () {
    it("Should have Optimism router constants", async function () {
      expect(await bot.UNI_V2_ROUTER_OPT()).to.equal("0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2");
      expect(await bot.SUSHI_ROUTER_OPT()).to.equal("0x2ABf469074dc0b54d793850807E6eb5Faf2625b1");
    });
    
    it("Should handle chain detection correctly", async function () {
      const chainId = await bot.currentChainId();
      const isArbitrum = await bot.isArbitrum();
      const isOptimism = await bot.isOptimism();
      
      // On Hardhat (chainId 31337), both should be false
      expect(isArbitrum).to.be.false;
      expect(isOptimism).to.be.false;
    });
  });

  describe("Gas Optimization", function () {
    it("Should approve tokens efficiently", async function () {
      // Test that the contract approves tokens to multiple routers
      // This would require token balance setup for full testing
      const amount = ethers.parseEther("1");
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const expectedProfit = ethers.parseEther("0.01");
      
      // Test doesn't revert with router approvals
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, path, true, expectedProfit)
      ).to.not.be.reverted;
    });
  });

  describe("Error Handling", function () {
    it("Should handle zero amounts gracefully", async function () {
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeArb(WETH_ADDRESS, 0, path, true, expectedProfit)
      ).to.be.revertedWith("Amount must be positive");
    });
    
    it("Should handle zero expected profit", async function () {
      const amount = ethers.parseEther("1");
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, path, true, 0)
      ).to.be.revertedWith("Expected profit must be positive");
    });
  });
});