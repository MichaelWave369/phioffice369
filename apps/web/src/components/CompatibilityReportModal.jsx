import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning, X } from 'lucide-react';
import { createMockCompatibilityReport, summarizeCompatibilityReport } from '../lib/compatibilityReport.js';
import './CompatibilityReportModal.css';

function ReportList({ title, items, tone }) {
  return (
    <section className={`compat-report-list ${tone}`}>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

export default function CompatibilityReportModal({ isOpen, onClose }) {
  const report = useMemo(() => createMockCompatibilityReport(), []);
  const summary = useMemo(() => summarizeCompatibilityReport(report), [report]);

  if (!isOpen) return null;

  return (
    <div className="compat-report-backdrop" role="presentation">
      <section className="compat-report-modal" role="dialog" aria-modal="true" aria-labelledby="compat-report-title">
        <button className="compat-report-close" type="button" onClick={onClose} aria-label="Close compatibility report"><X aria-hidden="true" /></button>
        <p className="eyebrow">Compatibility honesty</p>
        <h2 id="compat-report-title">Import/export report preview</h2>
        <p className="compat-report-lead">PhiOffice369 should tell users exactly what survives a format conversion, what gets approximated, and what may be lost.</p>

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
            <h3>Honest prototype note</h3>
            {report.notes.map((note) => <p key={note}>{note}</p>)}
          </div>
        </div>

        <button className="compat-report-ok" type="button" onClick={onClose}><CheckCircle2 aria-hidden="true" /> I understand</button>
      </section>
    </div>
  );
}
