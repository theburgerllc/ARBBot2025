interface LaunchConfig {
    skipValidation?: boolean;
    dryRun?: boolean;
    logLevel?: string;
    restartOnFailure?: boolean;
    maxRestarts?: number;
    healthCheckInterval?: number;
}
declare class ProductionLauncher {
    private botProcess;
    private restartCount;
    private config;
    private healthCheckTimer;
    private isShuttingDown;
    constructor(config?: LaunchConfig);
    launch(): Promise<void>;
    private setupProductionEnvironment;
    private startBot;
    private restartBot;
    private startHealthMonitoring;
    private performHealthCheck;
    private setupShutdownHandlers;
    private shutdown;
    private cleanup;
    private keepAlive;
}
export { ProductionLauncher };
