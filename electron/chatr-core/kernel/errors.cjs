'use strict';

class CapabilityNotBoundError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CapabilityNotBoundError';
    this.code = 'CAPABILITY_NOT_BOUND';
    this.intentId = details.intentId;
    this.capability = details.capability;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, capability: this.capability, timestamp: this.timestamp };
  }
}

class PolicyBlockedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PolicyBlockedError';
    this.code = 'POLICY_BLOCKED';
    this.intentId = details.intentId;
    this.capability = details.capability;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, capability: this.capability, timestamp: this.timestamp };
  }
}

class ProviderFailoverExhaustedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProviderFailoverExhaustedError';
    this.code = 'PROVIDER_FAILOVER_EXHAUSTED';
    this.intentId = details.intentId;
    this.capability = details.capability;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, capability: this.capability, timestamp: this.timestamp };
  }
}

class IntentNotFoundError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'IntentNotFoundError';
    this.code = 'INTENT_NOT_FOUND';
    this.intentId = details.intentId;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, timestamp: this.timestamp };
  }
}

class IllegalTransitionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'IllegalTransitionError';
    this.code = 'ILLEGAL_TRANSITION';
    this.intentId = details.intentId;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, timestamp: this.timestamp };
  }
}

class LedgerWriteError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'LedgerWriteError';
    this.code = 'LEDGER_WRITE_ERROR';
    this.intentId = details.intentId;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, timestamp: this.timestamp };
  }
}

class ABIVersionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ABIVersionError';
    this.code = 'ABI_VERSION_ERROR';
    this.intentId = details.intentId;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, timestamp: this.timestamp };
  }
}

class VerificationFailedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'VerificationFailedError';
    this.code = 'VERIFICATION_FAILED';
    this.intentId = details.intentId;
    this.capability = details.capability;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, intentId: this.intentId, capability: this.capability, timestamp: this.timestamp };
  }
}

module.exports = {
  CapabilityNotBoundError,
  PolicyBlockedError,
  ProviderFailoverExhaustedError,
  IntentNotFoundError,
  IllegalTransitionError,
  LedgerWriteError,
  ABIVersionError,
  VerificationFailedError
};
