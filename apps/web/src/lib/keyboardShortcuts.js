export const keyboardShortcutList = [
  { keys: 'Ctrl/⌘ + 1–7', action: 'Switch between main tabs' },
  { keys: 'Ctrl/⌘ + K', action: 'Focus the active search box' },
  { keys: 'Shift + ?', action: 'Open keyboard shortcut help' },
  { keys: 'Escape', action: 'Close shortcut help' },
];

export function isEditableElement(element) {
  const tagName = element?.tagName?.toLowerCase();
  return Boolean(
    element?.isContentEditable
    || tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select',
  );
}

export function normalizeShortcutKey(event) {
  if (!event) return '';
  if (event.key === ' ') return 'space';
  return String(event.key ?? '').toLowerCase();
}

export function isCommandLikeShortcut(event) {
  return Boolean(event?.ctrlKey || event?.metaKey);
}

export function getTabShortcutIndex(event, maxTabs = 7) {
  if (!isCommandLikeShortcut(event)) return -1;

  const key = normalizeShortcutKey(event);
  if (!/^\d$/.test(key)) return -1;

  const tabNumber = Number(key);
  if (tabNumber < 1 || tabNumber > maxTabs) return -1;

  return tabNumber - 1;
}

export function shouldOpenShortcutHelp(event) {
  if (!event || isEditableElement(event.target)) return false;
  return event.shiftKey && normalizeShortcutKey(event) === '?';
}

export function shouldFocusSearch(event) {
  return isCommandLikeShortcut(event) && normalizeShortcutKey(event) === 'k';
}

export function shouldCloseOverlay(event) {
  return normalizeShortcutKey(event) === 'escape';
}
