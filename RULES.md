# Fux contextual practice profile v9

Authority: Fux, *Gradus ad Parnassum* (Vienna, 1725), especially printed pp. 41–42 and the two-, three- and four-part exercises in Book II. [Primary text and scans](https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035). App explanations and examples are original. Parnasso's saved frontend informed the comparison; it is not the rule authority or an expected-result oracle.

## Runtime contract

Checking is always active and never blocks note entry. Results carry `fux-1725-v9`. A blank slot is unknown, not a rest. Checks needing an unknown pitch or bass wait; selection and hover do not alter the score. Results distinguish incomplete writing, definite violations, unresolved contextual questions (`needs-review`), and passing the implemented checks. Craft advice alone does not prevent a pass. Old results cannot announce a pass while an edit is being checked.

Findings identify the affected voices, pitches, bars and beats, distinguish rules, craft advice, study requirements and review questions, and link to an original lesson with a playable example and source pages. Positive feedback waits for a complete score without errors or review questions. Lesson fragments illustrate a local idea; they are not complete assessed compositions.

For a dissonance between a newly attacked note and a held note, feedback names the moving voice whose treatment is being checked. Both interval partners remain highlighted; the held partner is not being required to approach or depart by step. The same passing-tone test applies when the moving counterpoint is the bass. In the strict Fux profile (pp.63–64), G–F–E–D above a held B fails the consonant-anchor requirement for F and E; the broader allowance for consecutive passing dissonances in some modern teaching profiles is not enabled here.

Existing attempts retain their notes and timing. Optional per-voice species metadata is restored from the source or retained assignment when possible. Mixed-species studies and whole-note companions keep their own assignments. MusicXML exports retain per-voice species and given-voice roles; ordinary imports use the selected species. Saved `verified` flags are not proof: templates, model previews and path progress are reassessed with current rules. A retained answer must match the draft's rhythm before it can be previewed. Searches accept only complete current passes; a timeout means unknown, never impossible.

## Musical judgments

| Area | Implemented checks | Context and limits |
|---|---|---|
| Harmony | Spelled consonances and supported dissonance figures | The actual sounding bass determines upper-voice fourths and permitted tritones. Missing context postpones judgment. |
| Perfect motion | Actual adjacent parallels; structural parallels differentiated by species; direct perfects in two-voice first species | Second-species structural parallels are required checks in two voices. Third-species and fuller structural reductions receive craft guidance. In three and four voices, similar motion into a perfect interval receives contextual review even when the upper voice steps; a step alone does not establish Fux's exception. Actual parallels remain errors. |
| Melody | Interval spelling and singable interval sizes; prohibited augmented/diminished leaps, major sixths and sevenths | Minor sixths are admitted in both directions (p.60). Same-letter chromatic motion needs context review. No automatic tenth-range, immediate leap-recovery, or unique-climax advice is emitted: those prescriptions have not been established from the cited Fux passages. |
| Repetition | Repeated untied attacks in second, third and fourth species | First-species repetition and florid rearticulation receive craft advice. No invented numeric ceiling: corrected Figure 15 retains three G attacks (pp.53–54). |
| Passing notes | Weak-half dissonances pass by same-direction steps between consonances | A second-species dissonant neighbour is not accepted. Third-quarter dissonance requires consonant second and fourth quarters. |
| Neighbours/cambiata | Weak-quarter neighbours and descending cambiata on quarter two with consonant anchors | Shifting the same outline to an unsupported beat loses the exception. General decorated multivoice dissonances are not fully modeled. |
| Modal inflections | Cadential leading tones and supported modal contexts | A scale test cannot settle all musica ficta. Unsettled pitches are review questions, preventing a clean pass. No blanket hard verdict based only on scale membership. |
| Rhythm | Per-voice species values, rests, endings, ties and florid eighth groups | Whole-note companions and mixed assignments are retained. Multivoice cadential ties, delayed entries and supported rests in suspension studies are admitted. |
| Suspensions | Pitch and spelling through ties; preparation, holding and downward resolution | Preparation uses harmony at its own time. Fourth species requires syncopation. Multiple chain breaks receive advice rather than a universal once-only prohibition. The stationary-bass multivoice preparation exception is supported (pp.106–107). |
| Cadences | Position-dependent two-voice approach, final bass/sonority and a stepwise multivoice arrival | Phrygian keeps its natural alternative. A cadential diminished fifth in fuller texture requires the actual leading-tone bass and downward upper resolution to a major third (pp.95–96); missing resolutions wait. |
| Florid ornament | Stepwise eighth groups and the consonant-entry descending-third/return figure | The latter requires its specific two upward steps and harmonic context (pp.112–113). Arbitrary leaps into eighths remain errors. |
| Cantus studies | Assigned modal final; introductory stepwise-ending requirement | The stepwise ending is explicitly a study requirement. General imported cantus writing receives advice rather than an invented universal Fux law. |

## Evidence and remaining questions

Full-sonority advice applies only to consonant downbeats in fuller textures. A suspension's temporary dissonance does not receive this advice; its preparation and resolution are checked separately, and missing resolution pitches defer those judgments.

[SOURCE_REVIEW.md](SOURCE_REVIEW.md) records the original 46 disagreements and their manually reviewed source evidence. The machine-readable [evidence ledger](public/sources/fux-review.json) retains original v2 findings, classifications, scan links and current results. [The corpus audit](public/sources/fux-audit.json) covers all 123 transcriptions. The 33 relevant scan pages were inspected and their context checked in the primary text. A SHA-256 guard protects the original transcription file; no source pitches, timings, rests or ties were rewritten to improve results. No figure ID exempts music from checks.

The current audit has 106 passes of implemented checks, 12 contextual review results and 5 examples retaining violations. These are not independent certifications. Unsettled simultaneous dissonances in Figures 134, 183, 186, 203 and 204 remain explicit gaps. Figure 55 retains its editorial clef/erratum question. Ficta and historical accidental scope still require source judgment. Cross-relations, every multivoice cadence variant, simultaneous decorated suspensions and full contextual harmonic completeness are not exhaustively modeled.

Run `node scripts/audit_sources.ts` to refresh current results without changing evidence or music. Run `node scripts/curate.ts` to regenerate the 48 practice adaptations; they remain adaptations, not corrections to Fux. Independent allowed/prohibited motifs supplement historical regression cases, so generation does not test itself as its only oracle.

Later Mozart/Attwood, Jeppesen, Gauldin, Salzer/Schachter, Gédalge/Mann and Bach courses require separate teaching profiles. They must not silently change this modal Fux profile.

## Accuracy review — 8 November 2026

See [FUX_ACCURACY_REVIEW.md](FUX_ACCURACY_REVIEW.md) for the v7 examination and v8 corrections. The v7 historical corpus findings were identical to the stored v6 findings apart from the version label; the two failing tests did not establish a musical regression. v8 removes unsupported modern melodic prescriptions and refreshes all current assessments. It does not certify the remaining historical interpretation gaps as settled.

## Historical notes and continuation — v9

Editorial observations about the original print are optional historical reading, separate from musical findings. They do not change an attempt’s assessment or prevent moving on. The original editorial metadata remains preserved. Complete, assessed attempts without definite musical violations offer the next exercise even when a musical context question remains; that question stays visible and is not counted as a pass. Historical notes use learner-facing language rather than data-field references.
