import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Smartphone, Volume2, Vibrate } from "lucide-react";
import { toast } from "sonner";
import { showTestNotification, requestNotificationPermission } from "@/utils/serviceWorkerRegistration";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NotificationPreferences {
 chat_notifications: boolean;
 app_updates: boolean;
 marketing_alerts: boolean;
 transaction_alerts: boolean;
 call_notifications: boolean;
 group_notifications: boolean;
 sound_enabled: boolean;
 vibration_enabled: boolean;
}

export const NotificationSettings = ({ userId }: { userId?: string }) => {
 const [preferences, setPreferences] = React.useState<NotificationPreferences>({
 chat_notifications: true,
 app_updates: true,
 marketing_alerts: false,
 transaction_alerts: true,
 call_notifications: true,
 group_notifications: true,
 sound_enabled: true,
 vibration_enabled: true,
 });
 const [loading, setLoading] = React.useState(true);
 const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission>("default");
 const [customSound, setCustomSound] = React.useState("default");

 React.useEffect(() => {
 if (!userId) return;

 const loadPreferences = async () => {
 const { data, error } = await supabase
 .from('notification_preferences')
 .select('*')
 .eq('user_id', userId)
 .single();

 if (error) {
 console.error('Error loading preferences:', error);
 } else if (data) {
 setPreferences({
 chat_notifications: data.chat_notifications,
 app_updates: data.app_updates,
 marketing_alerts: data.marketing_alerts,
 transaction_alerts: data.transaction_alerts,
 call_notifications: data.call_notifications,
 group_notifications: data.group_notifications,
 sound_enabled: data.sound_enabled,
 vibration_enabled: data.vibration_enabled,
 });
 }

 const { data: profileData } = await supabase
 .from('profiles')
 .select('default_notification_sound')
 .eq('id', userId)
 .single();
 
 if (profileData?.default_notification_sound) {
 setCustomSound(profileData.default_notification_sound);
 }

 setLoading(false);
 };

 loadPreferences();
 
 // Check if Notification API is available
 if (typeof Notification !== 'undefined') {
 setNotificationPermission(Notification.permission);
 }
 }, [userId]);

 const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
 if (!userId) return;

 setPreferences(prev => ({ ...prev, [key]: value }));

 const { error } = await supabase
 .from('notification_preferences')
 .upsert({
 user_id: userId,
 [key]: value,
 updated_at: new Date().toISOString()
 }, {
 onConflict: 'user_id'
 });

 if (error) {
 console.error('Error updating preferences:', error);
 toast.error('Failed to update notification settings');
 // Revert on error
 setPreferences(prev => ({ ...prev, [key]: !value }));
 } else {
 toast.success('Notification settings updated');
 }
 };

 const updateCustomSound = async (soundId: string) => {
 if (!userId) return;

 setCustomSound(soundId);

 // Play preview
 let soundFile = '/notification.mp3';
 if (soundId !== 'default') {
 soundFile = `/ringtones/${soundId}.mp3`;
 }
 
 try {
 const audio = new Audio(soundFile);
 audio.volume = 0.5;
 await audio.play();
 } catch (error) {
 console.error("Failed to play preview", error);
 }

 const { error } = await supabase
 .from('profiles')
 .update({ default_notification_sound: soundId })
 .eq('id', userId);

 if (error) {
 console.error('Error updating sound:', error);
 toast.error('Failed to update sound preference');
 } else {
 toast.success('Notification sound updated');
 }
 };

 const handleRequestPermission = async () => {
 const permission = await requestNotificationPermission();
 setNotificationPermission(permission);
 
 if (permission === 'granted') {
 toast.success('Notification permission granted!');
 } else {
 toast.error('Notification permission denied');
 }
 };

 const handleTestNotification = async () => {
 if (notificationPermission !== 'granted') {
 toast.error('Please enable notifications first');
 return;
 }

 await showTestNotification(
 'Test Notification',
 'This is a test notification from Chatr!'
 );
 toast.success('Test notification sent!');
 };

 if (loading) {
 return <div>Loading...</div>;
 }

 return (
 <div className="space-y-6">
 {/* Permission Status */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 {notificationPermission === 'granted' ? (
 <Bell className="w-5 h-5 text-green-500" />
 ) : (
 <BellOff className="w-5 h-5 text-red-500" />
 )}
 Notification Permission
 </CardTitle>
 <CardDescription>
 {notificationPermission === 'granted' 
 ? 'Notifications are enabled for this device' 
 : 'Enable notifications to receive alerts even when the app is closed'}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {notificationPermission !== 'granted' && (
 <Button onClick={handleRequestPermission} className="w-full">
 Enable Notifications
 </Button>
 )}
 {notificationPermission === 'granted' && (
 <Button onClick={handleTestNotification} variant="outline" className="w-full">
 Send Test Notification
 </Button>
 )}
 </CardContent>
 </Card>

 {/* Notification Types */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Smartphone className="w-5 h-5" />
 Notification Types
 </CardTitle>
 <CardDescription>
 Choose which notifications you want to receive
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="flex items-center justify-between">
 <Label htmlFor="chat" className="flex-1">
 <div className="font-medium">Chat Messages</div>
 <div className="text-secondary text-muted-foreground">New messages from your contacts</div>
 </Label>
 <Switch
 id="chat"
 checked={preferences.chat_notifications}
 onCheckedChange={(checked) => updatePreference('chat_notifications', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="calls" className="flex-1">
 <div className="font-medium">Call Notifications</div>
 <div className="text-secondary text-muted-foreground">Incoming voice and video calls</div>
 </Label>
 <Switch
 id="calls"
 checked={preferences.call_notifications}
 onCheckedChange={(checked) => updatePreference('call_notifications', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="groups" className="flex-1">
 <div className="font-medium">Group Messages</div>
 <div className="text-secondary text-muted-foreground">Messages in group chats</div>
 </Label>
 <Switch
 id="groups"
 checked={preferences.group_notifications}
 onCheckedChange={(checked) => updatePreference('group_notifications', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="transactions" className="flex-1">
 <div className="font-medium">Transaction Alerts</div>
 <div className="text-secondary text-muted-foreground">Payment and wallet updates</div>
 </Label>
 <Switch
 id="transactions"
 checked={preferences.transaction_alerts}
 onCheckedChange={(checked) => updatePreference('transaction_alerts', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="updates" className="flex-1">
 <div className="font-medium">App Updates</div>
 <div className="text-secondary text-muted-foreground">New features and improvements</div>
 </Label>
 <Switch
 id="updates"
 checked={preferences.app_updates}
 onCheckedChange={(checked) => updatePreference('app_updates', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="marketing" className="flex-1">
 <div className="font-medium">Marketing & Offers</div>
 <div className="text-secondary text-muted-foreground">Promotional content and deals</div>
 </Label>
 <Switch
 id="marketing"
 checked={preferences.marketing_alerts}
 onCheckedChange={(checked) => updatePreference('marketing_alerts', checked)}
 />
 </div>
 </CardContent>
 </Card>

 {/* Notification Behavior */}
 <Card>
 <CardHeader>
 <CardTitle>Notification Behavior</CardTitle>
 <CardDescription>
 Customize how notifications appear
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="flex items-center justify-between">
 <Label htmlFor="sound" className="flex-1 flex items-center gap-2">
 <Volume2 className="w-4 h-4" />
 <div>
 <div className="font-medium">Sound</div>
 <div className="text-secondary text-muted-foreground">Play sound for notifications</div>
 </div>
 </Label>
 <Switch
 id="sound"
 checked={preferences.sound_enabled}
 onCheckedChange={(checked) => updatePreference('sound_enabled', checked)}
 />
 </div>

 {preferences.sound_enabled && (
 <div className="flex items-center justify-between border-t pt-4 mt-2">
 <Label className="flex-1">
 <div className="font-medium">Message Sound</div>
 <div className="text-secondary text-muted-foreground">Select a custom notification sound</div>
 </Label>
 <Select value={customSound} onValueChange={updateCustomSound}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Select sound" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="default">Default</SelectItem>
 <SelectItem value="frog-sms">Frog SMS</SelectItem>
 <SelectItem value="i-got-5">I Got 5</SelectItem>
 <SelectItem value="jetsons">Jetsons</SelectItem>
 <SelectItem value="message-notify">Message Notify</SelectItem>
 <SelectItem value="trap-text">Trap Text</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}

 <div className="flex items-center justify-between">
 <Label htmlFor="vibration" className="flex-1 flex items-center gap-2">
 <Vibrate className="w-4 h-4" />
 <div>
 <div className="font-medium">Vibration</div>
 <div className="text-secondary text-muted-foreground">Vibrate for notifications</div>
 </div>
 </Label>
 <Switch
 id="vibration"
 checked={preferences.vibration_enabled}
 onCheckedChange={(checked) => updatePreference('vibration_enabled', checked)}
 />
 </div>
 </CardContent>
 </Card>
 </div>
 );
};
