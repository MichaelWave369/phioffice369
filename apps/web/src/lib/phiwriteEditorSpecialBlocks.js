// PhiWrite's constrained, local-only quote/code toolbar transforms.
// Standalone and deterministic so no rich-text editor or dependency is needed.
export const PHIWRITE_SPECIAL_BLOCKS = Object.freeze({
  quote: { label: 'Quote' },
  codeblock: { label: 'Code block' },
});

function clamp(value, length) {
  return Math.max(0, Math.min(length, Number.isFinite(value) ? Math.trunc(value) : 0));
}

function fence(line) {
  const result = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return result ? { char: result[1][0], size: result[1].length } : null;
}

function withinFence(source, offset) {
  let opened = null;
  for (const line of source.slice(0, offset).split('\n')) {
    const current = fence(line);
    if (!current) continue;
    if (!opened) opened = current;
    else if (opened.char === current.char && current.size >= opened.size) opened = null;
  }
  return Boolean(opened);
}

function simpleLine(line) {
  // Refuse transformations that would replace existing structured Markdown.
  // Inline formatting is safe because it never changes paragraph block type.
  return !/^(?: {0,3}(?:#{1,6}\s|>\s?|[-+*]\s|\d{1,6}[.)]\s)| {2,3}[-+*]\s| {4,}\S|\s*\||.*\|\s*$)/.test(line)
    && !fence(line);
}

export function formatPhiWriteSpecialBlock(content, start, end, action) {
  if (!Object.hasOwn(PHIWRITE_SPECIAL_BLOCKS, action)) {
    throw new RangeError('Unsupported PhiWrite special block format');
  }
  const source = String(content ?? '');
  const a = clamp(start, source.length), b = clamp(end, source.length);
  const left = Math.min(a, b), right = Math.max(a, b);
  const selected = right > left;
  const lastIncluded = selected ? Math.max(left, right - 1) : left;
  const regionStart = source.lastIndexOf('\n', Math.max(0, left - 1)) + 1;
  const newline = source.indexOf('\n', lastIncluded);
  const regionEnd = newline < 0 ? source.length : newline;
  const region = source.slice(regionStart, regionEnd);
  const lines = region.split('\n');

  const refuse = (reason) => ({
    content: source, selectionStart: left, selectionEnd: right, changed: false, reason,
  });
  const success = (next, from, to) => ({
    content: next, selectionStart: from, selectionEnd: to, changed: true, reason: null,
  });

  if (!region || lines.length > 100 || lines.some((line) => !line.trim() || line.includes('\r'))) {
    return refuse('blank');
  }

  // The only allowed edit inside a fenced region is removing an exact,
  // directly enclosing three-tilde fence. Reject partial fence edits.
  if (action === 'codeblock') {
    const before = source.slice(0, regionStart);
    const after = source.slice(regionEnd);
    const leftFence = before.endsWith('~~~\n') &&
      (regionStart === 4 || before[before.length - 5] === '\n');
    const rightFence = after.startsWith('\n~~~') &&
      (after.length === 4 || after[4] === '\n');
    if (leftFence && rightFence && lines.every((line) => !fence(line))) {
      const open = regionStart - 4;
      const unwrapped = source.slice(0, open) + region + source.slice(regionEnd + 4);
      const relativeCaret = Math.max(0, left - regionStart);
      const caret = open + relativeCaret;
      return success(unwrapped, selected ? open : caret,
        selected ? open + region.length : caret);
    }
    if (withinFence(source, regionStart) || lines.some((line) => fence(line))) return refuse('code');
    if (!lines.every(simpleLine)) return refuse('structured');
    const next = source.slice(0, regionStart) + '~~~\n' + region + '\n~~~' + source.slice(regionEnd);
    const newStart = regionStart + 4;
    const caret = newStart + (left - regionStart);
    return success(next, selected ? newStart : caret,
      selected ? newStart + region.length : caret);
  }

  if (withinFence(source, regionStart) || lines.some((line) => fence(line))) return refuse('code');

  const quoted = lines.map((line) => line.match(/^>\s?(.*)$/));
  const allQuoted = quoted.every(Boolean);
  const anyQuoted = quoted.some(Boolean);
  if (anyQuoted && !allQuoted) return refuse('structured');

  if (!allQuoted && !lines.every(simpleLine)) return refuse('structured');
  const updated = allQuoted ? quoted.map((match) => match[1]).join('\n')
    : lines.map((line) => '> ' + line).join('\n');
  const next = source.slice(0, regionStart) + updated + source.slice(regionEnd);
  const caretOffset = left - regionStart;
  const originalPrefix = allQuoted ? (lines[0].length - quoted[0][1].length) : 0;
  const nextPrefix = allQuoted ? 0 : 2;
  const caret = regionStart + Math.max(0, caretOffset - originalPrefix) + nextPrefix;
  const safeCaret = Math.min(regionStart + updated.length, caret);
  return success(next, selected ? regionStart : safeCaret,
    selected ? regionStart + updated.length : safeCaret);
}
