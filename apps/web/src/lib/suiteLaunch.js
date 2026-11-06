const launchTargets = Object.freeze({
  phiwrite: 'PhiWrite',
  phigrid: 'PhiGrid',
  phideck: 'PhiDeck',
  phivault: 'PhiVault',
  professor: 'Professor Phi',
});

export function resolveSuiteLaunch(search) {
  const target = new URLSearchParams(search).get('app')?.toLowerCase();
  return Object.hasOwn(launchTargets, target) ? launchTargets[target] : null;
}
