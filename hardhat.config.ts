import os from 'os';
import dotenv from 'dotenv';
import { task, HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-gas-reporter';
import 'hardhat-docgen';

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.9',
     settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 155
  },
  networks: {
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ACCESS_TOKEN}`,
      accounts: process.env.POLYGON_PRIVATE_KEY ? [process.env.POLYGON_PRIVATE_KEY] : []
    },
    hardhat: {
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_ACCESS_TOKEN,
  },
  docgen: {
    path: './docs/contracts',
    clear: true,
    runOnCompile: false,
    except: ['^contracts/harness/']
  },
  paths: {
    tests: 'tests'
  },
  mocha: {
    parallel: true,
    jobs: os.cpus().length,
  }
};

export default config;
