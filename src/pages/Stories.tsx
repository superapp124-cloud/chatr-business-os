import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, CircleDashed, Loader2, PencilLine, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StoryRecord {
 id: string;
 user_id: string;
 media_url: string | null;
 media_type: 'image' | 'video' | 'text';
 caption: string | null;
 created_at: string;
 expires_at: string;
 profile?: {
 username: string;
 avatar_url: string | null;
 };
}

interface StoryGroup {
 userId: string;
 displayName: string;
 username: string;
 avatarUrl: string | null;
 stories: StoryRecord[];
 latestAt: string;
 hasViewed: boolean;
 isSelf: boolean;
}

const quickStatusOptions = [
 'Available now',
 'In a call',
 'At work',
 'On the move',
] as const;

const getTimeAgo = (dateString: string) => {
 const then = new Date(dateString).getTime();
 const diffSeconds = Math.max(1, Math.floor((Date.now() - then) / 1000));

 if (diffSeconds < 60) return 'Just now';
 if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
 if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
 return `${Math.floor(diffSeconds / 86400)}d ago`;
};

const Stories = () => {
 const navigate = useNavigate();
 const location = useLocation();
 const haptics = useNativeHaptics();
 const [user, setUser] = useState<any>(null);
 const [profile, setProfile] = useState<any>(null);
 const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
 const [statusDraft, setStatusDraft] = useState('');
 const [loading, setLoading] = useState(true);
 const [savingStatus, setSavingStatus] = useState(false);
 const [showViewer, setShowViewer] = useState(false);
 const [viewerStories, setViewerStories] = useState<StoryRecord[]>([]);
 const [viewerIndex, setViewerIndex] = useState(0);
 const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
 const [allProfiles, setAllProfiles] = useState<any[]>([]);
 const [contactDisplayNames, setContactDisplayNames] = useState<Map<string, string>>(new Map());

 const selfGroup = useMemo(
 () => storyGroups.find((group) => group.isSelf) ?? null,
 [storyGroups]
 );
 const contactGroups = useMemo(
 () => storyGroups.filter((group) => !group.isSelf),
 [storyGroups]
 );

 const recentUpdatesList = useMemo(() => {
 const list: Array<{
 userId: string;
 displayName: string;
 avatarUrl: string | null;
 hasStories: boolean;
 stories: StoryRecord[];
 statusNote: string | null;
 latestAt: string;
 hasViewed: boolean;
 }> = [];

 allProfiles.forEach(p => {
 if (p.id === user?.id) return;

 const group = storyGroups.find(g => g.userId === p.id);
 let hasStories = !!(group && group.stories.length > 0);
 let statusNote = p.status || null;
 let globalStoryRecord: any = null;

 if (statusNote && statusNote.startsWith('{') && statusNote.endsWith('}')) {
 try {
 const parsed = JSON.parse(statusNote);
 if (parsed.captionText) {
 statusNote = parsed.captionText;
 hasStories = true; // Force ring to be active
 globalStoryRecord = {
 id: `global-${p.id}`,
 user_id: p.id,
 media_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
 media_type: 'image',
 caption: p.status,
 created_at: p.updated_at,
 expires_at: new Date(Date.now() + 86400000).toISOString(),
 profile: { username: p.username, avatar_url: p.avatar_url }
 };
 }
 } catch (e) {
 // Normal text
 }
 }

 if (hasStories || statusNote) {
 const displayName = contactDisplayNames.get(p.id) || p.full_name || p.username || 'User';
 list.push({
 userId: p.id,
 displayName,
 avatarUrl: p.avatar_url || null,
 hasStories,
 stories: globalStoryRecord ? [globalStoryRecord, ...(group?.stories || [])] : (group?.stories || []),
 statusNote,
 latestAt: group?.latestAt || p.updated_at || new Date(0).toISOString(),
 hasViewed: group ? group.hasViewed : true
 });
 }
 });

 return list.sort((a, b) => {
 if (a.hasViewed !== b.hasViewed) return a.hasViewed ? 1 : -1;
 return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
 });
 }, [allProfiles, storyGroups, user?.id, contactDisplayNames]);

 const openStoryGroup = useCallback((group: StoryGroup, storyId?: string) => {
 const startIndex = storyId
 ? Math.max(group.stories.findIndex((story) => story.id === storyId), 0)
 : 0;

 setActiveGroupId(group.userId);
 setViewerStories(group.stories);
 setViewerIndex(startIndex);
 setShowViewer(true);
 }, []);

 const loadStatusHub = useCallback(async (currentUserId: string) => {
 const [{ data: profileData }, { data: contactsData }, { data: allProfilesData }] = await Promise.all([
 supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, status, updated_at')
 .eq('id', currentUserId)
 .maybeSingle(),
 supabase
 .from('user_contacts')
 .select('contact_user_id, display_name')
 .eq('user_id', currentUserId),
 supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, status, updated_at')
 ]);

 const displayNamesMap = new Map<string, string>();
 (contactsData ?? []).forEach((contact) => {
 if (contact.display_name && contact.contact_user_id) {
 displayNamesMap.set(contact.contact_user_id, contact.display_name);
 }
 });

 (allProfilesData ?? []).forEach((p) => {
 if (!displayNamesMap.has(p.id)) {
 displayNamesMap.set(p.id, p.full_name || p.username || 'User');
 }
 });

 setContactDisplayNames(displayNamesMap);
 setAllProfiles(allProfilesData ?? []);

 const visibleUserIds = Array.from(
 new Set([
 currentUserId,
 ...(allProfilesData?.map((p) => p.id) ?? [])
 ])
 );

 const { data: storyData, error: storiesError } = await supabase
 .from('stories')
 .select('id, user_id, media_url, media_type, caption, created_at, expires_at')
 .in('user_id', visibleUserIds)
 .gt('expires_at', new Date().toISOString())
 .order('created_at', { ascending: false });

 if (storiesError) {
 throw storiesError;
 }

 const storyIds = storyData?.map((s) => s.id) ?? [];
 let viewsData: any[] = [];
 if (storyIds.length > 0) {
 const { data: fetchedViews } = await supabase
 .from('story_views')
 .select('story_id, viewer_id')
 .in('story_id', storyIds);
 viewsData = fetchedViews ?? [];
 }

 const groupedStories = new Map<string, StoryGroup>();

 (storyData ?? []).forEach((story: any) => {
 const storyProfile = allProfilesData?.find((p) => p.id === story.user_id);
 const isSelf = story.user_id === currentUserId;
 const displayName = isSelf
 ? profileData?.full_name?.split(' ')[0] || profileData?.username || 'You'
 : displayNamesMap.get(story.user_id) ||
 storyProfile?.full_name ||
 storyProfile?.username ||
 'Contact';

 const existingGroup =
 groupedStories.get(story.user_id) ??
 {
 userId: story.user_id,
 displayName,
 username: storyProfile?.username || displayName,
 avatarUrl: isSelf
 ? profileData?.avatar_url || storyProfile?.avatar_url || null
 : storyProfile?.avatar_url || null,
 stories: [],
 latestAt: story.created_at,
 hasViewed: !isSelf,
 isSelf,
 };

 existingGroup.stories.push({
 id: story.id,
 user_id: story.user_id,
 media_url: story.media_url ?? null,
 media_type: story.media_type,
 caption: story.caption ?? '',
 created_at: story.created_at,
 expires_at: story.expires_at,
 profile: {
 username: storyProfile?.username || displayName,
 avatar_url: storyProfile?.avatar_url || null,
 },
 });

 existingGroup.latestAt =
 new Date(existingGroup.latestAt).getTime() > new Date(story.created_at).getTime()
 ? existingGroup.latestAt
 : story.created_at;

 if (!isSelf) {
 const hasViewedStory = viewsData?.some(
 (view: any) => view.story_id === story.id && view.viewer_id === currentUserId
 );
 existingGroup.hasViewed = existingGroup.hasViewed && !!hasViewedStory;
 }

 groupedStories.set(story.user_id, existingGroup);
 });

 const groups = Array.from(groupedStories.values())
 .map((group) => ({
 ...group,
 stories: [...group.stories].sort(
 (left, right) =>
 new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
 ),
 }))
 .sort((left, right) => {
 if (left.isSelf) return -1;
 if (right.isSelf) return 1;
 if (left.hasViewed !== right.hasViewed) return left.hasViewed ? 1 : -1;
 return new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime();
 });

 setProfile(profileData);
 setStatusDraft(profileData?.status ?? '');
 setStoryGroups(groups);

 return groups;
 }, []);

 useEffect(() => {
 let isMounted = true;

 const init = async () => {
 try {
 const {
 data: { session },
 } = await supabase.auth.getSession();

 if (!session) {
 navigate('/auth', { replace: true });
 return;
 }

 if (!isMounted) return;
 setUser(session.user);

 const groups = await loadStatusHub(session.user.id);
 if (!isMounted) return;

 const state = location.state as { createNew?: boolean; selectedStory?: { id?: string } } | null;
 if (state?.createNew) {
 navigate('/status/create', { replace: true });
 } else if (state?.selectedStory?.id) {
 const matchingGroup = groups.find((group) =>
 group.stories.some((story) => story.id === state.selectedStory?.id)
 );
 if (matchingGroup) {
 openStoryGroup(matchingGroup, state.selectedStory.id);
 }
 }
 } catch (error) {
 console.error('Failed to load status hub:', error);
 toast.error('Could not load status right now');
 } finally {
 if (isMounted) {
 setLoading(false);
 }
 }
 };

 void init();

 return () => {
 isMounted = false;
 };
 }, [loadStatusHub, location.state, navigate, openStoryGroup]);

 const refreshStatusHub = useCallback(async () => {
 if (!user?.id) return null;
 try {
 return await loadStatusHub(user.id);
 } catch (error) {
 console.error('Failed to refresh status hub:', error);
 return null;
 }
 }, [loadStatusHub, user?.id]);

 const handleSaveStatus = async () => {
 if (!user?.id) return;

 setSavingStatus(true);
 haptics.light();

 const nextStatus = statusDraft.trim();

 const { error } = await supabase
 .from('profiles')
 .update({ status: nextStatus || null })
 .eq('id', user.id);

 setSavingStatus(false);

 if (error) {
 console.error('Failed to save profile status:', error);
 toast.error('Could not save your status note');
 return;
 }

 setProfile((current: any) => ({ ...current, status: nextStatus || null }));
 await refreshStatusHub();
 toast.success(nextStatus ? 'Status note updated' : 'Status note cleared');
 };

 const handleCloseViewer = async () => {
 setShowViewer(false);
 await refreshStatusHub();
 };

 const handleViewerNext = async () => {
 if (viewerIndex < viewerStories.length - 1) {
 setViewerIndex((current) => current + 1);
 return;
 }

 // Dynamic Instagram-style Story transitions: transition to the next contact group
 const currentGroupIdx = storyGroups.findIndex(g => g.userId === activeGroupId);
 if (currentGroupIdx !== -1 && currentGroupIdx < storyGroups.length - 1) {
 const nextGroup = storyGroups[currentGroupIdx + 1];
 setActiveGroupId(nextGroup.userId);
 setViewerStories(nextGroup.stories);
 setViewerIndex(0);
 return;
 }

 await handleCloseViewer();
 };

 const handleViewerPrevious = async () => {
 if (viewerIndex > 0) {
 setViewerIndex((current) => current - 1);
 return;
 }

 // Dynamic Instagram-style Story transitions: transition to the previous contact group
 const currentGroupIdx = storyGroups.findIndex(g => g.userId === activeGroupId);
 if (currentGroupIdx > 0) {
 const prevGroup = storyGroups[currentGroupIdx - 1];
 setActiveGroupId(prevGroup.userId);
 setViewerStories(prevGroup.stories);
 setViewerIndex(prevGroup.stories.length - 1);
 return;
 }

 await handleCloseViewer();
 };

 // Real-time Status Sync: instantly sync updates and trigger in-app notifications
 useEffect(() => {
 if (!user?.id) return;

 const channel = supabase
 .channel('stories-realtime-hub')
 .on(
 'postgres_changes',
 {
 event: '*',
 schema: 'public',
 table: 'stories',
 },
 async (payload) => {
 console.log('⚡ Realtime story change detected:', payload);
 await refreshStatusHub();

 if (payload.eventType === 'INSERT') {
 const newStory = payload.new as any;
 if (newStory.user_id !== user.id) {
 const { data: profile } = await supabase
 .from('profiles')
 .select('username, full_name')
 .eq('id', newStory.user_id)
 .maybeSingle();

 if (profile) {
 const name = profile.full_name || profile.username || 'A contact';
 toast(`✨ ${name} posted a new status update!`, {
 description: newStory.caption || 'Tap to view',
 duration: 5000,
 action: {
 label: 'Watch',
 onClick: () => {
 refreshStatusHub().then((groups) => {
 if (groups) {
 const matchingGroup = groups.find(g => g.userId === newStory.user_id);
 if (matchingGroup) openStoryGroup(matchingGroup, newStory.id);
 }
 });
 }
 }
 });
 }
 }
 }
 }
 )
 .on(
 'postgres_changes',
 {
 event: 'UPDATE',
 schema: 'public',
 table: 'profiles',
 },
 async (payload) => {
 const newProfile = payload.new as any;
 if (newProfile.id !== user.id && newProfile.status !== payload.old?.status) {
 console.log('⚡ Realtime profile status update:', newProfile);
 await refreshStatusHub();
 toast.info(`✍️ ${newProfile.full_name || newProfile.username} updated their status note: '${newProfile.status || ''}'`, {
 duration: 4000
 });
 }
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [user?.id, refreshStatusHub, openStoryGroup]);

 if (showViewer && viewerStories.length > 0 && user) {
 return (
 <StoryViewer
 stories={viewerStories}
 currentIndex={viewerIndex}
 userId={user.id}
 onClose={handleCloseViewer}
 onNext={() => void handleViewerNext()}
 onPrevious={handleViewerPrevious}
 />
 );
 }

 return (
 <div className="min-h-full bg-[linear-gradient(180deg,#f7f5ff_0%,#f7f8fc_20%,#f7f8fc_100%)]">
 <div className="sticky top-0 z-10 border-b border-black/[0.04] bg-[linear-gradient(180deg,rgba(247,242,255,0.95)_0%,rgba(246,248,252,0.94)_100%)] backdrop-blur-xl">
 <div className="px-4 pb-3 pt-2">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-[1.95rem] font-semibold tracking-tight text-foreground">Status</p>
 <p className="mt-1 text-secondary text-muted-foreground">
 Updates from the people you care about
 </p>
 </div>

 <Button
 type="button"
 variant="ghost"
 className="rounded-full px-3 text-primary hover:bg-primary/8"
 onClick={() => {
 haptics.light();
 navigate('/status/create');
 }}
 >
 <Plus className="mr-1.5 h-4 w-4" />
 New
 </Button>
 </div>
 </div>
 </div>

 <div className="mx-auto max-w-[620px] space-y-6 px-4 pb-8">
 <section className="space-y-3 px-1">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-label font-semibold uppercase tracking-[0.16em] text-muted-foreground">Stories</p>
 <p className="mt-1 text-secondary text-foreground">Tap a ring to watch</p>
 </div>
 {contactGroups.length > 0 ? (
 <p className="text-label text-muted-foreground">{contactGroups.length} active now</p>
 ) : null}
 </div>

 <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
 <button
 type="button"
 onClick={() => {
 haptics.light();
 if (selfGroup?.stories.length) {
 openStoryGroup(selfGroup);
 } else {
 navigate('/status/create');
 }
 }}
 className="flex min-w-[86px] shrink-0 flex-col items-center gap-2 text-center"
 >
 <div
 className={cn(
 'relative rounded-full p-[3px]',
 selfGroup?.stories.length
 ? 'bg-gradient-to-br from-fuchsia-500 via-primary to-cyan-400'
 : 'bg-primary/12'
 )}
 >
 <Avatar className="h-16 w-16 border-2 border-white">
 <AvatarImage src={profile?.avatar_url || undefined} />
 <AvatarFallback className="bg-primary/8 text-primary">
 {(profile?.username || user?.email || 'Y')[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-sm">
 <Plus className="h-3.5 w-3.5" />
 </span>
 </div>
 <div>
 <p className="text-label font-semibold text-foreground">Your story</p>
 <p className="text-[11px] text-muted-foreground">
 {selfGroup?.stories.length ? `${selfGroup.stories.length} live` : 'Add update'}
 </p>
 </div>
 </button>

 {contactGroups.map((group) => (
 <button
 key={group.userId}
 type="button"
 onClick={() => {
 haptics.light();
 openStoryGroup(group);
 }}
 className="flex min-w-[86px] shrink-0 flex-col items-center gap-2 text-center"
 >
 <div
 className={cn(
 'rounded-full p-[3px]',
 group.hasViewed
 ? 'bg-black/[0.08]'
 : 'bg-gradient-to-br from-fuchsia-500 via-primary to-cyan-400'
 )}
 >
 <Avatar className="h-16 w-16 border-2 border-white">
 <AvatarImage src={group.avatarUrl || undefined} />
 <AvatarFallback className="bg-primary/8 text-primary">
 {group.displayName[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 </div>
 <div>
 <p className="max-w-[82px] truncate text-label font-semibold text-foreground">
 {group.displayName}
 </p>
 <p className="text-[11px] text-muted-foreground">{getTimeAgo(group.latestAt)}</p>
 </div>
 </button>
 ))}
 </div>
 </section>

 <section className="rounded-[24px] border border-black/[0.04] bg-white/94 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
 <div className="flex items-center gap-3">
 <Avatar className="h-12 w-12 border border-primary/10">
 <AvatarImage src={profile?.avatar_url || undefined} />
 <AvatarFallback className="bg-primary/8 text-primary">
 {(profile?.username || user?.email || 'Y')[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <p className="text-secondary font-semibold text-foreground">Share a quick note</p>
 <p className="truncate text-secondary text-muted-foreground">
 A short update that sits beside your story
 </p>
 </div>
 <Button
 type="button"
 variant="outline"
 className="rounded-full border-black/[0.08] bg-white px-4"
 onClick={() => {
 haptics.light();
 navigate('/status/create');
 }}
 >
 <Camera className="mr-2 h-4 w-4" />
 Story
 </Button>
 </div>

 <div className="mt-4 rounded-[22px] border border-black/[0.05] bg-[#f8f9fd] p-4">
 <Textarea
 value={statusDraft}
 onChange={(event) => setStatusDraft(event.target.value.slice(0, 120))}
 placeholder="What's happening right now?"
 rows={2}
 className="resize-none border-0 bg-transparent px-0 text-body text-foreground shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0"
 />

 <div className="mt-3 flex flex-wrap gap-2">
 {quickStatusOptions.map((option) => (
 <button
 key={option}
 type="button"
 onClick={() => {
 haptics.light();
 setStatusDraft(option);
 }}
 className={cn(
 'rounded-full border px-3 py-1.5 text-label transition-colors',
 statusDraft === option
 ? 'border-primary/30 bg-primary/10 text-primary'
 : 'border-black/[0.06] bg-white text-muted-foreground'
 )}
 >
 {option}
 </button>
 ))}
 </div>

 <div className="mt-4 flex flex-wrap gap-2">
 <Button
 type="button"
 className="rounded-full px-4"
 onClick={() => void handleSaveStatus()}
 disabled={savingStatus}
 >
 {savingStatus ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <PencilLine className="mr-2 h-4 w-4" />
 )}
 Save note
 </Button>

 <Button
 type="button"
 variant="ghost"
 className="rounded-full px-3 text-primary hover:bg-primary/8"
 onClick={() => {
 haptics.light();
 navigate('/status/create');
 }}
 >
 Add story
 </Button>
 </div>
 </div>
 </section>

 <section>
 <div className="mb-3 flex items-center justify-between px-1">
 <p className="text-label font-semibold uppercase tracking-[0.16em] text-muted-foreground">
 Recent updates
 </p>
 </div>

 {loading ? (
 <div className="overflow-hidden rounded-[28px] border border-black/[0.04] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
 <div className="space-y-3">
 <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
 <div className="h-16 animate-pulse rounded-[20px] bg-muted" />
 <div className="h-16 animate-pulse rounded-[20px] bg-muted" />
 </div>
 </div>
 ) : recentUpdatesList.length === 0 ? (
 <div className="rounded-[28px] border border-black/[0.04] bg-white px-5 py-10 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
 <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
 <CircleDashed className="h-7 w-7 text-primary" />
 </div>
 <p className="text-body font-semibold text-foreground">No updates yet</p>
 <p className="mt-1 text-secondary text-muted-foreground">
 When other Chatr users post a status or update their note, it will show up here.
 </p>
 </div>
 ) : (
 <div className="overflow-hidden rounded-[22px] border border-black/[0.04] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
 {recentUpdatesList.map((item, index) => {
 const latestStory = item.stories[item.stories.length - 1];

 return (
 <button
 key={item.userId}
 type="button"
 onClick={() => {
 haptics.light();
 if (item.hasStories) {
 const group = storyGroups.find(g => g.userId === item.userId);
 if (group) openStoryGroup(group);
 } else if (item.statusNote) {
 toast(`✍️ ${item.displayName}'s status note`, {
 description: `"${item.statusNote}"`
 });
 }
 }}
 className={cn(
 'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f8f9fd]',
 index !== recentUpdatesList.length - 1 && 'border-b border-black/[0.04]'
 )}
 >
 <div
 className={cn(
 'rounded-full p-[3px]',
 item.hasStories
 ? item.hasViewed
 ? 'bg-black/[0.08]'
 : 'bg-gradient-to-br from-fuchsia-500 via-primary to-cyan-400'
 : 'bg-primary/10'
 )}
 >
 <Avatar className="h-12 w-12 border-2 border-white">
 <AvatarImage src={item.avatarUrl || undefined} />
 <AvatarFallback className="bg-primary/8 text-primary">
 {item.displayName[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 </div>

 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <p className="truncate text-[15px] font-semibold text-foreground">
 {item.displayName}
 </p>
 {item.hasStories && !item.hasViewed && (
 <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
 New Story
 </span>
 )}
 {!item.hasStories && item.statusNote && (
 <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
 Note
 </span>
 )}
 </div>
 <p className="truncate text-secondary text-muted-foreground">
 {item.hasStories
 ? latestStory?.caption?.trim()
 ? latestStory.caption
 : latestStory?.media_type === 'video'
 ? 'Video update'
 : latestStory?.media_type === 'image'
 ? 'Photo update'
 : 'Text update'
 : item.statusNote}
 </p>
 </div>

 <div className="shrink-0 text-label text-muted-foreground">
 {getTimeAgo(item.latestAt)}
 </div>
 </button>
 );
 })}
 </div>
 )}
 </section>
 </div>
 </div>
 );
};

export default Stories;
