import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Download, Grid3X3, Plus, RotateCcw, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { calculateGrid, columnLetter, exportGridCsv, gridNumber, GRID_LIMITS, isGridFormula } from '../lib/gridFormulas.js';
import { parseCsvImport } from '../lib/localImporters.js';
import { recordLocalExport } from '../lib/localReceipts.js';
import { readWorkspaceRecord, workspaceTitle } from '../lib/workspaceRecords.js';
import { useWorkspaceDraft } from '../lib/useWorkspaceDraft.js';
import WorkspaceSaveActions from './WorkspaceSaveActions.jsx';
import './PhiGridLite.css';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'phioffice369-grid';
}

function createPhiGridStorageKey(templateId) {
  return `phioffice369:phigrid:${templateId}`;
}

function getColumns(template) {
  if ((template.sourceTemplateId ?? template.id) === 'claim_boundary_matrix') return ['Claim', 'Type', 'Evidence', 'Boundary', 'Publish Status'];
  if ((template.sourceTemplateId ?? template.id) === 'simple_family_budget') return ['Category', 'Planned', 'Actual', 'Difference', 'Notes'];
  return template.sections.slice(0, 5).length ? template.sections.slice(0, 5) : ['Item', 'Value', 'Notes'];
}

function blankRow(columns) {
  return columns.reduce((row, column) => ({ ...row, [column]: '' }), {});
}

