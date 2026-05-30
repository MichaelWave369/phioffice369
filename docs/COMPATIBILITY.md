# Compatibility Philosophy

PhiOffice369 should support common productivity formats where practical, but it should be honest about limits.

## Early targets

| Format | Early role |
|---|---|
| Markdown | PhiWrite import/export |
| HTML | Web-ready docs and cleaned imports |
| PDF | Export for docs, decks, posters |
| CSV | PhiGrid import/export |
| JSON | Native structured interchange |
| DOCX | Compatibility lab target |
| XLSX | Compatibility lab target |
| PPTX | Compatibility lab target |
| ODT/ODS/ODP | Open document compatibility path |

## Compatibility honesty

When importing complex external files, PhiOffice369 should show a compatibility report:

- What imported cleanly
- What was approximated
- What was not supported
- What needs manual review
- Whether round-trip export is recommended

## Non-goal for v0.1

v0.1 should not promise perfect DOCX/XLSX/PPTX round-trip compatibility.
