export interface SharedMessage {
  id: string;
  created_at: string;
}

type MergeDirection = 'replace' | 'prepend' | 'append' | 'update';

interface MergeOptions {
  direction: MergeDirection;
  maxMessages?: number;
}

const timestampOf = (message: SharedMessage): number => {
  const time = Date.parse(message.created_at);
  return Number.isFinite(time) ? time : 0;
};

export const sortMessagesAscending = <T extends SharedMessage>(messages: T[]): T[] => {
  return [...messages].sort((a, b) => {
    const byTime = timestampOf(a) - timestampOf(b);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
};

export const dedupeMessagesById = <T extends SharedMessage>(messages: T[]): T[] => {
  const byId = new Map<string, T>();
  for (const message of messages) {
    byId.set(message.id, { ...(byId.get(message.id) || {}), ...message });
  }
  return sortMessagesAscending(Array.from(byId.values()));
};

export const mergeMessagesForParity = <T extends SharedMessage>(
  current: T[],
  incoming: T[],
  options: MergeOptions
): T[] => {
  const maxMessages = options.maxMessages ?? 300;
  const merged = dedupeMessagesById(
    options.direction === 'replace'
      ? incoming
      : [...current, ...incoming]
  );

  if (merged.length <= maxMessages) return merged;

  if (options.direction === 'prepend') {
    return merged.slice(0, maxMessages);
  }

  return merged.slice(-maxMessages);
};

export const getOldestMessageTimestamp = <T extends SharedMessage>(messages: T[]): string | null => {
  const oldest = sortMessagesAscending(messages)[0];
  return oldest?.created_at || null;
};
