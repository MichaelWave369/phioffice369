const MAX_REVISIONS = 40;
const MAX_HISTORY_CHARS = 3_000_000;

export function createDocumentHistory(content) {
  return { past: [], content, future: [], typedAt: null };
}

function remember(entries, content) {
  const next = [...entries.slice(-(MAX_REVISIONS - 1)), content];
  let remaining = MAX_HISTORY_CHARS;
  let index = next.length;
  while (index > 0 && next[index - 1].length <= remaining) {
    remaining -= next[--index].length;
  }
  return next.slice(index);
}

export function updateDocumentHistory(history, action) {
  const { past, content, future, typedAt } = history;
  if (action.type === 'undo' && past.length) {
    return { past: past.slice(0, -1), content: past.at(-1), future: remember(future, content), typedAt: null };
  }
  if (action.type === 'redo' && future.length) {
    return { past: remember(past, content), content: future.at(-1), future: future.slice(0, -1), typedAt: null };
  }
  if (action.type !== 'edit') return history;
  const next = typeof action.next === 'function' ? action.next(content) : action.next;
  if (next === content) return history;
  const time = action.typedAt ?? null;
  const grouped = time !== null && typedAt !== null && time - typedAt < 750;
  return { past: grouped ? past : remember(past, content), content: next, future: [], typedAt: time };
}
