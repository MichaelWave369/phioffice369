import { blankWorkspaceTemplates, starterTemplates } from '@phioffice369/templates';
import { getBrowserLocalStorage, listStorageKeys } from './workspaceStorageAccess.js';

import { readWorkspaceRecord, workspaceTypeForKey, WORKSPACE_TYPES } from './workspaceRecords.js';

const workspaceTemplates = [...starterTemplates, ...blankWorkspaceTemplates];

function validTimestamp(value) {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

// A new file has a new key; starter-template keys and their existing data stay unchanged.
export function makeIndependentWorkspaceTemplate(template, id = null) {
  if (!WORKSPACE_TYPES.some((type) => type.app === template?.app)) {
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
  templates = workspaceTemplates,
  trashed = false,
} = {}) {
  if (!storage) return [];
  let keys = [];
  try {
    keys = listStorageKeys(storage);
  } catch {
    return [];
  }

  return keys.flatMap((key) => {
    const type = workspaceTypeForKey(key);
    if (!type) return [];
    const id = key.slice(type.prefix.length);
    const { record, state } = readWorkspaceRecord(key, storage);
    if (state !== (trashed ? 'trashed' : 'saved')) return [];
    const sourceTemplateId = record.sourceTemplateId
      ?? (templates.some((template) => template.id === id) ? id : null);
    const base = templates.find((template) => template.id === sourceTemplateId) ?? null;
    const title = typeof record.title === 'string' && record.title.trim()
      ? record.title.trim().slice(0, 240)
      : base?.title ?? 'Untitled ' + type.app;

    return [{
      key, id, title, trashedAt: record.trashedAt, kind: type.kind, app: type.app, sourceTemplateId,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
      sortTime: validTimestamp(record.updatedAt),
      isIndependent: id.startsWith('file_'),
    }];
  }).sort((left, right) =>
    right.sortTime - left.sortTime || left.title.localeCompare(right.title) || left.key.localeCompare(right.key)
  );
}

export function resolveRecentWorkspaceTemplate(entry, templates = workspaceTemplates) {
  if (!entry || !WORKSPACE_TYPES.some((type) => type.app === entry.app && type.kind === entry.kind)) {
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