function starterRows(template, columns) {
  if ((template.sourceTemplateId ?? template.id) === 'simple_family_budget') {
    return ['Income', 'Bills', 'Food', 'Savings', 'Kindness Money'].map((category) => ({ Category: category, Planned: '0', Actual: '0', Difference: '0', Notes: '' }));
  }
  if ((template.sourceTemplateId ?? template.id) === 'claim_boundary_matrix') {
    return [
      { Claim: 'Example claim', Type: 'Needs review', Evidence: '', Boundary: '', 'Publish Status': 'Draft' },
      { Claim: 'Symbolic idea', Type: 'Symbolic', Evidence: 'N/A', Boundary: 'Do not present as verified fact', 'Publish Status': 'Private' },
      { Claim: 'Verified source note', Type: 'Sourced', Evidence: 'Add citation', Boundary: 'Keep context attached', 'Publish Status': 'Review' },
    ];
  }
  return [blankRow(columns), blankRow(columns), blankRow(columns)];
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

export default function PhiGridLite({ template, onBack, loadedFile }) {
  const importInputRef = useRef(null);
  const latestImport = useRef(0);
  const defaultColumns = useMemo(() => getColumns(template), [template]);
  const storageKey = createPhiGridStorageKey(template.id);
  const [loaded] = useState(() => loadedFile ?? readWorkspaceRecord(storageKey));
  const savedGrid = loaded.record;
  const [title, setTitle] = useState(savedGrid?.title ?? template.title);
  const [columns, setColumns] = useState(savedGrid?.columns ?? defaultColumns);
  const [rows, setRows] = useState(savedGrid?.rows ?? starterRows(template, defaultColumns));
  const [activeLabelId, setActiveLabelId] = useState(savedGrid?.activeLabelId ?? template.trustDefaults[0] ?? 'private');
  const [copyStatus, setCopyStatus] = useState('');
  const [pendingCsvImport, setPendingCsvImport] = useState(null);
  const [formulasEnabled, setFormulasEnabled] = useState(savedGrid?.formulasEnabled !== false);
  const [budgetMode, setBudgetMode] = useState(savedGrid?.budgetMode ?? (
    (template.sourceTemplateId ?? template.id) === 'simple_family_budget' &&
    columns.length === defaultColumns.length && columns.every((column, index) => column === defaultColumns[index])
  ));
  const [columnWidths, setColumnWidths] = useState(savedGrid?.columnWidths ?? {});
  const [widthColumn, setWidthColumn] = useState(0);
  const [focusedCell, setFocusedCell] = useState('');
  const [filter, setFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortAscending, setSortAscending] = useState(true);

  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];
  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `grid_${template.id}`,
    title: workspaceTitle(title, 'PhiGrid'),
    app: 'PhiGrid',
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: ['template_to_phigrid_lite_table'],
  }), [activeLabelId, template, title]);

  const draftSnapshot = useMemo(() => ({
    ...savedGrid, templateId: template.id, sourceTemplateId: template.sourceTemplateId ?? template.id,
    title: workspaceTitle(title, 'PhiGrid'), columns, rows, activeLabelId, formulasEnabled, budgetMode, columnWidths,
  }), [savedGrid, template, title, columns, rows, activeLabelId, formulasEnabled, budgetMode, columnWidths]);
  const { saveStatus, setSaveStatus, saveFailed, save } = useWorkspaceDraft(storageKey, draftSnapshot, loaded);

  async function backToPhiOffice() {
    if (await save()) onBack();
  }

  const calculatedRows = useMemo(() => calculateGrid(columns, rows, formulasEnabled), [columns, rows, formulasEnabled]);
  const totals = useMemo(() => Object.fromEntries(columns.flatMap((column) => {
    const numbers = calculatedRows.map((row) => gridNumber(Object.hasOwn(row, column) ? row[column] : ''))
      .filter((number) => number !== null);
    return numbers.length ? [[column, numbers.reduce((sum, number) => sum + number, 0)]] : [];
  })), [columns, calculatedRows]);
  const numericColumns = Object.keys(totals);

  const visibleIndices = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const indices = calculatedRows.flatMap((row, index) =>
      !needle || columns.some((column) => String(Object.hasOwn(row, column) ? row[column] ?? '' : '').toLowerCase().includes(needle)) ? [index] : []);
    if (sortColumn && columns.includes(sortColumn)) {
      const direction = sortAscending ? 1 : -1;
      indices.sort((left, right) => {
        const a = Object.hasOwn(calculatedRows[left], sortColumn) ? calculatedRows[left][sortColumn] : '';
        const b = Object.hasOwn(calculatedRows[right], sortColumn) ? calculatedRows[right][sortColumn] : '';
        const aNumber = gridNumber(a);
        const bNumber = gridNumber(b);
        const comparison = aNumber !== null && bNumber !== null ? aNumber - bNumber
          : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
        return direction * comparison || left - right;
      });
    }
    return indices;
  }, [calculatedRows, columns, filter, sortColumn, sortAscending]);

  function budgetDifference(row, rowIndex) {
    if (formulasEnabled && (isGridFormula(row.Planned) || isGridFormula(row.Actual))) {
      return `=B${rowIndex + 1}-C${rowIndex + 1}`;
    }
    return String((gridNumber(row.Planned) ?? 0) - (gridNumber(row.Actual) ?? 0));
  }

  function updateCell(rowIndex, column, value) {
    setRows((currentRows) => currentRows.map((row, index) => {
      if (index !== rowIndex) return row;
      const nextRow = { ...row, [column]: value };
      if (budgetMode && (column === 'Planned' || column === 'Actual') &&
        (!row.Difference || row.Difference === budgetDifference(row, rowIndex))) {
        nextRow.Difference = budgetDifference(nextRow, rowIndex);
      }
      return nextRow;
    }));
  }

  const canAddRow = rows.length < GRID_LIMITS.rows && (rows.length + 1) * columns.length <= GRID_LIMITS.cells;
  const canAddColumn = columns.length < GRID_LIMITS.columns && rows.length * (columns.length + 1) <= GRID_LIMITS.cells;
  function addRow() {
    if (canAddRow) setRows((currentRows) => [...currentRows, blankRow(columns)]);
  }

  function addColumn() {
    if (!canAddColumn) return;
    let index = columns.length + 1;
    while (columns.includes('Column ' + index)) index += 1;
    setColumns((current) => [...current, 'Column ' + index]);
  }

  function resetGridView() {
    setFilter('');
    setSortColumn('');
    setSortAscending(true);
    setWidthColumn(0);
    setColumnWidths({});
  }

  function resetGrid() {
    if (!window.confirm('Reset this file to its starter template? This replaces the current content.')) return;
    latestImport.current += 1;
    setPendingCsvImport(null);
    setFormulasEnabled(true);
    setBudgetMode((template.sourceTemplateId ?? template.id) === 'simple_family_budget');
    resetGridView();
    setTitle(template.title);
    setColumns(defaultColumns);
    setRows(starterRows(template, defaultColumns));
    setActiveLabelId(template.trustDefaults[0] ?? 'private');
    setSaveStatus('Reset to template');
  }

  function exportCsv() {
    const filename = `${slugify(title)}.csv`;
    downloadTextFile(filename, exportGridCsv(columns, calculatedRows), 'text/csv;charset=utf-8');
    setSaveStatus(recordLocalExport('CSV exported', { artifactId: `grid_${template.id}`, format: 'csv', filename, sourceApp: 'PhiGrid', compatibility: 'values-only', warnings: ['Formulas export as displayed values. Formula-like text may receive a leading apostrophe.'] }));
  }

  function exportJson() {
    const filename = `${slugify(title)}-phigrid-lite.json`;
    const payload = { schema: 'phioffice369.phigrid_lite.v0.1', title, columns, rows, totals, formulasEnabled, columnWidths, receipt };
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setSaveStatus(recordLocalExport('JSON exported', { artifactId: `grid_${template.id}`, format: 'json', filename, sourceApp: 'PhiGrid' }));
  }

  function triggerCsvImport() {
    importInputRef.current?.click();
  }

  async function handleImportCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    const revision = ++latestImport.current;
    setPendingCsvImport(null);
    try {
      if (file.size > GRID_LIMITS.fileBytes) throw new RangeError('CSV is larger than 4 MiB.');
      const text = await file.text();
      if (revision !== latestImport.current) return;
      const imported = parseCsvImport(text, file.name.replace(/\.csv$/i, ''));
      setPendingCsvImport(imported);
      setSaveStatus('CSV preview ready. Current grid unchanged.');
    } catch (error) {
      if (revision !== latestImport.current) return;
      const reason = error instanceof Error ? error.message : 'Unable to read this file.';
      setSaveStatus('CSV import rejected: ' + reason + ' Current grid unchanged.');
    }
  }

  function confirmCsvImport() {
    if (!pendingCsvImport) return;
    setTitle(pendingCsvImport.title);
    setColumns(pendingCsvImport.columns);
    setRows(pendingCsvImport.rows);
    setFormulasEnabled(false);
    setBudgetMode(false);
    resetGridView();
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
        <button className="grid-ghost-button" type="button" onClick={backToPhiOffice}><ArrowLeft aria-hidden="true" /> Back to PhiOffice</button>
        <div>
          <p className="eyebrow">PhiGrid-lite</p>
          <h2>{template.title}</h2>
          <p className="grid-save-status" role="status" aria-live="polite">{saveStatus}</p>
        </div>
        <div className="grid-actions">
          <WorkspaceSaveActions save={save} saveFailed={saveFailed} onBack={onBack} />
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
          <p>{pendingCsvImport.rows.length} rows and {pendingCsvImport.columns.length} columns. Imported formulas will be kept as text unless you enable formulas after import.</p>
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
          <button className="grid-add-row" type="button" onClick={addRow} disabled={!canAddRow}><Plus aria-hidden="true" /> Add row</button>
          <button className="grid-add-row" type="button" onClick={addColumn} disabled={!canAddColumn}><Plus aria-hidden="true" /> Add column</button>
        </aside>

        <section className="panel grid-editor-panel">
          <label className="grid-title-field">
            <span>Grid title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <div className="grid-sheet-tools">
            <label>Filter rows<input value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
            <label>Sort view by<select value={sortColumn} onChange={(event) => setSortColumn(event.target.value)}>
              <option value="">Original row order</option>
              {columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select></label>
            <button type="button" disabled={!sortColumn} onClick={() => setSortAscending(!sortAscending)}>
              {sortAscending ? 'Ascending' : 'Descending'}
            </button>
            <label>Resize column<select value={widthColumn} onChange={(event) => setWidthColumn(Number(event.target.value))}>
              {columns.map((column, index) => <option key={column} value={index}>{column}</option>)}
            </select></label>
            <label>Column width<input type="range" min="100" max="400" step="10" value={columnWidths[widthColumn] ?? 140}
              onChange={(event) => setColumnWidths({ ...columnWidths, [widthColumn]: Number(event.target.value) })} /></label>
          </div>
          <label className="grid-formula-toggle"><input type="checkbox" checked={formulasEnabled}
            onChange={(event) => setFormulasEnabled(event.target.checked)} /> Calculate formulas</label>
          <p className="grid-sheet-note">Use =SUM(B1:B3), =AVERAGE(B1,B2), MIN, MAX, COUNT or arithmetic. Sorting and filtering keep the original row addresses. CSV exports the whole sheet as values and protects formula-like text with a leading apostrophe. JSON keeps the formula text.</p>

          <div className="table-wrap" tabIndex={0} aria-label="Spreadsheet data">
            <table>
              <thead><tr><th scope="col">Row</th>{columns.map((column, index) => (
                <th key={column} scope="col" style={{ minWidth: Math.max(100, Math.min(400, Number(columnWidths[index]) || 140)) }}>
                  <span className="grid-column-letter">{columnLetter(index)}</span>{column}
                </th>
              ))}</tr></thead>
              <tbody>
                {visibleIndices.map((rowIndex) => (
                  <tr key={rowIndex}>
                    <th scope="row">{rowIndex + 1}</th>
                    {columns.map((column, colIndex) => {
                      const row = rows[rowIndex];
                      const raw = String(Object.hasOwn(row, column) ? row[column] ?? '' : '');
                      const address = columnLetter(colIndex) + (rowIndex + 1);
                      const formula = formulasEnabled && isGridFormula(raw);
                      const value = formula && focusedCell !== address ? String(calculatedRows[rowIndex][column]) : raw;
                      const props = {
                        value,
                        onChange: (event) => updateCell(rowIndex, column, event.target.value),
                        onFocus: () => setFocusedCell(address),
                        onBlur: () => setFocusedCell(''),
                        'aria-label': column + ' row ' + (rowIndex + 1),
                      };
                      return (
                        <td key={column} className={formula ? 'formula-cell' : undefined}>
                          {raw.includes('\n')
                            ? <textarea {...props} rows={Math.min(6, raw.split('\n').length)} />
                            : <input {...props} title={formula ? raw : undefined} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleIndices.length === 0 && <p className="grid-sheet-note">{rows.length ? 'No rows match the filter.' : 'Add a row to start this sheet.'}</p>}

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
