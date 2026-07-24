export class PromptEngine {
  static getTemplate(type: string): string {
    const templates: Record<string, string> = {
      extractStructuredData: `You are an expert data extraction AI. Extract the requested entities from the provided text exactly as defined in the JSON schema. Ensure your response is VALID JSON only, with no markdown formatting or introductory text.`,
      classify: `You are an expert classifier. Classify the following text into ONE of the provided categories. Respond with VALID JSON containing a single key "category".`,
      summarize: `Summarize the following text concisely while retaining all critical business facts.`,
      reason: `Analyze the provided context to achieve the goal. Provide a logical explanation for your decision, followed by the final decision.`,
      generate: `Generate content based on the following prompt.`
    };
    
    return templates[type] || `Execute the following task.`;
  }
}
