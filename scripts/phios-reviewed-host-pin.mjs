import { execFileSync } from 'node:child_process';

export const REVIEWED_PHIOS_HOST_SHA = '1d0119eb8e35a542a45dec3192aa271a42e65af4';

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
