export type SmartCategory = 'Personal' | 'Work' | 'Finance' | 'OTP' | 'Shopping' | 'Groups';

export interface CategorizationResult {
  category: SmartCategory;
  confidence: number;
  reason?: string;
}

/**
 * An on-device heuristic to quickly categorize conversations 
 * based on sender info and last message content.
 */
export function categorizeConversation(
  isGroup: boolean,
  senderName: string = '',
  lastMessageContent: string = ''
): CategorizationResult {
  if (isGroup) {
    return { category: 'Groups', confidence: 1.0, reason: 'Is a group chat' };
  }

  const contentLower = lastMessageContent.toLowerCase();
  const nameLower = senderName.toLowerCase();

  // 1. OTP / Authentication
  if (
    contentLower.includes('otp') ||
    contentLower.includes('verification code') ||
    contentLower.includes('do not share this code') ||
    contentLower.match(/\b\d{4,6}\b.*(code|pin|password)/)
  ) {
    return { category: 'OTP', confidence: 0.9, reason: 'OTP keyword detected' };
  }

  // 2. Finance / Banking
  if (
    contentLower.includes('debited') ||
    contentLower.includes('credited') ||
    contentLower.includes('acct') ||
    contentLower.includes('balance is') ||
    contentLower.includes('payment received') ||
    nameLower.includes('bank') ||
    nameLower.includes('pay') ||
    nameLower.includes('hdfc') ||
    nameLower.includes('sbi') ||
    nameLower.includes('icici')
  ) {
    return { category: 'Finance', confidence: 0.85, reason: 'Financial keyword detected' };
  }

  // 3. Shopping / Delivery
  if (
    contentLower.includes('order') ||
    contentLower.includes('delivery') ||
    contentLower.includes('shipped') ||
    contentLower.includes('out for delivery') ||
    contentLower.includes('arriving today') ||
    nameLower.includes('amazon') ||
    nameLower.includes('flipkart') ||
    nameLower.includes('zomato') ||
    nameLower.includes('swiggy')
  ) {
    return { category: 'Shopping', confidence: 0.85, reason: 'Shopping/Delivery keyword detected' };
  }

  // 4. Work
  if (
    contentLower.includes('meeting') ||
    contentLower.includes('zoom') ||
    contentLower.includes('google meet') ||
    contentLower.includes('presentation') ||
    contentLower.includes('deadline') ||
    nameLower.includes('boss') ||
    nameLower.includes('hr ') ||
    nameLower.includes('manager')
  ) {
    return { category: 'Work', confidence: 0.7, reason: 'Work-related keyword detected' };
  }

  // Fallback to Personal
  return { category: 'Personal', confidence: 0.5, reason: 'Default category' };
}
