"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFlashbotsProvider = void 0;
const ethers_provider_bundle_1 = require("@flashbots/ethers-provider-bundle");
async function createFlashbotsProvider(provider, authSigner) {
    return await ethers_provider_bundle_1.FlashbotsBundleProvider.create(provider, authSigner, 'https://relay.flashbots.net');
}
exports.createFlashbotsProvider = createFlashbotsProvider;
