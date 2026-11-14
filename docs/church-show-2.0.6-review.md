# Church Show Pro 2 — 2.0.6 review

Song templates now reserve a fixed footer for song number/title and available author, composer, copyright and publisher. Missing credits are omitted. New preset IDs preserve existing user templates. Metadata renders on the output on every active verse; existing songs must have the new template applied.

## Validation

- Footer, style pack, planning and audio file tests: 10 passed.
- Electron TypeScript compilation and frontend production build passed locally.
- Runtime dependency audit: 4 moderate, 0 high, 0 critical. The remaining chain is Google Drive / googleapis-common / gaxios / uuid. This excludes build-time dependencies and is not a malware scan.
- Full audit still flags build-time tooling. No claim of a clean full audit.
- Packaged Mac startup and antivirus scan must pass in CI before producing the installer artifact. ClamAV scans the app and separately extracted ASAR; a clean scan is not a guarantee of safety.
- Apple signing and notarization remain unavailable without configured developer credentials. Chrome's classification of 2.0.5 has not been diagnosed or cleared.

Runtime versions: Electron 43.8.10, music-metadata 11.16.1.
