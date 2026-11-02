import { starterTemplates } from '@phioffice369/templates';
import { getBrowserLocalStorage, listStorageKeys, readStorageJson } from './workspaceStorageAccess.js';

export const RECENT_WORKSPACE_TYPES = Object.freeze([
  { prefix: 'phioffice369:phiwrite:', app: 'PhiWrite', kind: 'write' },
  { prefix: 'phioffice369:phigrid:', app: 'PhiGrid', kind: 'grid' },
  { prefix: 'phioffice369:phideck:', app: 'PhiDeck', kind: 'deck' },
]);

function typeForKey(key) {
  return RECENT_WORKSPACE_TYPES.find((type) => key.startsWith(type.prefix));
}

function isUsefulRecord(record, kind) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (kind === 'write') return typeof record.content === 'string';
  if (kind === 'grid') return Array.isArray(record.columns) && Array.isArray(record.rows);
  if (kind === 'deck') return Array.isArray(record.slides);
  return false;
}

function validTimestamp(value) {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

// A new file has a new key; starter-template keys and their existing data stay unchanged.
export function makeIndependentWorkspaceTemplate(template, id = null) {
  if (!RECENT_WORKSPACE_TYPES.some((type) => type.app === template?.app)) {
    throw new Error('Only PhiWrite, PhiGrid and PhiDeck support independent files.');
  }
  const randomId = id ?? globalThis.crypto?.randomUUID?.()
    ?? (Date.now().toString(36) + '_' + Math.random().toString(36).slice(2));
  if (typeof randomId !== 'string' || !/^[a-z0-9_-]{6,100}$/i.test(randomId)) {
    throw new Error('Invalid independent file identifier.');
  }
  return {
    ...template,
    id: 'file_' + randomId,
    sourceTemplateId: template.sourceTemplateId ?? template.id,
  };
}

export function scanRecentWorkspaces({
  storage = getBrowserLocalStorage(),
  templates = starterTemplates,
} = {}) {
  if (!storage) return [];
  let keys = [];
  try {
    keys = listStorageKeys(storage);
  } catch {
    return [];
  }

  return keys.flatMap((key) => {
    const type = typeForKey(key);
    if (!type) return [];
    const id = key.slice(type.prefix.length);
    if (!/^[a-z0-9_-]{1,120}$/i.test(id)) return [];

    let record;
    try {
      record = readStorageJson(key, storage);
    } catch {
      return [];
    }
    if (!isUsefulRecord(record, type.kind)) return [];
    const sourceTemplateId = record.sourceTemplateId
      ?? (templates.some((template) => template.id === id) ? id : null);
    const base = templates.find((template) => template.id === sourceTemplateId) ?? null;
    const title = typeof record.title === 'string' && record.title.trim()
      ? record.title.trim().slice(0, 240)
      : base?.title ?? 'Untitled ' + type.app;

    return [{
      key, id, title, kind: type.kind, app: type.app, sourceTemplateId,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
      sortTime: validTimestamp(record.updatedAt),
      isIndependent: id.startsWith('file_'),
    }];
  }).sort((left, right) =>
    right.sortTime - left.sortTime || left.title.localeCompare(right.title) || left.key.localeCompare(right.key)
  );
}

export function resolveRecentWorkspaceTemplate(entry, templates = starterTemplates) {
  if (!entry || !RECENT_WORKSPACE_TYPES.some((type) => type.app === entry.app && type.kind === entry.kind)) {
    throw new Error('Unsupported recent-file entry.');
  }
  const base = templates.find((template) => template.id === entry.sourceTemplateId && template.app === entry.app);
  return {
    ...(base ?? {
      purpose: 'Recovered browser-local artifact',
      sections: entry.kind === 'write' ? ['Draft'] : entry.kind === 'grid' ? ['Item', 'Value', 'Notes'] : ['Opening'],
      trustDefaults: ['private'],
    }),
    id: entry.id,
    sourceTemplateId: entry.sourceTemplateId ?? entry.id,
    title: entry.title,
    app: entry.app,
  };
}
