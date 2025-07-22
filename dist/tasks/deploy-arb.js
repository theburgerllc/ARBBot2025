"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("hardhat/config");
(0, config_1.task)("deployArb", "Deploy FlashArbBotBalancer to Arbitrum")
    .setAction(async (taskArgs, hre) => {
    const { run } = hre;
    console.log("🚀 Deploying to Arbitrum via deployArb task...");
    await run("run", {
        script: "scripts/deploy-arb.ts",
        network: "arbitrum"
    });
});
