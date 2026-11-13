# Church Show Pro 2

Based on FreeShow v1.6.7 (GPL-3.0), retaining its native projects, File menu,
media, audio, overlays, templates, scripture, calendar, functions and output engine.
The existing application identifier and data folder are retained to preserve the
first Church Show FreeShow installation's saved content.

## Implemented in this development build

- Existing Church Show logo, product name and gold interface accent.
- Shared import in File > Import and the resource tabs: ZIP, JSON, TXT and Markdown.
- Versioned, platform-neutral resource package; book, study, question and cue types.
- Existing `local-bible-study` JSON import, including a `studies` collection.
- Native saved shows for imported resources, preserving drag to project and native editing.
- Books, Questions and Cues tabs. Questions may carry a separate answer slide and speaker note.
- Dragging a cue into a project creates a native section with notes and color, without changing the audience output.
- Drag an audio file onto a show to pair it, display its name, replace it or unlink it.
  Pair attaches to the first slide of each existing arrangement. It is not a karaoke track.
- External plain text drop into project or an existing slideshow; long text splits into slides.

## Shared ZIP format

ZIP contains one or more JSON files using this contract (UTF-8):

```json
{
  "format": "church-show-package",
  "version": 1,
  "id": "my-package",
  "title": "Mitt studium",
  "resources": [{
    "id": "chapter-1",
    "kind": "book",
    "title": "Kapitel 1",
    "source": "Boktitel, författare, sida 1",
    "sections": [{"text": "Text att läsa och visa.", "source": "Boktitel, sida 1"}]
  }]
}
```

Kinds: `book`, `study`, `question`, `cue`. Sections may have `title`, `source`,
`answer`. Stable package/resource IDs prevent reinstallation overwriting edited
resources. ZIP limits: 10,000 entries and 256 MB uncompressed per archive.
Unknown formats are reported instead of silently claimed to be installed.
Media binaries, EPUB, USX, SQLite Bible packages, nested ZIP, EGW commentary
indexes and arbitrary earlier Pure Words packages still need dedicated adapters.
The existing native FreeShow Bible and project importers remain available.

## Still required before the requested full release

- All four offline Bible distributions and their attributions.
- Validate the basic saved-show reader and text selection flow against full book packages.
- All existing book/combined-package adapters and import preview.
- Actual Bibelmanna content and quiz flow controls.
- Extend cue metadata with person and duration.
- Visible audio backlinks in the Audio library and persistence/playback QA on macOS.
- Restore/port the previous Church Show audience output themes.
- Mobile consumer of the shared contract. NAS sync is not implemented.

## Future karaoke product

- Accept Suno M4A audio and inspect embedded lyrics.
- Render lyrics over a full-screen image.
- Recognize timed lyrics where present; do not invent synchronization when the
  file contains only plain lyrics. Support separate timing/manual synchronization.
- Route microphone input through the application's audio system.
- Clarify the user's additional input/device called “tale gater” before implementing
  hardware integration. Do not assume it means guitar, gate, or an app name.
- No karaoke controls or functionality are claimed in this build.

## Verification for this local development checkpoint

11 package and ZIP tests pass. Electron TypeScript compilation and the frontend
production compilation succeeded. Full Svelte checking reports 194 diagnostics
across the codebase and is not a clean check. Local post-build packaging could not
finish because native Opus prebuilds are absent after installing dependencies
without native install scripts. macOS packaging and hardware testing are pending.

The user approved publishing the code and logo to the public repository on
2026-11-13. macOS packaging is performed by the Intel Monterey workflow.

## 2.0.1 — visual identity and shared style packs

- Own logo, blue/gold startup window and base UI palette, including saved standard-theme migration. Custom user themes remain intact.
- Existing local Media folders are detached once; their paths remain under “Tidigare bakgrundsmappar”. Restore each one with “Visa igen”, or select its path through Add folder. Files on disk, Audio folders and saved presentations are not deleted.
- Default template/output background assignments reset once; later choices are preserved.
- Shared `churchshow-style-pack` v1: declarative colors, ten 4K SVG backgrounds and ten native song templates. The same ZIP installs through Shared import. No scripts or external resources in backgrounds.
- `packages/Church-Show-Sangstund-1.zip` includes ten UI themes (five light/five dark), and background SVGs can also be used outside the app. Automatic import in the mobile app still requires its adapter.
- UI and slide text contrast checked at >= 4.5:1 for the palette endpoints; projector brightness and room conditions still require a real-screen check.
- Browser screenshot verification was unavailable in this workspace; the vector background contact sheet was rendered and inspected.
