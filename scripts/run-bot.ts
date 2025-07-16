import { ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARB_RPC);
  const authSigner = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY!, provider);
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    "https://relay.flashbots.net",
    "no-challenge"
  );

  // Initialize routers, bot contract, and scanning logic
  // Monitor blocks and submit bundles when profitable
}

main();
