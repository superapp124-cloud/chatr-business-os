import { ImportMapping } from './types';

export class MappingEngine {
  private knownDictionaries: Record<string, string[]> = {
    'first_name': ['First Name', 'Fname', 'Given Name', 'Cust Name'],
    'last_name': ['Last Name', 'Lname', 'Surname', 'Family Name'],
    'email': ['Mail ID', 'Email Address', 'E-mail', 'Email', 'Contact Email'],
    'phone': ['Mobile No', 'Phone', 'Cell', 'Telephone', 'Contact Number', 'Ph'],
    'company': ['Organisation', 'Organization', 'Company', 'Business Name', 'Account Name'],
  };

  /**
   * Generates mappings for a set of raw headers.
   * Progresses through Exact -> Dictionary -> Fuzzy -> (Simulated) Local AI
   */
  async generateMappings(rawHeaders: string[], targetSchemaFields: string[]): Promise<ImportMapping[]> {
    const mappings: ImportMapping[] = [];

    for (const header of rawHeaders) {
      let mapped = false;

      // 1. Exact Match
      const exactMatch = targetSchemaFields.find(f => f.toLowerCase() === header.toLowerCase());
      if (exactMatch) {
        mappings.push({ source_column: header, target_field: exactMatch, confidence: 1.0, strategy: 'exact' });
        mapped = true;
        continue;
      }

      // 2. Dictionary Match
      for (const [targetField, dictionary] of Object.entries(this.knownDictionaries)) {
        if (targetSchemaFields.includes(targetField)) {
          const match = dictionary.find(d => d.toLowerCase() === header.toLowerCase());
          if (match) {
            mappings.push({ source_column: header, target_field: targetField, confidence: 0.9, strategy: 'dictionary' });
            mapped = true;
            break;
          }
        }
      }
      if (mapped) continue;

      // 3. Fuzzy Match (Simple Levenshtein distance placeholder)
      const fuzzyMatch = this.findFuzzyMatch(header, targetSchemaFields);
      if (fuzzyMatch) {
        mappings.push({ source_column: header, target_field: fuzzyMatch.field, confidence: fuzzyMatch.confidence, strategy: 'fuzzy' });
        mapped = true;
        continue;
      }

      // 4. Local AI Inference (Fallback)
      // In production, this would call the Local Ollama provider
      const aiMatch = await this.askLocalAI(header, targetSchemaFields);
      if (aiMatch) {
        mappings.push({ source_column: header, target_field: aiMatch, confidence: 0.7, strategy: 'ai' });
        mapped = true;
        continue;
      }

      // Unmapped
      mappings.push({ source_column: header, target_field: '', confidence: 0, strategy: 'exact' });
    }

    return mappings;
  }

  private findFuzzyMatch(header: string, targets: string[]): { field: string, confidence: number } | null {
    // A real implementation would use a Levenshtein library like fast-levenshtein
    // For now, we return null to simulate a miss and let it fall to AI
    return null;
  }

  private async askLocalAI(header: string, targets: string[]): Promise<string | null> {
    // MOCK: Simulate Ollama deciding that "Org" means "company"
    if (header.toLowerCase() === 'org' && targets.includes('company')) {
      return 'company';
    }
    return null;
  }
}
