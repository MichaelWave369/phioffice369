import { ShieldCheck, Sparkles, X } from 'lucide-react';
import './OnboardingModal.css';

export default function OnboardingModal({ isOpen, onClose, onStartTemplate }) {
  if (!isOpen) return null;

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="onboarding-close" type="button" onClick={onClose} aria-label="Close onboarding"><X aria-hidden="true" /></button>
        <p className="eyebrow">Welcome to PhiOffice369</p>
        <h2 id="onboarding-title">Your local-first workspace starts here.</h2>
        <p className="onboarding-lead">This prototype keeps work on your device, labels AI-assisted content clearly, and helps one artifact become the next useful thing.</p>

        <div className="onboarding-points">
          <article>
            <ShieldCheck aria-hidden="true" />
            <h3>Local by default</h3>
            <p>No forced login and no hidden cloud dependency in this prototype.</p>
          </article>
          <article>
            <Sparkles aria-hidden="true" />
            <h3>Trust labels</h3>
            <p>Mark work as human-written, AI-assisted, private, sourced, symbolic, or needing citation.</p>
          </article>
          <article>
            <Sparkles aria-hidden="true" />
            <h3>Start with a template</h3>
            <p>Open a starter artifact, edit locally, export, and see it appear in PhiVault.</p>
          </article>
        </div>

        <div className="onboarding-actions">
          <button type="button" onClick={onStartTemplate}>Start with a project spec</button>
          <button type="button" className="secondary" onClick={onClose}>Explore first</button>
        </div>
      </section>
    </div>
  );
}
