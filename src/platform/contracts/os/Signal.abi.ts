export interface SignalABI {
  id: string;                  // UUID
  source: string;              // e.g., 'gmail.webhook', 'calendar.poll', 'sensor.temp'
  type: string;                // e.g., 'email.received', 'meeting.created'
  timestamp: string;           // ISO8601
  confidence: number;          // Trustworthiness of the signal (0.0 - 1.0)
  payload: Record<string, any>; // The raw signal data
  
  // Correlation back to Reality Graph (e.g., this signal belongs to User X or Project Y)
  realityContext?: {
    entityIds: string[];
  };
}
