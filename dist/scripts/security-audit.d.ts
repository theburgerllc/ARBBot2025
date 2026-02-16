interface WalletAudit {
    address: string;
    balance: string;
    transactionCount: number;
    isContract: boolean;
    recentTransactions?: any[];
}
interface SecurityAuditResult {
    executorWallet: WalletAudit;
    gasFundingWallet: WalletAudit;
    suspiciousAddress: WalletAudit;
    securityIssues: string[];
    recommendations: string[];
}
export declare class SecurityAuditor {
    private provider;
    private executorWallet;
    private gasFundingWalletAddress;
    private suspiciousAddress;
    constructor();
    auditWallet(address: string): Promise<WalletAudit>;
    checkRecentTransactions(address: string, blockRange?: number): Promise<any[]>;
    checkForSuspiciousActivity(): Promise<string[]>;
    generateSecurityRecommendations(): Promise<string[]>;
    performCompleteAudit(): Promise<SecurityAuditResult>;
    private printAuditReport;
    checkEtherscanTransactions(address: string): Promise<void>;
}
export default SecurityAuditor;
