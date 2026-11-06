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

### PhiGrid CSV and PhiDeck JSON

PhiGrid CSV is a values-only interchange format. The exporter quotes fields, escapes embedded quotes, and prefixes formula-like text with an apostrophe. This can change how the text appears in another editor. Spreadsheet programs may reinterpret escaped data after resaving, and treatment varies by application. Use a workspace backup to preserve raw formula strings and metadata. [OWASP CSV injection notes](https://owasp.org/www-community/attacks/CSV_Injection).

PhiDeck v0.2 JSON preserves layout, accents, image bytes and descriptions. Older PhiOffice369 builds accept text-only v0.1 decks. Standalone HTML preserves the visible slide content and opens in a browser. PowerPoint compatibility is unevaluated. Keep the original file when using conversions.
