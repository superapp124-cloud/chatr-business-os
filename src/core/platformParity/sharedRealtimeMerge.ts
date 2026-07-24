import { mergeMessagesForParity, SharedMessage } from './sharedPaginationEngine';

export const mergeRealtimeMessage = <T extends SharedMessage>(
  current: T[],
  message: T,
  maxMessages = 300
): T[] => {
  return mergeMessagesForParity(current, [message], {
    direction: 'append',
    maxMessages,
  });
};

export const updateRealtimeMessage = <T extends SharedMessage>(
  current: T[],
  message: T
): T[] => {
  return current.map((existing) => (
    existing.id === message.id ? { ...existing, ...message } : existing
  ));
};
