export class Normalizer {
  /**
   * Standardizes casing and punctuation for downstream components.
   */
  static normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s@.]/g, '') // Remove most punctuation, keep @ and . for emails
      .replace(/\s+/g, ' ')
      .trim();
  }
}
