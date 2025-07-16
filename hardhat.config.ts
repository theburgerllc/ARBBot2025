import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arbitrum: {
      url: process.env.ARB_RPC!,
      accounts: [process.env.PRIVATE_KEY!],
    },
    optimism: {
      url: process.env.OPT_RPC!,
      accounts: [process.env.PRIVATE_KEY!],
    },
    hardhat: {
      forking: {
        url: process.env.MAINNET_RPC!,
        blockNumber: process.env.FORK_BLOCK
          ? parseInt(process.env.FORK_BLOCK)
          : undefined,
      },
    },
  },
};

export default config;
