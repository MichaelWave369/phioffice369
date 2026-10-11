// Local-only read of the subset of Word numbering metadata needed to
// distinguish ordinary decimal lists from bullets. No XML entities or fetches.
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function children(node, tag) {
  return [...(node?.children ?? [])].filter(x => x.namespaceURI === WORD_NS && x.localName === tag);
}
function value(node, name = 'val') {
  return node?.getAttributeNS(WORD_NS, name) ?? node?.getAttribute('w:' + name) ?? null;
}
function intId(raw) {
  if (!/^\d{1,8}$/.test(String(raw ?? ''))) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function createDocxNumberingResolver(xml, parser) {
  const abstract = new Map();
  const instances = new Map();
  if (xml) {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DOCX import: Unsafe numbering XML.');
    if (!parser?.parseFromString) throw new Error('DOCX import: XML parser missing.');
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length ||
        doc.querySelector('parsererror') ||
        doc.documentElement.localName !== 'numbering' ||
        doc.documentElement.namespaceURI !== WORD_NS) {
      throw new Error('DOCX import: Invalid Word numbering definitions.');
    }
    for (const definition of children(doc.documentElement, 'abstractNum')) {
      const abstractId = intId(value(definition, 'abstractNumId'));
      if (abstractId === null) continue;
      const levels = new Map();
      for (const level of children(definition, 'lvl')) {
        const index = intId(value(level, 'ilvl'));
        if (index === null || index > 8) continue;
        const format = value(children(level, 'numFmt')[0]) ?? 'bullet';
        const start = intId(value(children(level, 'start')[0])) ?? 1;
        levels.set(index, { format, start: Math.max(1, start) });
      }
      abstract.set(abstractId, levels);
    }
    for (const num of children(doc.documentElement, 'num')) {
      const numId = intId(value(num, 'numId'));
      const abstractId = intId(value(children(num, 'abstractNumId')[0]));
      if (numId === null || abstractId === null) continue;
      const overrides = new Map();
      for (const override of children(num, 'lvlOverride')) {
        const level = intId(value(override, 'ilvl'));
        const start = intId(value(children(override, 'startOverride')[0]));
        if (level !== null && start !== null && level <= 8) overrides.set(level, Math.max(1, start));
      }
      instances.set(numId, { abstractId, overrides });
    }
  }
  return (rawId, rawLevel = 0) => {
    const numId = intId(rawId);
    const level = intId(rawLevel);
    if (numId === null || level === null) return null;
    const instance = instances.get(numId);
    const entry = abstract.get(instance?.abstractId)?.get(level);
    if (!entry) return null;
    const ordered = entry.format === 'decimal';
    return {
      kind: ordered ? 'ol' : 'ul',
      start: instance.overrides.get(level) ?? entry.start,
      level,
      approximated: !['decimal', 'bullet'].includes(entry.format),
    };
  };
}
