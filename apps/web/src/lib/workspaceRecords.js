import { isSupportedSlide } from './deckSlides.js';
import { trustLabels } from '@phioffice369/core';
import { getBrowserLocalStorage, readStorageValue } from './workspaceStorageAccess.js';

export const WORKSPACE_TYPES = Object.freeze([
  { prefix: 'phioffice369:phiwrite:', app: 'PhiWrite', kind: 'write' },
  { prefix: 'phioffice369:phigrid:', app: 'PhiGrid', kind: 'grid' },
  { prefix: 'phioffice369:phideck:', app: 'PhiDeck', kind: 'deck' },
]);

export function workspaceTypeForKey(key) {
  return WORKSPACE_TYPES.find(({ prefix }) => key.startsWith(prefix) && /^[a-z0-9_-]{1,120}$/i.test(key.slice(prefix.length)));
}

const validLabels = new Set(trustLabels.map(({ id }) => id));
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const optionalString = (value) => value == null || typeof value === 'string';
const isCell = (value) => optionalString(value) || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean';

export function isWorkspaceRecord(record, kind) {
  if (!isObject(record) || !optionalString(record.title) || !optionalString(record.templateId) ||
      !optionalString(record.sourceTemplateId) || !optionalString(record.updatedAt) ||
      !optionalString(record.trashedAt) || (record.activeLabelId != null && !validLabels.has(record.activeLabelId))) return false;
  if (kind === 'write') return typeof record.content === 'string';
  if (kind === 'grid') {
    return Array.isArray(record.columns) && record.columns.length > 0 &&
      record.columns.every((column) => typeof column === 'string' && Boolean(column.trim())) &&
      new Set(record.columns).size === record.columns.length && Array.isArray(record.rows) &&
      record.rows.every((row) => isObject(row) && Object.values(row).every(isCell));
  }
  return kind === 'deck' && Array.isArray(record.slides) && record.slides.length > 0 &&
    record.slides.every(isSupportedSlide) &&
    new Set(record.slides.map(({ id }) => id)).size === record.slides.length;
}

export function readWorkspaceRecord(key, storage = getBrowserLocalStorage()) {
  if (!storage) return { record: null, raw: null, state: 'unavailable' };
  let raw;
  try {
    raw = readStorageValue(key, storage);
  } catch {
    return { record: null, raw: null, state: 'unavailable' };
  }
  if (raw === null) return { record: null, raw, state: 'missing' };
  try {
    const record = JSON.parse(raw);
    if (isWorkspaceRecord(record, workspaceTypeForKey(key)?.kind)) {
      return { record, raw, state: record.trashedAt ? 'trashed' : 'saved' };
    }
  } catch {
    // Keep the raw bytes intact so a workspace backup can recover them.
  }
  return { record: null, raw, state: 'damaged' };
}

export function workspaceTitle(title, app) {
  return title.trim() || `Untitled ${app} file`;
}
