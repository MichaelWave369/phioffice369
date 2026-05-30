import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  ClipboardCopy,
  Download,
  FileText,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import './PhiWriteLite.css';

function makeStarterContent(template) {
  return template.sections
    .map((section) => `## ${section}\n\nWrite your ${section.toLowerCase()} here...`)
    .join('\n\n');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'phioffice369-draft';
}

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window;
  } catch {
    return false;
  }
}

function loadDraft(template) {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = window.localStorage.getItem(`phioffice369:phiwrite:${template.id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function PhiWriteLite({ template, onBack }) {
  const savedDraft = useMemo(() => loadDraft(template), [template]);
  const [title, setTitle] = useState(savedDraft?.title ?? template.title);
  const [content, setContent] = useState(savedDraft?.content ?? makeStarterContent(template));
  const [activeLabelId, setActiveLabelId] = useState(savedDraft?.activeLabelId ?? template.trustDefaults[0] ?? 'human_written');
  const [saveStatus, setSaveStatus] = useState(savedDraft ? 'Restored local draft' : 'New local draft');
  const [copyStatus, setCopyStatus] = useState('');

  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];

  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `draft_${template.id}`,
    title,
    app: template.app,
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: ['template_to_phiwrite_lite_draft'],
  }), [activeLabelId, template, title]);

  useEffect(() => {
    if (!canUseLocalStorage()) return undefined;

    setSaveStatus('Unsaved changes...');
    const timeout = window.setTimeout(() => {
      const payload = {
        templateId: template.id,
        title,
        content,
        activeLabelId,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(`phioffice369:phiwrite:${template.id}`, JSON.stringify(payload));
      setSaveStatus('Autosaved locally');
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [activeLabelId, content, template.id, title]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const sectionCount = template.sections.length;
  const characterCount = content.length;

  function handleResetDraft() {
    const nextContent = makeStarterContent(template);
    setTitle(template.title);
    setContent(nextContent);
    setActiveLabelId(template.trustDefaults[0] ?? 'human_written');
    if (canUseLocalStorage()) {
      window.localStorage.removeItem(`phioffice369:phiwrite:${template.id}`);
    }
    setSaveStatus('Reset to template');
  }

  function buildMarkdownExport() {
    return [
      `# ${title}`,
      '',
      `> Created in PhiOffice369 / PhiWrite-lite from template: ${template.title}`,
      `> Active trust label: ${activeLabel.label}`,
      '',
      content,
      '',
      '---',
      '',
      '## PhiOffice369 Receipt Preview',
      '',
      `- Schema: ${receipt.schema}`,
      `- App: ${receipt.app}`,
      `- Labels: ${receipt.labels.join(', ')}`,
      `- Transformations: ${receipt.transformations.join(', ')}`,
    ].join('\n');
  }

  function handleExportMarkdown() {
    const markdown = buildMarkdownExport();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(title)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaveStatus('Markdown exported');
  }

  async function handleCopyReceipt() {
    const receiptText = JSON.stringify(receipt, null, 2);
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopyStatus('Receipt copied');
    } catch {
      setCopyStatus('Copy unavailable in this browser');
    }
  }

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
          <p className="save-status">{saveStatus}</p>
        </div>
        <div className="workspace-actions">
          <button className="ghost-button" type="button" onClick={handleResetDraft}>
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
          <button className="gold-button" type="button" onClick={handleExportMarkdown}>
            <Download aria-hidden="true" />
            Export .md
          </button>
        </div>
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
            <div><strong>{characterCount}</strong><span>characters</span></div>
            <div><strong>{receipt.labels.length}</strong><span>labels</span></div>
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
            <button className="copy-receipt-button" type="button" onClick={handleCopyReceipt}>
              <ClipboardCopy aria-hidden="true" />
              Copy receipt JSON
            </button>
            {copyStatus && <p className="copy-status">{copyStatus}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
