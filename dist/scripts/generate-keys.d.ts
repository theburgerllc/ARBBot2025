interface KeyPair {
    privateKey: string;
    publicKey: string;
    address: string;
    entropy: string;
}
interface WalletInfo {
    executorWallet: KeyPair;
    flashbotsAuthKey: KeyPair;
    timestamp: string;
    chainInfo: {
        arbitrum: {
            chainId: number;
            rpc: string;
        };
        optimism: {
            chainId: number;
            rpc: string;
        };
    };
}
declare class SecureKeyGenerator {
    private readonly ENV_FILE;
    private readonly BACKUP_DIR;
    private readonly ENTROPY_BYTES;
    constructor();
    private ensureBackupDir;
    /**
     * Generate cryptographically secure private key using OpenSSL equivalent
     */
    private generateSecurePrivateKey;
    /**
     * Generate a complete key pair with validation
     */
    private generateKeyPair;
    /**
     * Validate private key format and derivation
     */
    private validateKeyPair;
    /**
     * Generate both executor and Flashbots authentication keys
     */
    generateWalletKeys(): WalletInfo;
    /**
     * Display wallet information with security warnings
     */
    displayWalletInfo(walletInfo: WalletInfo): void;
    /**
     * Create .env file with generated keys
     */
    createEnvFile(walletInfo: WalletInfo): Promise<void>;
    /**
     * Create encrypted backup of wallet information
     */
    createBackup(walletInfo: WalletInfo, password?: string): Promise<string>;
    /**
     * Validate network connectivity
     */
    validateNetworkConnectivity(walletInfo: WalletInfo): Promise<boolean>;
    /**
     * Check wallet balances on both chains
     */
    checkWalletBalances(walletInfo: WalletInfo): Promise<void>;
    /**
     * Generate OpenSSL equivalent command for verification
     */
    generateOpenSSLCommand(): void;
    /**
     * Main setup function
     */
    setupWallet(options?: {
        createBackup?: boolean;
        password?: string;
        skipBalance?: boolean;
    }): Promise<void>;
}
export { SecureKeyGenerator, KeyPair, WalletInfo };
