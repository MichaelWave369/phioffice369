import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppReadinessBadge,
  getAppReadinessMessage,
  IMPLEMENTED_APP_NAMES,
  isImplementedApp,
  shouldAllowAppSelection,
} from '../apps/web/src/lib/appReadiness.js';

test('implemented app list includes current prototype apps', () => {
  assert.deepEqual(IMPLEMENTED_APP_NAMES, ['PhiWrite', 'PhiGrid', 'PhiDeck', 'PhiVault', 'Professor Phi']);
});

test('isImplementedApp identifies available and planned apps', () => {
  assert.equal(isImplementedApp({ name: 'PhiWrite' }), true);
  assert.equal(isImplementedApp({ name: 'Professor Phi' }), true);
  assert.equal(isImplementedApp({ name: 'PhiNotes' }), false);
});

test('getAppReadinessBadge returns status for available apps and v0.2 badge for planned apps', () => {
  assert.equal(getAppReadinessBadge({ name: 'PhiWrite', status: 'v0.1 lite' }), 'v0.1 lite');
  assert.equal(getAppReadinessBadge({ name: 'PhiNotes', status: 'planned' }), 'Coming in v0.2');
});

test('getAppReadinessMessage explains available vs planned apps', () => {
  assert.match(getAppReadinessMessage({ name: 'PhiDeck' }), /available/);
  assert.match(getAppReadinessMessage({ name: 'PhiFlow' }), /planned/);
});

test('shouldAllowAppSelection only allows implemented apps', () => {
  assert.equal(shouldAllowAppSelection({ name: 'PhiVault' }), true);
  assert.equal(shouldAllowAppSelection({ name: 'PhiBase' }), false);
});
