import { validateExportReceipt } from '@phioffice369/core/schemas';
import { ARTIFACT_METADATA_PREFIX } from './localArtifactMetadata.js';
import { isWorkspaceRecord, workspaceTypeForKey } from './workspaceRecords.js';

export function inspectBackupSnapshot(snapshot) {
  const entries = [];
  const errors = [];
  const seen = new Set();
  let ignored = 0;

  for (const [index, pair] of snapshot.entries()) {
    const location = `storageSnapshot entry ${index + 1}`;
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((item) => typeof item !== 'string')) {
      errors.push(`${location} must be a [key, value] string pair.`);
      continue;
    }
    const [key, raw] = pair;
    if (!key.startsWith('phioffice369:') || seen.has(key)) {
      errors.push(`${location} has an external or repeated key.`);
      continue;
    }
    seen.add(key);
    const type = workspaceTypeForKey(key);
    const isMetadata = key.startsWith(ARTIFACT_METADATA_PREFIX);
    const isReceipt = key.startsWith('phioffice369:export_receipt:');
    if (!type && !isMetadata && !isReceipt) {
      ignored += 1;
      continue;
    }
    try {
      const record = JSON.parse(raw);
      const valid = type ? isWorkspaceRecord(record, type.kind)
        : isReceipt ? validateExportReceipt(record).ok
          : Array.isArray(record?.tags) && record.tags.every((tag) => typeof tag === 'string') &&
            (record.projectFolder == null || typeof record.projectFolder === 'string');
      if (valid) {
        entries.push(pair);
        continue;
      }
    } catch {
      // A corrupt stored record is exportable as raw bytes for manual recovery.
    }
    errors.push(`${location} contains damaged or unsupported PhiOffice file data.`);
  }
  return { entries, errors, ignored };
}
