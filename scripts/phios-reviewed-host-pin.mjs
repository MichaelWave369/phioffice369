import { execFileSync } from 'node:child_process';

export const REVIEWED_PHIOS_HOST_SHA = '53ed5caa46c463a0c7385c9bb177c803fdeaaa03';

/** A merged, explicitly reviewed source pin, not a publisher trust root. */
export function requireReviewedHostSha(observed, expected = REVIEWED_PHIOS_HOST_SHA) {
  if (typeof observed !== 'string' || !/^[0-9a-f]{40}$/.test(observed)
      || expected !== REVIEWED_PHIOS_HOST_SHA || observed !== expected) {
    throw new Error('Reviewed PhiOS host checkout SHA mismatch: refusing two-app acceptance');
  }
  return observed;
}

export function verifyReviewedHostCheckout(directory) {
  const observed = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: directory, encoding: 'utf8',
  }).trim();
  return requireReviewedHostSha(observed);
}
