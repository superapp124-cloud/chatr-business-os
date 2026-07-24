import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { showNativeMessageNotification } from "@/utils/androidBridge";
import { useCallActiveState } from "@/hooks/useModuleNotifications";

/**
 * Global notification listener that works on ALL screens.
 * NOTE: Realtime filters reliably support eq; we do sender filtering in code.
 */
export function GlobalNotificationListener() {
 const { toast } = useToast();
 const [userId, setUserId] = useState<string | null>(null);

 // Track current user across refresh/login/logout
 useEffect(() => {
 let mounted = true;

 supabase.auth.getUser().then(({ data }) => {
 if (!mounted) return;
 setUserId(data.user?.id || null);
 });

 const {
 data: { subscription },
 } = supabase.auth.onAuthStateChange((_, session) => {
 setUserId(session?.user?.id || null);
 });

 return () => {
 mounted = false;
 subscription.unsubscribe();
 };
 }, []);

 const isCallActive = useCallActiveState();

 useEffect(() => {
 if (!userId) return;

 if (isCallActive) {
 console.log("📵 [Performance] Deferring global notifications channel subscriptions - call active/initiating");
 return;
 }

 console.log("🔔 GlobalNotificationListener active for user:", userId);

 // Request browser notification permission
 if ("Notification" in window && Notification.permission === "default") {
 Notification.requestPermission().catch(() => {});
 }

 const subId = Math.random().toString(36).substring(2, 9);

 // Subscribe to new messages (no invalid neq filter)
 const messagesChannel = supabase
 .channel(`global-messages-notifications:${userId}:${subId}`)
 .on(
 "postgres_changes",
 {
 event: "INSERT",
 schema: "public",
 table: "messages",
 },
 async (payload) => {
 const message = payload.new as any;
 if (!message) return;

 // Ignore our own messages
 if (message.sender_id === userId) return;

 // Check if this message is for the current user
 const { data: participants, error: partError } = await supabase
 .from("conversation_participants")
 .select("user_id")
 .eq("conversation_id", message.conversation_id);

 if (partError) {
 console.warn("⚠️ Failed to fetch conversation participants:", partError);
 return;
 }

 const isForCurrentUser = participants?.some((p: any) => p.user_id === userId);
 if (!isForCurrentUser) return;

 // Get sender info
 const { data: sender } = await supabase
 .from("profiles")
 .select("username, avatar_url")
 .eq("id", message.sender_id)
 .maybeSingle();

 const senderName = sender?.username || "Someone";
 const messagePreview =
 (message.content?.substring(0, 50) || "New message") +
 ((message.content?.length || 0) > 50 ? "..." : "");
 const messageBody = message.content?.substring(0, 100) || "New message";
 const shouldUseNativeBackgroundNotification =
 typeof document !== "undefined" &&
 (document.visibilityState !== "visible" || !document.hasFocus());

 if (shouldUseNativeBackgroundNotification) {
 const nativeNotified = showNativeMessageNotification({
 senderId: message.sender_id,
 senderName,
 messageText: messageBody,
 conversationId: message.conversation_id,
 senderAvatar: sender?.avatar_url || null,
 });

 if (nativeNotified) {
 console.log(
 "🔔 [GlobalNotificationListener] requested native message notification for:",
 message.conversation_id
 );
 return;
 }
 }

 toast({
 title: senderName,
 description: messagePreview,
 duration: 5000,
 });

 // Play notification sound (best-effort)
 try {
 const audio = new Audio("/ringtones/message-notify.mp3");
 audio.volume = 0.5;
 audio.play().catch(() => {});
 } catch {
 // ignore
 }

 // Browser notification if window not focused
 if (
 "Notification" in window &&
 Notification.permission === "granted" &&
 !document.hasFocus()
 ) {
 const notification = new Notification(senderName, {
 body: messageBody,
 icon: sender?.avatar_url || "/favicon.png",
 tag: message.conversation_id,
 });
 setTimeout(() => notification.close(), 5000);
 notification.onclick = () => {
 window.focus();
 notification.close();
 };
 }
 }
 )
 .subscribe((status) => {
 console.log("📡 global-messages-notifications channel status:", status);
 });

 // Subscribe to appointment updates
 const appointmentsChannel = supabase
 .channel(`global-appointments-notifications:${userId}:${subId}`)
 .on(
 "postgres_changes",
 {
 event: "*",
 schema: "public",
 table: "appointments",
 filter: `patient_id=eq.${userId}`,
 },
 async (payload) => {
 const appointment = payload.new as any;

 if (payload.eventType === "UPDATE") {
 toast({
 title: "Appointment Updated",
 description: `Your appointment status: ${appointment.status}`,
 duration: 5000,
 });
 } else if (payload.eventType === "INSERT") {
 toast({
 title: "Appointment Confirmed",
 description: "Your appointment has been scheduled",
 duration: 5000,
 });
 }
 }
 )
 .subscribe((status) => {
 console.log("📡 global-appointments-notifications channel status:", status);
 });

 return () => {
 supabase.removeChannel(messagesChannel);
 supabase.removeChannel(appointmentsChannel);
 };
 }, [userId, isCallActive]);

 return null;
}
