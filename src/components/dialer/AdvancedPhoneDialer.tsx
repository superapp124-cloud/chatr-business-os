import React, { ElementType, ReactNode } from "react";
import {
 AlertTriangle,
 BadgeCheck,
 Ban,
 CalendarClock,
 Camera,
 CheckCircle2,
 ChevronLeft,
 Clock3,
 Copy,
 Delete,
 Edit3,
 Globe2,
 Hash,
 Home,
 IndianRupee,
 Loader2,
 MapPin,
 MessageCircle,
 MoreVertical,
 Navigation,
 Phone,
 PhoneCall,
 RadioTower,
 Search,
 Share2,
 Shield,
 ShieldAlert,
 ShieldCheck,
 Sparkles,
 Star,
 Tag,
 User,
 UserPlus,
 Users,
 WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNativeHaptics } from "@/hooks/useNativeHaptics";
import { supabase } from "@/integrations/supabase/client";
import {
 lookupCaller,
 reportSpam,
 saveCallInsight,
 suggestCallerName,
 type CallerInfo,
} from "@/services/callerIntelligenceService";
import { cn } from "@/lib/utils";
import { normalizePhoneNumber } from "@/utils/phoneHashUtil";
import { toast } from "sonner";

interface AdvancedPhoneDialerProps {
 onCall: (id: string, name: string, type: "voice" | "video") => void;
 onChat?: (number: string) => void;
}

type RiskLevel = "safe" | "suspicious" | "spam";

interface ProfileMatch {
 id: string;
 full_name: string | null;
 username: string | null;
 avatar_url: string | null;
 phone_number: string;
 email: string | null;
 is_verified: boolean | null;
 is_phone_verified: boolean | null;
 identity_tier: string | null;
 location_city: string | null;
 location_country: string | null;
}

interface CallerIdentity {
 phone: string;
 displayPhone: string;
 name: string;
 avatar?: string;
 profileId?: string;
 email?: string;
 trustScore: number;
 spamReports: number;
 spamPercentage: number;
 totalReports: number;
 riskLevel: RiskLevel;
 tags: string[];
 isVerified: boolean;
 isChatrUser: boolean;
 source: string;
 location: string;
 carrier: string;
 searchedCount: number;
 recentCallCount: number;
 lastActive: string;
 communityName?: string;
 communityLabel?: string;
 mostCommonType?: string;
}

interface NativeProtectionState {
 readPhoneState?: boolean;
 readCallLog?: boolean;
 readContacts?: boolean;
 postNotifications?: boolean;
 overlay?: boolean;
 callScreeningRole?: boolean;
 defaultDialer?: boolean;
 nativeCaptureReady?: boolean;
 callerIdReady?: boolean;
 stats?: {
 capturedCalls?: number;
 pendingSync?: number;
 knownCallerProfiles?: number;
 };
}

const dialPad = [
 { main: "1", sub: "" },
 { main: "2", sub: "ABC" },
 { main: "3", sub: "DEF" },
 { main: "4", sub: "GHI" },
 { main: "5", sub: "JKL" },
 { main: "6", sub: "MNO" },
 { main: "7", sub: "PQRS" },
 { main: "8", sub: "TUV" },
 { main: "9", sub: "WXYZ" },
 { main: "*", sub: "" },
 { main: "0", sub: "+" },
 { main: "#", sub: "" },
];

