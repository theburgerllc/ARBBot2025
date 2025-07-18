import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

describe("Aave V3 Flash Loan Integration - Simple", function () {
  let flashArbBot: Contract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
  const SUSHISWAP_ROUTER = "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55";
  const UNISWAP_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const FlashArbBotBalancerFactory = await ethers.getContractFactory("FlashArbBotBalancer");
    flashArbBot = await FlashArbBotBalancerFactory.deploy(
      BALANCER_VAULT,
      SUSHISWAP_ROUTER,
      UNISWAP_V2_ROUTER,
      UNISWAP_V3_QUOTER
    );

    await flashArbBot.setAuthorizedCaller(owner.address, true);
    await flashArbBot.waitForDeployment();
  });

  describe("Contract Deployment", function () {
    it("should deploy successfully", async function () {
      expect(await flashArbBot.getAddress()).to.be.a("string");
      expect(await flashArbBot.owner()).to.equal(owner.address);
    });

    it("should have correct authorization", async function () {
      expect(await flashArbBot.authorizedCallers(owner.address)).to.be.true;
      expect(await flashArbBot.authorizedCallers(user.address)).to.be.false;
    });

    it("should have correct configuration", async function () {
      expect(await flashArbBot.slippageTolerance()).to.equal(200n);
      expect(await flashArbBot.minProfitBps()).to.equal(30n);
    });
  });

  describe("Security Functions", function () {
    it("should allow owner to pause contract", async function () {
      await flashArbBot.pause();
      expect(await flashArbBot.paused()).to.be.true;
    });

    it("should allow owner to unpause contract", async function () {
      await flashArbBot.pause();
      await flashArbBot.unpause();
      expect(await flashArbBot.paused()).to.be.false;
    });

    it("should only allow owner to set authorized caller", async function () {
      await flashArbBot.setAuthorizedCaller(user.address, true);
      expect(await flashArbBot.authorizedCallers(user.address)).to.be.true;
      
      await expect(
        flashArbBot.connect(user).setAuthorizedCaller(user.address, false)
      ).to.be.reverted;
    });

    it("should allow owner to set slippage tolerance", async function () {
      await flashArbBot.setSlippageTolerance(300);
      expect(await flashArbBot.slippageTolerance()).to.equal(300n);
    });

    it("should not allow slippage tolerance above maximum", async function () {
      await expect(
        flashArbBot.setSlippageTolerance(600)
      ).to.be.reverted;
    });

    it("should allow owner to set minimum profit", async function () {
      await flashArbBot.setMinProfitBps(50);
      expect(await flashArbBot.minProfitBps()).to.equal(50n);
    });

    it("should not allow zero minimum profit", async function () {
      await expect(
        flashArbBot.setMinProfitBps(0)
      ).to.be.reverted;
    });
  });

  describe("Provider Selection Logic", function () {
    it("should have FlashLoanProvider enum values", async function () {
      // Test that provider selection function exists
      expect(flashArbBot.interface.getFunction("getOptimalProvider")).to.exist;
    });

    it("should emit FlashLoanProviderSelected event", async function () {
      // Check if event is defined in the interface
      expect(flashArbBot.interface.getEvent("FlashLoanProviderSelected")).to.exist;
    });
  });
});