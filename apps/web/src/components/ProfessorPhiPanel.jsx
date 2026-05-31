import { useMemo, useState } from 'react';
import { Bot, ClipboardCopy, Send, ShieldCheck } from 'lucide-react';
import { createProfessorPhiMockResponse } from '@phioffice369/professor-phi';
import './ProfessorPhiPanel.css';

export default function ProfessorPhiPanel({ modes, systemNotes, selectedMode, onSelectMode }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(() => createProfessorPhiMockResponse({ prompt: '', modeId: selectedMode.id }));
  const [copyStatus, setCopyStatus] = useState('');

  const selectedModeDescription = useMemo(() => selectedMode?.description ?? 'Choose a Professor Phi mode.', [selectedMode]);

  function sendPrompt() {
    const nextResponse = createProfessorPhiMockResponse({ prompt, modeId: selectedMode.id });
    setResponse(nextResponse);
    setCopyStatus('');
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
            <p className="eyebrow">Local demo chat</p>
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
          />
        </label>

        <div className="professor-chat-actions">
          <button type="button" onClick={sendPrompt}><Send aria-hidden="true" /> Send local prompt</button>
          <button type="button" onClick={copyResponse}><ClipboardCopy aria-hidden="true" /> Copy response</button>
        </div>

        <article className="professor-response-card">
          <div className="professor-response-meta">
            <span>{response.modeLabel}</span>
            <span>{response.trustLabel}</span>
            <span>Publish risk: {response.publishRisk}</span>
            <span>{response.localOnly ? 'Local demo' : 'External'}</span>
          </div>
          <pre>{response.response}</pre>
        </article>

        {copyStatus && <p className="professor-copy-status">{copyStatus}</p>}

        <div className="professor-note-box live-note">
          <ShieldCheck aria-hidden="true" />
          <p>This panel is a local mock assistant. It does not call a backend yet, and responses are labeled AI-assisted demo guidance.</p>
        </div>

        <ul className="system-notes">
          {systemNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </div>
    </section>
  );
}
