import React from 'react';
import { cn } from '@/lib/utils';

export const PresenceIndicator: React.FC<{ status?: 'online' | 'away' | 'busy' | 'offline' }> = React.memo(({ status = 'offline' }) => {
 const colors = {
 online: 'bg-emerald-500',
 away: 'bg-amber-400',
 busy: 'bg-red-500',
 offline: 'bg-zinc-500'
 };
 return <span className={cn('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-zinc-950', colors[status])} />;
});
