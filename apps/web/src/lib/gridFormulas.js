const FUNCTIONS = {
  SUM: (values) => values.reduce((sum, value) => sum + value, 0),
  AVERAGE: (values) => values.length ? FUNCTIONS.SUM(values) / values.length : fail('#DIV/0!'),
  MIN: (values) => values.length ? Math.min(...values) : 0,
  MAX: (values) => values.length ? Math.max(...values) : 0,
  COUNT: (values) => values.length,
};

export const GRID_LIMITS = Object.freeze({ rows: 500, columns: 40, cells: 10000, fileBytes: 4 * 1024 * 1024 });

class FormulaError extends Error {}
function fail(code) { throw new FormulaError(code); }

export function columnLetter(index) {
  let label = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + (value - 1) % 26) + label;
  }
  return label;
}

export function gridNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^(-?)(?:\$)/, '$1').replace(/(?<=\d),(?=\d{3}(?:[,\.]|$))/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function isGridFormula(value) {
  return typeof value === 'string' && value.startsWith('=');
}

function address(token) {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(token);
  if (!match) fail('#PARSE!');
  const column = [...match[1]].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  return [Number(match[2]) - 1, column];
}

function evaluateFormula(source, cell, charge) {
  if (source.length > 512) fail('#LIMIT!');
  const tokens = [];
  const scanner = /\s*(\d+(?:\.\d*)?(?:E[+-]?\d+)?|\.\d+(?:E[+-]?\d+)?|[A-Z]+[0-9]*|[+\-*/(),:])/gy;
  const formula = source.slice(1).trim().toUpperCase();
  let offset = 0;
  while (offset < formula.length) {
    const match = scanner.exec(formula);
    if (!match) fail('#PARSE!');
    tokens.push(match[1]);
    offset = scanner.lastIndex;
  }
  charge(tokens.length);

  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  function requireToken(token) { if (take() !== token) fail('#PARSE!'); }
  function numeric(value) {
    if (value instanceof FormulaError) throw value;
    if (typeof value === 'number') return value;
    if (value == null) return 0;
    fail('#VALUE!');
  }
  function finite(value) {
    if (!Number.isFinite(value)) fail('#NUM!');
    return value;
  }

  function aggregate(name, depth) {
    if (!Object.hasOwn(FUNCTIONS, name)) fail('#NAME?');
    const values = [];
    function append(value) {
      if (value instanceof FormulaError) throw value;
      if (typeof value === 'number') values.push(value);
    }
    if (peek() !== ')') {
      do {
        if (tokens[index + 1] === ':') {
          const [row1, col1] = address(take());
          take();
          const [row2, col2] = address(take());
          const rowStart = Math.min(row1, row2);
          const rowEnd = Math.max(row1, row2);
          const colStart = Math.min(col1, col2);
          const colEnd = Math.max(col1, col2);
          const size = (rowEnd - rowStart + 1) * (colEnd - colStart + 1);
          if (size > 2500) fail('#LIMIT!');
          charge(size);
          for (let row = rowStart; row <= rowEnd; row += 1) {
            for (let col = colStart; col <= colEnd; col += 1) append(cell(row, col));
          }
        } else {
          append(expression(depth + 1));
        }
        if (peek() !== ',') break;
        take();
      } while (true);
    }
    requireToken(')');
    return finite(FUNCTIONS[name](values));
  }

  function atom(depth) {
    if (depth > 24) fail('#LIMIT!');
    const token = take();
    if (token === '+' || token === '-') return numeric(atom(depth + 1)) * (token === '-' ? -1 : 1);
    if (token === '(') {
      const result = expression(depth + 1);
      requireToken(')');
      return result;
    }
    if (/^[\d.]/.test(token ?? '')) return finite(Number(token));
    if (/^[A-Z]/.test(token ?? '')) {
      if (peek() === '(') {
        take();
        return aggregate(token, depth);
      }
      if (!/\d$/.test(token)) fail('#NAME?');
      return cell(...address(token));
    }
    fail('#PARSE!');
  }

  function term(depth) {
    let value = atom(depth);
    while (peek() === '*' || peek() === '/') {
      const op = take();
      const right = numeric(atom(depth));
      if (op === '/' && right === 0) fail('#DIV/0!');
      value = finite(op === '*' ? numeric(value) * right : numeric(value) / right);
    }
    return value;
  }

  function expression(depth) {
    let value = term(depth);
    while (peek() === '+' || peek() === '-') {
      const op = take();
      const right = numeric(term(depth));
      value = finite(op === '+' ? numeric(value) + right : numeric(value) - right);
    }
    return value;
  }

  const value = expression(0);
  if (index !== tokens.length) fail('#PARSE!');
  if (value instanceof FormulaError) throw value;
  return value ?? 0;
}

export function calculateGrid(columns, rows, enabled = true) {
  if (!enabled) return rows;
  const values = new Map();
  const active = new Set();
  let workRemaining = 250000;
  function charge(cost) {
    workRemaining -= cost;
    if (workRemaining < 0) fail('#LIMIT!');
  }
  function cell(row, col) {
    if (row < 0 || row >= rows.length || col < 0 || col >= columns.length) return new FormulaError('#REF!');
    const raw = Object.hasOwn(rows[row], columns[col]) ? rows[row][columns[col]] : null;
    if (!isGridFormula(raw)) return gridNumber(raw) ?? (raw === '' || raw == null ? null : String(raw));
    const key = row * columns.length + col;
    if (values.has(key)) return values.get(key);
    if (active.has(key)) return new FormulaError('#CYCLE!');
    if (active.size >= 48) return new FormulaError('#LIMIT!');
    active.add(key);
    let result;
    try {
      result = evaluateFormula(raw, cell, charge);
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      result = error;
    } finally {
      active.delete(key);
    }
    values.set(key, result);
    return result;
  }
  return rows.map((row, rowIndex) => Object.fromEntries(columns.map((column, colIndex) => {
    const raw = Object.hasOwn(row, column) ? row[column] : '';
    const value = isGridFormula(raw) ? cell(rowIndex, colIndex) : raw;
    return [column, value instanceof FormulaError ? value.message : value ?? ''];
  })));
}

const unsafeCsvStart = /^(?:[\t\r\n]|\s*[=+\-@＝＋－＠])/u;
export function exportGridCsv(columns, rows) {
  function quote(value) {
    const text = String(value ?? '');
    const safe = unsafeCsvStart.test(text) && (/^[\t\r\n]/.test(text) || gridNumber(text) === null) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }
  return [columns.map(quote).join(','), ...rows.map((row) => columns.map((column) =>
    quote(Object.hasOwn(row, column) ? row[column] : '')).join(','))].join('\r\n');
}
