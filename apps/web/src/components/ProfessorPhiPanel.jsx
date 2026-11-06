import { useMemo, useState } from 'react';
import { Bot, ClipboardCopy, Send, ShieldCheck } from 'lucide-react';
import { professorPhiDemoProvider, runProfessorPhi } from '@phioffice369/professor-phi';
import './ProfessorPhiPanel.css';

export default function ProfessorPhiPanel({ modes, systemNotes, selectedMode, onSelectMode, provider = professorPhiDemoProvider }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(null);
  const [pending, setPending] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const selectedModeDescription = useMemo(() => selectedMode?.description ?? 'Choose a Professor Phi mode.', [selectedMode]);

  async function sendPrompt() {
    if (!prompt.trim() || pending) return;
    setPending(true);
    setCopyStatus('');
    try {
      setResponse(await runProfessorPhi(provider, { prompt, modeId: selectedMode.id }));
    } catch (error) {
      setCopyStatus(error.message);
    } finally {
      setPending(false);
    }
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(response.response);
      setCopyStatus('Professor Phi response copied.');
    } catch {
      setCopyStatus('Clipboard copy unavailable in this browser.');
    }
  }

  function handlePromptKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      sendPrompt();
    }
  }

  return (
    <section className="section-block professor-chat-layout fade-in">
      <div className="panel professor-mode-panel">
        <p className="eyebrow">Professor Phi modes</p>
        <h2>Assistant behavior with boundaries.</h2>
        <div className="mode-list">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`mode-card ${selectedMode.id === mode.id ? 'selected' : ''}`}
              aria-pressed={selectedMode.id === mode.id}
              onClick={() => onSelectMode(mode)}
            >
              <strong>{mode.label}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel professor-chat-panel">
        <div className="professor-chat-heading">
          <div>
            <p className="eyebrow">{provider.name}</p>
            <h2>{selectedMode.label} mode</h2>
            <p>{selectedModeDescription}</p>
          </div>
          <Bot aria-hidden="true" />
        </div>

        <label className="professor-prompt-box">
          <span>Ask Professor Phi</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder="Example: Help me turn this product idea into a clean launch checklist..."
            rows={6}
            maxLength={16000}
          />
        </label>

        <div className="professor-chat-actions">
          <button type="button" onClick={sendPrompt} disabled={!prompt.trim() || pending}><Send aria-hidden="true" /> Send local prompt</button>
          <button type="button" onClick={copyResponse} disabled={!response}><ClipboardCopy aria-hidden="true" /> Copy response</button>
        </div>

        {response && <article className="professor-response-card" aria-live="polite">
          <div className="professor-response-meta">
            <span>{response.modeLabel}</span>
            <span>{response.trustLabel}</span>
            <span>Publish risk: {response.publishRisk}</span>
            <span>{response.providerName} · {response.providerKind}</span>
          </div>
          <pre>{response.response}</pre>
        </article>}

        {copyStatus && <p className="professor-copy-status" role="status">{copyStatus}</p>}

        <div className="professor-note-box live-note">
          <ShieldCheck aria-hidden="true" />
          <p>The built-in demo uses scripted local responses. Review its suggestions before using them as evidence or publishing them.</p>
        </div>

        <ul className="system-notes">
          {systemNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </div>
    </section>
  );
}
