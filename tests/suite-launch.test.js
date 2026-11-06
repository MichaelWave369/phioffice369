import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSuiteLaunch } from '../apps/web/src/lib/suiteLaunch.js';

test('PhiOS launch only selects a known PhiOffice surface', () => {
  assert.equal(resolveSuiteLaunch('?app=PhiGrid'), 'PhiGrid');
  assert.equal(resolveSuiteLaunch('?app=phivault&file=untrusted'), 'PhiVault');
  assert.equal(resolveSuiteLaunch('?app=professor'), 'Professor Phi');
  assert.equal(resolveSuiteLaunch('?app=__proto__'), null);
  assert.equal(resolveSuiteLaunch('?app=https%3A%2F%2Fexample.com'), null);
  assert.equal(resolveSuiteLaunch(''), null);
});
