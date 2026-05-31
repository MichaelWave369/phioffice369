import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPATIBILITY_REPORT_SCHEMA,
  createCompatibilityReport,
  createMockCompatibilityReport,
  summarizeCompatibilityReport,
} from '../apps/web/src/lib/compatibilityReport.js';

test('createCompatibilityReport creates versioned low-risk reports when nothing is lost', () => {
  const report = createCompatibilityReport({
    sourceFormat: 'markdown',
    targetFormat: 'PhiWrite',
    preserved: ['text'],
  });

  assert.equal(report.schema, COMPATIBILITY_REPORT_SCHEMA);
  assert.equal(report.roundTripRisk, 'low');
  assert.deepEqual(report.preserved, ['text']);
});

test('createCompatibilityReport marks medium and high risk from approximated and lost items', () => {
  assert.equal(createCompatibilityReport({ approximated: ['a', 'b', 'c'] }).roundTripRisk, 'medium');
  assert.equal(createCompatibilityReport({ lost: ['macros'] }).roundTripRisk, 'high');
});

test('createMockCompatibilityReport explains preserved approximated and lost areas', () => {
  const report = createMockCompatibilityReport();

  assert.equal(report.roundTripRisk, 'high');
  assert.ok(report.preserved.length > 0);
  assert.ok(report.approximated.length > 0);
  assert.ok(report.lost.length > 0);
  assert.match(report.notes.join(' '), /promise to test/);
});

test('summarizeCompatibilityReport returns compact modal state', () => {
  const summary = summarizeCompatibilityReport(createMockCompatibilityReport());

  assert.equal(summary.sourceFormat, 'DOCX / XLSX / PPTX');
  assert.equal(summary.targetFormat, 'PhiOffice369 native artifacts');
  assert.equal(summary.roundTripRisk, 'high');
  assert.equal(summary.lostCount, 2);
});
