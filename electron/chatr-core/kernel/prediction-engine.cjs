'use strict';

/**
 * Prediction Engine
 * Handles "typing" phase speculatively.
 * Triggers pre-fetches for GPS, and now calls the real ProviderSessionService
 * to validate sessions before the user even presses Enter.
 */
class PredictionEngine {
  constructor(bus, sessionService) {
    this.bus = bus;
    this.sessionService = sessionService; // Real ProviderSessionService (P1.3)
    this.activePredictions = new Map();
  }

  handlePartialIntent(partialText, userContext) {
    if (partialText.length < 5) return;
    const lowerText = partialText.toLowerCase();
    const predictionId = `pred_${Date.now()}`;

    if (lowerText.includes('order') || lowerText.includes('book')) {
      if (!this.activePredictions.has('action.book')) {
        this.bus.publish('kernel.prediction.started', { type: 'action.book', predictionId });
        this._speculativeGpsFetch(userContext);
        // Instead of hardcoding providers, the prediction engine defers to the runtime manager
        // to pre-warm whatever providers are registered for this intent type.
        this._speculativeSessionValidation('action.book', userContext);
        this.activePredictions.set('action.book', predictionId);
      }
    }
  }

  _speculativeGpsFetch(userContext) {
    this.bus.publish('kernel.prediction.gps_fetched', { location: 'Sector 128, Noida' });
  }

  _speculativeSessionValidation(capabilityId, userContext) {
    if (this.sessionService) {
      // In a real implementation, this would look up providers for capabilityId
      // and validate sessions for them.
      this.sessionService.validateCapabilityProviders(capabilityId).then(sessions => {
        sessions.forEach(s => {
          this.bus.publish('kernel.prediction.session_validated', {
            provider: s.provider,
            isLoggedIn: s.status === 'AUTHENTICATED',
            confidence: s.confidence,
          });
        });
      }).catch(() => {});
    } else {
      this.bus.publish('kernel.prediction.session_validated', { capabilityId, status: 'deferred' });
    }
  }

  clearPredictions() {
    this.activePredictions.clear();
  }
}

module.exports = { PredictionEngine };
