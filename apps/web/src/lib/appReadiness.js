export const IMPLEMENTED_APP_NAMES = ['PhiWrite', 'PhiGrid', 'PhiDeck', 'PhiVault', 'Professor Phi'];

export function isImplementedApp(app) {
  return IMPLEMENTED_APP_NAMES.includes(app?.name);
}

export function getAppReadinessBadge(app) {
  if (isImplementedApp(app)) return app.status ?? 'available';
  return 'Coming in v0.2';
}

export function getAppReadinessMessage(app) {
  if (isImplementedApp(app)) return `${app.name} is available in this prototype.`;
  return `${app?.name ?? 'This app'} is planned for a later PhiOffice369 phase.`;
}

export function shouldAllowAppSelection(app) {
  return isImplementedApp(app);
}
