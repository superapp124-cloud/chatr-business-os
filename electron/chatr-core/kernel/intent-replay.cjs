/**
 * Intent Replay Utility
 * Implements Stage 2: Intent Replay requirement.
 * 
 * Reconstructs the exact sequence of observations, policies, execution, and verification for debugging.
 */
const persistence = require('../db/persistence.cjs');

class IntentReplay {
    /**
     * Replays the history of a specific Intent Object.
     * @param {string} intentId 
     * @returns {Object} An object containing the final state and the ordered event history.
     */
    static replay(intentId) {
        if (!persistence.db) {
            throw new Error('Database connection not available');
        }

        // Fetch intent base details
        const intentStmt = persistence.db.prepare(`SELECT * FROM stewarded_intents WHERE id = ?`);
        const intentRow = intentStmt.get(intentId);

        if (!intentRow) {
            throw new Error(`Intent ${intentId} not found`);
        }

        const intent = {
            id: intentRow.id,
            intent_type: intentRow.intent_type,
            current_phase: intentRow.current_phase,
            data: JSON.parse(intentRow.data),
            created_at: intentRow.created_at,
            updated_at: intentRow.updated_at
        };

        // Fetch history in chronological order
        const historyStmt = persistence.db.prepare(`SELECT * FROM intent_history WHERE intent_id = ? ORDER BY timestamp ASC`);
        const historyRows = historyStmt.all(intentId);

        const history = historyRows.map(row => ({
            id: row.id,
            phase: row.phase,
            event_type: row.event_type,
            payload: JSON.parse(row.payload),
            timestamp: row.timestamp
        }));

        return {
            intent,
            history,
            reconstruction_summary: `Replayed ${history.length} events for ${intent.intent_type} (Status: ${intent.current_phase})`
        };
    }
}

module.exports = IntentReplay;
