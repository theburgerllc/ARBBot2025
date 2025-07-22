declare class ExtendedSimulator {
    private stats;
    private startTime;
    private simulationDuration;
    runExtendedSimulation(): Promise<void>;
    private runBotSimulation;
    private runFlashbotsSimulation;
    private parseeBotOutput;
    private parseFlashbotsOutput;
    private printFinalSummary;
    private sleep;
}
export { ExtendedSimulator };
