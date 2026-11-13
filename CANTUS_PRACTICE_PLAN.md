# Historical cantus and generated practice

Status: implementation plan; runtime changes are not part of this document.

## Intended experience

The learner completes guided counterpoint studies, unlocks generated practice,
and writes counterpoint against new given melodies. Historical cantus exercises
provide another route for practice: work from a documented teaching example,
then compare with a surviving realization where one exists.

The cantus is the fixed melody. Species, voice count, voice assignments, and
given-voice position belong to the exercise built around it. One cantus can
support several exercises, provided each assignment is separately verified.

The initial experience should read:

1. Complete the guided studies for a species and voice count.
2. See “Generated practice unlocked” in that part of the Path.
3. Choose a mode and given-voice position, then generate a cantus.
4. Receive the cantus with empty counterpoint voices and assigned rhythms.
5. Write, listen, revise, and complete the exercise using existing feedback.
6. Generate another exercise, revisit a historical cantus, or deliberately reuse
   the same cantus in another unlocked assignment.

## Product decisions

- Unlock generated practice independently for each of the 15 combinations of
  species I–V and two, three, or four total voices. Completing two-voice studies
  does not require finishing three- or four-voice work.
- Initially require the three existing guided studies in the selected
  species/voice-count group. Represent these requirements explicitly rather
  than deriving them from every exercise that happens to be in the catalog.
- A completion must be a complete learner attempt that passes applicable checks
  without unresolved source-context findings. Craft suggestions do not block it.
  Hints are allowed; previewing a supplied answer does not create a completion.
- Existing passing Path attempts count. New historical additions do not change
  the requirements of an already published curriculum version.
- Once earned, an unlock stays earned. Subsequent rule changes may mark a study
  for another look without removing access to generated practice.
- Generated exercises and optional historical challenges do not become new
  prerequisites for later unlocks.
- Historical browsing, source viewing, and manual cantus writing remain
  available. Unsupported historical material is never a required graded task.
- The generator supplies a given cantus and blank editable parts. It retains a
  separately checked witness solution for feasibility and optional help.
- Successful generation means a solution passes the implemented profile; it
  does not certify artistic quality or exhaustive historical authenticity.
- Keep the application local and usable offline after its assets are bundled.

## Current implementation and gaps

- `src/path.ts` preserves exact study identity and resumes saved attempts.
- `src/worker.ts` calculates progress by reassessing saved Path scores. There is
  no persistent completion or unlock ledger yet.
- `src/exercises.ts` provides the bounded completion solver and a generator
  that changes notes in an existing source cantus. That is a transitional
  variation generator, not the planned independent melody generator.
- `src/editor.ts` supplies species rhythm patterns. Fuller textures retain
  per-voice assignments; “species IV” must not silently force every editable
  voice into the same rhythm.
- `scripts/curate.ts` creates three templates per species/voice count. Some
  templates reuse a source or shift its octave. Guided-study count and distinct
  cantus count therefore measure different things.
- The catalog already distinguishes source metadata, adaptations, and retained
  solutions, but lacks a reusable cantus record and explicit teaching profiles.
- `server.mjs` stores attempts and settings in local SQLite and backs them up.
  Progress awards need persistence and backup support beyond browser recovery.
- The existing Fux profile documents its limits in `RULES.md` and
  `SOURCE_REVIEW.md`. It is not automatically an Albrechtsberger or Bach profile.
- `README.md` still describes older button names and generation fallback behavior;
  update it as part of delivery.

## Historical collection

Start with the existing Fux material and Albrechtsberger's teaching of Beethoven.
Add Mozart’s teaching of Thomas Attwood as another candidate aggregation:
harmony, species counterpoint, canon, and free-composition exercises, preserving
Attwood’s work separately from Mozart’s models and corrections. Verify fugue
materials separately rather than assuming a complete published fugue course.
Add verified Haydn-related studies afterward. Research Bach as a later course
involving chorales, imitation, and freer counterpoint; do not invent a collection
of “Bach species assignments” from unrelated compositions.

For each candidate, establish the manuscript or printed source, given voice,
assignment, attribution, and editorial state before shipping an exercise.
Distinguish a documented lesson association from evidence that a particular
teacher composed or personally assigned the melody.

Each historical cantus/exercise needs:

