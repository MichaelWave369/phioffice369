// Bounded, literal find over the editable PhiWrite Markdown source.
// No regex-mode, remote processing, hidden mutations or new dependencies.
export const MAX_PHIWRITE_MATCHES = 10000;

function validateQuery(value) {
  return value.length > 0 && value.length <= 256 && !/[\r\n\u0000]/.test(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
}

export function findPhiWriteMatches(content, query, caseSensitive = false) {
  const source = String(content ?? '');
  const needle = String(query ?? '');
  if (!needle) return { matches: [], truncated: false, reason: 'empty' };
  if (!validateQuery(needle)) return { matches: [], truncated: false, reason: 'query' };
  const search = new RegExp(escapeRegex(needle), caseSensitive ? 'g' : 'gi');
  const matches = [];
  let result;
  while ((result = search.exec(source)) !== null) {
    if (matches.length === MAX_PHIWRITE_MATCHES) {
      return { matches, truncated: true, reason: 'limit' };
    }
    matches.push({ start: result.index, end: result.index + result[0].length });
  }
  return { matches, truncated: false, reason: null };
}

export function choosePhiWriteMatch(matches, position, direction = 'next') {
  if (!Array.isArray(matches) || !matches.length) return -1;
  const at = Number.isFinite(position) ? position : 0;
  if (direction === 'next') {
    const found = matches.findIndex((match) => match.start >= at);
    return found < 0 ? 0 : found;
  }
  if (direction === 'previous') {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      if (matches[i].end <= at) return i;
    }
    return matches.length - 1;
  }
  throw new RangeError('Unknown find direction');
}

function resultOf(source, next, count, cursor) {
  return {
    content: next, changed: source !== next,
    reason: source === next ? 'same' : null,
    count, selectionStart: cursor.start, selectionEnd: cursor.end,
    before: source, after: next,
  };
}

export function replacePhiWriteMatch(content, query, replacement, offset, caseSensitive = false) {
  const source = String(content ?? ''), text = String(replacement ?? '');
  if (text.length > 2048) return { content: source, changed: false, reason: 'replacement' };
  const found = findPhiWriteMatches(source, query, caseSensitive);
  if (found.reason && found.reason !== 'empty') return { content: source, changed: false, reason: found.reason };
  const match = found.matches.find((entry) => entry.start === offset);
  if (!match) return { content: source, changed: false, reason: 'match' };
  return resultOf(source, source.slice(0, match.start) + text + source.slice(match.end),
    1, { start: match.start, end: match.start + text.length });
}

export function replaceAllPhiWriteMatches(content, query, replacement, caseSensitive = false) {
  const source = String(content ?? ''), text = String(replacement ?? '');
  if (text.length > 2048) return { content: source, changed: false, reason: 'replacement' };
  const found = findPhiWriteMatches(source, query, caseSensitive);
  if (found.reason && found.reason !== 'empty') return { content: source, changed: false, reason: found.reason };
  if (found.truncated) return { content: source, changed: false, reason: 'limit' };
  if (!found.matches.length) return { content: source, changed: false, reason: 'match' };
  const pieces = [];
  let from = 0;
  for (const match of found.matches) {
    pieces.push(source.slice(from, match.start), text);
    from = match.end;
  }
  pieces.push(source.slice(from));
  return resultOf(source, pieces.join(''), found.matches.length, { start: 0, end: 0 });
}

export function undoPhiWriteReplace(currentContent, receipt) {
  const current = String(currentContent ?? '');
  if (!receipt || !receipt.changed || current !== receipt.after) {
    return { content: current, changed: false, reason: 'stale' };
  }
  return { content: receipt.before, changed: true, reason: null };
}
