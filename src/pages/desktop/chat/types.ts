export type Room = {
  id: string;
  name: string;
  type: string;
  isPrivate?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
  avatarUrl?: string;
  participants?: string[];
  otherUserPresence?: string;
};

export type Message = {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  actorId?: string;
  content: string;
  attachments?: any[];
  replyToId?: string;
  createdAt: string;
};

export type CopilotMessage = {
  role: 'user' | 'assistant';
  content: string;
  workflowId?: string;
};

export type RightPaneTab = 'copilot' | 'tasks' | 'decisions' | 'notes' | 'calendar';
