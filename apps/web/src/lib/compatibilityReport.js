export const COMPATIBILITY_REPORT_SCHEMA = 'phioffice369.compatibility_report.v0.1';

export function createCompatibilityReport({
  sourceFormat = 'docx',
  targetFormat = 'phiwrite',
  preserved = [],
  approximated = [],
  lost = [],
  notes = [],
} = {}) {
  const lostCount = lost.length;
  const approximatedCount = approximated.length;
  const roundTripRisk = lostCount > 0 ? 'high' : approximatedCount > 2 ? 'medium' : 'low';

  return {
    schema: COMPATIBILITY_REPORT_SCHEMA,
    createdAt: new Date().toISOString(),
    sourceFormat,
    targetFormat,
    preserved,
    approximated,
    lost,
    notes,
    roundTripRisk,
  };
}

export function createMockCompatibilityReport() {
  return createCompatibilityReport({
    sourceFormat: 'DOCX / XLSX / PPTX',
    targetFormat: 'PhiOffice369 native artifacts',
    preserved: [
      'Plain text content',
      'Basic headings and paragraph order',
      'Simple tables and CSV-style rows',
      'Slide titles and bullet hierarchy',
    ],
    approximated: [
      'Complex page layout and spacing',
      'Theme colors and font substitutions',
      'Charts converted to editable report placeholders',
      'Slide animations summarized as notes',
    ],
    lost: [
      'Macros and executable embedded behavior',
      'Vendor-specific layout effects not supported by the browser prototype',
    ],
    notes: [
      'PhiOffice369 should show this report before users trust an imported or exported file.',
      'Round-trip compatibility is a promise to test, not a slogan to fake.',
    ],
  });
}

export function summarizeCompatibilityReport(report) {
  return {
    sourceFormat: report.sourceFormat,
    targetFormat: report.targetFormat,
    preservedCount: report.preserved.length,
    approximatedCount: report.approximated.length,
    lostCount: report.lost.length,
    roundTripRisk: report.roundTripRisk,
  };
}
