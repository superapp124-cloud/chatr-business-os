import { format, isToday, isYesterday } from 'date-fns';

export const relativeTime = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd MMM');
  } catch { return ''; }
};
