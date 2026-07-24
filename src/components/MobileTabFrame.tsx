import { Capacitor } from "@capacitor/core";
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";

export const MobileTabFrame = () => {
 const isNative = Capacitor.isNativePlatform();
 const location = useLocation();
 const searchParams = new URLSearchParams(location.search);
 const hasLegacyConversationQuery =
 location.pathname === "/chat" && searchParams.has("conversation");
 const isFullscreenRoute =
 location.pathname.startsWith("/chat/") ||
 hasLegacyConversationQuery ||
 location.pathname.startsWith("/standalone-messenger/") ||
 location.pathname.startsWith("/calls") ||
 location.pathname.startsWith("/standalone-dialer") ||
 location.pathname === "/status/create" ||
 location.pathname === "/stories/create";
 const usesFullBleedShell = isNative && isFullscreenRoute;

 return (
 <div
 className={cn(
 "h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden"
 )}
 style={
 isNative
 ? {
 paddingTop: usesFullBleedShell
 ? "env(safe-area-inset-top)"
 : "max(4px, env(safe-area-inset-top))",
 }
 : undefined
 }
 >
 <div
 className={cn(
 "flex-1 flex flex-col bg-transparent overflow-y-auto overflow-x-hidden",
 isNative &&
 !usesFullBleedShell &&
 "pb-[calc(82px+env(safe-area-inset-bottom))]"
 )}
 style={
 usesFullBleedShell
 ? { height: "calc(100dvh - env(safe-area-inset-top))" }
 : undefined
 }
 >
 <Outlet />
 </div>
 {!isFullscreenRoute && <BottomNav />}
 </div>
 );
};
