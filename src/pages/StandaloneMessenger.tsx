import { ChatInterface } from "@/components/chat/ChatInterface";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function StandaloneMessenger() {
 const navigate = useNavigate();
 const { conversationId } = useParams();
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);

 useEffect(() => {
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (!user) {
 navigate('/auth');
 } else {
 setCurrentUserId(user.id);
 }
 });
 }, [navigate]);

 if (!currentUserId) return null;

 return (
 <div className="flex h-screen flex-col bg-background safe-area-pt">
 {/* If conversationId is provided, show that chat, otherwise show a simplified inbox */}
 {conversationId ? (
 <ChatInterface conversationId={conversationId} />
 ) : (
 <div className="flex-1 flex items-center justify-center p-8 text-center">
 <p className="text-muted-foreground">Select a contact to start chatting</p>
 </div>
 )}
 </div>
 );
}