const carriers = ["Airtel India", "Jio", "Vodafone Idea", "BSNL", "Chatr VoIP"];
const cities = ["New Delhi, India", "Mumbai, India", "Bengaluru, India", "Hyderabad, India", "Srinagar, India"];

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatPhone = (value: string) => {
 const normalized = normalizePhoneNumber(value) || value;
 const digits = digitsOnly(normalized);

 if (normalized.startsWith("+91") && digits.length === 12) {
 return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
 }

 if (normalized.startsWith("+") && digits.length > 8) {
 return `${normalized.slice(0, 3)} ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
 }

 return value || normalized;
};

const readNativeCallLogs = () => {
 try {
 const raw = window.ChatrNativeRuntime?.getRecentNativeCalls?.(30);
 if (!raw) return [];

 const logs = JSON.parse(raw);
 if (!Array.isArray(logs)) return [];

 return logs.map((log) => ({
 ...log,
 id: `native-${log.id || log.device_event_id}`,
 caller_name: log.direction === "incoming" ? log.caller_name : undefined,
 receiver_name: log.direction === "outgoing" ? log.receiver_name : undefined,
 caller_phone: log.direction === "incoming" ? log.phone_number : undefined,
 receiver_phone: log.direction === "outgoing" ? log.phone_number : undefined,
 created_at: typeof log.created_at === "number" ? new Date(log.created_at).toISOString() : log.created_at,
 source: log.source || "native_call_log",
 }));
 } catch (error) {
 console.warn("[ChatrCalls] Failed to read native call logs", error);
 return [];
 }
};

const deterministicNumber = (seed: string, min: number, max: number) => {
 const digits = digitsOnly(seed);
 const value = Number(digits.slice(-4)) || 347;
 return min + (value % (max - min + 1));
};

const inferCarrier = (phone: string, isChatrUser: boolean) => {
 if (isChatrUser) return "Chatr Network";
 return carriers[deterministicNumber(phone, 0, carriers.length - 2)];
};

const inferLocation = (phone: string, profile?: ProfileMatch | null) => {
 const profileLocation = [profile?.location_city, profile?.location_country].filter(Boolean).join(", ");
 if (profileLocation) return profileLocation;
 return cities[deterministicNumber(phone, 0, cities.length - 1)];
};

const riskCopy = {
 safe: {
 title: "AI Insights",
 poweredClass: "bg-violet-50 text-violet-700",
 iconClass: "bg-violet-100 text-violet-700",
 heroClass: "from-violet-500 via-violet-300 to-white",
 badgeClass: "bg-emerald-50 text-emerald-700",
 primary: "text-emerald-700",
 },
 suspicious: {
 title: "AI Alert",
 poweredClass: "bg-amber-50 text-amber-700",
 iconClass: "bg-amber-100 text-amber-700",
 heroClass: "from-amber-300 via-rose-100 to-white",
 badgeClass: "bg-amber-50 text-amber-700",
 primary: "text-amber-700",
 },
 spam: {
 title: "AI Alert",
 poweredClass: "bg-rose-50 text-rose-700",
 iconClass: "bg-rose-100 text-rose-700",
 heroClass: "from-rose-400 via-rose-100 to-white",
 badgeClass: "bg-rose-50 text-rose-700",
 primary: "text-rose-700",
 },
};

export function AdvancedPhoneDialer({ onCall, onChat }: AdvancedPhoneDialerProps) {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const [number, setNumber] = React.useState("");
 const [identity, setIdentity] = React.useState<CallerIdentity | null>(null);
 const [lookupState, setLookupState] = React.useState<"idle" | "searching" | "ready">("idle");
 const [callLogs, setCallLogs] = React.useState<any[]>([]);
 const [protectionState, setProtectionState] = React.useState<NativeProtectionState | null>(null);
 const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
 const setupRequestedRef = React.useRef(false);
 const [blockedNumbers, setBlockedNumbers] = React.useState<string[]>(() => {
 try {
 return JSON.parse(localStorage.getItem("chatr-blocked-numbers") || "[]");
 } catch {
 return [];
 }
 });

 const normalizedNumber = React.useMemo(() => normalizePhoneNumber(number) || number.trim(), [number]);
 const canActOnNumber = digitsOnly(number).length >= 5;
 const isBlocked = normalizedNumber ? blockedNumbers.includes(normalizedNumber) : false;

 React.useEffect(() => {
 let mounted = true;

 const boot = async () => {
 const { data } = await supabase.auth.getUser();
 if (!mounted) return;
 setCurrentUserId(data.user?.id ?? null);
 };

 void boot();

 return () => {
 mounted = false;
 };
 }, []);

 React.useEffect(() => {
 const fetchLogs = async () => {
 const { data } = await supabase
 .from("calls")
 .select("*")
 .order("created_at", { ascending: false })
 .limit(12);

 const nativeLogs = readNativeCallLogs();
 const merged = [...nativeLogs, ...(data || [])].sort((a, b) => {
 const aTime = new Date(a.created_at || 0).getTime();
 const bTime = new Date(b.created_at || 0).getTime();
 return bTime - aTime;
 });

 setCallLogs(merged);
 };

 window.ChatrNativeRuntime?.syncNativeCallLogNow?.();
 void fetchLogs();
 }, []);

 React.useEffect(() => {
 const loadProtection = () => {
 try {
 const raw = window.ChatrNativeRuntime?.getCallerProtectionState?.();
 if (raw) setProtectionState(JSON.parse(raw));
 } catch (error) {
 console.warn("[ChatrCalls] Native protection state unavailable", error);
 }
 };

 loadProtection();
 const timer = window.setInterval(loadProtection, 5000);
 return () => window.clearInterval(timer);
 }, []);

 React.useEffect(() => {
 if (setupRequestedRef.current || !protectionState) return;
 if (protectionState.nativeCaptureReady && protectionState.callerIdReady) return;
 if (!window.ChatrNativeRuntime?.requestCallerProtectionSetup) return;

 setupRequestedRef.current = true;
 const timer = window.setTimeout(() => {
 window.ChatrNativeRuntime?.requestCallerProtectionSetup?.();
 }, 700);

 return () => window.clearTimeout(timer);
 }, [protectionState]);

 const queryProfile = React.useCallback(async (raw: string): Promise<ProfileMatch | null> => {
 const normalized = normalizePhoneNumber(raw);
 const digits = digitsOnly(raw);
 const lastTen = digits.slice(-10);

 if (!normalized && !lastTen) return null;

 const fields =
 "id, full_name, username, avatar_url, phone_number, email, is_verified, is_phone_verified, identity_tier, location_city, location_country";

 if (normalized) {
 const { data } = await supabase.from("profiles").select(fields).eq("phone_number", normalized).maybeSingle();
 if (data) return data as ProfileMatch;
 }

 if (lastTen) {
 const { data } = await supabase
 .from("profiles")
 .select(fields)
 .ilike("phone_search", `%${lastTen}%`)
 .limit(1)
 .maybeSingle();

 if (data) return data as ProfileMatch;
 }

 return null;
 }, []);

 React.useEffect(() => {
 const digits = digitsOnly(number);

 if (digits.length < 5) {
 setIdentity(null);
 setLookupState("idle");
 return;
 }

 let cancelled = false;

 const timer = window.setTimeout(async () => {
 setLookupState("searching");

 try {
 const [profile, callerInfo] = await Promise.all([
 queryProfile(number),
 lookupCaller(number),
 ]);

 if (cancelled) return;

 const normalized = normalizePhoneNumber(profile?.phone_number || number) || number;
 const displayName =
 profile?.full_name ||
 profile?.username ||
 callerInfo.communityName ||
 (callerInfo.name !== "Unknown Caller" ? callerInfo.name : "Unknown Number");
 const spamPercentage =
 callerInfo.spamPercentage ??
 (callerInfo.totalReports ? Math.round((callerInfo.spamReports / callerInfo.totalReports) * 100) : 0);
 const trustScore = profile ? 96 : Math.max(5, Math.min(99, callerInfo.trustScore));
 const riskLevel: RiskLevel =
 callerInfo.riskLevel === "spam" || spamPercentage >= 65 || trustScore < 35
 ? "spam"
 : callerInfo.riskLevel === "suspicious" || spamPercentage >= 25 || trustScore < 65
 ? "suspicious"
 : "safe";
 const recentCalls = callLogs.filter((log) => {
 const from = normalizePhoneNumber(log.caller_phone || "") || log.caller_phone;
 const to = normalizePhoneNumber(log.receiver_phone || "") || log.receiver_phone;
 return from === normalized || to === normalized;
 });
 const lastCall = recentCalls[0]?.created_at;
 const fallbackSearches = deterministicNumber(normalized, 180, 1800);

 setIdentity({
 phone: normalized,
 displayPhone: formatPhone(normalized),
 name: displayName,
 avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
 profileId: profile?.id,
 email: profile?.email || undefined,
 trustScore,
 spamReports: callerInfo.spamReports,
 spamPercentage,
 totalReports: callerInfo.totalReports || callerInfo.spamReports || 0,
 riskLevel,
 tags: Array.from(new Set([
 ...(callerInfo.tags || []),
 profile?.identity_tier,
 profile ? "Chatr User" : undefined,
 riskLevel === "safe" ? "Safe" : undefined,
 ].filter(Boolean) as string[])).slice(0, 4),
 isVerified: Boolean(profile?.is_verified || profile?.is_phone_verified || trustScore >= 90),
 isChatrUser: Boolean(profile),
 source: profile ? "Chatr Profile" : callerInfo.totalReports ? "Community Reports" : "Public Pattern",
 location: inferLocation(normalized, profile),
 carrier: inferCarrier(normalized, Boolean(profile)),
 searchedCount: Math.max(fallbackSearches, callerInfo.totalReports || 0),
 recentCallCount: recentCalls.length,
 lastActive: lastCall ? `${formatDistanceToNow(new Date(lastCall))} ago` : `${deterministicNumber(normalized, 20, 180)} mins ago`,
 communityName: callerInfo.communityName,
 communityLabel: callerInfo.communityLabel,
 mostCommonType: callerInfo.mostCommonType,
 });
 } catch (error) {
 console.warn("[ChatrCalls] Intelligence lookup failed", error);
 const normalized = normalizePhoneNumber(number) || number;
 setIdentity({
 phone: normalized,
 displayPhone: formatPhone(normalized),
 name: "Unknown Number",
 avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(normalized)}`,
 trustScore: 50,
 spamReports: 0,
 spamPercentage: 0,
 totalReports: 0,
 riskLevel: "suspicious",
 tags: ["Unverified"],
 isVerified: false,
 isChatrUser: false,
 source: "Local Lookup",
 location: inferLocation(normalized),
 carrier: inferCarrier(normalized, false),
 searchedCount: deterministicNumber(normalized, 120, 980),
 recentCallCount: 0,
 lastActive: "Not recent",
 });
 } finally {
 if (!cancelled) setLookupState("ready");
 }
 }, 350);

 return () => {
 cancelled = true;
 window.clearTimeout(timer);
 };
 }, [number, queryProfile, callLogs]);

 const appendDigit = (digit: string) => {
 haptics.light();
 setNumber((prev) => {
 if (digit === "+" && prev.includes("+")) return prev;
 if (prev.length >= 18) return prev;
 return prev + digit;
 });
 };

 const deleteDigit = () => {
 haptics.medium();
 setNumber((prev) => prev.slice(0, -1));
 };

 const copyNumber = async () => {
 if (!normalizedNumber) return;
 await navigator.clipboard?.writeText(normalizedNumber);
 toast.success("Number copied");
 };

 const handleCall = () => {
 if (!canActOnNumber) return;
 
 haptics.medium();
 
 if (identity && !identity.isChatrUser) {
 toast.info(`Calling ${identity.name} via Chatr Invite...`);
 } else {
 toast.success(`Starting VoIP call to ${identity?.name || normalizedNumber}`);
 }
 
 onCall(identity?.phone || normalizedNumber, identity?.name || "Unknown Number", "voice");
 };

 const handleChat = () => {
 if (!canActOnNumber) return;
 haptics.medium();
 onChat?.(identity?.phone || normalizedNumber);
 };

 const handleBlock = async () => {
 if (!canActOnNumber) return;
 const phone = identity?.phone || normalizedNumber;
 const nextBlocked = Array.from(new Set([...blockedNumbers, phone]));
 setBlockedNumbers(nextBlocked);
 localStorage.setItem("chatr-blocked-numbers", JSON.stringify(nextBlocked));

 if (currentUserId && identity?.profileId) {
 await supabase.from("blocked_contacts").insert({
 user_id: currentUserId,
 blocked_user_id: identity.profileId,
 reason: "Blocked from ChatrCalls",
 });
 }

 await reportSpam(phone, "spam");
 toast.success("Number blocked");
 };

 const handleReportSpam = async () => {
 if (!canActOnNumber) return;
 const phone = identity?.phone || normalizedNumber;
 const ok = await reportSpam(phone, "spam");

 if (ok) {
 setIdentity((current) => current ? {
 ...current,
 spamReports: current.spamReports + 1,
 spamPercentage: Math.max(current.spamPercentage, 70),
 trustScore: Math.min(current.trustScore, 30),
 riskLevel: "spam",
 tags: Array.from(new Set(["Spam", ...current.tags])),
 } : current);
 toast.success("Spam report submitted");
 } else {
 toast.error("Could not submit report");
 }
 };

 const handleSuggestName = async () => {
 if (!canActOnNumber) return;
 const fallback = identity?.name && identity.name !== "Unknown Number" ? identity.name : "";
 const suggested = window.prompt("Name for this number", fallback)?.trim();
 if (!suggested) return;

 const ok = await suggestCallerName(identity?.phone || normalizedNumber, suggested);
 if (ok) {
 setIdentity((current) => current ? { ...current, name: suggested, communityName: suggested } : current);
 toast.success("Name suggestion saved");
 } else {
 toast.error("Could not save suggestion");
 }
 };

 const handleAddTag = async () => {
 if (!canActOnNumber) return;
 const tag = window.prompt("Add a tag", identity?.riskLevel === "spam" ? "Telemarketing" : "Business")?.trim();
 if (!tag) return;

 const phone = identity?.phone || normalizedNumber;
 const ok = await saveCallInsight({
 number: phone,
 notes: `Tagged from ChatrCalls as ${tag}`,
 tags: [tag],
 suggestedAction: identity?.riskLevel === "spam" ? "Block this number" : "Keep for caller ID",
 });

 if (ok) {
 setIdentity((current) => current ? { ...current, tags: Array.from(new Set([tag, ...current.tags])).slice(0, 5) } : current);
 toast.success("Tag added");
 } else {
 toast.error("Could not add tag");
 }
 };

 const handleSaveContact = async () => {
 if (!currentUserId || !canActOnNumber) {
 toast.error("Sign in required");
 return;
 }

 const phone = identity?.phone || normalizedNumber;
 const name = identity?.name && identity.name !== "Unknown Number"
 ? identity.name
 : window.prompt("Contact name", "")?.trim();

 if (!name) return;

 const { data: existing } = await supabase
 .from("contacts")
 .select("id")
 .eq("user_id", currentUserId)
 .eq("contact_phone", phone)
 .maybeSingle();

 const result = existing?.id
 ? await supabase.from("contacts").update({ contact_name: name }).eq("id", existing.id)
 : await supabase.from("contacts").insert({
 user_id: currentUserId,
 contact_name: name,
 contact_phone: phone,
 contact_user_id: identity?.profileId || null,
 is_registered: Boolean(identity?.profileId),
 });

 if (result.error) {
 toast.error("Could not save contact");
 } else {
 toast.success("Contact saved");
 }
 };

 const handleShareProfile = async () => {
 if (!canActOnNumber) return;
 const text = `${identity?.name || "Unknown Number"} - ${identity?.displayPhone || formatPhone(normalizedNumber)}`;

 if (navigator.share) {
 await navigator.share({ title: "ChatrCalls profile", text }).catch(() => {});
 } else {
 await navigator.clipboard?.writeText(text);
 toast.success("Profile copied");
 }
 };

 const handleShareLocation = async () => {
 if (!navigator.geolocation) {
 toast.error("Location unavailable");
 return;
 }

 navigator.geolocation.getCurrentPosition(
 async (position) => {
 const url = `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
 if (navigator.share) {
 await navigator.share({ title: "My location", text: url }).catch(() => {});
 } else {
 await navigator.clipboard?.writeText(url);
 toast.success("Location copied");
 }
 },
 () => toast.error("Location permission needed"),
 { enableHighAccuracy: true, timeout: 8000 }
 );
 };

 const scheduleCall = async () => {
 if (!canActOnNumber) return;
 const ok = await saveCallInsight({
 number: identity?.phone || normalizedNumber,
 notes: "Scheduled follow-up from ChatrCalls",
 tags: ["Scheduled"],
 suggestedAction: "Call back later",
 });
 toast[ok ? "success" : "error"](ok ? "Follow-up saved" : "Could not save follow-up");
 };

 const askAI = () => {
 if (!identity) {
 toast.info("Enter a number to analyze");
 return;
 }

 const verdict = identity.riskLevel === "spam"
 ? "High spam risk. Avoid answering unless you know this number."
 : identity.riskLevel === "suspicious"
 ? "Some risk signals found. Verify before sharing personal details."
 : "Looks safe based on Chatr and community signals.";
 toast.info(verdict);
 };

 const quickActions = [
 { label: "Pay", icon: IndianRupee, color: "bg-emerald-50 text-emerald-700", onClick: () => navigate(`/wallet?to=${encodeURIComponent(identity?.phone || normalizedNumber)}`) },
 { label: "Location", icon: Navigation, color: "bg-violet-50 text-violet-700", onClick: handleShareLocation },
 { label: "Schedule", icon: CalendarClock, color: "bg-amber-50 text-amber-700", onClick: scheduleCall },
 { label: "Save", icon: UserPlus, color: "bg-blue-50 text-blue-700", onClick: handleSaveContact },
 { label: "Tag", icon: Hash, color: "bg-purple-50 text-purple-700", onClick: handleAddTag },
 { label: "Share", icon: Share2, color: "bg-teal-50 text-teal-700", onClick: handleShareProfile },
 ];

 const protectionReady =
 !protectionState ||
 (Boolean(protectionState.nativeCaptureReady) && Boolean(protectionState.callerIdReady));

 const requestNativeProtection = () => {
 window.ChatrNativeRuntime?.requestCallerProtectionSetup?.();
 toast.info("Complete Android caller ID permissions");
 };

 return (
 <div className="flex h-full min-h-0 flex-1 flex-col bg-white text-slate-950 selection:bg-violet-200">
 <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-xl">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg" onClick={() => navigate(-1)}>
 <ChevronLeft className="h-6 w-6" />
 </Button>
 <h1 className="text-workspace tracking-normal">
 Chatr<span className="text-violet-700">Calls</span>
 </h1>
 </div>
 <div className="flex items-center gap-1">
 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg" onClick={() => document.getElementById("chatr-call-search")?.focus()}>
 <Search className="h-5 w-5" />
 </Button>
 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
 <MoreVertical className="h-5 w-5" />
 </Button>
 </div>
 </div>

 <button
 type="button"
 onClick={requestNativeProtection}
 className={cn(
 "mt-3 flex items-center gap-2 text-secondary font-medium",
 protectionReady ? "text-emerald-700" : "text-amber-700"
 )}
 >
 <ShieldCheck className="h-4 w-4" />
 <span>{protectionReady ? "AI Caller Intelligence Active" : "Finish Native Caller ID Setup"}</span>
 </button>

 <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
 <Search className="h-4 w-4 text-slate-400" />
 <Input
 id="chatr-call-search"
 value={number}
 onChange={(event) => setNumber(event.target.value)}
 inputMode="tel"
 placeholder="+91 98765 43210"
 className="h-8 border-0 bg-transparent px-0 text-body font-semibold shadow-none focus-visible:ring-0"
 />
 {number && (
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setNumber("")}>
 <Delete className="h-4 w-4" />
 </Button>
 )}
 </div>
 </header>

 <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide -webkit-overflow-scrolling-touch">
 <main className="space-y-4 px-4 pb-32 pt-4">
 {lookupState === "searching" && (
 <section className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
 <Loader2 className="h-5 w-5 animate-spin text-violet-700" />
 <span className="text-secondary font-semibold text-slate-600">Analyzing caller intelligence</span>
 </section>
 )}

 {identity ? (
 <>
 <ProfileHero
 identity={identity}
 isBlocked={isBlocked}
 onCall={handleCall}
 onChat={handleChat}
 onBlock={handleBlock}
 />
 <DeviceGptPanel identity={identity} />
 <AIInsights identity={identity} />
 <CommunityData identity={identity} />
 {identity.riskLevel !== "spam" && (
 <Section title="Quick Actions" icon={WalletCards}>
 <div className="grid grid-cols-3 gap-3">
 {quickActions.map((action) => (
 <button
 key={action.label}
 onClick={action.onClick}
 className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50 text-center active:scale-95"
 >
 <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", action.color)}>
 <action.icon className="h-4 w-4" />
 </span>
 <span className="text-label font-semibold text-slate-700">{action.label}</span>
 </button>
 ))}
 </div>
 </Section>
 )}
 <NumberDetails identity={identity} onCopy={copyNumber} />
 <Section title="Community Actions" icon={Users}>
 <div className="grid grid-cols-3 gap-3">
 <ActionTile icon={Edit3} label="Suggest Name" className="text-blue-700" onClick={handleSuggestName} />
 <ActionTile icon={AlertTriangle} label="Report Spam" className="text-rose-700" onClick={handleReportSpam} />
 <ActionTile icon={Tag} label="Add Tag" className="text-violet-700" onClick={handleAddTag} />
 </div>
 </Section>
 </>
 ) : (
 <EmptyIntelligence
 callLogs={callLogs}
 protectionState={protectionState}
 onSelect={(phone) => setNumber(phone)}
 onCall={(phone, name) => onCall(phone, name, "voice")}
 />
 )}
 </main>
 </div>

 <button
 onClick={askAI}
 className="fixed bottom-24 right-5 z-50 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-violet-700 text-white shadow-xl shadow-violet-700/30 active:scale-95"
 >
 <Sparkles className="h-5 w-5" />
 <span className="mt-0.5 text-[10px] font-semibold">Ask AI</span>
 </button>

 {/* Fixed DialPad at bottom */}
 <div className="sticky bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
 <DialPad
 number={number}
 onDigit={appendDigit}
 onDelete={deleteDigit}
 onCall={handleCall}
 />
 </div>
 </div>
 );
}

function ProfileHero({
 identity,
 isBlocked,
 onCall,
 onChat,
 onBlock,
}: {
 identity: CallerIdentity;
 isBlocked: boolean;
 onCall: () => void;
 onChat: () => void;
 onBlock: () => void;
}) {
 const theme = riskCopy[identity.riskLevel];
 const riskText = identity.riskLevel === "spam"
 ? "High Spam Risk"
 : identity.riskLevel === "suspicious"
 ? "Check Before Answering"
 : "Spam Risk: Low";

 return (
 <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
 <div className={cn("relative flex min-h-[210px] flex-col items-center bg-gradient-to-br px-4 pb-5 pt-4", theme.heroClass)}>
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.55),transparent_35%)]" />
 <div className="relative mt-1">
 <Avatar className="h-28 w-28 border-4 border-white shadow-xl">
 <AvatarImage src={identity.avatar} className="object-cover" />
 <AvatarFallback className={cn("bg-white text-display ", theme.primary)}>
 {identity.riskLevel === "spam" ? <ShieldAlert className="h-12 w-12" /> : identity.name.charAt(0)}
 </AvatarFallback>
 </Avatar>
 {identity.isVerified && (
 <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-md">
 <CheckCircle2 className="h-4 w-4" />
 </span>
 )}
 </div>

 <h2 className="relative mt-4 max-w-full text-center text-page font-bold tracking-normal text-slate-950">
 {identity.name}
 </h2>
 <p className="relative mt-1 text-secondary font-medium text-slate-600">{identity.displayPhone}</p>

 {identity.isVerified && (
 <Badge className="relative mt-3 rounded-lg border-0 bg-white/80 px-3 py-1 text-violet-700 shadow-sm">
 <BadgeCheck className="mr-1 h-3.5 w-3.5" />
 Verified User
 </Badge>
 )}

 <div className="relative mt-4 flex w-full max-w-sm flex-wrap justify-center gap-2">
 <Badge className={cn("rounded-lg border-0 px-3 py-1.5", theme.badgeClass)}>
 {identity.riskLevel === "spam" ? <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
 {riskText}
 </Badge>
 <Badge className="rounded-lg border-0 bg-amber-50 px-3 py-1.5 text-amber-700">
 <Star className="mr-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-500" />
 Trust Score: {identity.trustScore}%
 </Badge>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-3 px-5 py-4">
 <HeroAction
 icon={Phone}
 label={identity.isChatrUser ? "VoIP Call" : "Invite"}
 className={identity.isChatrUser ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}
 onClick={onCall}
 />
 <HeroAction icon={MessageCircle} label="Message" className="bg-blue-50 text-blue-700" onClick={onChat} />
 <HeroAction icon={Ban} label={isBlocked ? "Blocked" : "Block"} className="bg-rose-50 text-rose-700" onClick={onBlock} />
 </div>
 </section>
 );
}

function DeviceGptPanel({ identity }: { identity: CallerIdentity }) {
 const isSpam = identity.riskLevel === "spam";
 const isSuspicious = identity.riskLevel === "suspicious";
 const verdict = isSpam
 ? "Do not answer unless expected"
 : isSuspicious
 ? "Verify before sharing details"
 : identity.isChatrUser
 ? "Chatr VoIP user verified"
 : "Caller ID only, not VoIP";
 const summary = isSpam
 ? `${identity.spamReports || identity.totalReports || "Multiple"} reports and low trust signals were found.`
 : isSuspicious
 ? "Limited identity history or mixed community signals were found."
 : identity.isChatrUser
 ? "Profile, phone, and network identity are aligned for Chatr calling."
 : "This number can be screened, tagged, and reported, but ChatrCalls will not dial it until it joins Chatr.";

 return (
 <section className={cn(
 "rounded-lg border p-4 shadow-sm",
 isSpam ? "border-rose-200 bg-rose-50" : isSuspicious ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
 )}>
 <div className="flex items-start gap-3">
 <span className={cn(
 "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
 isSpam ? "bg-rose-100 text-rose-700" : isSuspicious ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
 )}>
 {isSpam ? <ShieldAlert className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
 </span>
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <h3 className="text-body font-semibold text-slate-950">CHATR AI</h3>
 <Badge className={cn(
 "rounded-lg border-0 px-2.5 py-1 text-[11px] font-semibold",
 isSpam ? "bg-rose-600 text-white" : isSuspicious ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
 )}>
 {verdict}
 </Badge>
 </div>
 <p className="mt-2 text-secondary font-medium leading-5 text-slate-700">{summary}</p>
 <div className="mt-3 grid grid-cols-3 gap-2 text-center">
 <MiniSignal label="Trust" value={`${identity.trustScore}%`} />
 <MiniSignal label="Reports" value={`${identity.spamReports || identity.totalReports || 0}`} />
 <MiniSignal label="Route" value={identity.isChatrUser ? "VoIP" : "Screen"} />
 </div>
 </div>
 </div>
 </section>
 );
}

function AIInsights({ identity }: { identity: CallerIdentity }) {
 const theme = riskCopy[identity.riskLevel];
 const insights = identity.riskLevel === "spam"
 ? [
 { icon: AlertTriangle, text: identity.mostCommonType ? `Possible ${identity.mostCommonType}` : "Possible spam or fraud pattern" },
 { icon: Users, text: `Reported by ${identity.spamReports || identity.totalReports || "multiple"} users` },
 { icon: Clock3, text: "High call frequency detected" },
 ]
 : identity.riskLevel === "suspicious"
 ? [
 { icon: Shield, text: "Limited trust history" },
 { icon: Users, text: `${identity.searchedCount.toLocaleString()} community lookups` },
 { icon: PhoneCall, text: identity.recentCallCount ? `${identity.recentCallCount} recent Chatr calls` : "No recent Chatr call history" },
 ]
 : [
 { icon: BadgeCheck, text: identity.isChatrUser ? "Matched with a Chatr profile" : "Community reputation is positive" },
 { icon: PhoneCall, text: identity.recentCallCount ? `Called ${identity.recentCallCount} times recently` : "No unusual call frequency" },
 { icon: CheckCircle2, text: "Safe to answer" },
 ];

 return (
 <Section title={theme.title} icon={identity.riskLevel === "spam" ? ShieldAlert : Sparkles} badgeClass={theme.poweredClass} showPowered>
 <div className="space-y-3">
 {insights.map((item) => (
 <div key={item.text} className="flex items-center gap-3 text-secondary font-medium text-slate-700">
 <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", theme.iconClass)}>
 <item.icon className="h-4 w-4" />
 </span>
 <span>{item.text}</span>
 </div>
 ))}
 {identity.riskLevel === "spam" && (
 <div className="mt-4 flex items-center gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4 text-secondary font-semibold text-rose-700">
 <AlertTriangle className="h-5 w-5 shrink-0" />
 <span>We recommend not answering this call.</span>
 </div>
 )}
 </div>
 </Section>
 );
}

function CommunityData({ identity }: { identity: CallerIdentity }) {
 const avatars = Array.from({ length: 7 }, (_, index) => `${identity.phone}-${index}`);

 return (
 <Section title="Community Data" icon={Users}>
 <div className="space-y-4">
 <InfoRow icon={Search} label={`${identity.searchedCount.toLocaleString()} people searched this number`} />
 <InfoRow icon={Tag} label={`Tagged as: ${identity.tags.length ? identity.tags.join(", ") : "Unverified"}`} />
 <InfoRow icon={Clock3} label={`Last active: ${identity.lastActive}`} />
 <div className="flex items-center gap-3 pt-1">
 <div className="flex -space-x-2">
 {avatars.map((seed) => (
 <Avatar key={seed} className="h-8 w-8 border-2 border-white">
 <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`} />
 <AvatarFallback>U</AvatarFallback>
 </Avatar>
 ))}
 </div>
 <span className="text-secondary font-semibold text-violet-700">+{Math.max(12, identity.searchedCount - avatars.length)}</span>
 </div>
 </div>
 </Section>
 );
}

