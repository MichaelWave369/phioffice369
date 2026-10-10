import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Download, Grid3X3, Plus, RotateCcw, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { parseCsvImport } from '../lib/localImporters.js';
import { saveLocalExportReceipt } from '../lib/localReceipts.js';
import {
  canUseBrowserLocalStorage,
  readStorageJson,
  removeStorageValue,
  writeStorageJson,
} from '../lib/workspaceStorageAccess.js';
import './PhiGridLite.css';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'phioffice369-grid';
}

function createPhiGridStorageKey(templateId) {
  return `phioffice369:phigrid:${templateId}`;
}

function getColumns(template) {
  if (template.id === 'claim_boundary_matrix') return ['Claim', 'Type', 'Evidence', 'Boundary', 'Publish Status'];
  if (template.id === 'simple_family_budget') return ['Category', 'Planned', 'Actual', 'Difference', 'Notes'];
  return template.sections.slice(0, 5).length ? template.sections.slice(0, 5) : ['Item', 'Value', 'Notes'];
}

function blankRow(columns) {
  return columns.reduce((row, column) => ({ ...row, [column]: '' }), {});
}

function starterRows(template, columns) {
  if (template.id === 'simple_family_budget') {
    return ['Income', 'Bills', 'Food', 'Savings', 'Kindness Money'].map((category) => ({ Category: category, Planned: '0', Actual: '0', Difference: '0', Notes: '' }));
  }
  if (template.id === 'claim_boundary_matrix') {
    return [
      { Claim: 'Example claim', Type: 'Needs review', Evidence: '', Boundary: '', 'Publish Status': 'Draft' },
      { Claim: 'Symbolic idea', Type: 'Symbolic', Evidence: 'N/A', Boundary: 'Do not present as verified fact', 'Publish Status': 'Private' },
      { Claim: 'Verified source note', Type: 'Sourced', Evidence: 'Add citation', Boundary: 'Keep context attached', 'Publish Status': 'Review' },
    ];
  }
  return [blankRow(columns), blankRow(columns), blankRow(columns)];
}

function loadGrid(template) {
  if (!canUseBrowserLocalStorage()) return null;
  return readStorageJson(createPhiGridStorageKey(template.id));
}

