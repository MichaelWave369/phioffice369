// Deliberately small inline Markdown compatibility subset.
// The source draft remains plain Markdown; this helper recognizes only simple
// **bold**, *italic*, `code`, ~~strike~~, ==highlight==, ++underline++ and safe links without nesting.
export function safeExternalDocumentUrl(value) {
  const text = String(value ?? '');
  if (text.length < 1 || text.length > 2048 ||
      /[\u0000-\u0020\u007f<>\\]/.test(text)) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function tokenizePhiWriteInline(source) {
  const text = String(source ?? '');
  const tokens = [];
  let buffer = '';
  function flush() {
    if (buffer) { tokens.push({ text: buffer }); buffer = ''; }
  }
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length &&
        '*[]`~=+\\'.includes(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1 && !/[\r\n]/.test(text.slice(i + 1, end))) {
        flush();
        tokens.push({ text: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }
    if (text[i] === '[') {
      const match = text.slice(i).match(/^\[([^\]\r\n]+)\]\((https?:\/\/[^)\s]+)\)/i);
      if (match) {
        const href = safeExternalDocumentUrl(match[2]);
        if (href) {
          flush();
          tokens.push({ text: match[1], href });
          i += match[0].length;
          continue;
        }
      }
    }
    if (text.startsWith('~~', i) || text.startsWith('==', i) || text.startsWith('++', i)) {
      const marker = text.slice(i, i + 2);
      const end = text.indexOf(marker, i + 2);
      if (end > i + 2 && !/[\r\n]/.test(text.slice(i + 2, end))) {
        flush();
        tokens.push({ text: text.slice(i + 2, end),
          ...(marker === '~~' ? { strike: true } : marker === '==' ? { highlight: true } : { underline: true }) });
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2 && !/[\r\n]/.test(text.slice(i + 2, end))) {
        flush();
        tokens.push({ text: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i + 1 && text[i + 1] !== '*' &&
          !/[\r\n]/.test(text.slice(i + 1, end))) {
        flush();
        tokens.push({ text: text.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  flush();
  return tokens;
}

// Escape text when embedding values from arbitrary external Word files back
// into Markdown. Return plain text without interpreting unsafe URLs as links.
export function escapeInlineMarkdownText(value) {
  return String(value ?? '').replace(/[\\*`~+=\[\]]/g, '\\$&');
}

export function inlineTokensToMarkdown(tokens) {
  return tokens.map((token) => {
    const text = escapeInlineMarkdownText(token.text);
    if (token.code) return token.text.includes('`') ? text : '`' + token.text + '`';
    if (token.href) {
      const href = safeExternalDocumentUrl(token.href);
      return href ? '[' + text + '](' + href + ')' : text;
    }
    if (token.underline) return '++' + text + '++'; // deliberately nonstandard, single-layer
    if (token.highlight) return '==' + text + '=='; // only single-layer markup
    if (token.strike) return '~~' + text + '~~';
    if (token.bold && token.italic) return '**' + text + '**'; // subset limitation
    if (token.bold) return '**' + text + '**';
    if (token.italic) return '*' + text + '*';
    return text;
  }).join('');
}
