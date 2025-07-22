interface FundingConfig {
    amount: string;
    chains: string[];
    simulate: boolean;
}
declare class MultiChainFunder {
    private mainnetProvider;
    private executorWallet;
    private symbiosis;
    private readonly CHAIN_CONFIGS;
    constructor(config: FundingConfig);
    initialize(): Promise<void>;
    fundAllChains(amount: string, chains: string[], simulate?: boolean): Promise<void>;
    private fundChain;
    private waitForBridgeCompletion;
    checkAllBalances(): Promise<void>;
    generateFallbackInstructions(): Promise<void>;
}
export { MultiChainFunder };
