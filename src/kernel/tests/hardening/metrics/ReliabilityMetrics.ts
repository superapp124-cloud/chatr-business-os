export class ReliabilityMetrics {
  public lockConflicts = 0;
  public duplicateCommandsRejected = 0;
  public crashesRecovered = 0;
  public replaysSuccessful = 0;
  public corruptionDetected = 0;

  recordLockConflict() { this.lockConflicts++; }
  recordDuplicateCommand() { this.duplicateCommandsRejected++; }
  recordCrashRecovery() { this.crashesRecovered++; }
  recordReplaySuccess() { this.replaysSuccessful++; }
  recordCorruptionDetected() { this.corruptionDetected++; }
  
  getSummary() {
    return {
      lockConflicts: this.lockConflicts,
      duplicateCommandsRejected: this.duplicateCommandsRejected,
      crashesRecovered: this.crashesRecovered,
      replaysSuccessful: this.replaysSuccessful,
      corruptionDetected: this.corruptionDetected
    };
  }

  print() {
    console.table(this.getSummary());
  }
}
