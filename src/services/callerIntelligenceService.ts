/**
 * Caller Intelligence Service
 *
 * Provides:
 *  - Number hashing for privacy-preserving lookup
 *  - Supabase caller ID + spam score lookup
 *  - Post-call AI rules engine (zero-cost, on-device)
 *  - Insight saving
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber } from '@/utils/phoneHashUtil';
import { isUsefulCallerName, resolveCallerIdentity } from '@/utils/callerIdentityResolver';
import { emitSpamReported, emitCallCompleted } from '@/services/trustEventService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CallerInfo {
  name: string;
  trustScore: number;       // 0–100
  spamReports: number;
  riskLevel: 'safe' | 'suspicious' | 'spam';
  tags: string[];
  communityName?: string;
  communityLabel?: string;
  mostCommonType?: string;
  spamPercentage?: number;
  totalReports?: number;
}

export interface PostCallSummary {
  suggestedAction: string;
  summary: string;
  tags: string[];
  trustScore: number;
}

export interface CallInsight {
  number: string;
  notes: string;
  tags: string[];
  suggestedAction: string;
  durationSeconds?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy-preserving hash (SHA-256 via Web Crypto)
// ─────────────────────────────────────────────────────────────────────────────

export async function hashPhoneNumber(raw: string): Promise<string> {
  const normalized = normalizePhoneNumber(raw) || raw.replace(/\D/g, '');
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — Caller Lookup (Supabase RPC)
// ─────────────────────────────────────────────────────────────────────────────

export async function lookupCaller(rawNumber: string): Promise<CallerInfo> {
  const normalizedNumber = normalizePhoneNumber(rawNumber) || rawNumber;
  const defaultResult: CallerInfo = {
    name: 'Unknown Caller',
    trustScore: 50,
    spamReports: 0,
    riskLevel: 'safe',
    tags: [],
  };

  try {
    const resolved = await resolveCallerIdentity(normalizedNumber);
    if (resolved.source !== 'unknown' || resolved.spamReports > 0) {
      const spamReports = Number(resolved.spamReports ?? 0);
      const trustScore = Number(resolved.trustScore ?? 50);
      let riskLevel: CallerInfo['riskLevel'] = 'safe';
      if (spamReports >= 5 || trustScore < 30 || resolved.trustBand === 'block') riskLevel = 'spam';
      else if (spamReports >= 2 || trustScore < 60) riskLevel = 'suspicious';

      const tags = [
        ...((resolved.communityTags || []) as string[]),
        resolved.source === 'phonebook' ? 'Phonebook' : null,
        resolved.source === 'profile' ? 'Chatr Profile' : null,
        riskLevel === 'spam' ? 'Spam' : riskLevel === 'suspicious' ? 'Suspicious' : null,
      ].filter(Boolean) as string[];

      return {
        name: isUsefulCallerName(resolved.displayName, normalizedNumber)
          ? resolved.displayName!
          : 'Unknown Caller',
        trustScore,
        spamReports,
        riskLevel,
        tags,
        communityName: resolved.displayName || undefined,
        spamPercentage: resolved.spamPercentage,
        totalReports: resolved.communityReportCount,
      };
    }

    const hashedNumber = await hashPhoneNumber(normalizedNumber);

    const modernLookup = await (supabase as any).rpc('lookup_caller_id', {
      p_hashed_number: hashedNumber,
      p_raw_number: normalizedNumber,
    });

    if (!modernLookup.error && modernLookup.data) {
      const data = modernLookup.data;
      const spamReports = Number(data.spam_reports ?? data.spamReports ?? 0);
      const trustScore = Number(data.trust_score ?? data.trustScore ?? 50);
      const name = data.name ?? 'Unknown Caller';

      let riskLevel: CallerInfo['riskLevel'] = 'safe';
      if (spamReports >= 5 || trustScore < 30) riskLevel = 'spam';
      else if (spamReports >= 2 || trustScore < 60) riskLevel = 'suspicious';

      const tags: string[] = [];
      if (riskLevel === 'spam') tags.push('Spam');
      if (riskLevel === 'suspicious') tags.push('Suspicious');

      return { name, trustScore, spamReports, riskLevel, tags };
    }

    const legacyLookup = await (supabase as any).rpc('lookup_caller_id', {
      p_phone: normalizedNumber,
    });

    if (!legacyLookup.error && legacyLookup.data) {
      const row = Array.isArray(legacyLookup.data) ? legacyLookup.data[0] : legacyLookup.data;
      if (row) {
        const totalReports = Number(row.total_reports ?? 0);
        const spamPercentage = Number(row.spam_percentage ?? 0);
        const spamReports = Math.round((spamPercentage / 100) * totalReports);
        const riskLevel: CallerInfo['riskLevel'] =
          spamPercentage >= 65 ? 'spam' : spamPercentage >= 25 ? 'suspicious' : 'safe';
        const trustScore = Math.max(5, Math.min(99, 100 - spamPercentage));
        const tags = [
          row.most_common_type,
          row.community_label,
          riskLevel === 'spam' ? 'Spam' : riskLevel === 'suspicious' ? 'Suspicious' : 'Safe',
        ].filter(Boolean);

        return {
          name: row.community_name || 'Unknown Caller',
          trustScore,
          spamReports,
          riskLevel,
          tags,
          communityName: row.community_name,
          communityLabel: row.community_label,
          mostCommonType: row.most_common_type,
          spamPercentage,
          totalReports,
        };
      }
    }

    return defaultResult;
  } catch (err) {
    console.warn('[CallerIntelligence] Lookup failed:', err);
    return defaultResult;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 5 — Post-Call AI Rules Engine (Zero Cost, On-Device)
// ─────────────────────────────────────────────────────────────────────────────

export function runPostCallAI(params: {
  durationSeconds: number;
  spamReports: number;
  trustScore: number;
  userNotes: string;
  userTags: string[];
}): PostCallSummary {
  const { durationSeconds, spamReports, trustScore, userNotes, userTags } = params;

  let suggestedAction = 'No action needed';
  let summary = '';
  const tags = [...userTags];

  // Rule 1: Very short call — likely spam or accidental
  if (durationSeconds < 5) {
    suggestedAction = 'Ignore — Too short to be important';
    summary = 'Call lasted less than 5 seconds. Likely a robocall or accidental dial.';
    if (!tags.includes('Spam')) tags.push('Missed/Short');
  }
  // Rule 2: High spam reports
  else if (spamReports >= 5 || trustScore < 25) {
    suggestedAction = 'Block this number';
    summary = `This number has ${spamReports} spam reports and a low trust score. Consider blocking.`;
    if (!tags.includes('Spam')) tags.push('Spam');
  }
  // Rule 3: Medium call with notes — likely a lead or business
  else if (durationSeconds > 60 && userNotes.trim().length > 0) {
    suggestedAction = 'Follow up — Important contact';
    summary = `You had a ${formatDuration(durationSeconds)} call and left notes. This looks like an important contact.`;
    if (!tags.includes('Business')) tags.push('Follow-up');
  }
  // Rule 4: Long call, no notes
  else if (durationSeconds > 120 && userNotes.trim().length === 0) {
    suggestedAction = 'Add notes while fresh';
    summary = `You had a ${formatDuration(durationSeconds)} call with no notes. Consider adding a summary.`;
  }
  // Rule 5: Note contains keywords
  else if (/meeting|appointment|schedule|call back/i.test(userNotes)) {
    suggestedAction = 'Schedule follow-up';
    summary = 'Your notes mention a meeting or follow-up. Consider adding this to your calendar.';
    if (!tags.includes('Appointment')) tags.push('Appointment');
  }
  // Rule 6: Note contains money keywords
  else if (/quote|price|cost|payment|invoice/i.test(userNotes)) {
    suggestedAction = 'Send quote or invoice';
    summary = 'Your notes mention financial details. Consider sending a quote or invoice.';
    if (!tags.includes('Business')) tags.push('Business');
  }
  // Default
  else {
    suggestedAction = 'No action needed';
    summary = `Call lasted ${formatDuration(durationSeconds)}. No specific action required.`;
  }

  return { suggestedAction, summary, tags, trustScore };
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Save insight to Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function saveCallInsight(insight: CallInsight): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await (supabase as any).from('call_insights').upsert({
      user_id: user.id,
      number: insight.number,
      notes: insight.notes,
      tags: insight.tags,
      suggested_action: insight.suggestedAction,
      last_activity: new Date().toISOString(),
    }, {
      onConflict: 'user_id,number',
    });

    if (error) {
      console.error('[CallerIntelligence] Save failed:', error);
      return false;
    }

    // Emit trust event — fire-and-forget
    if (insight.durationSeconds) {
      emitCallCompleted(user.id, insight.durationSeconds);
    }

    return true;
  } catch (err) {
    console.error('[CallerIntelligence] saveCallInsight error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report a number as spam
// ─────────────────────────────────────────────────────────────────────────────

export async function reportSpam(
  number: string,
  reportType: 'spam' | 'fraud' | 'business_promotion' | 'other'
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const normalizedNumber = normalizePhoneNumber(number) || number;
    const results = await Promise.allSettled([
      (supabase as any).from('spam_reports').insert({
        number: normalizedNumber,
        report_type: reportType,
        user_id: user.id,
      }),
      supabase.from('caller_reports').insert({
        phone_number: normalizedNumber,
        report_type: 'spam',
        spam_type: reportType,
        reporter_id: user.id,
      }),
    ]);

    const success = results.some((result) => {
      if (result.status !== 'fulfilled') return false;
      return !result.value.error;
    });

    // Emit trust event — fire-and-forget, does not affect return value
    if (success) emitSpamReported(user.id, normalizedNumber);

    return success;
  } catch (err) {
    console.error('[CallerIntelligence] reportSpam error:', err);
    return false;
  }
}

export async function suggestCallerName(number: string, callerName: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const normalizedNumber = normalizePhoneNumber(number) || number;
    const { error } = await supabase.from('caller_reports').insert({
      phone_number: normalizedNumber,
      caller_name: callerName,
      report_type: 'safe',
      reporter_id: user.id,
    });

    return !error;
  } catch (err) {
    console.error('[CallerIntelligence] suggestCallerName error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1.5 — DPDP-Compliant Crowdsourced Contacts Sync
// ─────────────────────────────────────────────────────────────────────────────

export async function syncPhonebookContacts(): Promise<{ success: boolean; processed: number; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, processed: 0, error: 'unauthenticated' };

    let Contacts;
    try {
      const mod = await import('@capacitor-community/contacts');
      Contacts = mod.Contacts;
    } catch (e) {
      console.warn('[CallerIntelligence] Capacitor Contacts plugin not found. Skipping sync.');
      return { success: false, processed: 0, error: 'plugin_missing' };
    }

    const perm = await Contacts.requestPermissions();
    if (perm.contacts !== 'granted') {
      return { success: false, processed: 0, error: 'permission_denied' };
    }

    const { contacts } = await Contacts.getContacts({ projection: { name: true, phones: true } });
    
    if (!contacts || contacts.length === 0) {
      return { success: true, processed: 0 };
    }

    const payloadBatch = [];
    
    for (const contact of contacts) {
      const name = contact.name?.display;
      if (!name || !contact.phones || contact.phones.length === 0) continue;

      for (const phone of contact.phones) {
        if (!phone.number) continue;
        payloadBatch.push({
          phone: phone.number,
          label: name,
        });
      }
    }

    if (payloadBatch.length === 0) return { success: true, processed: 0 };

    const chunkSize = 2000;
    let totalProcessed = 0;

    for (let i = 0; i < payloadBatch.length; i += chunkSize) {
      const chunk = payloadBatch.slice(i, i + chunkSize);
      const { data, error } = await supabase.functions.invoke('sync-contacts', {
        body: { contacts: chunk }
      });

      if (error) {
        console.error('[CallerIntelligence] Sync chunk failed:', error);
      } else if (data?.success) {
        totalProcessed += data.processed || 0;
      }
    }

    return { success: true, processed: totalProcessed };

  } catch (err: any) {
    console.error('[CallerIntelligence] syncPhonebookContacts error:', err);
    return { success: false, processed: 0, error: err.message };
  }
}
