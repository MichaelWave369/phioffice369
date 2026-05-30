# Architecture Notes

## Preferred direction

PhiOffice369 should begin as a modular app shell with local-first storage and a small number of working tools.

## Possible technical tracks

These should be evaluated, not assumed:

1. Build a custom lightweight suite using React/Tauri/Electron-style desktop packaging.
2. Use existing open-source office/editor libraries where licensing and architecture make sense.
3. Integrate document editors carefully, with clear attribution and license compliance.
4. Keep PHI369-specific artifact transformation and trust-panel logic as first-class code.

## Local-first baseline

- Project folders should work offline.
- User data should stay local unless the user explicitly chooses sync or export.
- AI operations should be labeled.
- Online AI usage should disclose when content leaves the device.
- Local model support should be preferred where practical.

## Native project bundle idea

A PhiOffice369 project bundle may include:

- Manifest
- Documents
- Grids
- Decks
- Notes
- Diagrams
- Assets
- Trust labels
- Export receipts
- Lineage metadata
