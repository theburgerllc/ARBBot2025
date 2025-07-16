import { ethers } from "hardhat";

async function main() {
  const vault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const sushi = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
  const uni = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  const Factory = await ethers.getContractFactory("FlashArbBotBalancer");
  const bot = await Factory.deploy(vault, sushi, uni);
  await bot.deployed();
  console.log("FlashArbBotBalancer deployed to:", bot.address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
