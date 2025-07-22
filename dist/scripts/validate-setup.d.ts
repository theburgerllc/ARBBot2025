interface ValidationResult {
    category: string;
    test: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: any;
}
declare class SetupValidator {
    private results;
    private networks;
    constructor();
    private initializeNetworks;
    private addResult;
    /**
     * Validate environment file existence and permissions
     */
    validateEnvironmentFile(): void;
    /**
     * Validate required environment variables
     */
    validateEnvironmentVariables(): void;
    /**
     * Validate private key format and derivation
     */
    validatePrivateKeys(): void;
    /**
     * Validate network connectivity
     */
    validateNetworkConnectivity(): Promise<void>;
    /**
     * Validate wallet balances
     */
    validateWalletBalances(): Promise<void>;
    /**
     * Validate contract addresses
     */
    validateContractAddresses(): Promise<void>;
    /**
     * Validate Flashbots connectivity
     */
    validateFlashbotsConnectivity(): Promise<void>;
    /**
     * Validate bot configuration
     */
    validateBotConfiguration(): void;
    /**
     * Display validation results
     */
    displayResults(): void;
    /**
     * Run complete validation
     */
    runCompleteValidation(): Promise<void>;
}
export { SetupValidator, ValidationResult };
