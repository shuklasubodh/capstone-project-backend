import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMembershipTier } from './membershipTier.js';

test('normalizes membership tier capitalization', () => {
  assert.equal(normalizeMembershipTier('standard'), 'Standard');
  assert.equal(normalizeMembershipTier('PREMIUM'), 'Premium');
  assert.equal(normalizeMembershipTier('gOlD'), 'Gold');
});
