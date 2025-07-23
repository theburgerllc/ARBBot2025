import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { ethers } from 'ethers';

export async function createFlashbotsProvider(provider: ethers.Provider, authSigner: ethers.Wallet) {
  return await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    'https://relay.flashbots.net'
  );
}