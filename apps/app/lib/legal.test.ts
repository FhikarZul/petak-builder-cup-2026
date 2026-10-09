import { describe, expect, it } from 'vitest';
import { shouldBlockForLegal } from './legalGate';

describe('legal acceptance gate', () => {
  it('blocks normal accounts until both terms and privacy are accepted', () => {
    expect(shouldBlockForLegal({ is_reviewer: false, terms_accepted_at: null, privacy_accepted_at: null })).toBe(true);
    expect(shouldBlockForLegal({ is_reviewer: false, terms_accepted_at: '2026-08-29T00:00:00Z', privacy_accepted_at: null })).toBe(true);
    expect(shouldBlockForLegal({ is_reviewer: false, terms_accepted_at: null, privacy_accepted_at: '2026-08-29T00:00:00Z' })).toBe(true);
    expect(shouldBlockForLegal({ is_reviewer: false, terms_accepted_at: '2026-08-29T00:00:00Z', privacy_accepted_at: '2026-08-29T00:00:00Z' })).toBe(false);
  });

  it('does not block reviewer accounts', () => {
    expect(shouldBlockForLegal({ is_reviewer: true, terms_accepted_at: null, privacy_accepted_at: null })).toBe(false);
  });
});
