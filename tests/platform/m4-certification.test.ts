import { describe, it, expect, beforeAll } from 'vitest';
import { OutcomeVerifier } from '../../src/platform/execution/OutcomeVerifier';

describe('M4-CERT: Outcome Platform Certification', () => {
  let verifier: OutcomeVerifier;
  const mockSourceEventId = '00000000-0000-0000-0000-000000000001';

  beforeAll(() => {
    verifier = new OutcomeVerifier();
  });

  it('M4-CERT-001: Verified Outcome', async () => {
    const expected = { targetEntityId: 'email_1', expectedState: { delivered: true, read: true } };
    const observed = { delivered: true, read: true };
    
    const result = await verifier.verifyObservation(expected, observed, mockSourceEventId);
    
    expect(result.status).toBe('verified');
    expect(result.unknowns).toHaveLength(0);
  });

  it('M4-CERT-002: Rejected Outcome', async () => {
    const expected = { targetEntityId: 'email_1', expectedState: { delivered: true, read: true } };
    const observed = { delivered: true, read: false }; // Contradicts expectation
    
    const result = await verifier.verifyObservation(expected, observed, mockSourceEventId);
    
    expect(result.status).toBe('rejected');
    expect(result.unknowns).toHaveLength(0);
  });

  it('M4-CERT-003: Inconclusive Outcome (Preserving Uncertainty)', async () => {
    const expected = { targetEntityId: 'email_1', expectedState: { delivered: true, read: true } };
    const observed = { delivered: true }; // 'read' status is missing/unknown
    
    const result = await verifier.verifyObservation(expected, observed, mockSourceEventId);
    
    expect(result.status).toBe('inconclusive');
    expect(result.unknowns).toContain('read'); // Platform explicitly tracks what it doesn't know
  });
});
