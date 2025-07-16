import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    arbitrum: {
      url: process.env.ARB_RPC!,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 42161,
      gasPrice: 1000000000, // 1 gwei
    },
    optimism: {
      url: process.env.OPT_RPC!,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 10,
      gasPrice: 1000000000, // 1 gwei
    },
    hardhat: {
      forking: {
        url: process.env.ARB_RPC || process.env.MAINNET_RPC!,
        blockNumber: process.env.FORK_BLOCK
          ? parseInt(process.env.FORK_BLOCK)
          : undefined,
      },
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || "",
    },
  },
};

export default config;
