import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { ethers } from 'ethers';
export declare function createFlashbotsProvider(provider: ethers.Provider, authSigner: ethers.Wallet): Promise<FlashbotsBundleProvider>;
