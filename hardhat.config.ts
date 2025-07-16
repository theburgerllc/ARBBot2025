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
        runs: 1000
      },
      viaIR: true
    }
  },
  networks: {
    arbitrum: {
      url: process.env.ARB_RPC!,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 42161,
      gasPrice: 100000000, // 0.1 gwei
      timeout: 60000
    },
    optimism: {
      url: process.env.OPT_RPC!,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 10,
      gasPrice: 1000000000, // 1 gwei
      timeout: 60000
    },
    hardhat: {
      forking: {
        url: process.env.ARB_RPC || process.env.MAINNET_RPC!,
        blockNumber: process.env.FORK_BLOCK
          ? parseInt(process.env.FORK_BLOCK)
          : undefined,
        enabled: true
      },
      chainId: 31337,
      gas: 30000000,
      gasPrice: 1000000000,
      allowUnlimitedContractSize: true,
      timeout: 60000
    },
    hardhat_arbitrum: {
      forking: {
        url: process.env.ARB_RPC!,
        blockNumber: process.env.FORK_BLOCK
          ? parseInt(process.env.FORK_BLOCK)
          : undefined,
        enabled: true
      },
      chainId: 31337,
      gas: 30000000,
      gasPrice: 100000000,
      allowUnlimitedContractSize: true
    },
    hardhat_optimism: {
      forking: {
        url: process.env.OPT_RPC!,
        blockNumber: process.env.FORK_BLOCK_OPT
          ? parseInt(process.env.FORK_BLOCK_OPT)
          : undefined,
        enabled: true
      },
      chainId: 31337,
      gas: 30000000,
      gasPrice: 1000000000,
      allowUnlimitedContractSize: true
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      gas: 30000000,
      gasPrice: 1000000000
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 1,
    showTimeSpent: true,
    showMethodSig: true
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || ""
    }
  },
  mocha: {
    timeout: 300000, // 5 minutes
    slow: 30000      // 30 seconds
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6"
  }
};

export default config;