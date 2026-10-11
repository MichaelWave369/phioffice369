// Intentionally bounded 2-level Markdown lists: top-level lines and child
// lines indented with exactly two spaces. No arbitrary nested HTML or syntax.
function parseLine(line) {
  const match = String(line ?? '').match(/^( {0,2})([-+*]|\d{1,6}[.)])\s+(.+)$/);
  if (!match || (match[1].length !== 0 && match[1].length !== 2)) return null;
  const ordered = /^\d/.test(match[2]);
  return {
    level: match[1].length / 2,
    listType: ordered ? 'ol' : 'ul',
    text: match[3],
    ...(ordered ? { number: Number(match[2].match(/^\d+/)[0]) } : {}),
  };
}

export function parsePhiWriteListAt(lines, at) {
  if (!Array.isArray(lines) || at < 0) return null;
  const first = parseLine(lines[at]);
  if (!first || first.level !== 0) return null;
  const items = [];
  let i = at;
  while (i < lines.length && items.length < 500) {
    const item = parseLine(lines[i]);
    if (!item || (item.level === 1 && !items.some((prev) => prev.level === 0))) break;
    items.push(item);
    i += 1;
  }
  if (!items.length) return null;
  const onlyFlat = items.every((item) => item.level === 0 &&
    item.listType === items[0].listType);
  if (onlyFlat) {
    return {
      block: {
        kind: 'list',
        listType: items[0].listType,
        items: items.map((item) => item.text),
        ...(items[0].listType === 'ol' ? { start: items[0].number } : {}),
      },
      nextIndex: i,
    };
  }
  return { block: { kind: 'nested-list', items }, nextIndex: i };
}

export function buildTwoLevelListTree(items) {
  const roots = [];
  for (const item of items) {
    const node = { ...item, children: [] };
    if (item.level === 1 && roots.length) roots[roots.length - 1].children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function groupTwoLevelListNodes(nodes) {
  const groups = [];
  for (const node of nodes) {
    let group = groups[groups.length - 1];
    if (!group || group.listType !== node.listType) {
      group = { listType: node.listType, start: node.number ?? 1, items: [] };
      groups.push(group);
    }
    group.items.push(node);
  }
  return groups;
}
