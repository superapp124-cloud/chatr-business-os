export interface SavedIntentTemplate {
  id: string;
  title: string;
  intent: string;
  provider?: string;
  payment?: string;
  address?: string;
  addons?: string[];
  icon?: string;
  color?: string;
}

export interface GoalHistoryRecord {
  id: string;
  intent: string;
  status: 'DONE' | 'CANCELLED';
  provider: string;
  timestamp: number;
  details: string;
}

export class GoalHistoryService {
  private static TEMPLATES_KEY = 'chatr_saved_templates';
  private static HISTORY_KEY = 'chatr_goal_history';

  // --- Saved Intent Templates ---

  static getSavedTemplates(): SavedIntentTemplate[] {
    try {
      const stored = localStorage.getItem(this.TEMPLATES_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Default mock templates as requested
    return [
      {
        id: 'tpl-1',
        title: 'Friday Chicken Biryani',
        intent: 'Order Chicken Biryani',
        provider: 'Paradise',
        payment: 'UPI',
        address: 'Home',
        addons: ['Extra Raita'],
        icon: '🍗',
        color: '#f59e0b' // amber
      },
      {
        id: 'tpl-2',
        title: 'Morning Coffee',
        intent: 'Order a cappuccino',
        provider: 'Blue Tokai',
        icon: '☕',
        color: '#d97706' // amber-600
      },
      {
        id: 'tpl-3',
        title: 'Monthly Electricity Bill',
        intent: 'Pay electricity bill',
        provider: 'BESCOM',
        icon: '⚡',
        color: '#3b82f6' // blue
      }
    ];
  }

  static saveTemplate(template: SavedIntentTemplate) {
    const templates = this.getSavedTemplates();
    templates.push(template);
    localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(templates));
  }

  // --- Goal History ---

  static getHistory(): GoalHistoryRecord[] {
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    
    // Default mock history
    return [
      {
        id: 'hist-1',
        intent: 'Passport renewed',
        status: 'DONE',
        provider: 'PassportSeva',
        timestamp: Date.now() - 86400000 * 5,
        details: 'Dispatched to home address'
      },
      {
        id: 'hist-2',
        intent: 'Last Friday Biryani',
        status: 'DONE',
        provider: 'Paradise',
        timestamp: Date.now() - 86400000 * 7,
        details: 'Delivered in 34 mins'
      },
      {
        id: 'hist-3',
        intent: 'Weekend Hotel',
        status: 'DONE',
        provider: 'MakeMyTrip',
        timestamp: Date.now() - 86400000 * 14,
        details: 'Taj Goa · 2 Nights'
      }
    ];
  }

  static addHistoryRecord(record: GoalHistoryRecord) {
    const history = this.getHistory();
    history.unshift(record);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
  }
}
