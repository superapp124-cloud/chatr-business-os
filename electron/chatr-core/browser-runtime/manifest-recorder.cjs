'use strict';

/**
 * CHATR Browser Runtime — Manifest Recorder
 * Sprint 1.1
 *
 * Records a sequence of manually observed browser actions and generates
 * a draft manifest. Engineers perform the flow once; the recorder
 * captures it; the manifest is written to disk.
 *
 * This dramatically reduces the cost of onboarding new providers.
 */

class ManifestRecorder {
  constructor(provider) {
    this._provider = provider;
    this._flowName = 'unnamed_flow';
    this._steps = [];
    this._recording = false;
  }

  /**
   * Start recording a named flow.
   */
  startFlow(flowName) {
    this._flowName = flowName;
    this._steps = [];
    this._recording = true;
    return this;
  }

  /**
   * Record a navigate step.
   */
  navigate(url) {
    this._assertRecording();
    // Replace dynamic parts with template variables
    this._steps.push({ step: 'navigate', url });
    return this;
  }

  /**
   * Record an observe step.
   */
  observe(selector, timeoutMs = 3000) {
    this._assertRecording();
    this._steps.push({ step: 'observe', selector, timeout_ms: timeoutMs });
    return this;
  }

  /**
   * Record an extract step.
   */
  extract(selector, schema) {
    this._assertRecording();
    this._steps.push({ step: 'extract', selector, schema });
    return this;
  }

  /**
   * Record an act step.
   */
  act(action, target, value = null) {
    this._assertRecording();
    const s = { step: 'act', action, target };
    if (value !== null) s.value = value;
    this._steps.push(s);
    return this;
  }

  /**
   * Record a verify step.
   */
  verify(condition) {
    this._assertRecording();
    this._steps.push({ step: 'verify', condition });
    return this;
  }

  /**
   * Record a wait step (for dynamic content).
   */
  wait(ms) {
    this._assertRecording();
    this._steps.push({ step: 'wait', duration_ms: ms });
    return this;
  }

  /**
   * Stop recording and generate a draft manifest object.
   * @returns {object} Draft manifest (not yet validated or saved)
   */
  stopAndGenerate() {
    this._assertRecording();
    this._recording = false;

    const draft = {
      provider: this._provider,
      version: '1.0',
      runtime_version: '1.0',
      generated_at: new Date().toISOString(),
      generated_by: 'ManifestRecorder',
      maturity: 'draft',
      flows: {
        [this._flowName]: [...this._steps],
      },
    };

    return draft;
  }

  /**
   * Convert the draft to a JSON string suitable for saving to disk.
   */
  toJSON() {
    return JSON.stringify(this.stopAndGenerate(), null, 2);
  }

  _assertRecording() {
    if (!this._recording) throw new Error('ManifestRecorder: startFlow() must be called before recording steps');
  }
}

module.exports = { ManifestRecorder };
