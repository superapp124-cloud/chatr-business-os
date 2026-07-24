import { IntentResult, QueryIntent } from "./types.js";

export class IntentClassifier {
  static classify(query: string): IntentResult {
    const lower = query.toLowerCase();
    
    const isCommerce = /\b(best|under|vs|top|review|comparison|budget|price|buy)\b/.test(lower);
    const isCode = /\b(code|typescript|react|node|api|bug|error|sdk|library|github|npm)\b/.test(lower);
    const isBharat = /[\u0900-\u097f\u0600-\u06ff]/.test(lower) || /\b(itr|tax|aadhaar|aadhar|pan|upi|digilocker|gst|sarkari|ration|pf|epfo|irctc|paytm|phonepe|gpay|bharat|india|inr|rupees)\b/.test(lower);
    const isNews = /\b(today|latest|breaking|news|update|live)\b/.test(lower);

    let intent: QueryIntent = "general";
    let commerceIntentScore = 0;

    if (isCommerce) {
      intent = "shopping";
      commerceIntentScore = 1.0;
    } else if (isCode) {
      intent = "coding";
    } else if (isBharat) {
      intent = "bharat";
    } else if (isNews) {
      intent = "news";
    }

    return {
      intent,
      commerceIntentScore,
      expandedQueries: this.expandQuery(query, intent, isBharat)
    };
  }

  private static expandQuery(original: string, intent: QueryIntent, isBharat: boolean): string[] {
    const expansions = [original];
    
    if (intent === "shopping") {
      expansions.push(`${original} review specifications`);
      if (isBharat) {
        expansions.push(`${original} India price`);
        expansions.push(`91mobiles ${original}`);
        expansions.push(`smartprix ${original}`);
      }
    } else if (intent === "coding") {
      expansions.push(`${original} official documentation github`);
      expansions.push(`${original} stackoverflow example`);
    } else if (intent === "bharat") {
      expansions.push(`${original} official portal guidelines`);
      expansions.push(`${original} latest updates India`);
    } else if (intent === "news") {
      expansions.push(`${original} latest breaking news`);
    }
    
    return expansions;
  }
}
