export interface CallerInfo {
  id: string;
  name: string;
  number: string;
  type: 'mobile' | 'home' | 'work';
  timestamp: string;
  duration?: string;
  status: 'missed' | 'outgoing' | 'incoming';
  isSpam?: boolean;
  trustScore?: number;
  location?: string;
  carrier?: string;
  avatar?: string;
  isFavorite?: boolean;
}

export const MOCK_RECENTS: CallerInfo[] = [];

export const MOCK_CONTACTS: CallerInfo[] = [];

export const SIMULATE_AI_INTELLIGENCE = (number: string) => {
  return {
    number,
    trustScore: Math.floor(Math.random() * 40) + 60,
    isSpam: false,
    callerName: "Potential Business",
    category: "Financial Services",
    insights: [
      "Verified business number",
      "No spam reports in the last 30 days",
      "Average call duration 2:15"
    ]
  };
};
