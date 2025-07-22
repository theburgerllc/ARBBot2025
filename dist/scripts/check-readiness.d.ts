interface ValidationResult {
    category: string;
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: string;
    duration?: number;
}
interface ValidationSummary {
    results: ValidationResult[];
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    overallStatus: 'pass' | 'fail' | 'warning';
}
declare class ARBBotValidator {
    private results;
    private startTime;
    private addResult;
    validateEnvironmentVariables(): Promise<void>;
    validateNetworkConnectivity(): Promise<void>;
    validateWalletConfiguration(): Promise<void>;
    validateContractDeployments(): Promise<void>;
    validateTestModeReadiness(): Promise<void>;
    validatePerformanceAndSecurity(): Promise<void>;
    generateSummary(): ValidationSummary;
    printSummary(summary: ValidationSummary): void;
    runValidation(): Promise<ValidationSummary>;
}
export { ARBBotValidator };
