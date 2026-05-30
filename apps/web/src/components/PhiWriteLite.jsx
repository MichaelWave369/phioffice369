import { useMemo, useState } from 'react';
import { ArrowLeft, Bot, FileText, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import './PhiWriteLite.css';

function makeStarterContent(template) {
  return template.sections
    .map((section) => `## ${section}\n\nWrite your ${section.toLowerCase()} here...`)
    .join('\n\n');
}

export default function PhiWriteLite({ template, onBack }) {
  const [title, setTitle] = useState(template.title);
  const [content, setContent] = useState(() => makeStarterContent(template));
  const [activeLabelId, setActiveLabelId] = useState(template.trustDefaults[0] ?? 'human_written');

  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];

  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `draft_${template.id}`,
    title,
    app: template.app,
    labels: template.trustDefaults,
    transformations: ['template_to_phiwrite_lite_draft'],
  }), [template, title]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const sectionCount = template.sections.length;

  return (
    <section className="phiwrite-workspace fade-in">
      <div className="workspace-topbar panel">
        <button className="ghost-button" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back to templates
        </button>
        <div>
          <p className="eyebrow">PhiWrite-lite</p>
          <h2>{template.title}</h2>
        </div>
        <button className="gold-button" type="button">
          <Save aria-hidden="true" />
          Save locally soon
        </button>
      </div>

      <div className="workspace-grid">
        <aside className="panel workspace-sidebar">
          <FileText aria-hidden="true" />
          <h3>Template sections</h3>
          <div className="section-stack">
            {template.sections.map((section) => <span key={section}>{section}</span>)}
          </div>

          <div className="workspace-stat-grid">
            <div><strong>{wordCount}</strong><span>words</span></div>
            <div><strong>{sectionCount}</strong><span>sections</span></div>
          </div>

          <div className="assistant-card">
            <Bot aria-hidden="true" />
            <div>
              <h3>Professor Phi</h3>
              <p>Draft, polish, transform, and claim-check actions will dock here next.</p>
            </div>
          </div>
        </aside>

        <section className="panel editor-panel">
          <label className="title-field">
            <span>Artifact title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="editor-field">
            <span>Draft content</span>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck="true" />
          </label>
        </section>

        <aside className="panel trust-dock">
          <ShieldCheck aria-hidden="true" />
          <h3>Trust panel</h3>
          <p>Label the working draft before exporting or publishing.</p>
          <div className="workspace-labels">
            {trustLabels.map((label) => (
              <button key={label.id} type="button" className={activeLabelId === label.id ? 'selected' : ''} onClick={() => setActiveLabelId(label.id)}>
                {label.label}
              </button>
            ))}
          </div>

          <div className={`active-label-preview ${activeLabel.tone}`}>
            <Sparkles aria-hidden="true" />
            <div>
              <strong>{activeLabel.label}</strong>
              <p>{activeLabel.description}</p>
            </div>
          </div>

          <div className="receipt-mini">
            <h3>Receipt preview</h3>
            <code>{receipt.schema}</code>
            <p>{receipt.app} · {receipt.labels.length} labels · local draft</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
