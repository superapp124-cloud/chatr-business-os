import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileEditDialog } from '@/components/ProfileEditDialog';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';
import { ProfileMusicCard } from '@/components/profile/ProfileMusicCard';
import { MutualFriendsDisplay } from '@/components/profile/MutualFriendsDisplay';
import { PhotoAlbumsGrid } from '@/components/profile/PhotoAlbumsGrid';
import { SpotifyNowPlaying } from '@/components/profile/SpotifyNowPlaying';
import { 
 User, 
 Heart, 
 Coins, 
 Settings, 
 Smartphone, 
 LogOut,
 ChevronRight,
 Shield,
 Bell,
 Music,
 Images,
 Fingerprint,
 Bot,
 Globe,
 Folder,
 Palette,
 Image
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppleButton } from '@/components/ui/AppleButton';
import { AppleCard, AppleGroupedList, AppleListItem } from '@/components/ui/AppleCard';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';

const Profile = () => {
 const haptics = useNativeHaptics();
 const navigate = useNavigate();
 const [user, setUser] = useState<any>(null);
 const [profile, setProfile] = useState<any>(null);
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
 const [loading, setLoading] = useState(true);
 
 // Real-time states
 const [badges, setBadges] = useState<any[]>([]);
 const [identityCount, setIdentityCount] = useState<number>(0);
 const [aiCloneCount, setAiCloneCount] = useState<number>(0);
 const [pointsBalance, setPointsBalance] = useState<number>(0);
 const [isDiscoverable, setIsDiscoverable] = useState<boolean>(false);
 const [healthRecordCount, setHealthRecordCount] = useState<number>(0);
 const [deviceCount, setDeviceCount] = useState<number>(0);

 useEffect(() => {
 loadUserData();
 }, []);

 // Ensure onboarding is completed to prevent dialog from showing
 useEffect(() => {
 const markOnboardingComplete = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (session?.user) {
 await supabase
 .from('profiles')
 .update({ onboarding_completed: true })
 .eq('id', session.user.id);
 }
 };
 markOnboardingComplete();
 }, []);

 const loadBadges = async (userId: string) => {
 try {
 const { data } = await supabase
 .from('user_badges')
 .select('id, badge_type, is_active')
 .eq('user_id', userId)
 .eq('is_active', true);
 setBadges(data || []);
 } catch {
 setBadges([]);
 }
 };

 const loadUserData = async () => {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) {
 navigate('/auth');
 return;
 }

 setUser(session.user);

 // Try to fetch existing profile
 const { data: profileData } = await supabase
 .from('profiles')
 .select('*')
 .eq('id', session.user.id)
 .maybeSingle();
 setProfile(profileData);

 await loadBadges(session.user.id);

 // Fetch dynamic stats
 try {
 const { count: idCount } = await supabase.from('identities').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
 setIdentityCount(idCount || 0);

 const { count: aiCount } = await supabase.from('identities').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('ai_clone_enabled', true);
 setAiCloneCount(aiCount || 0);
 } catch (e) { console.error('Identity fetch error', e); }

 try {
 const { data: pts } = await supabase.from('user_points').select('balance').eq('user_id', session.user.id).maybeSingle();
 if (pts) setPointsBalance(pts.balance || 0);
 } catch (e) { console.error('Points fetch error', e); }

 try {
 const { data: disc } = await supabase.from('discover_profiles').select('is_searchable').eq('user_id', session.user.id).maybeSingle();
 if (disc) setIsDiscoverable(disc.is_searchable);
 } catch (e) { console.error('Discover fetch error', e); }

 try {
 const { count: healthCount } = await supabase.from('health_records').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
 setHealthRecordCount(healthCount || 0);
 } catch (e) { console.error('Health fetch error', e); }

 try {
 const { count: dCount } = await supabase.from('user_devices').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
 setDeviceCount(dCount || 0);
 } catch (e) { console.error('Device fetch error', e); }

 } catch (error) {
 console.error('Error loading profile:', error);
 } finally {
 setLoading(false);
 }
 };

 // Real-time subscriptions
 useEffect(() => {
 if (!user?.id) return;
 
 const channel = supabase
 .channel('profile-stats-changes')
 .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${user.id}` }, () => loadBadges(user.id))
 .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${user.id}` }, (p: any) => setPointsBalance(p.new?.balance || 0))
 .on('postgres_changes', { event: '*', schema: 'public', table: 'identities', filter: `user_id=eq.${user.id}` }, async () => {
 try {
 const { count: idCount } = await supabase.from('identities').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
 setIdentityCount(idCount || 0);
 const { count: aiCount } = await supabase.from('identities').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('ai_clone_enabled', true);
 setAiCloneCount(aiCount || 0);
 } catch(e) {}
 })
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [user?.id]);

 const handleSignOut = async () => {
 const { performLogout } = await import('@/utils/logout');
 await performLogout();
 navigate('/auth');
 console.log('[Profile] User signed out');
 };

 if (loading) {
 return (
 <div className="flex h-full min-h-full items-center justify-center bg-background pb-20">
 <div className="text-muted-foreground">Loading...</div>
 </div>
 );
 }

 return (
 <div className="h-full min-h-full overflow-y-auto bg-background pb-28">
 {/* Profile Header - Mobile Optimized */}
 <div className="border-b border-border/60 bg-gradient-to-b from-primary/8 via-background to-background pt-safe">
 <div className="px-4 py-6 text-center">
 <Avatar className="chatr-profile-avatar mx-auto mb-3 h-20 w-20 border-2 border-background shadow-lg shadow-primary/10">
 <AvatarImage src={profile?.avatar_url} className="chatr-profile-avatar-image" />
 <AvatarFallback className="bg-primary text-primary-foreground text-workspace">
 {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
 </AvatarFallback>
 </Avatar>
 
 <div className="flex items-center justify-center gap-1 mb-1">
 <h1 className="text-workspace font-bold">
 {profile?.username || 'Anonymous User'}
 </h1>
 {/* Verified Badges */}
 {badges.map((badge) => (
 <VerifiedBadge 
 key={badge.id}
 type={badge.badge_type as 'verified' | 'creator' | 'business' | 'celebrity'}
 size="md"
 />
 ))}
 </div>

 {profile?.primary_handle && (
 <p className="text-secondary text-muted-foreground font-mono mb-1">@{profile.primary_handle}</p>
 )}
 
 {profile?.status && (
 <p className="text-secondary text-muted-foreground mb-3">{profile.status}</p>
 )}
 
 <AppleButton 
 onClick={() => setIsEditDialogOpen(true)}
 variant="secondary"
 size="sm"
 rounded="full"
 >
 Edit Profile
 </AppleButton>
 </div>
 </div>

 {/* Now Playing / Profile Music */}
 <div className="px-4 pt-4">
 <SpotifyNowPlaying userId={user?.id} />
 <ProfileMusicCard userId={user?.id} editable={true} className="mt-3" />
 </div>

 {/* Profile Content Tabs */}
 <div className="px-4 py-4">
 <Tabs defaultValue="settings" className="w-full">
 <TabsList className="w-full grid grid-cols-3 mb-4">
 <TabsTrigger value="settings">Settings</TabsTrigger>
 <TabsTrigger value="albums">Albums</TabsTrigger>
 <TabsTrigger value="social">Social</TabsTrigger>
 </TabsList>

 <TabsContent value="settings" className="space-y-3">
 {/* CHATR++ Identity */}
 <div className="native-card divide-y divide-border">
 <button
 onClick={() => navigate('/identity')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Fingerprint className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">CHATR++ Identity</h3>
 <p className="text-label text-muted-foreground truncate">
 {profile?.primary_handle 
 ? `@${profile.primary_handle} • ${identityCount} identit${identityCount === 1 ? 'y' : 'ies'}` 
 : 'Claim your handle'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button
 onClick={() => navigate('/ai-clone-settings')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Bot className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">AI Clone Settings</h3>
 <p className="text-label text-muted-foreground truncate">
 {aiCloneCount > 0 ? `${aiCloneCount} AI clone${aiCloneCount > 1 ? 's' : ''} active` : 'Configure your AI identity'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button
 onClick={() => navigate('/discover')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Globe className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Discover People</h3>
 <p className="text-label text-muted-foreground truncate">
 {isDiscoverable ? 'Publicly discoverable' : 'Hidden from search'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>
 </div>

 {/* Health & Points Cards */}
 <div className="native-card divide-y divide-border">
 <button
 onClick={() => navigate('/health-passport')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Heart className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Health Passport</h3>
 <p className="text-label text-muted-foreground truncate">
 {healthRecordCount > 0 ? `${healthRecordCount} medical record${healthRecordCount > 1 ? 's' : ''} linked` : 'Manage health records'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button
 onClick={() => navigate('/chatr-points')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Coins className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Chatr Points</h3>
 <p className="text-label text-muted-foreground truncate">
 {pointsBalance > 0 ? `${pointsBalance.toLocaleString()} points balance` : 'View rewards & wallet'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button
 onClick={() => navigate('/device-management')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Smartphone className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Device Management</h3>
 <p className="text-label text-muted-foreground truncate">
 {deviceCount > 0 ? `${deviceCount} linked device${deviceCount > 1 ? 's' : ''}` : 'Manage linked devices'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>
 </div>

 {/* Settings Section */}
 <div className="native-card divide-y divide-border">
 <div className="px-4 py-3">
 <h3 className="text-label font-semibold text-muted-foreground uppercase tracking-wide">
 Settings
 </h3>
 </div>

 <button 
 onClick={() => navigate('/settings/chat-folders')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Folder className="h-5 w-5 text-[#5c22ff] flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Chat Folders</h3>
 <p className="text-[10px] text-muted-foreground">Organize your chats</p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button 
 onClick={() => navigate('/settings/appearance')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Palette className="h-5 w-5 text-[#5c22ff] flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Profile Themes</h3>
 <p className="text-[10px] text-muted-foreground">Customize colors</p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button 
 onClick={() => navigate('/settings/wallpaper')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Image className="h-5 w-5 text-[#5c22ff] flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">AI Wallpapers</h3>
 <p className="text-[10px] text-muted-foreground">Generative backgrounds</p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button 
 onClick={() => navigate('/settings/app-icon')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Smartphone className="h-5 w-5 text-[#5c22ff] flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">App Icon</h3>
 <p className="text-[10px] text-muted-foreground">Change home screen icon</p>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button 
 onClick={() => navigate('/notification-settings')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Bell className="h-5 w-5 text-muted-foreground flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Notifications</h3>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button 
 onClick={() => navigate('/privacy')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Privacy & Security</h3>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>

 <button 
 onClick={() => navigate('/account')}
 className="w-full flex items-center gap-3 p-3 active:bg-accent/50 transition-colors"
 >
 <Settings className="h-5 w-5 text-muted-foreground flex-shrink-0" />
 <div className="flex-1 text-left min-w-0">
 <h3 className="font-medium text-secondary">Account Settings</h3>
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 </button>
 </div>

 {/* Sign Out — de-emphasized text link (standard pattern) */}
 <div className="pt-6 pb-4 flex justify-center">
 <button
 onClick={handleSignOut}
 className="text-button text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1.5"
 >
 <LogOut className="h-3.5 w-3.5" />
 Sign out
 </button>
 </div>
 </TabsContent>

 <TabsContent value="albums">
 <PhotoAlbumsGrid userId={user?.id} editable={true} />
 </TabsContent>

 <TabsContent value="social">
 <div className="space-y-4">
 <AppleCard className="p-4">
 <h3 className="font-medium mb-3 flex items-center gap-2">
 <User className="w-4 h-4" />
 Mutual Friends
 </h3>
 {user?.id && <MutualFriendsDisplay userId={user.id} maxDisplay={5} />}
 </AppleCard>
 </div>
 </TabsContent>
 </Tabs>
 </div>

 {/* Edit Profile Dialog - Always render so button click works */}
 <ProfileEditDialog
 profile={profile}
 open={isEditDialogOpen}
 onOpenChange={setIsEditDialogOpen}
 onProfileUpdated={loadUserData}
 />
 </div>
 );
};

export default Profile;
