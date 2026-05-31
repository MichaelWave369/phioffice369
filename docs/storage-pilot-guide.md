# PhiOffice369 Storage Pilot Guide

PhiOffice369 is local-first. The current live prototype uses browser localStorage for continuity. IndexedDB is being introduced carefully as a durable storage pilot, not as a blind replacement.

This guide explains the safe operator path inside PhiVault-lite.

## Current storage model

- **Default mode:** localStorage.
- **Pilot target:** IndexedDB.
- **Safety rule:** IndexedDB pilot mode should only be enabled after a successful copy and verification.
- **Rollback rule:** localStorage remains the fallback path.

## Before testing IndexedDB pilot mode

Open PhiVault-lite and export a manual workspace backup first.

Use:

1. **Backup workspace**
2. Save the JSON file somewhere safe.
3. Then proceed with migration testing.

The backup file uses:

```text
phioffice369.workspace_backup.v0.1
```

It captures `phioffice369:*` browser-local workspace data while skipping emergency backup keys.

## Safe pilot sequence

Use this exact order:

```text
Backup workspace
→ Plan IndexedDB migration
→ Copy missing safely
→ Verify copy
→ Review readiness gate
→ Enable IndexedDB pilot
→ Refresh app
```

## What each PhiVault control means

### Plan IndexedDB migration

Builds a comparison plan between localStorage and IndexedDB.

It reports:

- source items
- missing target items
- already synced items
- conflicts

It does not write anything.

### Copy missing safely

Copies only missing localStorage items into IndexedDB.

It does not overwrite conflicts.

### Verify copy

Compares localStorage source data against IndexedDB target data by key/value equality.

The visible report is redacted. It shows keys and value lengths, not private document contents.

### Copy/export migration report

Creates a redacted report for review.

Use this when debugging migration state without exposing stored document text.

### Copy/export verify report

Creates a redacted verification report.

Use this before enabling pilot mode.

### Readiness gate

The readiness gate decides whether IndexedDB pilot mode can be enabled.

Pilot mode is blocked if:

- IndexedDB is unavailable,
- verification has not been run,
- verification is not passing,
- items are missing in IndexedDB,
- items are mismatched in IndexedDB.

### Enable IndexedDB pilot

Saves a local preference only when the readiness gate passes.

The saved preference uses:

```text
backend: indexedDB-pilot
reason: verified_indexeddb_copy
```

After saving the preference, refresh the app to test pilot storage.

### Keep localStorage mode

Saves an explicit localStorage preference.

Use this when you do not want to test IndexedDB yet.

### Reset storage preference

Clears the saved storage preference entirely.

After reset, PhiOffice returns to default localStorage behavior on refresh.

## Preference status panel

PhiVault displays storage preference status so the pilot is never hidden.

It shows:

- requested backend,
- active adapter,
- whether the active adapter matches the saved preference,
- preference reason.

If the active adapter does not match the saved preference, stay in localStorage mode until the mismatch is understood.

## Recovery path

If anything feels wrong:

1. Use **Reset storage preference**.
2. Refresh the app.
3. Confirm the active adapter is localStorage.
4. Import the workspace backup if needed.
5. Restore the backup into browser storage.

## Operator notes

Do not delete localStorage data just because IndexedDB verification passes. For now, localStorage remains the source of truth and IndexedDB is a pilot mirror.

Do not enable overwrite behavior for conflicts until conflict review has a dedicated UI.

Do not treat IndexedDB pilot mode as a production migration until:

- the app shell reads/writes through the preference-aware adapter everywhere,
- PhiWrite-lite is migrated to adapter calls,
- PhiGrid-lite is migrated to adapter calls,
- PhiDeck-lite is migrated to adapter calls,
- backup/restore is tested against both backends,
- CI and manual QA verify localStorage fallback.

## Current claim boundary

IndexedDB support is currently a cautious pilot path. It is not yet the default storage engine for the full app.
