// Test-runner process shutdown. Browser.close must be allowed to complete
// BEFORE escalating to SIGTERM/SIGKILL; sending SIGTERM immediately turns a
// purported graceful storage-durability experiment into a forced-exit test.
function settleWithin(promise, milliseconds) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, milliseconds);
    Promise.resolve(promise).then(
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } },
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(false); } },
    );
  });
}

export async function shutdownBrowserProcess({
  isRunning, exited, requestBrowserClose, signal,
  gracefulTimeoutMs = 6000, termTimeoutMs = 1500, killTimeoutMs = 5000,
}) {
  if (!isRunning()) return { exitKind: 'already-exited', forced: false };

  // A DevTools command may reject because the socket closes *as the browser
  // exits*. A command response, or its rejection, is not an exit signal.
  // Continue waiting for the child process itself.
  if (typeof requestBrowserClose === 'function') {
    await settleWithin(Promise.resolve().then(requestBrowserClose), 1200);
    if (await settleWithin(exited, gracefulTimeoutMs) || !isRunning()) {
      return { exitKind: 'browser-close', forced: false };
    }
  }

  if (isRunning()) signal('SIGTERM');
  if (await settleWithin(exited, termTimeoutMs) || !isRunning()) {
    return { exitKind: 'sigterm', forced: true };
  }

  if (isRunning()) signal('SIGKILL');
  if (await settleWithin(exited, killTimeoutMs) || !isRunning()) {
    return { exitKind: 'sigkill', forced: true };
  }
  throw new Error('Browser process remained alive after SIGKILL.');
}
