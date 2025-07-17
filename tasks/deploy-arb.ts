import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deployArb", "Deploy FlashArbBotBalancer to Arbitrum")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { run } = hre;
    
    console.log("🚀 Deploying to Arbitrum via deployArb task...");
    
    await run("run", {
      script: "scripts/deploy-arb.ts",
      network: "arbitrum"
    });
  });