// Local-only line/paragraph formatting for the supported PhiWrite Markdown.
// Whole-line edits remain independently testable without React or browser APIs.
export const PHIWRITE_BLOCK_ACTIONS = Object.freeze({
  h1: { label: 'Heading 1', marker: '# ' },
  h2: { label: 'Heading 2', marker: '## ' },
  h3: { label: 'Heading 3', marker: '### ' },
  bullet: { label: 'Bullet list', marker: '- ' },
  numbered: { label: 'Numbered list', marker: '1. ' },
});

function bound(offset, length) {
  return Math.min(length, Math.max(0, Number.isFinite(offset) ? Math.trunc(offset) : 0));
}

function detectedLine(line) {
  const heading = line.match(/^( {0,3})(#{1,6})[ \t]+(.+)$/);
  if (heading) return {
    type: 'heading', level: heading[2].length, prefix: line.length - heading[3].length,
  };
  const list = line.match(/^( {0,2})([-+*]|\d{1,6}[.)])[ \t]+(.+)$/);
  if (list) return {
    type: /^\d/.test(list[2]) ? 'numbered' : 'bullet',
    prefix: line.length - list[3].length, indent: list[1].length,
  };
  return { type: 'plain', prefix: 0 };
}

function fenceAtLine(line) {
  const match = line.match(new RegExp('^ {0,3}(' + String.fromCharCode(96) + '{3,}|~{3,})'));
  return match ? { character: match[1][0], width: match[1].length } : null;
}

function insideFencedBlock(source, lineStart) {
  let fence = null;
  for (const line of source.slice(0, lineStart).split('\n')) {
    const current = fenceAtLine(line);
    if (!current) continue;
    if (!fence) fence = current;
    else if (fence.character === current.character && current.width >= fence.width) fence = null;
  }
  return fence !== null;
}

export function formatPhiWriteBlockSelection(content, start, end, action) {
  if (!Object.hasOwn(PHIWRITE_BLOCK_ACTIONS, action)) {
    throw new RangeError('Unsupported PhiWrite paragraph action');
  }
  const source = String(content ?? '');
  const a = bound(start, source.length), b = bound(end, source.length);
  const left = Math.min(a, b), right = Math.max(a, b);
  const selected = right > left;
  // Selection ending at the next line's beginning does not style that line.
  const lastIncluded = selected ? Math.max(left, right - 1) : left;
  const blockStart = source.lastIndexOf('\n', Math.max(0, left - 1)) + 1;
  const ending = source.indexOf('\n', lastIncluded);
  const blockEnd = ending < 0 ? source.length : ending;
  const region = source.slice(blockStart, blockEnd);
  const lines = region.split('\n');

  function refused(reason) {
    return {
      content: source, changed: false, reason, selectionStart: left, selectionEnd: right,
    };
  }

  if (!lines.length || lines.length > 100 || lines.some((line) => !line.trim())) return refused('blank');
  if (insideFencedBlock(source, blockStart) || lines.some((line) => fenceAtLine(line))) return refused('code');
  // Tables, blockquotes, indented code and nested list items need specialized
  // editing rather than destructive prefix stripping.
  if (lines.some((line) => /^ {0,3}>\s|^\s*\||\|\s*$|^ {4,}\S/.test(line))) {
    return refused('structured');
  }
  if (action.startsWith('h') && lines.length !== 1) return refused('multiline');

  const parsed = lines.map((line) => ({ line, ...detectedLine(line) }));
  if (parsed.some((item) => item.indent === 2)) return refused('structured');
  const texts = parsed.map((item) => item.line.slice(item.prefix));
  if (texts.some((text) => !text.trim())) return refused('blank');

  const headingLevel = action.startsWith('h') ? Number(action[1]) : null;
  const undo = headingLevel !== null
    ? parsed[0].type === 'heading' && parsed[0].level === headingLevel
    : parsed.every((entry) => entry.type === action);
  const nextLines = texts.map((text, index) => {
    if (undo) return text;
    if (headingLevel !== null) return '#'.repeat(headingLevel) + ' ' + text;
    return action === 'bullet' ? '- ' + text : (index + 1) + '. ' + text;
  });
  const nextRegion = nextLines.join('\n');
  if (nextRegion === region) return refused('unchanged');
  const next = source.slice(0, blockStart) + nextRegion + source.slice(blockEnd);
  // Collapsed cursor sticks to the content. Selection sticks to the changed
  // full lines, allowing another click to toggle or change a list.
  const caret = left - blockStart;
  const newPrefix = undo ? 0 : headingLevel !== null ? headingLevel + 1 : 2;
  const from = selected ? blockStart : blockStart +
    Math.min(nextRegion.length, Math.max(0, caret - parsed[0].prefix) + newPrefix);
  return {
    content: next, changed: true, reason: null,
    selectionStart: from,
    selectionEnd: selected ? blockStart + nextRegion.length : from,
  };
}
