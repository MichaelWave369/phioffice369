import { Keyboard, X } from 'lucide-react';
import { keyboardShortcutList } from '../lib/keyboardShortcuts.js';
import './ShortcutHelpOverlay.css';

export default function ShortcutHelpOverlay({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="shortcut-overlay" role="dialog" aria-modal="true" aria-labelledby="shortcut-overlay-title">
      <section className="shortcut-card panel">
        <div className="shortcut-heading">
          <div>
            <Keyboard aria-hidden="true" />
            <p className="eyebrow">Keyboard shortcuts</p>
            <h2 id="shortcut-overlay-title">Move faster through PhiOffice369</h2>
          </div>
          <button type="button" onClick={onClose}><X aria-hidden="true" /> Close</button>
        </div>

        <div className="shortcut-list">
          {keyboardShortcutList.map((shortcut) => (
            <article key={shortcut.keys}>
              <kbd>{shortcut.keys}</kbd>
              <span>{shortcut.action}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
