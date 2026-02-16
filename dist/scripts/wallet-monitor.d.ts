interface WalletMonitorAlert {
    timestamp: string;
    alertType: 'BALANCE_CHANGE' | 'UNAUTHORIZED_TRANSFER' | 'SUSPICIOUS_ACTIVITY' | 'GAS_FUNDING';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    wallet: string;
    message: string;
    details?: any;
}
export declare class WalletMonitor {
    private provider;
    private alerts;
    private monitoredWallets;
    private isRunning;
    private monitoringInterval;
    private suspiciousAddresses;
    constructor();
    private initializeMonitoredWallets;
    initializeBaselines(): Promise<void>;
    checkWalletChanges(): Promise<void>;
    checkSuspiciousAddresses(): Promise<void>;
    private createAlert;
    private displayAlert;
    startMonitoring(): Promise<void>;
    stopMonitoring(): void;
    getAlerts(severity?: WalletMonitorAlert['severity']): WalletMonitorAlert[];
    displayRecentAlerts(count?: number): void;
    generateSecurityReport(): Promise<void>;
    addSuspiciousAddress(address: string): void;
    addMonitoredWallet(address: string, name: string, threshold?: string): void;
}
export default WalletMonitor;
