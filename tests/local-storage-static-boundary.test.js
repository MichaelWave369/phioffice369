import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getLocalStorageBoundaryFiles } from '../apps/web/src/lib/localStorageBoundaryAudit.js';

const SOURCE_ROOT = path.join(process.cwd(), 'apps', 'web', 'src');
const SEARCH_EXTENSIONS = new Set(['.js', '.jsx']);
const LOCAL_STORAGE_PATTERNS = [
  /\blocalStorage\b/,
  /\bwindow\.localStorage\b/,
  /\benvironment\?\.localStorage\b/,
  /\bglobalThis\.localStorage\b/,
];

function walkSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(absolutePath);
    if (!SEARCH_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [absolutePath];
  });
}

function toRepoPath(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll(path.sep, '/');
}

function fileContainsLocalStorageReference(absolutePath) {
  const content = fs.readFileSync(absolutePath, 'utf8');
  return LOCAL_STORAGE_PATTERNS.some((pattern) => pattern.test(content));
}

test('direct localStorage references stay inside approved boundary files', () => {
  const approvedFiles = new Set(getLocalStorageBoundaryFiles().map((entry) => entry.path));
  const observedFiles = walkSourceFiles(SOURCE_ROOT)
    .filter(fileContainsLocalStorageReference)
    .map(toRepoPath)
    .sort();
  const unexpectedFiles = observedFiles.filter((file) => !approvedFiles.has(file));

  assert.deepEqual(unexpectedFiles, []);
});
