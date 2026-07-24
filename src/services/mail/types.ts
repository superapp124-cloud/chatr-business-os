export interface EmailMessage {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  internalDate: number;
}
