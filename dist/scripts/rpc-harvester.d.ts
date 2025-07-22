#!/usr/bin/env ts-node
/**
 * RPC Endpoint Harvester - ARBBot2025
 *
 * Automatically discovers and validates the best RPC endpoints for testnets:
 * - Scrapes public RPC lists
 * - Tests endpoint speed and reliability
 * - Updates .env with fastest available endpoints
 * - Monitors endpoint health
 */
interface RPCEndpoint {
    url: string;
    network: string;
    chainId: number;
    responseTime?: number;
    blockHeight?: number;
    isWorking: boolean;
    lastTested: string;
    source?: string;
}
interface NetworkConfig {
    name: string;
    chainId: number;
    testUrls: string[];
    publicSources: string[];
}
declare class RPCHarvester {
    private browser;
    private page;
    private readonly NETWORKS;
    initialize(): Promise<void>;
    testEndpoint(endpoint: RPCEndpoint): Promise<RPCEndpoint>;
    scrapeChainlistEndpoints(network: NetworkConfig): Promise<RPCEndpoint[]>;
    discoverAllEndpoints(): Promise<RPCEndpoint[]>;
    testAllEndpoints(endpoints: RPCEndpoint[]): Promise<RPCEndpoint[]>;
    getBestEndpoints(results: RPCEndpoint[]): {
        [network: string]: RPCEndpoint[];
    };
    updateEnvironmentFile(bestEndpoints: {
        [network: string]: RPCEndpoint[];
    }): Promise<void>;
    generateReport(allResults: RPCEndpoint[], bestEndpoints: {
        [network: string]: RPCEndpoint[];
    }): Promise<void>;
    private generateRecommendations;
    cleanup(): Promise<void>;
    runFullHarvest(): Promise<void>;
}
export { RPCHarvester };
