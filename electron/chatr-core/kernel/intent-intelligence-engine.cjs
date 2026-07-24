'use strict';

/**
 * CHATR Kernel — Intent Intelligence Engine (Phase 5.1)
 *
 * Sits between the Planner and the Workflow Engine.
 * Runs five resolvers in sequence to enrich and validate constraints
 * before any workflow execution begins.
 *
 * Pipeline:
 *   Entity Resolution
 *   → Context Resolution   (location, calendar, history)
 *   → Constraint Resolution (required vs known, confidence scoring)
 *   → Preference Resolution (World Model preferences)
 *   → Risk Resolution       (flag high-risk / irreversible actions)
 *
 * Returns:
 *   { resolved, missing, confidence, risk, clarificationQuestion }
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// ── Required constraints per intent ────────────────────────────────────────

const REQUIRED_CONSTRAINTS = {
  'transport.book':             ['from', 'to', 'mode'],
  'transport.search':           ['from', 'to', 'mode'],
  'food.order':                 ['location'],
  'food.search':                ['location'],
  'shopping.purchase':          ['category'],
  'shopping.search':            ['query'],
  'healthcare.search_doctors':  ['location'],
  'healthcare.book_appointment':['doctor', 'date'],
  'jobs.post':                  ['role', 'platforms'],
  'jobs.search':                ['query'],
  'workflow.invoice_processing':['company'],
};

// Confidence threshold — below this means "ask user"
const CONFIDENCE_THRESHOLD = 70;

class IntentIntelligenceEngine {

  // ── 1. Entity Resolution ────────────────────────────────────────────────

  resolveEntities(intentText, constraints) {
    const enriched = { ...constraints };

    // Extract destination from text patterns
    const toMatch = intentText.match(/\bto\s+(?:the\s+)?([A-Z][a-zA-Z\s]{2,25})(?:\s+(?:tomorrow|today|tonight|morning|evening|afternoon|on|at|by)|\s*$)/i);
    if (toMatch && !enriched.to) {
      enriched.to = { value: toMatch[1].trim(), source: 'user_text', confidence: 95 };
    }

    const fromMatch = intentText.match(/\bfrom\s+(?:the\s+)?([A-Z][a-zA-Z\s]{2,25})(?:\s+to\b)/i);
    if (fromMatch && !enriched.from) {
      enriched.from = { value: fromMatch[1].trim(), source: 'user_text', confidence: 95 };
    }

    // Date extraction
    const datePatterns = [
      { pattern: /\btomorrow\b/i,          value: _offsetDate(1),    confidence: 98 },
      { pattern: /\btoday\b/i,             value: _offsetDate(0),    confidence: 98 },
      { pattern: /\bthis\s+weekend\b/i,    value: _nextWeekend(),    confidence: 85 },
      { pattern: /\bnext\s+week\b/i,       value: _offsetDate(7),    confidence: 80 },
      { pattern: /\bon\s+(\w+day)\b/i,     value: null,              confidence: 88, dayName: true },
    ];

    if (!enriched.date) {
      for (const dp of datePatterns) {
        const m = intentText.match(dp.pattern);
        if (m) {
          enriched.date = {
            value: dp.dayName ? _nextDayOfWeek(m[1]) : dp.value,
            source: 'user_text',
            confidence: dp.confidence,
          };
          break;
        }
      }
    }

    // Mode extraction
    if (!enriched.mode) {
      if (/\btrain\b|\bticket\b|\birctc\b/i.test(intentText)) {
        enriched.mode = { value: 'train', source: 'user_text', confidence: 99 };
      } else if (/\bflight\b|\bplane\b|\bfly\b/i.test(intentText)) {
        enriched.mode = { value: 'flight', source: 'user_text', confidence: 99 };
      } else if (/\bcab\b|\btaxi\b|\buber\b|\bola\b|\bride\b/i.test(intentText)) {
        enriched.mode = { value: 'cab', source: 'user_text', confidence: 99 };
      } else if (/\bbike\b|\brapido\b/i.test(intentText)) {
        enriched.mode = { value: 'bike', source: 'user_text', confidence: 99 };
      } else if (/\bauto\b/i.test(intentText)) {
        enriched.mode = { value: 'auto', source: 'user_text', confidence: 99 };
      } else if (/\bbus\b/i.test(intentText)) {
        enriched.mode = { value: 'bus', source: 'user_text', confidence: 99 };
      }
    }

    // Normalize plain string constraints to scored objects
    for (const [key, val] of Object.entries(enriched)) {
      if (typeof val === 'string') {
        enriched[key] = { value: val, source: 'user_text', confidence: 90 };
      }
    }

    return enriched;
  }

  // ── 2. Context Resolution ────────────────────────────────────────────────

  async resolveFromContext(constraints, userContext) {
    const enriched = { ...constraints };

    // Infer `from` from GPS location
    if (!enriched.from || enriched.from.confidence < CONFIDENCE_THRESHOLD) {
      const loc = userContext?.location;
      if (loc?.city) {
        enriched.from = {
          value: loc.city,
          source: 'gps',
          confidence: loc.accuracy === 'high' ? 95 : 78,
        };
      } else if (loc?.savedLocations?.home) {
        enriched.from = {
          value: loc.savedLocations.home,
          source: 'saved_location',
          confidence: 70,
        };
      }
    }

    // Infer `to` from calendar (nearest upcoming event with a location)
    if (!enriched.to || enriched.to.confidence < CONFIDENCE_THRESHOLD) {
      const calendar = userContext?.calendar;
      if (Array.isArray(calendar?.upcoming)) {
        const nextWithLocation = calendar.upcoming.find(e => e.location && e.location.trim().length > 0);
        if (nextWithLocation) {
          enriched.to = {
            value: nextWithLocation.location,
            source: 'calendar',
            confidence: 75,
            hint: `You have "${nextWithLocation.title}" on ${nextWithLocation.date}`,
          };
          // Infer date from event if not set
          if (!enriched.date) {
            enriched.date = {
              value: nextWithLocation.date,
              source: 'calendar',
              confidence: 80,
              hint: `Event: ${nextWithLocation.title}`,
            };
          }
        }
      }
    }

    // Infer `location` for food/healthcare from GPS
    if (!enriched.location || enriched.location.confidence < CONFIDENCE_THRESHOLD) {
      const loc = userContext?.location;
      if (loc?.city) {
        enriched.location = {
          value: loc.city,
          source: 'gps',
          confidence: loc.accuracy === 'high' ? 95 : 78,
        };
      }
    }

    return enriched;
  }

  // ── 3. Constraint Resolution ─────────────────────────────────────────────

  resolveConstraints(intent, constraints) {
    const required = REQUIRED_CONSTRAINTS[intent] || [];
    const resolved = {};
    const missing  = [];

    for (const field of required) {
      const c = constraints[field];
      if (c && typeof c === 'object' && c.value && c.confidence >= CONFIDENCE_THRESHOLD) {
        resolved[field] = c;
      } else if (c && typeof c === 'object' && c.value && c.confidence < CONFIDENCE_THRESHOLD) {
        // Low confidence — include but flag
        resolved[field] = { ...c, lowConfidence: true };
      } else {
        missing.push(field);
      }
    }

    // Pass through optional constraints as-is
    for (const [key, val] of Object.entries(constraints)) {
      if (!required.includes(key) && val) {
        resolved[key] = val;
      }
    }

    return { resolved, missing };
  }

  // ── 4. Preference Resolution ─────────────────────────────────────────────

  async resolvePreferences(intent, constraints, worldModel) {
    if (!worldModel) return constraints;

    try {
      const prefs = await worldModel.getPreferences(intent);
      const enriched = { ...constraints };

      if (prefs?.preferredMode && !enriched.mode) {
        enriched.mode = { value: prefs.preferredMode, source: 'world_model', confidence: 72 };
      }
      if (prefs?.preferredFrom && !enriched.from) {
        enriched.from = { value: prefs.preferredFrom, source: 'world_model', confidence: 68 };
      }

      return enriched;
    } catch (e) {
      return constraints;
    }
  }

  // ── 5. Risk Resolution ───────────────────────────────────────────────────

  resolveRisk(intent, constraints) {
    const IRREVERSIBLE = [
      'transport.book', 'food.order', 'shopping.purchase',
      'healthcare.book_appointment', 'jobs.post',
    ];
    const HIGH_COST_THRESHOLD = 2000;

    const isIrreversible = IRREVERSIBLE.includes(intent);
    const estimatedCost  = constraints.price?.value || constraints.total?.value || 0;
    const isHighCost     = estimatedCost > HIGH_COST_THRESHOLD;

    return {
      requiresApproval: isIrreversible,
      isHighCost,
      riskLevel: isHighCost ? 'high' : isIrreversible ? 'medium' : 'low',
    };
  }

  // ── Main Entry Point ─────────────────────────────────────────────────────

  /**
   * Run all 5 resolvers in sequence.
   *
   * @param {string} intentText      Raw user input
   * @param {string} intent          Intent type from Planner
   * @param {object} constraints     Extracted constraints from Planner (plain or scored)
   * @param {object} userContext     From UserContextEngine
   * @param {object} [worldModel]    From WorldModel
   * @returns {Promise<object>}
   */
  async analyze(intentText, intent, constraints, userContext, worldModel) {
    log.info(`[IntentIntelligenceEngine] Analyzing intent='${intent}'`);

    // 1. Entity Resolution
    let enriched = this.resolveEntities(intentText, constraints);

    // 2. Context Resolution
    enriched = await this.resolveFromContext(enriched, userContext);

    // 3. Preference Resolution
    enriched = await this.resolvePreferences(intent, enriched, worldModel);

    // 4. Constraint Resolution
    const { resolved, missing } = this.resolveConstraints(intent, enriched);

    // 5. Risk Resolution
    const risk = this.resolveRisk(intent, resolved);

    // Build confidence map
    const confidence = {};
    for (const [k, v] of Object.entries(resolved)) {
      confidence[k] = typeof v === 'object' ? v.confidence : 90;
    }

    // Generate clarification question if missing fields
    let clarificationQuestion = null;
    if (missing.length > 0) {
      clarificationQuestion = this._buildQuestion(intent, missing, resolved, userContext);
    }

    log.info(`[IntentIntelligenceEngine] resolved=${Object.keys(resolved).join(',')} missing=${missing.join(',')}`);

    return { resolved, missing, confidence, risk, clarificationQuestion };
  }

  // ── Question Generator ────────────────────────────────────────────────────

  _buildQuestion(intent, missing, resolved, userContext) {
    const knownParts = [];

    if (resolved.from?.value) knownParts.push(`you're in **${resolved.from.value}**`);
    if (resolved.to?.hint)    knownParts.push(resolved.to.hint);
    if (resolved.mode?.value) knownParts.push(`mode: **${resolved.mode.value}**`);
    if (resolved.date?.hint)  knownParts.push(resolved.date.hint);

    const prefix = knownParts.length > 0
      ? `I can see ${knownParts.join(' and ')}. `
      : 'I can book that. ';

    const fieldLabels = {
      from:     'departure city',
      to:       'destination',
      date:     'travel date',
      mode:     'travel mode (train, cab, flight…)',
      location: 'your location',
      query:    'what you\'re looking for',
      role:     'job title / role',
      platforms:'job platforms (LinkedIn, Naukri…)',
      category: 'what you want to buy',
      doctor:   'doctor name or specialty',
    };

    const missingLabels = missing.map(f => fieldLabels[f] || f);

    if (missingLabels.length === 1) {
      return `${prefix}I just need one thing: **${missingLabels[0]}**.`;
    }

    return `${prefix}I just need:\n${missingLabels.map(l => `• ${l}`).join('\n')}`;
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function _offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function _nextWeekend() {
  const d = new Date();
  const day = d.getDay();
  const diff = day <= 6 ? 6 - day : 0;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function _nextDayOfWeek(dayName) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const target = days.indexOf(dayName.toLowerCase());
  if (target === -1) return null;
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

const intentIntelligenceEngine = new IntentIntelligenceEngine();
module.exports = { intentIntelligenceEngine, IntentIntelligenceEngine };
