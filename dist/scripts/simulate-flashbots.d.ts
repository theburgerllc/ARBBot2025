import { FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
interface SimulationResult {
    bundleHash?: string;
    success: boolean;
    gasUsed?: string;
    coinbaseDiff?: string;
    error?: string;
    simulation?: any;
    transactions: FlashbotsBundleTransaction[];
    targetBlockNumber: number;
    timestamp: string;
}
declare class FlashbotsSimulator {
    private provider;
    private authSigner;
    private executorSigner;
    private flashbotsProvider;
    private resultsDir;
    constructor();
    /**
     * Initialize Flashbots provider
     */
    initialize(): Promise<void>;
    /**
     * Create a sample arbitrage transaction bundle
     */
    createArbitrageBundle(): Promise<FlashbotsBundleTransaction[]>;
    /**
     * Create a custom transaction bundle from parameters
     */
    createCustomBundle(contractAddress: string, methodSignature: string, parameters: any[], value?: bigint, urgency?: 'low' | 'medium' | 'high'): Promise<FlashbotsBundleTransaction[]>;
    /**
     * Simulate a bundle using Flashbots
     */
    simulateBundle(bundleTransactions: FlashbotsBundleTransaction[], targetBlockNumber?: number): Promise<SimulationResult>;
    /**
     * Sign and validate bundle without sending
     */
    signBundle(bundleTransactions: FlashbotsBundleTransaction[]): Promise<string[]>;
    /**
     * Run comprehensive bundle analysis
     */
    analyzeBundleProfitability(bundleTransactions: FlashbotsBundleTransaction[]): Promise<void>;
    /**
     * Save simulation results to file
     */
    saveResults(result: SimulationResult): Promise<string>;
    /**
     * Run a complete simulation test
     */
    runSimulationTest(): Promise<void>;
}
export { FlashbotsSimulator };
