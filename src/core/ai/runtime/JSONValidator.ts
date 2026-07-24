export class JSONValidator {
  
  /**
   * Attempts to parse and validate a raw string from an LLM.
   * If parsing fails, it strips markdown formatting and retries.
   * In a full implementation, it would throw a structured error containing the repair prompt.
   */
  static validate<T>(rawResponse: string, schemaName?: string): T {
    let cleanText = rawResponse.trim();
    
    // Strip markdown code blocks if the LLM output them
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    try {
      const parsed = JSON.parse(cleanText);
      // If a schemaName was provided, we would ideally run ajv or zod validation here.
      return parsed as T;
    } catch (e: any) {
      // Return a structured error for the Auto-Repair loop to catch
      throw new Error(`JSONValidationFailed: ${e.message}. Raw Output: ${rawResponse}`);
    }
  }
}
