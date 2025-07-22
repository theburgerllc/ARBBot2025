#!/usr/bin/env node
/**
 * Quick setup script for MEV Bot
 * Provides interactive setup with guided prompts
 */
declare class QuickSetup {
    private envPath;
    constructor();
    private displayHeader;
    private prompt;
    private runCommand;
    private checkPrerequisites;
    private setupEnvironment;
    private installDependencies;
    private compileContracts;
    private validateSetup;
    private deployContracts;
    private displayNextSteps;
    run(): Promise<void>;
}
export { QuickSetup };
