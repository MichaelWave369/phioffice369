import { safeExternalDocumentUrl, tokenizePhiWriteInline } from './phiwriteInline.js';

// A link edit is a reviewable, local-only operation, never a blind append.
// Preserve the exact source snapshot to prevent stale selection overwrites.
export function preparePhiWriteLinkSelection(source, start, end) {
  const content = String(source ?? '');
  const clamp = (value) => Math.max(0, Math.min(content.length,
    Number.isFinite(value) ? Math.trunc(value) : 0));
  const left = Math.min(clamp(start), clamp(end));
  const right = Math.max(clamp(start), clamp(end));
  const selected = content.slice(left, right);
  return {
    content, start: left, end: right,
    label: selected || 'link text',
    reason: /[\r\n]/.test(selected) ? 'multiline' : null,
  };
}

export function insertPhiWriteSafeLink(currentContent, selection, label, url) {
  const source = String(currentContent ?? '');
  const unchanged = (reason) => ({
    content: source, changed: false, reason, selectionStart: selection?.start ?? 0,
    selectionEnd: selection?.end ?? 0,
  });
  if (!selection || selection.content !== source) return unchanged('stale');
  if (selection.reason) return unchanged(selection.reason);
  if (!Number.isInteger(selection.start) || !Number.isInteger(selection.end) ||
      selection.start < 0 || selection.end < selection.start || selection.end > source.length) {
    return unchanged('selection');
  }
  const visible = String(label ?? '').trim();
  // Only link labels that our intentionally minimal one-layer parser can read.
  // Reject embedded Markdown constructs instead of promising nested markup.
  if (!visible || visible.length > 200 || /[\r\n\t\u0000-\u001f\[\]`*~=+]/.test(visible)) {
    return unchanged('label');
  }
  const trimmedUrl = String(url ?? '').trim();
  const href = safeExternalDocumentUrl(trimmedUrl);
  // The current link tokenizer cannot safely parse parentheses in an href.
  if (!href || /[()]/.test(href) || !tokenizePhiWriteInline(
    '[' + visible + '](' + href + ')',
  ).some((token) => token.href === href && token.text === visible)) {
    return unchanged('url');
  }
  // Refuse partial editing of existing markdown or inline span markers.
  const selected = source.slice(selection.start, selection.end);
  if (/[\r\n\[\]`*~=+]/.test(selected)) return unchanged('nested');
  if (source.slice(selection.start - 1, selection.start) === '[' ||
      source.slice(selection.end, selection.end + 2) === '](') return unchanged('nested');
  // Do not introduce an unsupported nested link inside a formatted span.
  for (const marker of ['**', '~~', '==', '++', '*', '`']) {
    if (source.slice(selection.start - marker.length, selection.start) === marker &&
        source.slice(selection.end, selection.end + marker.length) === marker) {
      return unchanged('nested');
    }
  }
  const markdown = '[' + visible + '](' + href + ')';
  const next = source.slice(0, selection.start) + markdown + source.slice(selection.end);
  return {
    content: next, changed: true, reason: null,
    selectionStart: selection.start + 1,
    selectionEnd: selection.start + 1 + visible.length,
  };
}
