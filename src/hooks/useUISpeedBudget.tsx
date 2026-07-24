import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * UI Speed Budget — warns when interactions exceed a target latency.
 * Default budget: 100ms (Nielsen "feels instant" threshold).
 *
 * Hooks the browser's PerformanceObserver for `event` entries
 * (Event Timing API) which measures the time from input → next paint.
 *
 * Usage: mount once near the app root.
 *
 * FIX: onViolation, showToast, logToConsole are stored in refs so the
 * PerformanceObserver is created only ONCE (when budgetMs changes),
 * preventing an infinite re-render loop caused by inline callback identity changes.
 */

interface SpeedBudgetOptions {
 /** Max acceptable interaction latency in ms. Default 100ms. */
 budgetMs?: number;
 /** Show a toast when exceeded. Disabled by default — toasts themselves
 * trigger re-renders and inflate INP measurements. */
 showToast?: boolean;
 /** Log to console.warn. Default true in dev. */
 logToConsole?: boolean;
 /** Callback for analytics or custom handling. */
 onViolation?: (entry: {
 name: string;
 duration: number;
 target?: string;
 }) => void;
}

const isDev = import.meta.env.DEV;

export function useUISpeedBudget(options: SpeedBudgetOptions = {}) {
 const {
 budgetMs = 100,
 showToast = false, // disabled by default — toasts cause re-renders
 logToConsole = false, // disabled to prevent console spam in dev
 onViolation,
 } = options;

 const lastWarnRef = useRef<number>(0);

 // Store mutable callbacks/flags in refs so we don't recreate the observer
 // every time an inline function reference changes.
 const logRef = useRef(logToConsole);
 const toastRef = useRef(showToast);
 const cbRef = useRef(onViolation);
 logRef.current = logToConsole;
 toastRef.current = showToast;
 cbRef.current = onViolation;

 useEffect(() => {
 if (typeof PerformanceObserver === 'undefined') return;

 const WARN_INTERVAL_MS = 2000;

 let observer: PerformanceObserver | null = null;
 try {
 observer = new PerformanceObserver((list) => {
 for (const entry of list.getEntries()) {
 const duration = entry.duration;
 if (duration <= budgetMs) continue;

 const target =
 (entry as unknown as { target?: Element }).target?.tagName?.toLowerCase() ||
 'unknown';

 const violation = { name: entry.name, duration: Math.round(duration), target };

 cbRef.current?.(violation);

 if (logRef.current) {
 console.warn(
 `⚡ UI Speed Budget exceeded: ${violation.name} on <${target}> took ${violation.duration}ms (budget: ${budgetMs}ms)`
 );
 }

 const now = Date.now();
 if (toastRef.current && now - lastWarnRef.current > WARN_INTERVAL_MS) {
 lastWarnRef.current = now;
 toast.warning(`Slow interaction: ${violation.duration}ms (budget ${budgetMs}ms)`, {
 description: `${violation.name} on <${target}>`,
 duration: 3500,
 });
 }
 }
 });

 observer.observe({
 type: 'event',
 buffered: true,
 // @ts-expect-error - durationThreshold is in the spec but not all TS defs have it
 durationThreshold: budgetMs,
 });
 } catch {
 // Older browsers may not support the 'event' type — silently no-op.
 }

 let longTaskObserver: PerformanceObserver | null = null;
 try {
 longTaskObserver = new PerformanceObserver((list) => {
 for (const entry of list.getEntries()) {
 if (entry.duration > budgetMs && logRef.current) {
 console.warn(`⚠️ Long task blocking UI: ${Math.round(entry.duration)}ms`);
 }
 }
 });
 longTaskObserver.observe({ type: 'longtask', buffered: true });
 } catch {
 // longtask API not supported — ignore.
 }

 return () => {
 observer?.disconnect();
 longTaskObserver?.disconnect();
 };
 // Only re-create observers if the numeric budget threshold changes.
 // All callbacks/flags are read from refs inside the observer closure.
 }, [budgetMs]);
}
