import { useState } from 'react';
import { FileWarning } from 'lucide-react';
import CompatibilityReportModal from './CompatibilityReportModal.jsx';
import './CompatibilityReportLauncher.css';

export default function CompatibilityReportLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="compat-report-launcher"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open compatibility honesty report"
      >
        <FileWarning aria-hidden="true" />
        <span>Compatibility report</span>
      </button>
      <CompatibilityReportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
