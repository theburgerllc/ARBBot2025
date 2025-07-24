#!/usr/bin/env ts-node
"use strict";
/**
 * RPC Endpoint Harvester - ARBBot2025
 *
 * Automatically discovers and validates the best RPC endpoints for testnets:
 * - Scrapes public RPC lists
 * - Tests endpoint speed and reliability
 * - Updates .env with fastest available endpoints
 * - Monitors endpoint health
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPCHarvester = void 0;
const playwright_1 = require("playwright");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class RPCHarvester {
    browser = null;
    page = null;
    NETWORKS = [
        {
            name: 'arbitrum-sepolia',
            chainId: 421614,
            testUrls: [
                'https://sepolia-rollup.arbitrum.io/rpc',
                'https://arbitrum-sepolia.infura.io/v3/YOUR_KEY',
                'https://arbitrum-sepolia.public.blastapi.io',
                'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public'
            ],
            publicSources: [
                'https://chainlist.org/chain/421614',
                'https://rpc.info/arbitrum-sepolia'
            ]
        },
        {
            name: 'ethereum-sepolia',
            chainId: 11155111,
            testUrls: [
                'https://rpc.sepolia.org',
                'https://sepolia.infura.io/v3/YOUR_KEY',
                'https://ethereum-sepolia.public.blastapi.io',
                'https://eth-sepolia.g.alchemy.com/v2/demo'
            ],
            publicSources: [
                'https://chainlist.org/chain/11155111',
                'https://rpc.info/ethereum-sepolia'
            ]
        },
        {
            name: 'optimism-sepolia',
            chainId: 11155420,
            testUrls: [
                'https://sepolia.optimism.io',
                'https://optimism-sepolia.infura.io/v3/YOUR_KEY',
                'https://optimism-sepolia.public.blastapi.io',
                'https://endpoints.omniatech.io/v1/op/sepolia/public'
            ],
            publicSources: [
                'https://chainlist.org/chain/11155420',
                'https://rpc.info/optimism-sepolia'
            ]
        }
    ];
    async initialize() {
        console.log(chalk_1.default.blue('🌐 Initializing RPC Endpoint Harvester'));
        this.browser = await playwright_1.chromium.launch({
            headless: process.env.NODE_ENV === 'production',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 }
        });
        console.log(chalk_1.default.green('✅ Browser initialized for RPC discovery'));
    }
    async testEndpoint(endpoint) {
        const startTime = Date.now();
        try {
            // Skip endpoints with placeholder keys
            if (endpoint.url.includes('YOUR_KEY') || endpoint.url.includes('demo')) {
                return {
                    ...endpoint,
                    isWorking: false,
                    lastTested: new Date().toISOString(),
                    responseTime: 9999
                };
            }
            const provider = new ethers_1.JsonRpcProvider(endpoint.url);
            // Set timeout for the request
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 10000); // 10 second timeout
            });
            const testPromise = Promise.all([
                provider.getBlockNumber(),
                provider.getNetwork()
            ]);
            const [blockHeight, network] = await Promise.race([testPromise, timeoutPromise]);
            const responseTime = Date.now() - startTime;
            // Validate chain ID matches
            const isCorrectChain = Number(network.chainId) === endpoint.chainId;
            return {
                ...endpoint,
                isWorking: isCorrectChain,
                responseTime: isCorrectChain ? responseTime : 9999,
                blockHeight: isCorrectChain ? blockHeight : undefined,
                lastTested: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                ...endpoint,
                isWorking: false,
                responseTime: 9999,
                lastTested: new Date().toISOString()
            };
        }
    }
    async scrapeChainlistEndpoints(network) {
        if (!this.page)
            throw new Error('Browser not initialized');
        const endpoints = [];
        const chainlistUrl = `https://chainlist.org/chain/${network.chainId}`;
        try {
            console.log(chalk_1.default.yellow(`  🔍 Scraping Chainlist for ${network.name}...`));
            await this.page.goto(chainlistUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await this.page.waitForTimeout(3000);
            // Look for RPC URL elements
            const rpcSelectors = [
                'input[value*="http"]',
                '.rpc-url',
                '[data-testid*="rpc"]',
                'code:has-text("http")',
                'span:has-text("http")'
            ];
            for (const selector of rpcSelectors) {
                try {
                    const elements = await this.page.locator(selector).all();
                    for (const element of elements) {
                        const text = await element.textContent() || '';
                        const value = await element.getAttribute('value') || '';
                        const url = text.includes('http') ? text : value;
                        if (url && url.startsWith('http') && !url.includes('YOUR_KEY')) {
                            endpoints.push({
                                url: url.trim(),
                                network: network.name,
                                chainId: network.chainId,
                                isWorking: false,
                                lastTested: '',
                                source: 'chainlist'
                            });
                        }
                    }
                }
                catch {
                    continue; // Try next selector
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`    ❌ Failed to scrape Chainlist: ${error}`));
        }
        return endpoints;
    }
    async discoverAllEndpoints() {
        console.log(chalk_1.default.blue('\n🔍 Discovering RPC endpoints from all sources...'));
        const allEndpoints = [];
        for (const network of this.NETWORKS) {
            console.log(chalk_1.default.cyan(`\n📡 Processing ${network.name}...`));
            // Add known test URLs
            const testEndpoints = network.testUrls.map(url => ({
                url,
                network: network.name,
                chainId: network.chainId,
                isWorking: false,
                lastTested: '',
                source: 'known'
            }));
            allEndpoints.push(...testEndpoints);
            // Scrape additional endpoints from public sources  
            try {
                const scrapedEndpoints = await this.scrapeChainlistEndpoints(network);
                allEndpoints.push(...scrapedEndpoints);
                console.log(chalk_1.default.green(`  ✅ Found ${scrapedEndpoints.length} additional endpoints`));
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`  ⚠️ Scraping failed: ${error}`));
            }
        }
        // Remove duplicates
        const uniqueEndpoints = allEndpoints.filter((endpoint, index, arr) => arr.findIndex(e => e.url === endpoint.url && e.chainId === endpoint.chainId) === index);
        console.log(chalk_1.default.green(`\n✅ Discovered ${uniqueEndpoints.length} unique endpoints`));
        return uniqueEndpoints;
    }
    async testAllEndpoints(endpoints) {
        console.log(chalk_1.default.blue(`\n⚡ Testing ${endpoints.length} RPC endpoints...`));
        const results = [];
        const batchSize = 5; // Test 5 endpoints concurrently
        for (let i = 0; i < endpoints.length; i += batchSize) {
            const batch = endpoints.slice(i, i + batchSize);
            console.log(chalk_1.default.gray(`  Testing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(endpoints.length / batchSize)}...`));
            const batchPromises = batch.map(endpoint => this.testEndpoint(endpoint));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            // Log results for this batch
            batchResults.forEach(result => {
                const status = result.isWorking ? '✅' : '❌';
                const time = result.responseTime !== 9999 ? `${result.responseTime}ms` : 'FAIL';
                const networkName = result.network.replace('-', ' ').toUpperCase();
                console.log(chalk_1.default.white(`    ${status} ${networkName}: ${time} - ${result.url.substring(0, 50)}...`));
            });
            // Small delay between batches
            if (i + batchSize < endpoints.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return results;
    }
    getBestEndpoints(results) {
        const bestByNetwork = {};
        for (const network of this.NETWORKS) {
            const networkEndpoints = results
                .filter(r => r.network === network.name && r.isWorking)
                .sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999))
                .slice(0, 3); // Keep top 3 for each network
            bestByNetwork[network.name] = networkEndpoints;
        }
        return bestByNetwork;
    }
    async updateEnvironmentFile(bestEndpoints) {
        console.log(chalk_1.default.blue('\n📝 Updating .env with best RPC endpoints...'));
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        try {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        catch {
            console.log(chalk_1.default.yellow('  ⚠️ .env file not found, creating new one'));
        }
        // Prepare new RPC configuration
        const rpcUpdates = [
            '',
            '# ===== OPTIMIZED RPC ENDPOINTS (Auto-updated) =====',
            `# Updated: ${new Date().toISOString()}`,
            ''
        ];
        for (const [networkName, endpoints] of Object.entries(bestEndpoints)) {
            if (endpoints.length > 0) {
                const primary = endpoints[0];
                const fallbacks = endpoints.slice(1);
                const envKey = networkName.toUpperCase().replace('-', '_') + '_RPC';
                rpcUpdates.push(`# ${networkName}: ${primary.responseTime}ms response time`);
                rpcUpdates.push(`export ${envKey}="${primary.url}"`);
                if (fallbacks.length > 0) {
                    fallbacks.forEach((fallback, index) => {
                        rpcUpdates.push(`export ${envKey}_FALLBACK_${index + 1}="${fallback.url}"`);
                    });
                }
                rpcUpdates.push('');
            }
        }
        // Remove old RPC configuration and add new one
        const lines = envContent.split('\n');
        const filteredLines = lines.filter(line => !line.includes('_RPC=') &&
            !line.includes('_RPC_FALLBACK') &&
            !line.includes('# Updated:') &&
            !line.includes('===== OPTIMIZED RPC ENDPOINTS'));
        const updatedContent = filteredLines.join('\n') + '\n' + rpcUpdates.join('\n');
        fs.writeFileSync(envPath, updatedContent);
        console.log(chalk_1.default.green('  ✅ Environment file updated with optimized endpoints'));
    }
    async generateReport(allResults, bestEndpoints) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTested: allResults.length,
                workingEndpoints: allResults.filter(r => r.isWorking).length,
                averageResponseTime: Math.round(allResults.filter(r => r.isWorking).reduce((sum, r) => sum + (r.responseTime || 0), 0) /
                    allResults.filter(r => r.isWorking).length)
            },
            bestEndpoints,
            allResults: allResults.filter(r => r.isWorking),
            recommendations: this.generateRecommendations(bestEndpoints)
        };
        const reportPath = path.join(process.cwd(), 'rpc-optimization-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        // Print summary to console
        console.log(chalk_1.default.blue('\n🌐 RPC OPTIMIZATION REPORT'));
        console.log(chalk_1.default.white('═'.repeat(60)));
        console.log(chalk_1.default.cyan('\n📊 Summary:'));
        console.log(chalk_1.default.white(`  Total endpoints tested: ${report.summary.totalTested}`));
        console.log(chalk_1.default.white(`  Working endpoints: ${report.summary.workingEndpoints}`));
        console.log(chalk_1.default.white(`  Average response time: ${report.summary.averageResponseTime}ms`));
        console.log(chalk_1.default.cyan('\n⚡ Best Endpoints by Network:'));
        for (const [network, endpoints] of Object.entries(bestEndpoints)) {
            if (endpoints.length > 0) {
                console.log(chalk_1.default.white(`\n  ${network.toUpperCase()}:`));
                endpoints.forEach((endpoint, index) => {
                    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                    console.log(chalk_1.default.white(`    ${rank} ${endpoint.responseTime}ms - ${endpoint.url}`));
                });
            }
        }
        console.log(chalk_1.default.cyan('\n💡 Recommendations:'));
        report.recommendations.forEach(rec => {
            console.log(chalk_1.default.yellow(`  • ${rec}`));
        });
        console.log(chalk_1.default.green(`\n📄 Detailed report saved: ${reportPath}`));
    }
    generateRecommendations(bestEndpoints) {
        const recommendations = [];
        for (const [network, endpoints] of Object.entries(bestEndpoints)) {
            if (endpoints.length === 0) {
                recommendations.push(`No working endpoints found for ${network} - check network status`);
            }
            else if (endpoints.length === 1) {
                recommendations.push(`Only 1 endpoint found for ${network} - consider finding more for redundancy`);
            }
            else if (endpoints[0].responseTime && endpoints[0].responseTime > 2000) {
                recommendations.push(`${network} endpoints are slow (>${endpoints[0].responseTime}ms) - may impact performance`);
            }
        }
        if (recommendations.length === 0) {
            recommendations.push('All networks have good endpoint coverage and performance!');
        }
        return recommendations;
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log(chalk_1.default.green('🔄 RPC harvester cleaned up'));
        }
    }
    async runFullHarvest() {
        try {
            await this.initialize();
            // Discover all available endpoints
            const allEndpoints = await this.discoverAllEndpoints();
            // Test all endpoints for speed and reliability
            const results = await this.testAllEndpoints(allEndpoints);
            // Identify the best endpoints per network
            const bestEndpoints = this.getBestEndpoints(results);
            // Update environment configuration
            await this.updateEnvironmentFile(bestEndpoints);
            // Generate comprehensive report
            await this.generateReport(results, bestEndpoints);
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ RPC harvest failed: ${error}`));
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
}
exports.RPCHarvester = RPCHarvester;
// CLI execution
async function main() {
    const harvester = new RPCHarvester();
    try {
        await harvester.runFullHarvest();
        console.log(chalk_1.default.green('\n🎉 RPC endpoint optimization completed successfully!'));
    }
    catch (error) {
        console.log(chalk_1.default.red('\n💥 RPC harvest failed:', error));
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
