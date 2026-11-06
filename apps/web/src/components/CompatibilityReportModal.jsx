import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning, X } from 'lucide-react';
import { createCompatibilityReport, summarizeCompatibilityReport } from '../lib/compatibilityReport.js';
import WorkspaceDialog from './WorkspaceDialog.jsx';
import './CompatibilityReportModal.css';

const reports = [
  {
    sourceFormat: 'DOCX', targetFormat: 'PhiWrite',
    preserved: ['Text, headings, supported lists and simple tables', 'Basic inline styles and safe HTTP(S) links'],
    approximated: ['Complex tables become text with import warnings', 'Document layout is reflowed'],
    lost: ['Embedded images, merged cells, exact pagination and macros'],
    notes: ['Review DOCX import warnings and keep the original Office file.'],
  },
  {
    sourceFormat: 'CSV', targetFormat: 'PhiGrid',
    preserved: ['Quoted text, commas, multiline cells and values'],
    approximated: ['Blank or duplicate headers get unique labels', 'Formula-like text may be escaped on export'],
    lost: ['CSV does not carry spreadsheet styles, workbooks or editable formulas'],
    notes: ['Use a workspace backup to keep formulas and column widths.'],
  },
  {
    sourceFormat: 'PhiDeck JSON / HTML', targetFormat: 'PhiDeck / browser',
    preserved: ['Native JSON retains text, ordering, layout, accents and local images'],
    approximated: ['HTML provides a read-only slide view and browser print styling'],
    lost: ['PPTX and XLSX interchange is unavailable'],
    notes: ['Keep native JSON or a workspace backup for continued editing.'],
  },
].map(createCompatibilityReport);

function ReportList({ title, items, tone }) {
  return (
    <section className={`compat-report-list ${tone}`}>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

export default function CompatibilityReportModal({ isOpen, onClose }) {
  const [reportIndex, setReportIndex] = useState(0);
  const report = reports[reportIndex];
  const summary = summarizeCompatibilityReport(report);

  if (!isOpen) return null;

  return (
    <WorkspaceDialog className="compat-report-modal" labelledBy="compat-report-title" onClose={onClose}>
        <button className="compat-report-close" type="button" onClick={onClose} aria-label="Close compatibility report"><X aria-hidden="true" /></button>
        <p className="eyebrow">Compatibility honesty</p>
        <h2 id="compat-report-title">Import and export compatibility</h2>
        <label className="compat-report-lead">Format
          <select value={reportIndex} onChange={(event) => setReportIndex(Number(event.target.value))}>
            {reports.map((item, index) => <option key={item.sourceFormat} value={index}>{item.sourceFormat}</option>)}
          </select>
        </label>

        <div className="compat-report-summary">
          <span><FileWarning aria-hidden="true" /> Source: {summary.sourceFormat}</span>
          <span>Target: {summary.targetFormat}</span>
          <span className={`risk ${summary.roundTripRisk}`}>Round-trip risk: {summary.roundTripRisk}</span>
        </div>

        <div className="compat-report-columns">
          <ReportList title="Preserved" items={report.preserved} tone="preserved" />
          <ReportList title="Approximated" items={report.approximated} tone="approximated" />
          <ReportList title="Lost or blocked" items={report.lost} tone="lost" />
        </div>

        <div className="compat-report-notes">
          <AlertTriangle aria-hidden="true" />
          <div>
            <h3>Working with this format</h3>
            {report.notes.map((note) => <p key={note}>{note}</p>)}
          </div>
        </div>

        <button className="compat-report-ok" type="button" onClick={onClose}><CheckCircle2 aria-hidden="true" /> I understand</button>
    </WorkspaceDialog>
  );
}