function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCsv(columns, rows) {
  const quote = (value) => `"${String(value ?? '').split('"').join('""')}"`;
  return [columns.map(quote).join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\n');
}

function downloadTextFile(filename, body, type) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PhiGridLite({ template, onBack }) {
  const importInputRef = useRef(null);
  const defaultColumns = useMemo(() => getColumns(template), [template]);
  const savedGrid = useMemo(() => loadGrid(template), [template]);
  const [title, setTitle] = useState(savedGrid?.title ?? template.title);
  const [columns, setColumns] = useState(savedGrid?.columns ?? defaultColumns);
  const [rows, setRows] = useState(savedGrid?.rows ?? starterRows(template, defaultColumns));
  const [activeLabelId, setActiveLabelId] = useState(savedGrid?.activeLabelId ?? template.trustDefaults[0] ?? 'private');
  const [saveStatus, setSaveStatus] = useState(savedGrid ? 'Restored local grid' : 'New local grid');
  const [copyStatus, setCopyStatus] = useState('');
  const [pendingCsvImport, setPendingCsvImport] = useState(null);

  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];
  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `grid_${template.id}`,
    title,
    app: 'PhiGrid',
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: ['template_to_phigrid_lite_table'],
  }), [activeLabelId, template, title]);

  useEffect(() => {
    if (!canUseBrowserLocalStorage()) return undefined;
    setSaveStatus('Unsaved changes...');
    const timeout = window.setTimeout(() => {
      writeStorageJson(createPhiGridStorageKey(template.id), {
        templateId: template.id,
        title,
        columns,
        rows,
        activeLabelId,
        updatedAt: new Date().toISOString(),
      });
      setSaveStatus('Autosaved locally');
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [activeLabelId, columns, rows, template.id, title]);

  const numericColumns = columns.filter((column) => rows.some((row) => String(row[column] ?? '').match(/^-?[$0-9,.]+$/)));
  const totals = numericColumns.reduce((acc, column) => ({ ...acc, [column]: rows.reduce((sum, row) => sum + numberValue(row[column]), 0) }), {});

  function updateCell(rowIndex, column, value) {
    setRows((currentRows) => currentRows.map((row, index) => {
      if (index !== rowIndex) return row;
      const nextRow = { ...row, [column]: value };
      if (columns.includes('Planned') && columns.includes('Actual') && columns.includes('Difference')) {
        nextRow.Difference = String(numberValue(nextRow.Planned) - numberValue(nextRow.Actual));
      }
      return nextRow;
    }));
  }

  function addRow() {
    setRows((currentRows) => [...currentRows, blankRow(columns)]);
  }

  function resetGrid() {
    setPendingCsvImport(null);
    setTitle(template.title);
    setColumns(defaultColumns);
    setRows(starterRows(template, defaultColumns));
    setActiveLabelId(template.trustDefaults[0] ?? 'private');
    if (canUseBrowserLocalStorage()) removeStorageValue(createPhiGridStorageKey(template.id));
    setSaveStatus('Reset to template');
  }

  function exportCsv() {
    const filename = `${slugify(title)}.csv`;
    downloadTextFile(filename, toCsv(columns, rows), 'text/csv;charset=utf-8');
    saveLocalExportReceipt({ artifactId: `grid_${template.id}`, format: 'csv', filename, sourceApp: 'PhiGrid' });
    setSaveStatus('CSV exported + receipt saved');
  }

  function exportJson() {
    const filename = `${slugify(title)}-phigrid-lite.json`;
    const payload = { schema: 'phioffice369.phigrid_lite.v0.1', title, columns, rows, totals, receipt };
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    saveLocalExportReceipt({ artifactId: `grid_${template.id}`, format: 'json', filename, sourceApp: 'PhiGrid' });
    setSaveStatus('JSON exported + receipt saved');
  }

  function triggerCsvImport() {
    importInputRef.current?.click();
  }

  async function handleImportCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingCsvImport(null);
    try {
      const text = await file.text();
      const imported = parseCsvImport(text, file.name.replace(/\.csv$/i, ''));
      setPendingCsvImport(imported);
      setSaveStatus('CSV preview ready. Current grid unchanged.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unable to read this file.';
      setSaveStatus('CSV import rejected: ' + reason + ' Current grid unchanged.');
    } finally {
      event.target.value = '';
    }
  }

  function confirmCsvImport() {
    if (!pendingCsvImport) return;
    setTitle(pendingCsvImport.title);
    setColumns(pendingCsvImport.columns);
    setRows(pendingCsvImport.rows);
    setActiveLabelId('private');
    setPendingCsvImport(null);
    setSaveStatus('CSV accepted. Autosaving locally.');
  }

  function cancelCsvImport() {
    setPendingCsvImport(null);
    setSaveStatus('CSV import cancelled. Current grid unchanged.');
  }

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopyStatus('Receipt copied');
    } catch {
      setCopyStatus('Copy unavailable in this browser');
    }
  }

  return (
    <section className="phigrid-workspace fade-in">
      <div className="grid-topbar panel">
        <button className="grid-ghost-button" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to templates</button>
        <div>
          <p className="eyebrow">PhiGrid-lite</p>
          <h2>{template.title}</h2>
          <p className="grid-save-status" role="status" aria-live="polite">{saveStatus}</p>
        </div>
        <div className="grid-actions">
          <button type="button" onClick={resetGrid}><RotateCcw aria-hidden="true" /> Reset</button>
          <button type="button" onClick={triggerCsvImport}><Upload aria-hidden="true" /> Import CSV</button>
          <button type="button" onClick={exportCsv}><Download aria-hidden="true" /> Export CSV</button>
          <button type="button" onClick={exportJson}><Download aria-hidden="true" /> Export JSON</button>
          <input ref={importInputRef} className="grid-file-input" type="file" accept=".csv,text/csv" onChange={handleImportCsv} />
        </div>
      </div>

      {pendingCsvImport && (
        <section className="panel grid-import-preview" aria-label="CSV import review">
          <h3>Review CSV before replacing your current grid</h3>
          <p>{pendingCsvImport.rows.length} rows and {pendingCsvImport.columns.length} columns. No existing grid content has been changed.</p>
          {pendingCsvImport.csvWarnings.length > 0 && (
            <div className="grid-import-warnings" role="note">
              <strong>Compatibility notes</strong>
              <ul>{pendingCsvImport.csvWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}
          <div className="grid-import-table-wrap">
            <table>
              <thead><tr>{pendingCsvImport.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {pendingCsvImport.rows.slice(0, 3).map((row, index) => (
                  <tr key={index}>{pendingCsvImport.columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {pendingCsvImport.rows.length > 3 && <p>Showing first 3 rows only.</p>}
          </div>
          <div className="grid-import-review-actions">
            <button type="button" onClick={cancelCsvImport}>Cancel import</button>
            <button type="button" onClick={confirmCsvImport}>Replace current grid with CSV</button>
          </div>
        </section>
      )}

      <div className="grid-workspace-layout">
        <aside className="panel grid-side-panel">
          <Grid3X3 aria-hidden="true" />
          <h3>Grid stats</h3>
          <div className="grid-stat-grid">
            <div><strong>{rows.length}</strong><span>rows</span></div>
            <div><strong>{columns.length}</strong><span>columns</span></div>
            <div><strong>{numericColumns.length}</strong><span>numeric cols</span></div>
            <div><strong>{receipt.labels.length}</strong><span>labels</span></div>
          </div>
          <button className="grid-add-row" type="button" onClick={addRow}><Plus aria-hidden="true" /> Add row</button>
        </aside>

        <section className="panel grid-editor-panel">
          <label className="grid-title-field">
            <span>Grid title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <div className="table-wrap">
            <table>
              <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {columns.map((column) => {
                      const value = String(row[column] ?? '');
                      const props = {
                        value,
                        onChange: (event) => updateCell(rowIndex, column, event.target.value),
                        'aria-label': column + ' row ' + (rowIndex + 1),
                      };
                      return (
                        <td key={column}>
                          {value.includes('\n')
                            ? <textarea {...props} rows={Math.min(6, value.split('\n').length)} />
                            : <input {...props} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {numericColumns.length > 0 && (
            <div className="totals-panel">
              <h3>Local totals</h3>
              <div>{numericColumns.map((column) => <span key={column}>{column}: {totals[column]}</span>)}</div>
            </div>
          )}
        </section>

        <aside className="panel grid-trust-panel">
          <ShieldCheck aria-hidden="true" />
          <h3>Trust panel</h3>
          <p>Label this grid before exporting or publishing.</p>
          <div className="grid-labels">
            {trustLabels.map((label) => <button key={label.id} type="button" className={activeLabelId === label.id ? 'selected' : ''} onClick={() => setActiveLabelId(label.id)}>{label.label}</button>)}
          </div>
          <div className={`grid-active-label ${activeLabel.tone}`}><Sparkles aria-hidden="true" /><div><strong>{activeLabel.label}</strong><p>{activeLabel.description}</p></div></div>
          <div className="grid-receipt-mini">
            <h3>Receipt preview</h3>
            <code>{receipt.schema}</code>
            <p>{receipt.app} · {receipt.labels.length} labels · local grid</p>
            <button type="button" onClick={copyReceipt}><ClipboardCopy aria-hidden="true" /> Copy receipt JSON</button>
            {copyStatus && <p className="grid-copy-status">{copyStatus}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
