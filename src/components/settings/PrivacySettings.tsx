import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BrainCircuit, Eye, EyeOff, Clock, Image, Shield, Lock, Fingerprint } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isOnDeviceAIEnabled, setOnDeviceAIEnabled } from '@/lib/onDeviceAI';

interface PrivacySettingsProps {
 userId?: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ userId }) => {
 const [settings, setSettings] = useState({
 last_seen_visibility: 'everyone',
 profile_photo_visibility: 'everyone',
 status_visibility: 'everyone',
 read_receipts_enabled: true,
 online_status_visible: true,
 biometric_lock_enabled: false,
 screenshot_notifications: false,
 allow_calls: true,
 on_device_ai_enabled: true,
 });
 const [onDeviceAiEnabled, setOnDeviceAiEnabledState] = useState(isOnDeviceAIEnabled);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 if (userId) {
 loadSettings();
 } else {
 setLoading(false);
 }
 }, [userId]);

 const loadSettings = async () => {
 try {
 const { data, error } = await supabase
 .from('profiles')
 .select('privacy_settings')
 .eq('id', userId!)
 .single();

 if (data?.privacy_settings && typeof data.privacy_settings === 'object') {
 const privacySettings = data.privacy_settings as Record<string, any>;
 setSettings((prev) => {
 const merged = { ...prev, ...privacySettings };
 if (typeof merged.on_device_ai_enabled === 'boolean') {
 setOnDeviceAiEnabledState(merged.on_device_ai_enabled);
 setOnDeviceAIEnabled(merged.on_device_ai_enabled);
 }
 return merged;
 });
 }
 } catch (error) {
 console.error('Error loading privacy settings:', error);
 } finally {
 setLoading(false);
 }
 };

 const saveSettings = async () => {
 if (!userId) return;
 setSaving(true);
 try {
 const { error } = await supabase
 .from('profiles')
 .update({ privacy_settings: settings })
 .eq('id', userId);

 if (error) throw error;
 toast.success('Privacy settings saved');
 } catch (error) {
 console.error('Error saving privacy settings:', error);
 toast.error('Failed to save settings');
 } finally {
 setSaving(false);
 }
 };

 const updateSetting = (key: string, value: any) => {
 setSettings((prev) => ({ ...prev, [key]: value }));
 };

 const updateOnDeviceAiSetting = (checked: boolean) => {
 setOnDeviceAiEnabledState(checked);
 setOnDeviceAIEnabled(checked);
 updateSetting('on_device_ai_enabled', checked);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center p-8">
 <div className="w-6 h-6 border-2 border-primary/60 border-t-transparent rounded-full animate-spin" />
 </div>
 );
 }

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-body">
 <Eye className="w-4 h-4" />
 Visibility
 </CardTitle>
 <CardDescription className="text-label">
 Control who can see your information
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Last Seen */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="flex items-center gap-2 text-secondary">
 <Clock className="w-3.5 h-3.5 text-muted-foreground" />
 Last Seen
 </Label>
 <p className="text-label text-muted-foreground">
 Who can see when you were last online
 </p>
 </div>
 <Select
 value={settings.last_seen_visibility}
 onValueChange={(value) => updateSetting('last_seen_visibility', value)}
 >
 <SelectTrigger className="w-32 h-8 text-label">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="everyone">Everyone</SelectItem>
 <SelectItem value="contacts">My Contacts</SelectItem>
 <SelectItem value="nobody">Nobody</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <Separator />

 {/* Profile Photo */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="flex items-center gap-2 text-secondary">
 <Image className="w-3.5 h-3.5 text-muted-foreground" />
 Profile Photo
 </Label>
 <p className="text-label text-muted-foreground">
 Who can see your profile photo
 </p>
 </div>
 <Select
 value={settings.profile_photo_visibility}
 onValueChange={(value) => updateSetting('profile_photo_visibility', value)}
 >
 <SelectTrigger className="w-32 h-8 text-label">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="everyone">Everyone</SelectItem>
 <SelectItem value="contacts">My Contacts</SelectItem>
 <SelectItem value="nobody">Nobody</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <Separator />

 {/* Status */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="flex items-center gap-2 text-secondary">
 <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
 Status Updates
 </Label>
 <p className="text-label text-muted-foreground">
 Who can see your status updates
 </p>
 </div>
 <Select
 value={settings.status_visibility}
 onValueChange={(value) => updateSetting('status_visibility', value)}
 >
 <SelectTrigger className="w-32 h-8 text-label">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="everyone">Everyone</SelectItem>
 <SelectItem value="contacts">My Contacts</SelectItem>
 <SelectItem value="nobody">Nobody</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-body">
 <Shield className="w-4 h-4" />
 Security
 </CardTitle>
 <CardDescription className="text-label">
 Protect your account and messages
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Read Receipts */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="text-secondary">Read Receipts</Label>
 <p className="text-label text-muted-foreground">
 Show when you've read messages
 </p>
 </div>
 <Switch
 checked={settings.read_receipts_enabled}
 onCheckedChange={(checked) => updateSetting('read_receipts_enabled', checked)}
 />
 </div>

 <Separator />

 {/* Online Status */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="text-secondary">Online Status</Label>
 <p className="text-label text-muted-foreground">
 Show when you're currently online
 </p>
 </div>
 <Switch
 checked={settings.online_status_visible}
 onCheckedChange={(checked) => updateSetting('online_status_visible', checked)}
 />
 </div>

 <Separator />

 {/* Allow Calls */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="text-secondary">Allow Calls</Label>
 <p className="text-label text-muted-foreground">
 Enable voice and video calls
 </p>
 </div>
 <Switch
 checked={settings.allow_calls}
 onCheckedChange={(checked) => updateSetting('allow_calls', checked)}
 />
 </div>

 <Separator />

 {/* Biometric Lock */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="flex items-center gap-2 text-secondary">
 <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
 Biometric Lock
 </Label>
 <p className="text-label text-muted-foreground">
 Require fingerprint/face to open app
 </p>
 </div>
 <Switch
 checked={settings.biometric_lock_enabled}
 onCheckedChange={(checked) => updateSetting('biometric_lock_enabled', checked)}
 />
 </div>

 <Separator />

 {/* On-device AI */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="flex items-center gap-2 text-secondary">
 <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
 On-device AI
 </Label>
 <p className="text-label text-muted-foreground">
 Use Gemini Nano when this phone supports it
 </p>
 </div>
 <Switch
 checked={onDeviceAiEnabled}
 onCheckedChange={updateOnDeviceAiSetting}
 />
 </div>

 <Separator />

 {/* Screenshot Notifications */}
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label className="text-secondary">Screenshot Alerts</Label>
 <p className="text-label text-muted-foreground">
 Notify when someone takes a screenshot
 </p>
 </div>
 <Switch
 checked={settings.screenshot_notifications}
 onCheckedChange={(checked) => updateSetting('screenshot_notifications', checked)}
 />
 </div>
 </CardContent>
 </Card>

 {userId && (
 <Button onClick={saveSettings} disabled={saving} className="w-full">
 {saving ? 'Saving...' : 'Save Privacy Settings'}
 </Button>
 )}
 </div>
 );
};
