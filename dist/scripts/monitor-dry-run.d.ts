declare class DryRunMonitor {
    private monitoringActive;
    private stats;
    startMonitoring(): Promise<void>;
    private displayHeader;
    private updateStats;
    private parseLogFiles;
    private getRecentLogFiles;
    private parseLogFile;
    private checkProcessStatus;
    private displayStats;
    private displayProgressIndicators;
    private createProgressBar;
    private getPerformanceEmoji;
    private getResourceEmoji;
    private getCPUUsage;
}
export { DryRunMonitor };
