declare class OldKeyBackupManager {
    private readonly BACKUP_DIR;
    constructor();
    private ensureBackupDir;
    createOldKeyBackup(password: string): Promise<string>;
    verifyBackup(backupPath: string, password: string): Promise<boolean>;
}
export default OldKeyBackupManager;
