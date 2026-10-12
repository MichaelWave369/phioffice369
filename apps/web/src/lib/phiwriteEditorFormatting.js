// PhiWrite's deliberately small selection-aware inline Markdown editor.
// Pure and DOM-free so commands can be tested without a browser or runtime package.
export const PHIWRITE_FORMATS = Object.freeze({
  bold: { marker: '**', placeholder: 'bold text', label: 'Bold' },
  italic: { marker: '*', placeholder: 'italic text', label: 'Italic' },
  underline: { marker: '++', placeholder: 'underlined text', label: 'Underline' },
  strike: { marker: '~~', placeholder: 'removed text', label: 'Strikethrough' },
  highlight: { marker: '==', placeholder: 'important text', label: 'Highlight' },
  code: { marker: '`', placeholder: 'code', label: 'Code' },
});

function clampOffset(offset, length) {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(length, Math.max(0, Math.trunc(offset)));
}

export function formatPhiWriteSelection(content, start, end, format) {
  const spec = PHIWRITE_FORMATS[format];
  if (!spec) throw new RangeError('Unsupported PhiWrite inline formatting action');
  const source = String(content ?? '');
  const from = clampOffset(start, source.length);
  const to = clampOffset(end, source.length);
  const left = Math.min(from, to);
  const right = Math.max(from, to);
  const selection = source.slice(left, right);
  const { marker, placeholder } = spec;
  const width = marker.length;

  const unchanged = (reason) => ({
    content: source, selectionStart: left, selectionEnd: right, changed: false, reason,
  });
  const changed = (next, selectionStart, selectionEnd) => ({
    content: next, selectionStart, selectionEnd, changed: true, reason: null,
  });

  // A collapsed cursor creates a descriptive placeholder and selects it,
  // so the next keystroke naturally replaces it.
  if (!selection) {
    const insert = marker + placeholder + marker;
    return changed(source.slice(0, left) + insert + source.slice(right),
      left + width, left + width + placeholder.length);
  }
  if (/[\r\n]/.test(selection)) return unchanged('multiline');

  // Toggle off when the actual markers are inside the selection.
  if (selection.startsWith(marker) && selection.endsWith(marker) &&
      selection.length > width * 2) {
    const middle = selection.slice(width, -width);
    return changed(source.slice(0, left) + middle + source.slice(right),
      left, left + middle.length);
  }

  // Toggle off when only the formatted text is selected.
  if (source.slice(left - width, left) === marker &&
      source.slice(right, right + width) === marker) {
    return changed(source.slice(0, left - width) + selection + source.slice(right + width),
      left - width, left - width + selection.length);
  }

  // PhiWrite's parser is explicitly nonnested. Do not turn a supported
  // span into an unsupported combination or wrap a second delimiter.
  if (/(?:\*\*|~~|==|\+\+|`)/.test(selection) ||
      (format === 'italic' && selection.includes('*'))) {
    return unchanged('nested');
  }
  return changed(source.slice(0, left) + marker + selection + marker + source.slice(right),
    left + width, right + width);
}

export function phiWriteShortcutForKey({ key, ctrlKey = false, metaKey = false, altKey = false, shiftKey = false } = {}) {
  if ((!ctrlKey && !metaKey) || altKey || shiftKey) return null;
  const shortcuts = { b: 'bold', i: 'italic', u: 'underline', k: 'link' };
  return shortcuts[String(key ?? '').toLowerCase()] ?? null;
}
