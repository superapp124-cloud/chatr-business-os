import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lock, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';

interface DocumentLockBadgeProps {
 fileId: string;
 className?: string;
}

export const DocumentLockBadge: React.FC<DocumentLockBadgeProps> = ({ fileId, className }) => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const [lockedBy, setLockedBy] = useState<{ id: string; name: string } | null>(null);

 useEffect(() => {
 // Initial fetch
 const fetchLock = async () => {
 const { data, error } = await supabase
 .from('document_locks')
 .select('locked_by, profiles(full_name)')
 .eq('file_id', fileId)
 .maybeSingle();
 
 if (!error && data?.profiles) {
 setLockedBy({
 id: data.locked_by,
 name: (data.profiles as any).full_name || 'Someone'
 });
 }
 };
 fetchLock();

 // Subscribe to realtime lock changes
 const sub = supabase.channel(`doc-lock-${fileId}`)
 .on('postgres_changes', { event: '*', schema: 'public', table: 'document_locks', filter: `file_id=eq.${fileId}` }, (payload) => {
 if (payload.eventType === 'DELETE') {
 setLockedBy(null);
 } else if (payload.new) {
 // Fetch the profile name
 supabase.from('profiles').select('full_name').eq('id', payload.new.locked_by).maybeSingle().then(({ data }) => {
 setLockedBy({
 id: payload.new.locked_by,
 name: data?.full_name || 'Someone'
 });
 });
 }
 })
 .subscribe();

 return () => {
 supabase.removeChannel(sub);
 };
 }, [fileId]);

 if (!lockedBy) return null;

 return (
 <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm animate-in fade-in zoom-in duration-200", isDark ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200", className)}>
 <PenLine className="w-3 h-3 animate-pulse" />
 <span>Edited by {lockedBy.name}</span>
 </div>
 );
};
