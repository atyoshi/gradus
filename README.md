# Gradus ad Parnassum

A private counterpoint studio for your Mac, inspired by Parnasso's exercise workflow. The opening exercise uses Fux's Dorian cantus firmus.

## macOS app

Open the DMG in `release/` and drag **Gradus ad Parnassum** into Applications. The app includes its runtime and works offline. See [macOS setup and notebook migration](macos/README.md). To rebuild on Apple Silicon, run `npm run build:mac`; for Intel, run `npm run build:mac:intel`. These builds are unsigned and unnotarized.

## Run in a browser

Requires Node.js 24 or newer (developed and tested with Node 26).

```sh
npm install
npm run build
npm start
```

Open **http://127.0.0.1:4173**. Keep the terminal running; press Control-C to stop. `npm run dev` runs the development server at the same address. Everything required for practice, engraving, and playback is bundled locally. Links to historical source pages open external sites only when clicked.

## Practice

- Choose species 1–5, two to four voices, a mode, and the position of the given voice. “Source exercise” selects a historical example. The shelf lets you pick individual studies.
- 123 Fux examples are included alongside 48 checked practice templates (three per species/voice count, plus three cantus studies). The guided path includes the full catalogue across Dorian, Phrygian, Lydian, Mixolydian, Aeolian, and Ionian, with a mode filter. Historical examples can retain exceptions the checker flags. The source collection does not contain every possible mode/position combination.
- “New cantus” modifies a source cantus, searches for a complete solution, and only returns a generated prompt when its retained solution passes the checker. Bounded search can fall back to a checked source exercise; the app explains when that happens.
- Click a staff slot to set pitch. A–G enters a pitch near the selected note and advances. Left/right selects slots; up/down moves a diatonic step, Command-up/down an octave. Backspace clears a slot. Command-Z / Shift-Command-Z undo/redo. Toolbar controls handle accidentals, rhythm, rests, and ties.
- The workspace uses compact, readable controls in neutral light and charcoal dark themes. Score size defaults to 125%; use the Score size control for 100–200%. The score scrolls independently instead of shrinking notes to fit.
- Pitch hints start off. Enable “Pitch hints” to see locally compatible green noteheads at the next unwritten position, filtered by the active accidental. Click a head or use keyboard focus and Enter to choose it.
- Historical printing and editorial notes appear as optional “Did you know?” reading. They do not block progress. Completed exercises without rule violations offer the next exercise even when a musical context question remains available for review.
- Guided studies keep their assigned note lengths, but ties are editable. Add tie copies a pitch into the following slot; changing a tied pitch updates its connected notes. Adding or removing a tie is undoable. Given voices and sample answers remain read-only.
- Violations, suggestions, and strengths use expandable rows. Select a highlighted passage for its concise diagnosis near the score. Musical analysis describes the selected editable voice; harmonic and motion counts compare known downbeats with the cantus. Partial work is labeled “So far,” and unrelated errors do not hide supported strengths.
- Choose the next note's duration with the rhythm buttons or number keys: 7 whole, 6 half, 5 quarter, 4 eighth. Dotted values are available in the duration menu. Choosing a value does not change the score; entering a pitch applies it to a blank measure tail, preserving written notes. Guided path studies keep their assigned rhythms. Given voices remain locked. Conventional and alto/tenor clefs are available.
- Your chosen duration carries into untouched empty measures when you enter a note. Selection and hovering leave the score unchanged; existing music and assigned path-study rhythms are preserved. A shorter slot fills any remainder of the bar. Opening another exercise or reloading resets the input preference to the exercise's saved rhythm.
- Contextual feedback is always active. Definite errors, craft advice, exercise requirements and source-review questions are distinguished, with pitch/bar/beat details and links to lessons. Candidate pitches pass the applicable local checks against currently entered notes; they are not guaranteed global solutions. Stronger hints run a bounded completion search. A timeout does not prove impossibility.
- Sample answers are reassessed previews: they do not overwrite or autosave over your draft, and a retained answer cannot replace a rhythm you have changed.
- Lessons offer 11 focused explanations with playable notation, source references and a return to your draft. The practice path labels each study’s skill focus and reassesses progress using the current rules.
- Playback uses Tone.js and locally bundled piano, cello, and violin samples, with voice mute/solo, tempo, and a bar loop. Space starts/stops playback.
- Import MusicXML/MXL containing separate monophonic parts in 4/4 or 2/2 with complete measures. A single-part score becomes a cantus for a new exercise. Chords, tuplets, grace notes, pickups, and multiple voices per staff are rejected. Selected species and mode apply to ordinary imports. Files exported here retain per-voice species and given-voice roles. Exported empty slots become rests.

## Storage and backup

Attempts are autosaved to `data/gradus.sqlite`. A browser recovery copy also protects the current draft between keystrokes and the debounced disk save. Settings and last exercise are local. The notebook sidebar exports a complete JSON backup and restores backups by merging attempts; matching IDs are updated. Keep periodic backups somewhere safe. Browser recovery is specific to the browser and origin you use.

The server binds to loopback only. There is no account, cloud sync, subscription, analytics, or AI API dependency.

