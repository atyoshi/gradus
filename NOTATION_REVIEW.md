# Notation code review

Scope: score engraving, ledger lines, accidental display, selection colors, preview geometry and related browser interactions in `src/ScoreView.tsx`. This is not a repository-wide or exhaustive musical-rules review.

## Fixed findings

- **P2 — Ledger lines lost contrast in dark mode.** VexFlow's stave default uses `#444`, independently of the note's theme-aware style. Ledger lines now explicitly use the note's ink, selected, given or error color. Browser assertions cover one and multiple ledger lines above and below the treble staff in both themes; screenshots were inspected.
- **P1 — Natural cancellations were missing within a measure.** After an altered pitch, a subsequent natural of the same staff pitch could be engraved without its natural sign, implying the wrong sounding pitch. Each voice now tracks alterations by note name and octave within the bar and prints the cancellation. Barline resets and explicit altered-note signs are retained.
- **P2 — Note color could remain stale on selection.** The engraving effect reads the selected note but did not depend on selection changes. It now updates the engraved note and ledger colors when selection changes.

## Register layout update

The fixed 112-pixel offsets have been replaced by per-voice extents derived from written pitches and candidate hints. Staves, measure highlights, hit regions and previews share these coordinates. Score zoom uses the SVG viewBox, and pointer coordinates are transformed through its screen matrix. Hover previews are bounded to the available voice region and supported pitch range; committing a new extreme register expands the layout.

Browser checks cover C8 and C1 in a three-voice score, testing visible stems, ledger lines and notehead baselines. Music-font text boxes include invisible ascender/descender space and are not used as estimates of notehead ink. Light/dark rendering, desktop/mobile width and all five zoom settings are covered as well.

## Verification

73 unit tests, 28 browser tests and the production build passed in the redesign verification. Browser regression checks cover ledger-line count and computed color, the natural glyph, light/dark screenshots and harmless selection; the complete browser suite also checks duration memory, mouse/keyboard entry, undo/redo, playback, saved drafts, MusicXML and lessons.

## Compact editor refinement

The editor now defaults to 125% score zoom with 16px body text, 40px standard controls and 44px editing controls. Neutral charcoal and light-gray themes use a plum selection accent. Desktop feedback occupies a 320px column; narrow layouts place explanations immediately after the score controls. Findings are readable without disclosure clicks, with sources and lessons remaining expandable.

Forward pitch choices use a separate candidate target in the selected voice, skipping written notes and rests. Worker results are guarded by score, target, duration and accidental. Clear line restores catalog patterns (or saved solutions), and custom lines reuse the species pattern generator. Both actions use the existing undo/save system.

Refinement validation: 84 unit tests and 32 browser tests pass; production build and formatting checks pass. Browser screenshots were inspected in both themes at desktop and narrow widths. Checks cover all zoom levels, extreme registers, 1280×800 viewport fit, centered editing symbols, forward candidate targets and stale responses, Clear line undo/save/reload, 300/400 BPM playback, and existing MusicXML/lesson behavior. The build retains Vite's dependency bundle-size advisory.

## Organized workspace verification

Exercise/file actions, playback/display settings, study help, and musical review now have separate homes. Pitch hints initialize off. Keyboard regression checks cover up/down, left/right, octave modifiers, tied pitch edits and returning focus from settings. Extended-tie authoring guards reject three-note fourth-species holds from either direction; imported chains remain intact and receive diagnostics. Florid extended holds require context. The rule contract is now fux-1725-v4; the audit ledger and practice provenance version were updated without changing source music.

Validation: 89 unit tests and 35 browser tests passed, followed by focused checks for final spacing and sample-answer protection. Production build and formatting checks pass. Desktop and narrow screenshots were visually inspected in light/dark themes. Vite retains its existing dependency bundle-size advisory.