- A stable identifier and connection to other exercises using the same melody.
- Teacher/student attribution and its evidence, including uncertainty.
- Work or collection title, catalog/shelfmark, page or folio, and scan URL.
- Edition or pinned transcription revision and file checksum.
- Original pitch, rhythm, accidentals, voice roles, and any correction layers.
- A record of access/reuse terms for the actual material being bundled.
- A label: **Historical assignment**, **Practice adaptation**, or **Generated**.
- Every transposition, rhythmic adjustment, or other adaptation recorded as a
  transformation, with the original preserved.
- A reviewed realization if available, its attribution, and the applicable
  teaching profile. A generated witness must not be presented as Beethoven's work.

Transcribe from accessible source material and visually compare the notation
with its scan. Check pitch, accidental scope, rhythm, ties, clefs, and voice
roles. Do not rewrite a source realization merely to make the current checker
accept it. Separate a student's original writing from a teacher's corrections
when the evidence supports that distinction.

Historical tasks can have three readiness states: ready for graded practice,
available for source study with explained limitations, or awaiting research.
Only reviewed, gradeable tasks enter assessed practice. Optional historical
challenges do not delay unlocking generation.

Initial research references:

- [Existing Fux transcription collection](https://github.com/MarkGotham/species),
  pinned locally at `5c7cae40422bd5ed897a2be3b916a7bc1a2a2df7`.
- [Beethoven composition studies, edited by Julia Ronge](https://www.henle.de/de/Abt.-13-Bd.-1-Kompositionsstudien-bei-Joseph-Haydn-Johann-Georg-Albrechtsberger-und-Antonio-Salieri/HN-4461):
  the scholarly edition includes transcriptions, critical commentary, and
  reproductions for the Haydn, Albrechtsberger, and Salieri studies.
- [Henle's composition-studies catalog entry](https://www.henle.de/media/03/db/bf/1704363984/2207_2_641-643.pdf):
  documents the edition history and describes Seyfried's earlier publication as
  substantially reworked. Older printed collections require source comparison.
- [Hess 234 research overview](https://www.lvbeethoven.org/hess234/): identifies
  about 125 strict-counterpoint exercises on two cantus melodies, in F major
  and D minor. Use this as a discovery aid; verify the selected notes and lesson
  attribution against the underlying sources before import.
- [Mozart–Attwood studies, Neue Mozart-Ausgabe X/30/1](https://dme.mozarteum.at/DME/nma/nma_toc.php?l=2&vsep=223),
  Bärenreiter BA 4543 (1965), with the critical report (1969): candidate source
  for historical assignments and teacher correction layers. The edition
  distinguishes Attwood’s writing in black from Mozart’s in red. Review each
  assignment’s attribution, notation, editorial interpretation, and reuse terms
  before importing it. This is a planned aggregation, not an implemented course.
- [Bärenreiter's Inventions and Sinfonias preface](https://www.barenreiter.co.uk/prefaces/9790006465811_Innenansicht.pdf):
  supports the teaching context for Bach's keyboard and composition materials.
  It does not establish a species-cantus exercise bank.

## Data and persistence

Introduce explicit records while retaining compatibility with existing scores:

| Record | Responsibility |
| --- | --- |
| Cantus | Stable melody identity, spelled notes, mode/final, original register, provenance, and melody fingerprints. |
| Exercise assignment | Cantus ID, total voices, given-voice position, per-voice species/rhythm, profile, explicit requirements, and difficulty. |
| Attempt | Learner notes, assignment ID, resume state, and existing score data. |
| Completion award | Study ID, passing attempt snapshot or retained evidence, completion time, curriculum version, and checker/profile version. |
| Unlock | Species and voice count, earned time, and supporting completion awards. |
| Generation metadata | Reproducible random seed, generator/profile versions, chosen settings, witness solution, and validation result. |

Model an identity-bearing cantus separately from its placement in a score.
Transposing a historical melody creates a documented variant rather than a new
historical attribution. Explicit reuse creates a new assignment/attempt without
losing the original attempt.

On migration, reassess existing Path attempts and award credit to qualifying
completed work. Do not trust saved `verified` booleans or count catalog solutions.
The active recovery draft overrides an older saved copy for current assessment.
Persist awards after a confirmed pass, not during a pending or stale worker
result. Store enough completion evidence that later edits to the attempt do not
erase earned access.

Version backup data to include awards, unlocks, and generation metadata; continue
to import old backups and reconstruct qualifying credit. Merge awards
idempotently. Restoring a backup must preserve existing notes and earned unlocks.

## Independent cantus generation

Replace source-note mutation with a reproducible, constrained melody search:

1. **Select a supported assignment.** Confirm its unlock, teaching profile,
   species, voice count, mode, given-voice position, and per-voice rhythms.
2. **Plan the melody.** Initially use 8–12 whole-note measures, a suitable
   register, a modal final, a cadence, and a broad contour. Start with a small
   tested set of lengths and modes; expose only supported choices.
3. **Construct pitches with backtracking.** Favor connected melodic motion and
   prune prohibited intervals, unworkable endings, and range problems early.
   Make decisions from musical constraints, not edits to a historical melody.
4. **Assess the cantus itself.** Apply definite rules and explicit assignment
   requirements. Treat contour, repetition, leap recovery, and climax preferences
   as generation-quality criteria where the teaching profile treats them as
   advice; do not invent universal historical prohibitions.
5. **Check novelty.** Compare exact melody and normalized interval contour with
   recent generated work. Reject duplicates and simple register/transposition
   substitutes. Rank similarity to avoid changing only one note repeatedly.
   Intentional “Use this cantus again” bypasses novelty filtering.
6. **Build the actual exercise.** Create appropriate rhythms, ties, rests,
   positions, and companion-voice assignments for this species and texture.
7. **Find a witness solution.** Solve the exact assignment, including its given
   voice position. Correct tie handling must constrain connected pitches during
   search rather than waiting for a finished invalid solution.
8. **Validate before delivery.** Reassess the complete witness and the immutable
   given melody using the current profile. Require complete timing/coverage,
   valid assignment structure, and no errors or unresolved context.
9. **Return only the prompt.** Preserve the checked witness separately and leave
   the editable voices blank with their assigned rests/ties intact.

For beginner difficulty, prefer assignments for which the search finds multiple
meaningfully different valid realizations. Finding one witness establishes
feasibility; failing to find a second within a budget does not prove uniqueness.
Do not advertise solution counts the search has not established.

Run generation in a dedicated cancellable worker so a longer search cannot stall
live checking. Set both node and elapsed-time budgets, report useful progress,
and discard stale results after cancellation or settings changes. Begin with a
six-second interactive budget and benchmark it on the target Mac before tuning.

If search reaches its limit, retain the current draft and explain that no
verified exercise was found in the allotted search. Offer retry or other
supported settings. Never return the old cantus as a purported new one, and
never call a timed-out search proof that no solution exists.

## Path and exercise interface

- Keep only the last-worked species expanded on entering the Path. Cantus firmus
  is expanded only when that was the last-worked section.
- Within a species, show the two-, three-, and four-voice groups with guided
  completion counts and their generation access state.
- Locked text: “Complete these 3 guided studies to unlock generated practice.”
  Link directly to the remaining study rather than presenting a dead control.
- Unlocked text: “Generated practice unlocked” with a clear action.
- Preserve Started badges, current-study identification, and green Checks passed
  labels. Show “Completed previously · review available” when appropriate after
  a rule change; keep the generated-practice access available.
- After completing a group's final requirement, show the unlock and the actions
  “Generate a cantus” and “Continue the guided path.”
- In New exercise, explain three choices: a specific existing example, a
  different existing cantus, or a generated cantus. Use unique melody counts
  rather than presenting duplicate adaptations as extra cantus variety.
- Explain that opening a specific example keeps its given melody and blanks
  editable parts. Historical version labels such as Figure 6 “corrected” need
  their source explanation; they do not describe the learner's work.
- Apply unlock policy to every generator entry point. Existing generated
  attempts remain resumable regardless of access to creating new exercises.
- Historical cards expose teacher/student context, readiness, and source links.
  After completion, offer side-by-side notation and playback of the learner's
  work and a documented realization. Describe it as one realization, not the
  only acceptable answer. Teacher corrections are shown only when verified.

## Implementation sequence

### 1. Curriculum and completion foundation

Add versioned group requirements, completion awards, and unlock derivation to
`src/path.ts` and a small persistence module. Extend the worker's progress
response and `server.mjs` storage/backup endpoints. Migrate qualifying existing
attempts. Keep record changes optional or provide explicit migration; do not
invalidate old score JSON.

Deliverable: the 15 groups show correct progress and earned access that survives
reload, subsequent edits, and backup restoration.

### 2. Path and creation workflow

Update `src/main.tsx`, `src/style.css`, and the relevant panels to expose progress,
unlock states, generator access, and clear example selection. Consolidate status
calculation so badges, buttons, and completion notices use the same assessment.
Preserve last-worked expansion, autosave, keyboard entry, and mobile layout.

Deliverable: a learner can see exactly what remains and enter generated practice
without losing the current exercise.

### 3. Cantus records and historical pilot

Add the cantus/provenance registry and map existing Fux examples to shared melody
identities. Add source import/audit tooling and preserve original files.
Research and transcribe a small Albrechtsberger–Beethoven pilot, verifying the
two Hess 234 cantus candidates before choosing gradeable assignments.

Define a separate historical profile only where sufficient source evidence and
tests exist. Clearly mark any Fux-profile practice adaptation. Keep unsupported
originals in source-study mode. Pilot availability must not block generation work.

Deliverable: sourced historical cantus records, accurately labeled tasks, and
an audit showing which tasks can be graded and which need further research.

### 4. Independent generator: two voices

Extract generation from `src/exercises.ts` into focused modules for reproducible
randomness, cantus construction, novelty, assignment construction, and search.
Reuse the musical model and checker. Add the dedicated generator worker and
cancellation handling. Start with two-voice first species and then cover II–V.

Deliverable: new melodies with checked witnesses for each released combination,
with deterministic reproduction and explicit failure behavior. Keep unsupported
settings unavailable with an explanation instead of silently substituting them.

### 5. Fuller textures and comparison

Extend search to three and four voices with explicit per-voice assignments and
cadential templates. Release each combination after its verification matrix
passes. Add historical realization comparison and deliberate reuse of a cantus
across unlocked assignments. Add verified Haydn-related tasks after the pilot.

Deliverable: all 15 species/voice-count combinations supported, plus historical
comparison for the imported tasks that have documented realizations.

### 6. Documentation and release checks

Update `README.md`, `RULES.md`, source manifests, credits, and backup documentation.
Record the generator's supported settings, search limits, tested coverage, and
remaining historical questions. Run required unit tests, source audits, build,
and browser workflows against a temporary database.

## Verification and acceptance

Test meaningful contracts rather than mirroring helper implementations:

- Partial, invalid, unresolved, stale, and model-preview states cannot earn a
  completion. Passing learner work earns one award, with suggestions allowed.
- Completing exactly the configured studies unlocks only that species/voice
  group. Existing passing work receives credit on migration.
- Earned access survives checker updates, subsequent edits, reloads, and old/new
  backup restoration. Failed writes never announce a durable unlock.
- Generated prompts have a complete locked cantus, correct assigned rhythms,
  blank editable pitches, a matching valid witness, and no historical attribution.
- Replaying a recorded seed under the same versions reproduces the candidate;
  search budgets use controlled node limits in deterministic tests.
- Exact repetitions, octave shifts, and near-duplicate melodies are detected;
  deliberate cantus reuse remains possible.
- Independent allowed/prohibited musical fixtures and reviewed historical
  examples test the checker. Solver-produced answers are not its only oracle.
- Benchmark a fixed matrix of modes, positions, lengths, species, and voice
  counts. Record success/failure rate, time, distinct contours, and representative
  scores. Audit repetitive or awkward output by notation and listening.
- Timeout, cancellation, settings changes, and no-result cases preserve the
  draft. Checking and playback remain responsive during generation.
- Historical originals match their scans and retain their provenance. Adapted
  notes, teacher corrections, and generated realizations are labeled accurately.
- Browser workflows cover completion → unlock → generation → writing → saving
  → resume, plus historical comparison and cantus reuse in another assignment.
- Check both themes and narrow screens, including green completion labels,
  Started markers, keyboard access, and the default collapsed Path sections.

Initial scope excludes a full Bach course, fugue generation, new audio assets,
accounts, and an AI service dependency. Historical coverage is reported by
verified usable assignments and distinct cantus melodies, not inflated by the
number of realizations of the same melody.