## Teaching approach and limits

The first course implements a documented Fux practice interpretation. It distinguishes definite errors, craft advice, explicit study requirements, incomplete writing and unresolved source context. Unsettled contextual questions cannot produce a clean pass. It is not an exhaustive historical-style validator or an assessment of artistic merit. See [RULES.md](RULES.md) for the rule contract and known limits, and [PARNASSO_COMPARISON.md](PARNASSO_COMPARISON.md) for the comparison and implemented improvements. Rules and generators share a musical model with spelled pitches, exact eighth-note time units (including half units for dotted eighths), stable note/voice identities, rests, and ties. Checking, hints, and generation run in a worker.

Mozart’s teaching of Thomas Attwood (harmony, species counterpoint, canon, and free composition; NMA X/30/1), Renaissance polyphony (Jeppesen), tonal counterpoint (Gauldin), structural voice leading (Salzer/Schachter), fugue (Gédalge/Mann), and advanced Bach studies (Ledbetter/Dirst) are identified as future courses, not implemented lessons. Their exact editions and text access must be reviewed before building those courses.

## Verification

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use an installed Playwright Chromium, or the existing Mac Chromium cache. On another machine, run `npx playwright install chromium` first. Set `GRADUS_BROWSER` to use another compatible Chromium executable. Browser tests use a separate SQLite database; production attempts are untouched.

`node scripts/curate.ts` rebuilds the 48 checked practice adaptations. `python3 scripts/fetch_sources.py` explicitly refreshes and pins the upstream score collection; normal startup never downloads it. `python3 scripts/fetch_audio.py` refreshes audio/font assets.

## Sources and credits

- Arensky's *1000 harmony exercises* are [archived for future OMR work](public/sources/arensky.md); they are not yet interactive exercises.
- Fux, _Gradus ad Parnassum_ (1725), [Wienbibliothek digitization](https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035), public domain.
- [Jay Wilson / Mark Gotham, FourScoreAndMore species collection](https://github.com/MarkGotham/species), pinned commit `5c7cae40422bd5ed897a2be3b916a7bc1a2a2df7`. Score transcriptions: CC0; figure numbers follow the Mann edition. Upstream README and individual provenance accompany the bundled scores. Original practice adaptations are identified as such.
- VexFlow (MIT), Bravura (SIL Open Font License). VexFlow bundles its engraving fonts; a Bravura font and its notice are also included locally.
- Tone.js (MIT); [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments), Nicholaus P. Brosowsky, 2018. Instrument-library code: MIT; **samples: CC BY 3.0**, as stated in the upstream license. Selected piano C3/C4/C5, cello C2/C3/C4, violin G3/C4/C5 samples are redistributed locally, unmodified; Tone.js repitches them during playback. [License notice](public/sources/audio-license.txt).
- The saved Parnasso snapshot is a local comparison reference. Its code, branding and lesson text are not included in the app runtime.

## Editor revision

The score now uses one horizontally scrolling system. Blank slots are unpitched; hovering previews the exact pitch before insertion. Clicking at a different staff height in an existing slot changes its pitch; clicking the note itself selects it. Dragging previews a replacement. Previews stay neutral even for a pitch that violates a rule; committed edits receive warnings without being blocked. The notation keeps stable clefs and shared timing positions across voices. Playback sits above the score and editing tools below. New-exercise settings and the source shelf are collapsed behind New exercise. Appearance follows the system or a saved light/dark override.

The contextual Fux profile follows the primary source with documented exceptions, per-voice assignments and explicit limits. All 46 original disagreements have source evidence in [SOURCE_REVIEW.md](SOURCE_REVIEW.md); the full 123-example audit currently records 105 passes of implemented checks, 13 contextual review results and 5 examples with unresolved violations. The Sources screen exposes the evidence and remaining questions. Run `node scripts/audit_sources.ts` to reproduce current assessments. Passing the automated profile is not an exhaustive historical or artistic certification.

The editor includes **Clear line**, which resets the active voice to its empty exercise pattern in one undoable change. Custom lines reset to their assigned species rhythm. Pitch hints appear at the next unwritten position in the same voice; green choices are locally compatible, and future notes can change that judgment. Rule explanations are visible beside the score on desktop and immediately after editing controls on narrow screens. Tempo supports 30–400 BPM.

Each voice has its own clef selector in the voice controls beneath the editor. Automatic clefs use the source register when available; an empty voice below the cantus starts in bass clef. Bass voices have additional pointer-entry space below the staff. Changing clef changes notation only, preserving the pitches.

Practice actions are grouped by task: exercise creation and MusicXML in the header; playback, zoom, and Playback & display above the score; editing and study help below it. Playback & display contains instrument, clef presets, and per-voice mute/solo. Musical review combines analysis, suggestions, and strengths; the desktop rule column contains violations and unresolved context. Notebook backups live on the Notebook page.

Fourth-species ties cannot be extended into a three-note hold. Existing imported holds remain intact and receive feedback. Unsupported extended florid holds need source context rather than being declared universally valid. Arrow-key editing, octave modifiers, and undo/redo remain available when the score has focus.
