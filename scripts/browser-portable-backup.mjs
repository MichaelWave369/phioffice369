// Cross-profile test: export a REAL downloaded backup, close the source browser,
// then import that downloaded JSON in a separate fresh browser process.
// Synthetic records only; uses the disposable loopback acceptance server.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const COUNT = 510;
const digest = (raw) => createHash('sha256').update(raw).digest('hex');

function pngChunk(type, data) {
  const pair = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of pair) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const end = Buffer.alloc(4);
  end.writeUInt32BE((~crc) >>> 0);
  return Buffer.concat([len, pair, end]);
}
function syntheticPng() {
  const width = 64, height = 64, stride = width * 3;
  const scanlines = Buffer.alloc((stride + 1) * height);
  let seed = 369;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < stride; col++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      scanlines[row * (stride + 1) + 1 + col] = seed >>> 24;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}
async function openSuite(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.tabs').waitFor({ timeout: 30000 });
  await page.locator('[aria-label="Close onboarding"]').click({ timeout: 1000 }).catch(() => {});
}
async function openVault(page) {
  if (!await page.locator('.vault-hero').count())
    await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.locator('.vault-hero').waitFor({ timeout: 30000 });
}
async function selectFile(page, title) {
  await openVault(page);
  await page.locator('.artifact-row h3').filter({ hasText: new RegExp('^' + title + '$') })
    .first().click({ timeout: 30000 });
  await page.locator('.artifact-detail-drawer').waitFor();
}

export async function runPortableBackupQualification(browserType, fixtureUrl, engine) {
  const base = fixtureUrl.split('?')[0];
  const temp = await mkdtemp(join(tmpdir(), 'phi-portable-backup-'));
  const path = join(temp, 'synthetic-workspace-backup.json');
  let sourceBrowser, destinationBrowser;
  try {
    sourceBrowser = await browserType.launch({ headless: true });
    const source = await sourceBrowser.newContext({ acceptDownloads: true });
    const page = await source.newPage();
    await openSuite(page, base);
    const originals = await page.evaluate(({ count, imageUri }) => {
      const items = [];
      for (let i = 0; i < count; i++) {
        const kind = ['phiwrite', 'phigrid', 'phideck'][i % 3];
        const id = 'file_portable_' + String(i).padStart(3, '0');
        const key = 'phioffice369:' + kind + ':' + id;
        const title = 'Portable proof ' + String(i).padStart(3, '0');
        const core = { title, templateId: id, sourceTemplateId: 'portable_' + kind, activeLabelId: 'private' };
        const record = kind === 'phiwrite'
          ? { ...core, content: '# ' + title + '\n' + ('π 369 <literal> — original.\n').repeat(48) }
          : kind === 'phigrid'
            ? { ...core, columns: ['Item', 'Amount', 'Notes'], rows: Array.from({ length: 22 }, (_, row) => ({
              Item: 'Item-' + i + '-' + row, Amount: String(i + row), Notes: 'Punctuation, ç, 369 and, commas',
            })) }
            : { ...core, slides: Array.from({ length: 5 }, (_, slide) => ({
              id: 'slide_' + slide, title: title + ' / ' + slide,
              bullets: [('Transferable presentation bullet: ' + i + ':' + slide).repeat(8)],
              ...(slide === 0 && i % 30 === 2
                ? { layout: 'image-left', image: { src: imageUri, alt: 'Synthetic image pattern' } }
                : {}),
            })) };
        const raw = JSON.stringify(record);
        localStorage.setItem(key, raw);
        items.push([key, raw]);
      }
      return items;
    }, { count: COUNT, imageUri: syntheticPng() });
    assert.equal(originals.length, COUNT);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.tabs').waitFor();
    await openVault(page);
    for (const i of [0, 1, 2]) {
      const title = 'Portable proof ' + String(i).padStart(3, '0');
      await selectFile(page, title);
      await page.getByRole('button', { name: 'Create IndexedDB copy' }).click();
      await page.locator('.artifact-row h3')
        .filter({ hasText: title + ' (IndexedDB copy)' }).first().waitFor({ timeout: 30000 });
    }
    const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
    await page.getByRole('button', { name: 'Backup workspace' }).click();
    await (await downloadPromise).saveAs(path);
    assert.ok((await stat(path)).size > 200000, 'Downloaded backup unexpectedly small');
    const bytes = await readFile(path);
    const backup = JSON.parse(bytes.toString('utf8'));
    assert.equal(backup.schema, 'phioffice369.workspace_backup.v0.1');
    const saved = new Map(backup.storageSnapshot);
    assert.equal(saved.size, backup.storageSnapshot.length, 'Backup duplicate keys');
    for (const [key, raw] of originals)
      assert.equal(digest(saved.get(key)), digest(raw), 'Backup content lost: ' + key);
    const tx = backup.storageSnapshot.filter(([key]) =>
      /^phioffice369:(phiwrite|phigrid|phideck):file_tx_/.test(key));
    assert.equal(tx.length, 3, 'Expected 3 migrated IndexedDB copies');
    assert.ok(originals.some(([key, raw]) =>
      key.startsWith('phioffice369:phideck:') && raw.includes('data:image/png;base64,')),
      'No image-bearing deck in fixtures');
    const checksum = digest(bytes);
    await sourceBrowser.close();
    sourceBrowser = null;

    destinationBrowser = await browserType.launch({ headless: true });
    const destination = await destinationBrowser.newContext({ acceptDownloads: true });
    const restoredPage = await destination.newPage();
    await openSuite(restoredPage, base);
    assert.equal(await restoredPage.evaluate(key => localStorage.getItem(key), originals[0][0]),
      null, 'Second browser process is not a clean profile');
    await openVault(restoredPage);
    await restoredPage.locator('.vault-file-input').setInputFiles(path);
    const restoreButton = restoredPage.getByRole('button', { name: 'Restore missing items' });
    await restoreButton.waitFor({ timeout: 60000 });
    await restoreButton.click();
    await restoredPage.waitForFunction(key => localStorage.getItem(key) !== null,
      originals.at(-1)[0], { timeout: 60000 });
    const keys = [...originals.map(([key]) => key), ...tx.map(([key]) => key)];
    const restored = new Map(await restoredPage.evaluate(
      keys => keys.map(key => [key, localStorage.getItem(key)]), keys));
    assert.equal(restored.size, COUNT + 3);
    for (const key of keys)
      assert.equal(digest(restored.get(key)), digest(saved.get(key)), 'Restored file differs: ' + key);
    await restoredPage.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await restoredPage.locator('.tabs').waitFor();
    await selectFile(restoredPage, 'Portable proof 000 (IndexedDB copy)');
    await restoredPage.getByRole('button', { name: 'Open file' }).click();
    const textarea = restoredPage.locator('.editor-field textarea');
    await textarea.waitFor({ timeout: 30000 });
    assert.equal(await textarea.inputValue(),
      JSON.parse(tx.find(([key]) => key.startsWith('phioffice369:phiwrite:'))[1]).content,
      'Reopened downloaded document does not match');
    console.log('PASS ' + engine + ' real backup transfer: ' + COUNT
      + ' mixed files, PNG slide images and 3 IndexedDB copies survived download,'
      + ' transfer to a new browser process, restore and reopen. SHA-256 '
      + checksum.slice(0, 16));
  } finally {
    await sourceBrowser?.close().catch(() => {});
    await destinationBrowser?.close().catch(() => {});
    await rm(temp, { recursive: true, force: true });
  }
}
