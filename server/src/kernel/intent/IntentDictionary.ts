export const IntentDictionary: Record<string, string[]> = {
  create: ['add', 'register', 'insert', 'onboard', 'new', 'submit'],
  approve: ['accept', 'authorize', 'sign off', 'ok', 'yes'],
  reject: ['deny', 'decline', 'cancel', 'no'],
  ticket: ['issue', 'complaint', 'support request', 'problem'],
  lead: ['prospect', 'contact', 'opportunity'],
  expense: ['receipt', 'reimbursement', 'charge'],
  job: ['position', 'role', 'req', 'requirement'],
  qualify: ['promote', 'advance', 'convert']
};

export class AliasExpander {
  /**
   * Replaces known aliases in the normalized text with their canonical forms.
   */
  static expand(normalizedText: string): string {
    let expanded = normalizedText;
    
    for (const [canonical, aliases] of Object.entries(IntentDictionary)) {
      for (const alias of aliases) {
        // Replace whole words only
        const regex = new RegExp(`\\b${alias}\\b`, 'gi');
        expanded = expanded.replace(regex, canonical);
      }
    }
    
    return expanded;
  }
}
