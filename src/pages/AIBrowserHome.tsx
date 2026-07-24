import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
 ArrowRight,
 BookOpen,
 Brain,
 ChevronRight,
 Code,
 Flag,
 Globe,
 MapPin,
 Mic,
 Newspaper,
 RefreshCw,
 Search,
 TrendingUp,
 Zap,
} from "lucide-react";
import { useVoiceAI } from "@/hooks/useVoiceAI";

type ModeId = "web" | "news" | "code" | "research" | "bharat";
type Phase = "home" | "loading" | "results";

interface SearchResults {
 main: string | null;
 quick: string | null;
 india: string | null;
}

interface SourceCard {
 index?: number;
 title: string;
 url: string;
 snippet?: string;
 source?: string;
 domain?: string;
 trustTier?: string;
 trustLabel?: string;
 fetchedAt?: string;
}

interface ModelStatus {
 provider: string;
 label: string;
 model?: string;
 status: "ready" | "streaming" | "complete" | "fallback" | "missing_key" | "optional" | "error";
 latencyMs?: number;
}

interface AnswerMeta {
 citations?: SourceCard[];
 relatedQuestions?: string[];
 confidence?: {
 level: "low" | "medium" | "high";
 score: number;
 label: string;
 };
 providerUsed?: string;
 latencyMs?: number;
}

interface LocalAnswerResponse {
 answer: string;
 citations?: SourceCard[];
 relatedQuestions?: string[];
 sources?: SourceCard[];
 confidence?: AnswerMeta["confidence"];
 providerUsed?: string;
 latencyMs?: number;
}

const MODE_TO_CATEGORY: Record<ModeId, string> = {
 web: "web",
 news: "news",
 code: "tech",
 research: "research",
 bharat: "web",
};

const MODES = [
 { id: "web" as const, label: "Web", Icon: Globe },
 { id: "news" as const, label: "News", Icon: Newspaper },
 { id: "code" as const, label: "Code", Icon: Code },
 { id: "research" as const, label: "Research", Icon: BookOpen },
 { id: "bharat" as const, label: "Bharat", Icon: Flag },
];

const SUGGESTIONS = [
 "Best 5G phones under Rs 20,000",
 "How does quantum computing work?",
 "IPL 2026 points table",
 "How to file ITR online",
 "Top AI tools for startups 2026",
 "Delhi to Mumbai flight prices today",
];

const loadingMessages = [
 "Searching the web in real time...",
 "Activating local/free synthesis...",
 "Fetching India-specific context...",
 "Cross-referencing sources...",
 "Synthesizing your answer...",
];

const DEFAULT_MODEL_STATUSES: ModelStatus[] = [
 { provider: "ollama", label: "Ollama Local", status: "ready" },
 { provider: "extractive", label: "Grounded Extractive", status: "ready" },
];

