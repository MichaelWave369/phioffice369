import test from 'node:test';
import assert from 'node:assert/strict';
import { shutdownBrowserProcess } from '../scripts/browser-process-shutdown.mjs';

function controlledExit() {
  let active = true;
  let done;
  const exited = new Promise(resolve => { done = resolve; });
  const signals = [];
  return {
    exited,
    isRunning: () => active,
    terminate: () => { active = false; done(); },
    signal(name) { signals.push(name); },
    signals,
  };
}

test('graceful Browser.close waits for real child exit before sending any signal', async () => {
  const child = controlledExit();
  const result = await shutdownBrowserProcess({
    ...child,
    requestBrowserClose: async () => {
      setTimeout(() => child.terminate(), 20);
    },
    gracefulTimeoutMs: 100, termTimeoutMs: 10, killTimeoutMs: 10,
  });
  assert.deepEqual(result, { exitKind: 'browser-close', forced: false });
  assert.deepEqual(child.signals, []);
});

test('DevTools disconnection after Browser.close is not mistaken for a forced exit', async () => {
  const child = controlledExit();
  const result = await shutdownBrowserProcess({
    ...child,
    requestBrowserClose: async () => {
      setTimeout(() => child.terminate(), 15);
      throw new Error('DevTools socket closed');
    },
    gracefulTimeoutMs: 100, termTimeoutMs: 10, killTimeoutMs: 10,
  });
  assert.deepEqual(result, { exitKind: 'browser-close', forced: false });
  assert.deepEqual(child.signals, []);
});

test('falls back to SIGTERM only after the browser-close grace period', async () => {
  const child = controlledExit();
  const signals = [];
  const result = await shutdownBrowserProcess({
    ...child,
    requestBrowserClose: async () => {},
    signal(name) { signals.push(name); if (name === 'SIGTERM') child.terminate(); },
    gracefulTimeoutMs: 10, termTimeoutMs: 100, killTimeoutMs: 10,
  });
  assert.deepEqual(result, { exitKind: 'sigterm', forced: true });
  assert.deepEqual(signals, ['SIGTERM']);
});

test('escalates to SIGKILL only when SIGTERM fails to stop Chrome', async () => {
  const child = controlledExit();
  const signals = [];
  const result = await shutdownBrowserProcess({
    ...child,
    requestBrowserClose: async () => {},
    signal(name) { signals.push(name); if (name === 'SIGKILL') child.terminate(); },
    gracefulTimeoutMs: 10, termTimeoutMs: 10, killTimeoutMs: 100,
  });
  assert.deepEqual(result, { exitKind: 'sigkill', forced: true });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});

test('does not signal a browser that has already exited', async () => {
  const child = controlledExit();
  child.terminate();
  const result = await shutdownBrowserProcess({
    ...child,
    requestBrowserClose: () => { throw Error('Should not be called'); },
  });
  assert.deepEqual(result, { exitKind: 'already-exited', forced: false });
  assert.deepEqual(child.signals, []);
});

test('reports failure instead of claiming a graceful shutdown if SIGKILL does not exit', async () => {
  const child = controlledExit();
  await assert.rejects(
    shutdownBrowserProcess({
      ...child,
      requestBrowserClose: async () => {},
      gracefulTimeoutMs: 5, termTimeoutMs: 5, killTimeoutMs: 5,
    }),
    /remained alive after SIGKILL/,
  );
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
});