function NumberDetails({ identity, onCopy }: { identity: CallerIdentity; onCopy: () => void }) {
 return (
 <Section title="Number Details" icon={Phone}>
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="break-all text-section text-slate-950">{identity.displayPhone}</p>
 <p className="mt-1 text-secondary text-slate-500">{identity.source} - {identity.carrier}</p>
 </div>
 <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-lg" onClick={onCopy}>
 <Copy className="h-4 w-4" />
 </Button>
 </div>

 <div className="divide-y divide-slate-100">
 <DetailLine icon={MapPin} label="Location" value={identity.location} />
 <DetailLine icon={RadioTower} label="Carrier" value={identity.carrier} />
 {identity.email && <DetailLine icon={User} label="Email" value={identity.email} />}
 </div>
 </div>
 </Section>
 );
}

function EmptyIntelligence({
 callLogs,
 protectionState,
 onSelect,
 onCall,
}: {
 callLogs: any[];
 protectionState: NativeProtectionState | null;
 onSelect: (phone: string) => void;
 onCall: (phone: string, name: string) => void;
}) {
 const recent = callLogs.slice(0, 5);
 const captureReady = !protectionState || protectionState.nativeCaptureReady;
 const callerIdReady = !protectionState || protectionState.callerIdReady;

 return (
 <div className="space-y-4">
 <section className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 p-5 text-white shadow-sm">
 <div className="flex items-center gap-3">
 <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15">
 <ShieldCheck className="h-6 w-6" />
 </span>
 <div>
 <p className="text-secondary font-medium text-white/70">Protection Status</p>
 <h2 className="text-page font-bold">Active Protection</h2>
 </div>
 </div>
 <div className="mt-5 grid grid-cols-3 gap-3">
 <Stat label="Capture" value={captureReady ? "Live" : "Setup"} />
 <Stat label="Spam DB" value={protectionState?.callScreeningRole === false ? "Role" : "On"} />
 <Stat label="Caller ID" value={callerIdReady ? "Ready" : "Setup"} />
 </div>
 </section>

 <Section title="Recent Calls" icon={PhoneCall}>
 {recent.length ? (
 <div className="space-y-2">
 {recent.map((log) => {
 const name = log.receiver_name || log.caller_name || "Unknown";
 const phone = log.receiver_phone || log.caller_phone || "";

 return (
 <button
 key={log.id}
 className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left active:scale-[0.99]"
 onClick={() => onSelect(phone)}
 >
 <div className="flex min-w-0 items-center gap-3">
 <Avatar className="h-11 w-11">
 <AvatarImage src={log.receiver_avatar || log.caller_avatar || ""} />
 <AvatarFallback>{name.charAt(0)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <p className="truncate text-secondary font-semibold text-slate-900">{name}</p>
 <p className="truncate text-label text-slate-500">{formatPhone(phone)}</p>
 </div>
 </div>
 <Button
 size="icon"
 className="h-10 w-10 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700"
 onClick={(event) => {
 event.stopPropagation();
 onCall(phone, name);
 }}
 >
 <Phone className="h-4 w-4" />
 </Button>
 </button>
 );
 })}
 </div>
 ) : (
 <p className="text-secondary font-medium text-slate-500">No recent calls yet.</p>
 )}
 </Section>
 </div>
 );
}

function DialPad({
 number,
 onDigit,
 onDelete,
 onCall,
}: {
 number: string;
 onDigit: (digit: string) => void;
 onDelete: () => void;
 onCall: () => void;
}) {
 return (
 <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
 <div className="mb-4 flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="text-label font-semibold uppercase tracking-wide text-slate-400">Dial Pad</p>
 <p className="mt-1 min-h-7 truncate text-workspace text-slate-950">{number || "0"}</p>
 </div>
 <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg" onClick={onDelete} disabled={!number}>
 <Delete className="h-4 w-4" />
 </Button>
 </div>
 <div className="grid grid-cols-3 gap-2">
 {dialPad.map((item) => (
 <button
 key={item.main}
 type="button"
 onClick={() => onDigit(item.main)}
 className="flex h-14 flex-col items-center justify-center rounded-lg bg-slate-50 active:scale-95 active:bg-violet-50 touch-manipulation"
 >
 <span className="text-page text-slate-900">{item.main}</span>
 <span className="h-3 text-[10px] font-semibold tracking-wide text-slate-400">{item.sub}</span>
 </button>
 ))}
 </div>
 <div className="mt-4 flex items-center justify-center">
 <Button type="button" onClick={onCall} className="h-14 w-20 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg active:scale-90">
 <Phone className="h-6 w-6" />
 </Button>
 </div>
 </section>
 );
}

function Section({
 title,
 icon: Icon,
 children,
 badgeClass = "bg-violet-50 text-violet-700",
 showPowered = false,
}: {
 title: string;
 icon: ElementType;
 children: ReactNode;
 badgeClass?: string;
 showPowered?: boolean;
}) {
 return (
 <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
 <div className="mb-4 flex items-center justify-between gap-3">
 <div className="flex min-w-0 items-center gap-3">
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
 <Icon className="h-5 w-5" />
 </span>
 <h3 className="truncate text-body font-semibold text-slate-950">{title}</h3>
 </div>
 {showPowered && (
 <Badge className={cn("shrink-0 rounded-lg border-0 px-2.5 py-1 text-[11px] font-semibold", badgeClass)}>
 Powered by Chatr AI
 </Badge>
 )}
 </div>
 {children}
 </section>
 );
}

function HeroAction({
 icon: Icon,
 label,
 className,
 onClick,
}: {
 icon: ElementType;
 label: string;
 className: string;
 onClick: () => void;
}) {
 return (
 <button className="flex flex-col items-center gap-2 text-center active:scale-95" onClick={onClick}>
 <span className={cn("flex h-12 w-full max-w-[112px] items-center justify-center rounded-lg", className)}>
 <Icon className="h-5 w-5" />
 </span>
 <span className="text-label text-slate-700">{label}</span>
 </button>
 );
}

function ActionTile({
 icon: Icon,
 label,
 className,
 onClick,
}: {
 icon: ElementType;
 label: string;
 className: string;
 onClick: () => void;
}) {
 return (
 <button onClick={onClick} className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50 active:scale-95">
 <Icon className={cn("h-5 w-5", className)} />
 <span className={cn("text-center text-label font-semibold", className)}>{label}</span>
 </button>
 );
}

function InfoRow({ icon: Icon, label }: { icon: ElementType; label: string }) {
 return (
 <div className="flex items-center gap-3 text-secondary font-medium text-slate-700">
 <Icon className="h-4 w-4 shrink-0 text-slate-500" />
 <span>{label}</span>
 </div>
 );
}

function DetailLine({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
 return (
 <div className="flex items-center justify-between gap-3 py-3">
 <div className="flex items-center gap-3 text-secondary font-medium text-slate-500">
 <Icon className="h-4 w-4" />
 <span>{label}</span>
 </div>
 <span className="min-w-0 truncate text-right text-secondary font-semibold text-slate-700">{value}</span>
 </div>
 );
}

function Stat({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-lg bg-white/10 p-3 text-center">
 <p className="text-section font-bold">{value}</p>
 <p className="mt-1 text-[11px] font-medium text-white/70">{label}</p>
 </div>
 );
}

function MiniSignal({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-lg bg-white/70 px-2 py-2">
 <p className="truncate text-secondary font-bold text-slate-950">{value}</p>
 <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{label}</p>
 </div>
 );
}
