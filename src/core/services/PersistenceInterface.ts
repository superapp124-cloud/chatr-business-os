export interface PersistenceInterface {
  /**
   * Save or update an outcome
   */
  saveOutcome(outcome: any): Promise<void>;
  
  /**
   * Retrieve an outcome by ID
   */
  getOutcome(id: string): Promise<any | null>;
  
  /**
   * Delete an outcome by ID
   */
  deleteOutcome(id: string): Promise<void>;
  
  /**
   * Query outcomes by status, type, or date
   */
  queryOutcomes(filter: any): Promise<any[]>;
}
