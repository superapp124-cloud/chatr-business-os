import { EmailMessage } from '../mail/types';

export class Summarizer {
  /**
   * Generates a bulleted summary of the email.
   * In a real local LLM pipeline, this would pass the raw body through a prompt.
   */
  static analyze(message: EmailMessage): string[] {
    const summary: string[] = [];
    
    // Fallback heuristic: Split the snippet by punctuation to simulate sentence extraction
    const sentences = message.snippet.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if (sentence.length > 10) {
        summary.push(sentence.trim());
      }
    }
    
    if (summary.length === 0) {
      summary.push(message.snippet);
    }
    
    return summary.slice(0, 3); // Max 3 bullet points
  }
}