function toFlashAnswer(text: string) {
 if (!text.trim()) return "No quick answer available yet. Try refining your search.";
 const normalized = text
 .replace(/\*\*/g, "")
 .replace(/^#+\s+/gm, "")
 .replace(/^[-*\u2022]\s+/gm, "")
 .replace(/\s+/g, " ")
 .trim();
 const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [normalized];
 return sentences.slice(0, 3).join(" ").trim();
}

function toBharatIntel(text: string, sources: SourceCard[], mode: ModeId) {
 const indiaSources = sources.filter((source) =>
 /(india|\.in$|flipkart|amazon\.in|gadgets360|91mobiles|digit|smartprix|gov\.in|nic\.in|iplt20|bcci)/i.test(
 `${source.domain} ${source.title}`,
 ),
 );
 const sourceLine = indiaSources.length
 ? `- India-relevant sources found: ${indiaSources
 .slice(0, 3)
 .map((source) => `[${source.index || "?"}] ${source.domain || getSourceHost(source.url)}`)
 .join(", ")}.`
 : "- India-specific source signals were limited, so CHATR kept the answer tied to retrieved web context.";

 const modeLine =
 mode === "bharat"
 ? "- Bharat Mode is active: prioritize INR, Indian rules, local platforms, and practical Indian workflows."
 : "- Indian context is applied where the retrieved sources support it.";

 return `### Bharat Intel
${modeLine}
${sourceLine}
- Quick read: ${toFlashAnswer(text)}`;
}

function collapseAdjacentRepeatedPhrases(value: string) {
 let words = value.trim().split(/\s+/).filter(Boolean);
 if (words.length < 2) return words.join(" ");

 for (let size = Math.floor(words.length / 2); size >= 1; size -= 1) {
 const nextWords: string[] = [];

 for (let index = 0; index < words.length; index += 1) {
 const current = words.slice(index, index + size);
 const next = words.slice(index + size, index + size * 2);
 const currentText = current.join(" ").toLowerCase();
 const nextText = next.join(" ").toLowerCase();

 if (current.length === size && next.length === size && currentText === nextText) {
 nextWords.push(...current);
 index += size * 2 - 1;

 while (words.slice(index + 1, index + 1 + size).join(" ").toLowerCase() === currentText) {
 index += size;
 }
 } else {
 nextWords.push(words[index]);
 }
 }

 words = nextWords;
 }

 return words.join(" ");
}

function sanitizeSearchQuery(value: string) {
 let nextValue = value
 .replace(/https?:\/\/\S+/gi, "")
 .replace(/[<>]/g, "")
 .replace(/\s+/g, " ")
 .trim()
 .slice(0, 240);

 for (let pass = 0; pass < 3; pass += 1) {
 nextValue = collapseAdjacentRepeatedPhrases(nextValue);
 }

 return nextValue;
}

function getRelatedBaseQuery(value: string) {
 const sanitized = sanitizeSearchQuery(value);
 const base = sanitized
 .replace(/^(how does|what is|what are|best alternatives to|alternatives to|latest|explain)\s+/i, "")
 .replace(/\s+(work|works|explained|in india|latest 2026|today)$/i, "")
 .trim();

 return base || sanitized;
}

async function localAnswerAPI(query: string, mode: ModeId): Promise<LocalAnswerResponse> {
 const params = new URLSearchParams({ q: sanitizeSearchQuery(query), category: MODE_TO_CATEGORY[mode] });
 const answerPath =
 window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
 ? "http://localhost:8787/api/search/answer"
 : "/api/search/answer";
 const response = await fetch(`${answerPath}?${params.toString()}`);
 if (!response.ok) throw new Error(`Local search failed: ${response.status}`);
 return response.json();
}

function canUseSSESearch() {
 return typeof window !== "undefined" && "EventSource" in window;
}

function canOpenSourceUrl(url: string) {
 return /^https?:\/\//i.test(url);
}

function getSourceHost(url: string) {
 try {
 const parsed = new URL(url);
 if (parsed.protocol === "internal:") return "Chatr fallback";
 return parsed.hostname.replace(/^www\./, "");
 } catch {
 return "Source";
 }
}

function normalizeModelStatus(model: Partial<ModelStatus>): ModelStatus {
 const fallback = DEFAULT_MODEL_STATUSES.find((item) => item.provider === model.provider);
 return {
 provider: model.provider || fallback?.provider || "model",
 label: model.label || fallback?.label || model.provider || "Model",
 model: model.model || fallback?.model,
 status: model.status || fallback?.status || "ready",
 latencyMs: model.latencyMs ?? fallback?.latencyMs,
 };
}

function mergeModelStatus(previous: ModelStatus[], update: Partial<ModelStatus> | ModelStatus[]) {
 if (Array.isArray(update)) return update.map(normalizeModelStatus);
 if (!update.provider) return previous;

 const exists = previous.some((item) => item.provider === update.provider);
 const next = exists
 ? previous.map((item) => (item.provider === update.provider ? normalizeModelStatus({ ...item, ...update }) : item))
 : [...previous, normalizeModelStatus(update)];

 return next;
}

function streamChatrAPI(
 query: string,
 mode: ModeId,
 onToken: (answer: string) => void,
 onStatus: (status: string) => void,
 onSources?: (sources: SourceCard[]) => void,
 onModelStatus?: (update: Partial<ModelStatus> | ModelStatus[]) => void,
 onMeta?: (metadata: AnswerMeta) => void,
): Promise<string> {
 const params = new URLSearchParams({ q: sanitizeSearchQuery(query), category: MODE_TO_CATEGORY[mode] });
 const streamPath =
 window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
 ? "http://localhost:8787/api/search/agent"
 : "/api/search/agent";

 return new Promise((resolve, reject) => {
 const source = new EventSource(`${streamPath}?${params.toString()}`);
 let answer = "";
 let settled = false;

 const timeoutId = window.setTimeout(() => {
 if (settled) return;
 settled = true;
 source.close();
 reject(new Error("SSE search timed out"));
 }, 60000);

 const finish = (callback: () => void) => {
 if (settled) return;
 settled = true;
 window.clearTimeout(timeoutId);
 source.close();
 callback();
 };

 source.onmessage = (event) => {
 try {
 const data = JSON.parse(event.data);

 if (data.type === "step" && data.message) onStatus(data.message);
 if (data.type === "sources") onSources?.(Array.isArray(data.cards) ? data.cards : []);
 if (data.type === "meta") onMeta?.(data);
 if (data.status === "engines_active" && Array.isArray(data.engines)) onModelStatus?.(data.engines);

 if (data.status === "scraping_web") onStatus("Crawling local/free search...");
 if (data.status === "cache_hit") onStatus("Serving cached answer...");
 if (data.status === "synthesizing") {
 onStatus("Streaming local/free synthesis...");
 if (Array.isArray(data.sources)) onSources?.(data.sources);
 }
 if (data.status === "model_stream_start") {
 onStatus(`Streaming ${data.provider || "model"} response...`);
 onModelStatus?.({ provider: data.provider, status: "streaming" });
 }
 if (data.status === "provider_fallback") {
 onStatus(`Switching from ${data.provider || "provider"}...`);
 onModelStatus?.({ provider: data.provider, status: "fallback" });
 }
 if (data.status === "provider_complete") {
 onModelStatus?.({ provider: data.provider, status: "complete", latencyMs: data.latencyMs });
 }
 if (data.status === "provider_error") {
 onModelStatus?.({ provider: data.provider, status: "error", latencyMs: data.latencyMs });
 }
 if (data.status === "complete") {
 onMeta?.({
 citations: Array.isArray(data.citations) ? data.citations : undefined,
 relatedQuestions: Array.isArray(data.relatedQuestions) ? data.relatedQuestions : undefined,
 confidence: data.confidence,
 providerUsed: data.providerUsed || data.provider,
 latencyMs: data.latencyMs,
 });
 }

 const token = data.type === "token" ? data.text : data.token;
 if (token) {
 answer += token;
 onStatus("");
 onToken(answer);
 }

 if (data.type === "error" || data.error) {
 finish(() => reject(new Error(data.detail || data.message || data.error)));
 }

 if (data.status === "complete" || (data.type === "status" && data.status === "complete")) {
 finish(() => resolve(answer.trim()));
 }
 } catch (error) {
 finish(() => reject(error instanceof Error ? error : new Error("Invalid SSE payload")));
 }
 };

 source.onerror = () => {
 finish(() => {
 if (answer.trim()) {
 resolve(answer.trim());
 } else {
 reject(new Error("SSE search server unavailable"));
 }
 });
 };
 });
}

function renderInlineMarkdown(text: string, color = "#E2E8F0") {
 return text.split(/\*\*(.*?)\*\*/g).map((part, index) =>
 index % 2 === 1 ? (
 <strong key={`${part}-${index}`} style={{ color }}>
 {part}
 </strong>
 ) : (
 part
 ),
 );
}

function splitMarkdownTableRow(row: string) {
 return row
 .trim()
 .replace(/^\|/, "")
 .replace(/\|$/, "")
 .split("|")
 .map((cell) => cell.trim());
}

function isMarkdownTableDivider(row: string) {
 const cells = splitMarkdownTableRow(row);
 return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function MD({ text, muted = false }: { text: string | null; muted?: boolean }) {
 if (!text) return null;
 const baseColor = muted ? "#6EE7B7" : "#94A3B8";
 const lines = text.split("\n");
 const rendered: ReactNode[] = [];

 for (let index = 0; index < lines.length; index += 1) {
 const trimmed = lines[index].trim();

 if (trimmed.startsWith("```")) {
 const language = trimmed.slice(3).trim();
 const codeLines: string[] = [];
 let cursor = index + 1;
 while (cursor < lines.length && !lines[cursor].trim().startsWith("```")) {
 codeLines.push(lines[cursor]);
 cursor += 1;
 }

 rendered.push(
 <pre
 key={`code-${index}`}
 style={{
 background: "#070B13",
 border: "1px solid #1A2A42",
 borderRadius: 8,
 color: "#CBD5E1",
 fontSize: 12,
 lineHeight: 1.6,
 margin: "12px 0",
 overflowX: "auto",
 padding: "12px",
 }}
 >
 {language && <div style={{ color: "#64748B", fontSize: 11, marginBottom: 8 }}>{language}</div>}
 <code>{codeLines.join("\n")}</code>
 </pre>,
 );
 index = cursor;
 continue;
 }

 if (!trimmed) {
 rendered.push(<div key={index} style={{ height: 6 }} />);
 continue;
 }

 if (trimmed.startsWith("|") && lines[index + 1] && isMarkdownTableDivider(lines[index + 1].trim())) {
 const tableRows: string[] = [];
 let cursor = index;
 while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
 tableRows.push(lines[cursor].trim());
 cursor += 1;
 }

 const headers = splitMarkdownTableRow(tableRows[0]);
 const bodyRows = tableRows.slice(2).map(splitMarkdownTableRow);
 rendered.push(
 <div key={`table-${index}`} style={{ overflowX: "auto", margin: "12px 0" }}>
 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: baseColor, minWidth: 420 }}>
 <thead>
 <tr>
 {headers.map((header) => (
 <th
 key={header}
 style={{
 textAlign: "left",
 color: "#E2E8F0",
 fontWeight: 650,
 borderBottom: "1px solid #1E2D4A",
 padding: "8px 10px",
 whiteSpace: "nowrap",
 }}
 >
 {renderInlineMarkdown(header)}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {bodyRows.map((row, rowIndex) => (
 <tr key={`${row.join("-")}-${rowIndex}`}>
 {headers.map((header, cellIndex) => (
 <td
 key={`${header}-${cellIndex}`}
 style={{
 borderBottom: "1px solid #0D1A2E",
 padding: "8px 10px",
 verticalAlign: "top",
 lineHeight: 1.5,
 }}
 >
 {renderInlineMarkdown(row[cellIndex] || "", muted ? "#D1FAE5" : "#E2E8F0")}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>,
 );
 index = cursor - 1;
 continue;
 }

 if (trimmed.startsWith("### ")) {
 rendered.push(
 <h3 key={index} style={{ fontSize: 14, fontWeight: 650, color: "#E2E8F0", margin: "14px 0 6px", letterSpacing: 0 }}>
 {trimmed.slice(4)}
 </h3>,
 );
 continue;
 }

 if (trimmed.startsWith("## ")) {
 rendered.push(
 <h2
 key={index}
 style={{
 fontSize: 14,
 fontWeight: 650,
 color: "#E2E8F0",
 margin: "14px 0 6px",
 letterSpacing: 0,
 }}
 >
 {trimmed.slice(3)}
 </h2>,
 );
 continue;
 }

 if (trimmed.startsWith("# ")) {
 rendered.push(
 <h1
 key={index}
 style={{ fontSize: 16, fontWeight: 750, color: "#F1F5F9", margin: "0 0 10px", letterSpacing: 0 }}
 >
 {trimmed.slice(2)}
 </h1>,
 );
 continue;
 }

 if (/^[-*\u2022]\s+/.test(trimmed)) {
 const content = trimmed.replace(/^[-*\u2022]\s+/, "");
 rendered.push(
 <div key={index} style={{ display: "flex", gap: 8, margin: "4px 0", alignItems: "flex-start" }}>
 <ChevronRight size={11} color="#F59E0B" style={{ marginTop: 6, flexShrink: 0 }} />
 <span style={{ fontSize: 14, color: baseColor, lineHeight: 1.65 }}>{renderInlineMarkdown(content)}</span>
 </div>,
 );
 continue;
 }

 rendered.push(
 <p key={index} style={{ fontSize: 14, color: baseColor, margin: "5px 0", lineHeight: 1.65 }}>
 {renderInlineMarkdown(trimmed)}
 </p>,
 );
 }

 return <div>{rendered}</div>;
}

function LegacyMD({ text, muted = false }: { text: string | null; muted?: boolean }) {
 if (!text) return null;
 const baseColor = muted ? "#6EE7B7" : "#94A3B8";

 return (
 <div>
 {text.split("\n").map((line, index) => {
 const trimmed = line.trim();
 if (!trimmed) return <div key={index} style={{ height: 6 }} />;
 if (trimmed.startsWith("## ")) {
 return (
 <h2
 key={index}
 style={{
 fontSize: 14,
 fontWeight: 650,
 color: "#E2E8F0",
 margin: "14px 0 6px",
 letterSpacing: 0,
 }}
 >
 {trimmed.slice(3)}
 </h2>
 );
 }
 if (trimmed.startsWith("# ")) {
 return (
 <h1
 key={index}
 style={{ fontSize: 16, fontWeight: 750, color: "#F1F5F9", margin: "0 0 10px", letterSpacing: 0 }}
 >
 {trimmed.slice(2)}
 </h1>
 );
 }
 if (/^[-*\u2022]\s+/.test(trimmed)) {
 const content = trimmed.replace(/^[-*\u2022]\s+/, "");
 return (
 <div key={index} style={{ display: "flex", gap: 8, margin: "4px 0", alignItems: "flex-start" }}>
 <ChevronRight size={11} color="#F59E0B" style={{ marginTop: 6, flexShrink: 0 }} />
 <span style={{ fontSize: 14, color: baseColor, lineHeight: 1.65 }}>
 {renderInlineMarkdown(content)}
 </span>
 </div>
 );
 }
 return (
 <p key={index} style={{ fontSize: 14, color: baseColor, margin: "5px 0", lineHeight: 1.65 }}>
 {renderInlineMarkdown(trimmed)}
 </p>
 );
 })}
 </div>
 );
}

function SearchBar({
 value,
 onChange,
 onSearch,
 compact = false,
 autoFocus = false,
 isListening = false,
 onVoiceSearch,
}: {
 value: string;
 onChange: (value: string) => void;
 onSearch: (value: string) => void;
 compact?: boolean;
 autoFocus?: boolean;
 isListening?: boolean;
 onVoiceSearch?: () => void;
}) {
 const ref = useRef<HTMLInputElement>(null);
 const [focused, setFocused] = useState(false);
 const hasQuery = Boolean(value.trim());

 useEffect(() => {
 if (autoFocus && ref.current) ref.current.focus();
 }, [autoFocus]);

 return (
 <div
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 background: "#0D1526",
 border: `1px solid ${focused ? "#818CF8" : "#1E2D4A"}`,
 borderRadius: compact ? 10 : 14,
 padding: compact ? "8px 12px" : "14px 16px",
 transition: "border-color 0.2s, box-shadow 0.2s",
 boxShadow: focused ? "0 0 0 3px rgba(129,140,248,0.12)" : "none",
 }}
 >
 <Search
 size={compact ? 15 : 17}
 color={focused ? "#818CF8" : "#4A5568"}
 style={{ flexShrink: 0, transition: "color 0.2s" }}
 />
 <input
 ref={ref}
 value={value}
 onChange={(event) => onChange(event.target.value)}
 onKeyDown={(event) => event.key === "Enter" && onSearch(value)}
 onFocus={() => setFocused(true)}
 onBlur={() => setFocused(false)}
 placeholder={compact ? "Search anything..." : "Ask anything in English, Hindi, or Urdu..."}
 style={{
 flex: 1,
 minWidth: 0,
 background: "none",
 border: "none",
 outline: "none",
 fontSize: compact ? 14 : 15,
 color: "#E2E8F0",
 fontFamily: "inherit",
 }}
 />
 {!compact && (
 <button
 type="button"
 onClick={onVoiceSearch}
 aria-label="Voice search"
 title="Voice search"
 style={{
 width: 34,
 height: 34,
 border: "none",
 borderRadius: 8,
 background: isListening ? "rgba(245,158,11,0.14)" : "transparent",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 cursor: "pointer",
 flexShrink: 0,
 }}
 >
 <Mic size={15} color={isListening ? "#F59E0B" : "#334155"} />
 </button>
 )}
 <button
 type="button"
 onClick={() => onSearch(value)}
 disabled={!hasQuery}
 style={{
 minWidth: compact ? 34 : 92,
 background: hasQuery ? "linear-gradient(135deg,#818CF8,#C084FC)" : "#1A2540",
 border: "none",
 borderRadius: 8,
 padding: compact ? "6px 10px" : "8px 14px",
 cursor: hasQuery ? "pointer" : "not-allowed",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 5,
 color: hasQuery ? "#fff" : "#334155",
 fontSize: 13,
 fontWeight: 550,
 transition: "all 0.2s",
 fontFamily: "inherit",
 }}
 >
 {compact ? (
 <ArrowRight size={13} />
 ) : (
 <>
 <ArrowRight size={14} />
 <span>Search</span>
 </>
 )}
 </button>
 </div>
 );
}

function ModeTabs({
 active,
 onChange,
}: {
 active: ModeId;
 onChange: (mode: ModeId) => void;
}) {
 return (
 <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
 {MODES.map(({ id, label, Icon }) => (
 <button
 key={id}
 type="button"
 onClick={() => onChange(id)}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 5,
 padding: "7px 14px",
 borderRadius: 8,
 border: active === id ? "1px solid #818CF8" : "1px solid #1E2D4A",
 background: active === id ? "rgba(129,140,248,0.1)" : "transparent",
 color: active === id ? "#A5B4FC" : "#64748B",
 fontSize: 13,
 cursor: "pointer",
 transition: "all 0.15s",
 fontFamily: "inherit",
 }}
 >
 <Icon size={12} />
 {label}
 </button>
 ))}
 </div>
 );
}

function HomeView({
 query,
 setQuery,
 onSearch,
 mode,
 setMode,
 isListening,
 onVoiceSearch,
}: {
 query: string;
 setQuery: (query: string) => void;
 onSearch: (query: string) => void;
 mode: ModeId;
 setMode: (mode: ModeId) => void;
 isListening: boolean;
 onVoiceSearch: () => void;
}) {
 return (
 <div
 style={{
 minHeight: "100vh",
 background: "#07090F",
 display: "flex",
 flexDirection: "column",
 alignItems: "center",
 justifyContent: "center",
 padding: "40px 20px",
 fontFamily: "'Segoe UI', system-ui, sans-serif",
 position: "relative",
 overflow: "hidden",
 }}
 >
 <style>{`
 @keyframes chatrLogoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
 .chatr-chip:hover { border-color: #374151 !important; color: #94A3B8 !important; background: rgba(255,255,255,0.03) !important; }
 @media (max-width: 520px) {
 .chatr-home-logo { font-size: 42px !important; }
 .chatr-home-subtitle { letter-spacing: 1px !important; }
 .chatr-home-footer { flex-wrap: wrap; justify-content: center; gap: 12px !important; }
 }
 `}</style>

 <div style={{ marginBottom: 46, textAlign: "center", animation: "chatrLogoFloat 6s ease infinite" }}>
 <div
 className="chatr-home-logo"
 style={{
 fontSize: 56,
 fontWeight: 900,
 letterSpacing: 0,
 background: "linear-gradient(135deg, #818CF8 0%, #C084FC 45%, #F59E0B 100%)",
 WebkitBackgroundClip: "text",
 WebkitTextFillColor: "transparent",
 marginBottom: 10,
 }}
 >
 Chatr AI
 </div>
 <div className="chatr-home-subtitle" style={{ fontSize: 12, color: "#42526F", letterSpacing: 2, fontWeight: 550 }}>
 FREE LOCAL | INDIA-NATIVE | REAL-TIME SEARCH
 </div>
 </div>

 <div style={{ width: "100%", maxWidth: 640, marginBottom: 18 }}>
 <SearchBar
 value={query}
 onChange={setQuery}
 onSearch={onSearch}
 autoFocus
 isListening={isListening}
 onVoiceSearch={onVoiceSearch}
 />
 </div>

 <div style={{ marginBottom: 42 }}>
 <ModeTabs active={mode} onChange={setMode} />
 </div>

 <div style={{ textAlign: "center", maxWidth: 620 }}>
 <div
 style={{
 fontSize: 11,
 color: "#2A3A5A",
 letterSpacing: 2,
 marginBottom: 14,
 textTransform: "uppercase",
 }}
 >
 Try asking
 </div>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
 {SUGGESTIONS.map((suggestion) => (
 <button
 key={suggestion}
 type="button"
 className="chatr-chip"
 onClick={() => onSearch(suggestion)}
 style={{
 padding: "8px 14px",
 borderRadius: 8,
 border: "1px solid #1A2535",
 background: "transparent",
 color: "#64748B",
 fontSize: 13,
 cursor: "pointer",
 transition: "all 0.15s",
 fontFamily: "inherit",
 }}
 >
 {suggestion}
 </button>
 ))}
 </div>
 </div>

 <div
 className="chatr-home-footer"
 style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 20, color: "#243149", fontSize: 12 }}
 >
 <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
 <MapPin size={11} />
 <span>Noida | UP</span>
 </div>
 <div>Free/local stack active</div>
 <div>Real-time search</div>
 </div>
 </div>
 );
}

function LoadingView({ msg, query }: { msg: string; query: string }) {
 return (
 <div
 style={{
 minHeight: "100vh",
 background: "#07090F",
 display: "flex",
 flexDirection: "column",
 alignItems: "center",
 justifyContent: "center",
 gap: 28,
 padding: 20,
 fontFamily: "'Segoe UI', system-ui, sans-serif",
 }}
 >
 <style>{`
 @keyframes spin0 { from{transform:translate(-50%,-50%) rotate(0deg) translateX(34px)} to{transform:translate(-50%,-50%) rotate(360deg) translateX(34px)} }
 @keyframes spin1 { from{transform:translate(-50%,-50%) rotate(120deg) translateX(24px)} to{transform:translate(-50%,-50%) rotate(480deg) translateX(24px)} }
 @keyframes spin2 { from{transform:translate(-50%,-50%) rotate(240deg) translateX(44px)} to{transform:translate(-50%,-50%) rotate(600deg) translateX(44px)} }
 @keyframes pulse { 0%,100%{opacity:0.35} 50%{opacity:1} }
 @keyframes slide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
 `}</style>

 <div style={{ position: "relative", width: 100, height: 100 }}>
 {["#818CF8", "#F59E0B", "#34D399"].map((color, index) => (
 <div
 key={color}
 style={{
 position: "absolute",
 width: 10,
 height: 10,
 borderRadius: "50%",
 background: color,
 top: "50%",
 left: "50%",
 animation: `spin${index} ${1.4 + index * 0.35}s linear infinite`,
 }}
 />
 ))}
 <div
 style={{
 position: "absolute",
 width: 28,
 height: 28,
 borderRadius: "50%",
 background: "linear-gradient(135deg,#818CF8,#C084FC)",
 top: "50%",
 left: "50%",
 transform: "translate(-50%,-50%)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <Brain size={13} color="#fff" />
 </div>
 </div>

 <div style={{ textAlign: "center", maxWidth: 620 }}>
 <div style={{ fontSize: 13, color: "#334155", marginBottom: 10, fontStyle: "italic" }}>"{query}"</div>
 <div key={msg} style={{ fontSize: 14, color: "#64748B", animation: "slide 0.4s ease" }}>
 {msg}
 </div>
 </div>

 <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
 {[
 ["#818CF8", "Synthesis"],
 ["#F59E0B", "Flash"],
 ["#34D399", "Bharat Intel"],
 ].map(([color, name]) => (
 <div key={name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#475569" }}>
 <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1.5s ease infinite" }} />
 {name}
 </div>
 ))}
 </div>
 </div>
 );
}

function Card({
 bg,
 border,
 accent,
 icon,
 label,
 badge,
 children,
 leftBorder,
}: {
 bg: string;
 border: string;
 accent: string;
 icon: ReactNode;
 label: string;
 badge?: string;
 children: ReactNode;
 leftBorder?: string;
}) {
 const isGradient = accent.includes("gradient");
 const labelColor = isGradient ? "#A5B4FC" : accent;
 const cardStyle: CSSProperties = {
 background: bg,
 borderRadius: 8,
 padding: 22,
 border: `1px solid ${border}`,
 borderLeft: leftBorder ? `3px solid ${leftBorder}` : `1px solid ${border}`,
 };

 return (
 <div style={cardStyle}>
 <div
 style={{
 display: "flex",
 alignItems: "center",
 gap: 8,
 marginBottom: 16,
 paddingBottom: 12,
 borderBottom: `1px solid ${border}`,
 }}
 >
 <div
 style={{
 width: 26,
 height: 26,
 borderRadius: 8,
 background: accent,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 flexShrink: 0,
 }}
 >
 {icon}
 </div>
 <span style={{ fontSize: 12, fontWeight: 650, color: labelColor }}>{label}</span>
 {badge && (
 <span
 style={{
 marginLeft: "auto",
 fontSize: 11,
 color: "#64748B",
 background: "rgba(0,0,0,0.26)",
 padding: "2px 8px",
 borderRadius: 8,
 whiteSpace: "nowrap",
 }}
 >
 {badge}
 </span>
 )}
 </div>
 {children}
 </div>
 );
}

function ResultsView({
 query,
 setQuery,
 onSearch,
 onReset,
 results,
 statusText,
 sourceCards,
 answerMeta,
 modelStatuses,
 mode,
 setMode,
}: {
 query: string;
 setQuery: (query: string) => void;
 onSearch: (query: string, modeOverride?: ModeId) => void;
 onReset: () => void;
 results: SearchResults;
 statusText: string;
 sourceCards: SourceCard[];
 answerMeta: AnswerMeta;
 modelStatuses: ModelStatus[];
 mode: ModeId;
 setMode: (mode: ModeId) => void;
}) {
 const relatedQueries = useMemo(
 () => {
 const groundedQuestions = (answerMeta.relatedQuestions || [])
 .map((item) => sanitizeSearchQuery(item))
 .filter(Boolean);
 if (groundedQuestions.length) return groundedQuestions.slice(0, 4);

 const baseQuery = getRelatedBaseQuery(query);
 return [
 `${baseQuery} in India`,
 `${baseQuery} latest 2026`,
 `Best alternatives to ${baseQuery}`,
 `How does ${baseQuery} work`,
 ].filter((relatedQuery, index, list) => relatedQuery && list.indexOf(relatedQuery) === index);
 },
 [answerMeta.relatedQuestions, query],
 );

 const handleModeChange = (nextMode: ModeId) => {
 setMode(nextMode);
 onSearch(query, nextMode);
 };

 const handleExportMarkdown = () => {
 if (!results.main) return;
 const blob = new Blob([results.main], { type: "text/markdown;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = `${getRelatedBaseQuery(query).replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "chatr-search"}.md`;
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 URL.revokeObjectURL(url);
 };

 return (
 <div style={{ minHeight: "100vh", background: "#07090F", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
 <style>{`
 @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
 .chatr-rq:hover { color: #94A3B8 !important; border-bottom-color: #1E2D4A !important; }
 .chatr-results-grid { max-width: 1080px; margin: 0 auto; padding: 24px 20px; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; }
 .chatr-topbar { padding: 10px 24px; display: flex; align-items: center; gap: 16px; }
 @media (max-width: 860px) {
 .chatr-results-grid { grid-template-columns: 1fr; }
 .chatr-topbar { align-items: stretch; flex-wrap: wrap; }
 .chatr-topbar-search { order: 3; flex-basis: 100%; max-width: none !important; }
 }
 `}</style>

 <div
 className="chatr-topbar"
 style={{
 background: "#09111E",
 borderBottom: "1px solid #0F1C30",
 position: "sticky",
 top: 0,
 zIndex: 20,
 }}
 >
 <button
 type="button"
 onClick={onReset}
 style={{
 fontSize: 22,
 fontWeight: 900,
 background: "linear-gradient(135deg,#818CF8,#C084FC)",
 WebkitBackgroundClip: "text",
 WebkitTextFillColor: "transparent",
 cursor: "pointer",
 flexShrink: 0,
 letterSpacing: 0,
 border: "none",
 padding: 0,
 fontFamily: "inherit",
 }}
 >
 Chatr AI
 </button>
 <div className="chatr-topbar-search" style={{ flex: 1, maxWidth: 580 }}>
 <SearchBar value={query} onChange={setQuery} onSearch={(value) => onSearch(value)} compact />
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#334155" }}>
 <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399" }} />
 Live
 </div>
 </div>

 <div style={{ padding: "10px 24px", borderBottom: "1px solid #0B1525" }}>
 <ModeTabs active={mode} onChange={handleModeChange} />
 </div>

 <div className="chatr-results-grid">
 <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
 <div style={{ animation: "fadein 0.5s ease" }}>
 <Card
 bg="#0D1526"
 border="#1A2A42"
 accent="linear-gradient(135deg,#818CF8,#C084FC)"
 icon={<Brain size={13} color="#fff" />}
 label="Chatr AI Synthesis"
 badge={`${mode === "code" ? "Tech" : mode === "bharat" ? "India" : "Web"} | Real-time`}
 >
 {results.main ? (
 <MD text={results.main} />
 ) : (
 <div style={{ color: "#64748B", fontSize: 13 }}>
 {statusText || "Generating synthesis..."}
 </div>
 )}
 </Card>
 </div>

 <div
 style={{
 display: "grid",
 gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
 gap: 8,
 animation: "fadein 0.55s ease",
 }}
 >
 {[
 { label: "Summarize", action: () => onSearch(`Summarize ${query} in concise bullets`) },
 { label: "Simplify", action: () => onSearch(`Explain ${query} simply for Indian users`) },
 { label: "Compare", action: () => onSearch(`${query} comparison table India`) },
 { label: "Explain", action: () => onSearch(`Explain ${query} with citations and examples`) },
 ].map((item) => (
 <button
 key={item.label}
 type="button"
 onClick={item.action}
 style={{
 padding: "9px 10px",
 border: "1px solid #1A2A42",
 borderRadius: 8,
 background: "#09111E",
 color: "#94A3B8",
 fontSize: 12,
 fontWeight: 600,
 cursor: "pointer",
 fontFamily: "inherit",
 }}
 >
 {item.label}
 </button>
 ))}
 <button
 type="button"
 onClick={handleExportMarkdown}
 disabled={!results.main}
 style={{
 padding: "9px 10px",
 border: "1px solid #1A2A42",
 borderRadius: 8,
 background: results.main ? "#09111E" : "#080D16",
 color: results.main ? "#94A3B8" : "#334155",
 fontSize: 12,
 fontWeight: 600,
 cursor: results.main ? "pointer" : "not-allowed",
 fontFamily: "inherit",
 }}
 >
 Export
 </button>
 </div>

 <div style={{ animation: "fadein 0.6s ease" }}>
 <Card
 bg="#080F0D"
 border="#142A20"
 accent="#34D399"
 icon={<Flag size={13} color="#052E1C" />}
 label="Bharat Intel"
 badge="India context"
 >
 {results.india ? (
 <MD text={results.india} muted />
 ) : (
 <div style={{ color: "#1F4534", fontSize: 13 }}>Fetching India context...</div>
 )}
 </Card>
 </div>
 </div>

 <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
 <div style={{ animation: "fadein 0.4s ease" }}>
 <Card
 bg="#0C1118"
 border="#1E2A30"
 accent="#F59E0B"
 icon={<Zap size={13} color="#171004" />}
 label="Flash Answer"
 leftBorder="#F59E0B"
 >
 {results.quick ? (
 <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, margin: 0 }}>{results.quick}</p>
 ) : (
 <div style={{ color: "#334155", fontSize: 13 }}>Loading...</div>
 )}
 </Card>
 </div>

 <div
 style={{
 background: "#0D1526",
 border: "1px solid #1A2A42",
 borderRadius: 8,
 padding: 18,
 animation: "fadein 0.55s ease",
 }}
 >
 <div style={{ fontSize: 11, color: "#334155", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 }}>
 Intelligence stack
 </div>
 {answerMeta.confidence && (
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 gap: 10,
 padding: "9px 0 12px",
 borderBottom: "1px solid #0D1A2E",
 marginBottom: 2,
 }}
 >
 <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>Grounding confidence</span>
 <span style={{ color: "#34D399", fontSize: 12, fontWeight: 700 }}>
 {answerMeta.confidence.label} · {Math.round(answerMeta.confidence.score * 100)}%
 </span>
 </div>
 )}
 {[
 {
 provider: "search",
 label: "Search Retrieval",
 status: sourceCards.length ? "complete" : "ready",
 model: sourceCards[0]?.source || "Live web context",
 },
 ...modelStatuses,
 ].map((model) => {
 const dot =
 model.status === "complete"
 ? "#34D399"
 : model.status === "streaming"
 ? "#F59E0B"
 : model.status === "missing_key" || model.status === "error"
 ? "#EF4444"
 : "#818CF8";
 const sub = model.latencyMs
 ? `${model.status} | ${model.latencyMs}ms`
 : model.model || model.status.replace("_", " ");
 return (
 <div
 key={model.provider}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 padding: "9px 0",
 borderBottom: "1px solid #0D1A2E",
 }}
 >
 <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
 <div>
 <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 550 }}>{model.label}</div>
 <div style={{ fontSize: 11, color: "#41516B" }}>{sub}</div>
 </div>
 <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: dot, opacity: 0.4 }} />
 </div>
 );
 })}
 </div>

 {sourceCards.length > 0 && (
 <div
 style={{
 background: "#0D1526",
 border: "1px solid #1A2A42",
 borderRadius: 8,
 padding: 18,
 animation: "fadein 0.6s ease",
 }}
 >
 <div style={{ fontSize: 11, color: "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.5 }}>
 Sources
 </div>
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
 {sourceCards.slice(0, 5).map((source, index) => {
 const isOpenable = canOpenSourceUrl(source.url);
 const host = source.domain || getSourceHost(source.url);
 const trustLabel = source.trustLabel || source.trustTier || "Web";
 const fetchedLabel = source.fetchedAt ? "fetched now" : "live";
 const content = (
 <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
 {isOpenable ? (
 <img
 src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`}
 alt=""
 width={18}
 height={18}
 style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }}
 />
 ) : (
 <span style={{ color: "#818CF8", fontSize: 11, flexShrink: 0 }}>[{source.index || index + 1}]</span>
 )}
 <div style={{ minWidth: 0, flex: 1 }}>
 <div
 style={{
 color: "#CBD5E1",
 fontSize: 12,
 fontWeight: 600,
 overflow: "hidden",
 textOverflow: "ellipsis",
 whiteSpace: "nowrap",
 }}
 >
 [{source.index || index + 1}] {source.title || "Untitled source"}
 </div>
 <div style={{ color: "#64748B", fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {host} | {fetchedLabel} | {trustLabel}
 </div>
 </div>
 </div>
 );

 if (isOpenable) {
 return (
 <a
 key={`${source.url}-${index}`}
 href={source.url}
 target="_blank"
 rel="noreferrer"
 style={{
 display: "block",
 padding: "10px 11px",
 border: "1px solid #17243A",
 borderRadius: 8,
 background: "#09111E",
 textDecoration: "none",
 }}
 >
 {content}
 </a>
 );
 }

 return (
 <div
 key={`${source.url}-${index}`}
 style={{
 padding: "10px 11px",
 border: "1px solid #17243A",
 borderRadius: 8,
 background: "#09111E",
 }}
 >
 {content}
 </div>
 );
 })}
 </div>
 </div>
 )}

 <div
 style={{
 background: "#0D1526",
 border: "1px solid #1A2A42",
 borderRadius: 8,
 padding: 18,
 animation: "fadein 0.65s ease",
 }}
 >
 <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.5 }}>
 <TrendingUp size={12} />
 Related queries
 </div>
 {relatedQueries.map((relatedQuery) => (
 <button
 key={relatedQuery}
 type="button"
 className="chatr-rq"
 onClick={() => {
 setQuery(relatedQuery);
 onSearch(relatedQuery);
 }}
 style={{
 display: "flex",
 alignItems: "flex-start",
 gap: 8,
 width: "100%",
 padding: "8px 0",
 background: "none",
 border: "none",
 borderBottom: "1px solid #0D1A2E",
 color: "#64748B",
 fontSize: 12,
 cursor: "pointer",
 textAlign: "left",
 transition: "color 0.15s",
 fontFamily: "inherit",
 lineHeight: 1.4,
 }}
 >
 <ChevronRight size={11} color="#334155" style={{ marginTop: 2, flexShrink: 0 }} />
 {relatedQuery}
 </button>
 ))}
 </div>

 <button
 type="button"
 onClick={onReset}
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 7,
 padding: "10px",
 borderRadius: 8,
 border: "1px solid #1A2A42",
 background: "transparent",
 color: "#64748B",
 fontSize: 12,
 cursor: "pointer",
 fontFamily: "inherit",
 transition: "all 0.15s",
 }}
 onMouseEnter={(event) => {
 event.currentTarget.style.color = "#818CF8";
 event.currentTarget.style.borderColor = "#818CF8";
 }}
 onMouseLeave={(event) => {
 event.currentTarget.style.color = "#64748B";
 event.currentTarget.style.borderColor = "#1A2A42";
 }}
 >
 <RefreshCw size={12} /> New search
 </button>
 </div>
 </div>

 <div style={{ textAlign: "center", padding: "20px 0 32px", fontSize: 11, color: "#1F2937" }}>
 Chatr AI Search | SearXNG/DuckDuckGo context | Ollama/local synthesis
 </div>
 </div>
 );
}

export default function AIBrowserHome() {
 const [query, setQuery] = useState("");
 const [mode, setMode] = useState<ModeId>("web");
 const [phase, setPhase] = useState<Phase>("home");
 const [results, setResults] = useState<SearchResults>({ main: null, quick: null, india: null });
 const [sourceCards, setSourceCards] = useState<SourceCard[]>([]);
 const [answerMeta, setAnswerMeta] = useState<AnswerMeta>({});
 const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>(DEFAULT_MODEL_STATUSES);
 const [streamStatus, setStreamStatus] = useState("");
 const [loadMsg, setLoadMsg] = useState("Initializing...");
 const { isListening, startListening, transcript, interimTranscript } = useVoiceAI({ processCommands: false });
 const lastTranscriptRef = useRef("");
 const latestSourcesRef = useRef<SourceCard[]>([]);

 useEffect(() => {
 if (phase !== "loading") return;
 let index = 0;
 const intervalId = window.setInterval(() => {
 setLoadMsg(loadingMessages[index++ % loadingMessages.length]);
 }, 700);
 return () => window.clearInterval(intervalId);
 }, [phase]);

 useEffect(() => {
 const spokenQuery = transcript.trim();
 if (!spokenQuery || spokenQuery === lastTranscriptRef.current) return;
 lastTranscriptRef.current = spokenQuery;
 setQuery(spokenQuery);
 void handleSearch(spokenQuery);
 }, [transcript]);

 useEffect(() => {
 if (!isListening) return;
 const spokenPreview = interimTranscript.trim();
 if (spokenPreview) setQuery(spokenPreview);
 }, [interimTranscript, isListening]);

 const handleSearch = async (nextQuery?: string, modeOverride?: ModeId) => {
 const trimmed = sanitizeSearchQuery(nextQuery || query);
 if (!trimmed) return;
 const activeMode = modeOverride || mode;

 setQuery(trimmed);
 setMode(activeMode);
 setPhase("loading");
 setResults({ main: null, quick: null, india: null });
 setSourceCards([]);
 latestSourcesRef.current = [];
 setAnswerMeta({});
 setModelStatuses(DEFAULT_MODEL_STATUSES);
 setStreamStatus("Preparing live search...");

 if (canUseSSESearch()) {
 setPhase("results");
 setResults({ main: "", quick: null, india: null });

 try {
 const main = await streamChatrAPI(
 trimmed,
 activeMode,
 (partialAnswer) => setResults((previous) => ({ ...previous, main: partialAnswer })),
 setStreamStatus,
 (sources) => {
 latestSourcesRef.current = sources;
 setSourceCards(sources);
 },
 (update) => setModelStatuses((previous) => mergeModelStatus(previous, update)),
 (metadata) => setAnswerMeta((previous) => ({ ...previous, ...metadata })),
 );
 const finalMain = main || "Reliable live sources were limited. Try refining your search.";
 setResults({
 main: finalMain,
 quick: toFlashAnswer(finalMain),
 india: toBharatIntel(finalMain, latestSourcesRef.current, activeMode),
 });
 setStreamStatus("");
 return;
 } catch (error) {
 console.warn("[AIBrowserHome] SSE search failed, falling back to local answer route:", error);
 const localAnswer = await localAnswerAPI(trimmed, activeMode);
 const finalMain = localAnswer.answer || "Reliable live sources were limited. Try refining your search.";
 const nextSources = localAnswer.sources || localAnswer.citations || [];
 latestSourcesRef.current = nextSources;
 setSourceCards(nextSources);
 setAnswerMeta({
 citations: localAnswer.citations,
 relatedQuestions: localAnswer.relatedQuestions,
 confidence: localAnswer.confidence,
 providerUsed: localAnswer.providerUsed,
 latencyMs: localAnswer.latencyMs,
 });
 setResults({
 main: finalMain,
 quick: toFlashAnswer(finalMain),
 india: toBharatIntel(finalMain, nextSources, activeMode),
 });
 setStreamStatus("");
 return;
 }
 }

 const localAnswer = await localAnswerAPI(trimmed, activeMode);
 const finalMain = localAnswer.answer || "Reliable live sources were limited. Try refining your search.";
 const nextSources = localAnswer.sources || localAnswer.citations || [];
 latestSourcesRef.current = nextSources;
 setSourceCards(nextSources);
 setAnswerMeta({
 citations: localAnswer.citations,
 relatedQuestions: localAnswer.relatedQuestions,
 confidence: localAnswer.confidence,
 providerUsed: localAnswer.providerUsed,
 latencyMs: localAnswer.latencyMs,
 });
 setResults({
 main: finalMain,
 quick: toFlashAnswer(finalMain),
 india: toBharatIntel(finalMain, nextSources, activeMode),
 });
 setStreamStatus("");
 setPhase("results");
 };

 const handleReset = () => {
 setPhase("home");
 setQuery("");
 setResults({ main: null, quick: null, india: null });
 setSourceCards([]);
 latestSourcesRef.current = [];
 setAnswerMeta({});
 setModelStatuses(DEFAULT_MODEL_STATUSES);
 setStreamStatus("");
 setLoadMsg("Initializing...");
 };

 const handleVoiceSearch = () => {
 void startListening();
 };

 if (phase === "home") {
 return (
 <HomeView
 query={query}
 setQuery={setQuery}
 onSearch={(value) => void handleSearch(value)}
 mode={mode}
 setMode={setMode}
 isListening={isListening}
 onVoiceSearch={handleVoiceSearch}
 />
 );
 }

 if (phase === "loading") {
 return <LoadingView msg={loadMsg} query={query} />;
 }

 return (
 <ResultsView
 query={query}
 setQuery={setQuery}
 onSearch={(value, nextMode) => void handleSearch(value, nextMode)}
 onReset={handleReset}
 results={results}
 statusText={streamStatus}
 sourceCards={sourceCards}
 answerMeta={answerMeta}
 modelStatuses={modelStatuses}
 mode={mode}
 setMode={setMode}
 />
 );
}
