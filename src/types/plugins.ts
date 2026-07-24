declare module '@capacitor/core' {
  interface PluginRegistry {
    ChatrIntelligence: ChatrIntelligencePlugin;
    ChatrSafeSms: ChatrSafeSmsPlugin;
  }
}

export interface ChatrIntelligencePlugin {
  getRecentCalls(options: { limit?: number }): Promise<{ calls: any[] }>;
  getStats(): Promise<any>;
  predictIntent(options: { number: string }): Promise<any>;
}

export interface ChatrSafeSmsPlugin {
  getConversations(options: { limit?: number }): Promise<{ conversations: any[] }>;
  getMessages(options: { conversationId: string; limit?: number }): Promise<{ messages: any[] }>;
  getStats(): Promise<any>;
  syncExistingMessages(options?: { limit?: number }): Promise<{ synced: number }>;
}
