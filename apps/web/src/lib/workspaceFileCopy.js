import { makeIndependentWorkspaceTemplate } from './recentWorkspaces.js';
import { workspaceTitle, workspaceTypeForKey } from './workspaceRecords.js';

export function prepareWorkspaceCopy(key, record, suffix, identifier) {
  const { app, prefix } = workspaceTypeForKey(key);
  const id = key.slice(prefix.length);
  const template = makeIndependentWorkspaceTemplate({ app, id, sourceTemplateId: record.sourceTemplateId }, identifier);
  const title = workspaceTitle(record.title ?? '', app);
  return {
    key: prefix + template.id,
    snapshot: {
      ...record,
      templateId: template.id,
      sourceTemplateId: template.sourceTemplateId,
      title: title.slice(0, 240 - suffix.length) + suffix,
    },
  };
}
