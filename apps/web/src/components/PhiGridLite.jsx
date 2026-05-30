import './PhiGridLite.css';

export default function PhiGridLite({ template, onBack }) {
  return (
    <section className="phigrid-workspace fade-in">
      <div className="grid-topbar panel">
        <button className="grid-ghost-button" type="button" onClick={onBack}>Back to templates</button>
        <div>
          <p className="eyebrow">PhiGrid-lite</p>
          <h2>{template.title}</h2>
          <p className="grid-save-status">Local grid workspace loading.</p>
        </div>
      </div>
    </section>
  );
}
