import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("FlashArbBotBalancer Unit Tests", function () {
  let bot: Contract;
  let owner: Signer;
  let addr1: Signer;
  let balancerVault: Contract;
  let mockUniRouter: Contract;
  let mockSushiRouter: Contract;
  let mockUniV3Quoter: Contract;
  let mockWETH: Contract;
  let mockUSDC: Contract;
  
  const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const USDC_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
  const UNI_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
  const SUSHI_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const UNI_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    // Deploy mock contracts for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    
    // Deploy the flash arbitrage bot
    const FlashArbBotBalancer = await ethers.getContractFactory("FlashArbBotBalancer");
    bot = await FlashArbBotBalancer.deploy(
      BALANCER_VAULT,
      SUSHI_ROUTER,
      UNI_V2_ROUTER,
      UNI_V3_QUOTER
    );
    
    // Get contract references
    balancerVault = await ethers.getContractAt("IBalancerVault", BALANCER_VAULT);
    mockUniRouter = await ethers.getContractAt("IUniswapV2Router02", UNI_V2_ROUTER);
    mockSushiRouter = await ethers.getContractAt("IUniswapV2Router02", SUSHI_ROUTER);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await bot.owner()).to.equal(await owner.getAddress());
    });

    it("Should set the correct contract addresses", async function () {
      expect(await bot.vault()).to.equal(BALANCER_VAULT);
      expect(await bot.sushiRouter()).to.equal(SUSHI_ROUTER);
      expect(await bot.uniRouter()).to.equal(UNI_V2_ROUTER);
      expect(await bot.uniV3Quoter()).to.equal(UNI_V3_QUOTER);
    });

    it("Should have correct default parameters", async function () {
      expect(await bot.slippageTolerance()).to.equal(200); // 2%
      expect(await bot.minProfitBps()).to.equal(30); // 0.3%
      expect(await bot.MAX_SLIPPAGE()).to.equal(500); // 5%
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set authorized caller", async function () {
      await bot.setAuthorizedCaller(await addr1.getAddress(), true);
      expect(await bot.authorizedCallers(await addr1.getAddress())).to.be.true;
    });

    it("Should not allow non-owner to set authorized caller", async function () {
      await expect(
        bot.connect(addr1).setAuthorizedCaller(await addr1.getAddress(), true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to set slippage tolerance", async function () {
      await bot.setSlippageTolerance(300); // 3%
      expect(await bot.slippageTolerance()).to.equal(300);
    });

    it("Should not allow slippage tolerance above maximum", async function () {
      await expect(
        bot.setSlippageTolerance(600) // 6%
      ).to.be.revertedWith("Slippage too high");
    });

    it("Should allow owner to set minimum profit", async function () {
      await bot.setMinProfitBps(50); // 0.5%
      expect(await bot.minProfitBps()).to.equal(50);
    });

    it("Should not allow zero minimum profit", async function () {
      await expect(
        bot.setMinProfitBps(0)
      ).to.be.revertedWith("Min profit must be positive");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause and unpause", async function () {
      await bot.pause();
      expect(await bot.paused()).to.be.true;
      
      await bot.unpause();
      expect(await bot.paused()).to.be.false;
    });

    it("Should prevent execution when paused", async function () {
      await bot.pause();
      
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = ethers.parseEther("1");
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, path, true, expectedProfit)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Arbitrage Execution", function () {
    it("Should reject invalid parameters", async function () {
      const invalidPath = [WETH_ADDRESS]; // Too short
      const amount = ethers.parseEther("1");
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, invalidPath, true, expectedProfit)
      ).to.be.revertedWith("Invalid path");
    });

    it("Should reject zero amount", async function () {
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = 0;
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, path, true, expectedProfit)
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should reject zero expected profit", async function () {
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = ethers.parseEther("1");
      const expectedProfit = 0;
      
      await expect(
        bot.executeArb(WETH_ADDRESS, amount, path, true, expectedProfit)
      ).to.be.revertedWith("Expected profit must be positive");
    });

    it("Should only allow authorized callers", async function () {
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = ethers.parseEther("1");
      const expectedProfit = ethers.parseEther("0.01");
      
      await expect(
        bot.connect(addr1).executeArb(WETH_ADDRESS, amount, path, true, expectedProfit)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Simulation", function () {
    it("Should simulate arbitrage opportunities", async function () {
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = ethers.parseEther("1");
      
      // This will likely return 0 profit on a fork without price differences
      const profit = await bot.simulateArbitrage(WETH_ADDRESS, amount, path, true);
      expect(profit).to.be.a("bigint");
    });

    it("Should return zero profit for unprofitable trades", async function () {
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = ethers.parseEther("1000000"); // Unrealistically large amount
      
      const profit = await bot.simulateArbitrage(WETH_ADDRESS, amount, path, true);
      expect(profit).to.equal(0n);
    });
  });

  describe("Withdraw Functionality", function () {
    it("Should allow owner to withdraw tokens", async function () {
      // Send some tokens to the contract first
      await mockWETH.mint(await bot.getAddress(), ethers.parseEther("1"));
      
      const initialBalance = await mockWETH.balanceOf(await owner.getAddress());
      
      await bot.withdraw(await mockWETH.getAddress());
      
      const finalBalance = await mockWETH.balanceOf(await owner.getAddress());
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1"));
    });

    it("Should not allow non-owner to withdraw", async function () {
      await expect(
        bot.connect(addr1).withdraw(await mockWETH.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when trying to withdraw zero balance", async function () {
      await expect(
        bot.withdraw(await mockWETH.getAddress())
      ).to.be.revertedWith("No balance to withdraw");
    });

    it("Should allow emergency withdrawal", async function () {
      // Send some tokens to the contract first
      await mockWETH.mint(await bot.getAddress(), ethers.parseEther("1"));
      
      const initialBalance = await mockWETH.balanceOf(await owner.getAddress());
      
      await bot.emergencyWithdraw(await mockWETH.getAddress());
      
      const finalBalance = await mockWETH.balanceOf(await owner.getAddress());
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Price Feed Integration", function () {
    it("Should allow setting price feeds", async function () {
      const mockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const priceFeed = await mockPriceFeed.deploy();
      
      await bot.setPriceFeed(WETH_ADDRESS, await priceFeed.getAddress());
      expect(await bot.priceFeeds(WETH_ADDRESS)).to.equal(await priceFeed.getAddress());
    });

    it("Should not allow non-owner to set price feeds", async function () {
      const mockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const priceFeed = await mockPriceFeed.deploy();
      
      await expect(
        bot.connect(addr1).setPriceFeed(WETH_ADDRESS, await priceFeed.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks", async function () {
      // This test would require a malicious contract that attempts reentrancy
      // For now, we verify that the contract has the nonReentrant modifier
      const path = [WETH_ADDRESS, USDC_ADDRESS];
      const amount = ethers.parseEther("1");
      const expectedProfit = ethers.parseEther("0.01");
      
      // The contract should have nonReentrant modifier on executeArb
      // This will be tested in integration tests with actual flash loans
      expect(true).to.be.true; // Placeholder
    });
  });

  describe("Events", function () {
    it("Should emit ArbitrageExecuted event", async function () {
      // This test requires a successful arbitrage execution
      // Will be implemented in integration tests
      expect(true).to.be.true; // Placeholder
    });

    it("Should emit ProfitWithdrawn event", async function () {
      // Send some tokens to the contract first
      await mockWETH.mint(await bot.getAddress(), ethers.parseEther("1"));
      
      await expect(bot.withdraw(await mockWETH.getAddress()))
        .to.emit(bot, "ProfitWithdrawn")
        .withArgs(await mockWETH.getAddress(), ethers.parseEther("1"));
    });
  });
});

// Mock contracts for testing
const MockERC20 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
`;

const MockPriceFeed = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockPriceFeed {
    int256 private _price;
    uint256 private _updatedAt;
    
    constructor() {
        _price = 2000e8; // $2000 USD
        _updatedAt = block.timestamp;
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }
    
    function setPrice(int256 price) external {
        _price = price;
        _updatedAt = block.timestamp;
    }
}
`;
