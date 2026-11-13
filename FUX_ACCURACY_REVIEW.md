# Fux accuracy review — 8 November 2026

## Verdict

v7 cannot be certified as an exact implementation of Fux's intentions. It combined historically grounded checks, modern melodic prescriptions, exercise requirements, and incomplete interpretations of fuller textures. v8 removes the unsupported melodic prescriptions, restores reproducible current audit results, and retains the outstanding questions. A pass means that the implemented checks passed; it is not a comprehensive Fux certification.

This review examined `src/rules.ts`, the finding explanations, existing independent motif tests, the evidence ledger, and freshly assessed results for all 123 unmodified historical transcriptions. It consulted the searchable Latin of the 1725 edition for the passages listed below and visually inspected the original printed pp.54 and 60. It did not re-transcribe or independently verify every note of the entire book. With no Git history, the exact sequence of v6-to-v7 edits cannot be established.

## What the version mismatch actually meant

Before making changes, every v7 historical assessment had the same findings and status as the stored v6 assessment. Only the version label differed. The historical totals were 105 passes, 13 needing review, and 5 retaining violations. Thus the two failing tests were stale-version/audit failures, not evidence of a changed historical verdict. They still needed correction, because stale artifacts cannot be treated as current evidence.

## Source checks and conclusions

Authority: [Fux, Gradus ad Parnassum, Vienna, 1725, Wienbibliothek](https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035). References below use printed Latin-edition pages, not PDF page indices or Mann's English-edition pages. [Searchable original text](https://www.digital.wienbibliothek.at/wbrobv/download/ftpack/plain/4118035).

| Question | Primary evidence | Result |
|---|---|---|
| Similar motion into perfect consonances in two-voice first species | p.42, first and third rules; pp.49–50 explain hidden fifths and the octave-to-fifth case | The hard first-species check is justified. An upper voice moving by step is not an automatic exemption from these rules. |
| Beginning above or below the given voice | pp.46–49; p.49 explicitly corrects a lower opening fifth because it changes the mode | The position-sensitive opening restriction is supported. |
| Two-voice cadence | p.46 requires a major sixth with the cantus below, minor third with it above; pp.56–57 describe the second-species penultimate bar; p.61 discusses its Phrygian exception | The basic major-sixth/minor-third framework is supported, but the present check is not a full implementation of every species-specific penultimate-bar requirement. |
| Major sixth versus minor sixth | p.53 rejects the major-sixth leap; pp.59–60 allow the minor sixth or octave to regain contrary motion | Do not conflate major and minor sixths. The p.60 prose does not specify an ascending-only restriction. The existing ledger also identifies printed descending minor sixths. Applying the allowance in every context remains an implementation generalization, not an exhaustive statement of Fux's intentions. |
| Interior unison versus octave battuta | pp.53–54 distinguish the optional stepwise octave battuta from forbidden interior unisons and objectionable larger contrary leaps into the octave/unison | The first-species interior-unison check is supported. The full contrary-leap case is not implemented; ordinary parallel checks cannot cover it. |
| Unique climax, maximum tenth, automatic immediate stepwise leap recovery | v7's climax explanation explicitly cited a modern theory course; the cited Fux passages do not establish these automatic prescriptions | Removed all three automatic melodic suggestions from this Fux-only profile. Their removal does not disable checks for prohibited melodic intervals. |

## Changes made in v8

- Removed automatic `climax`, `range`, and `leap-recovery` findings. Removed the modern contour-source attribution and revised lesson text to describe the actual scope.
- Retained explicit introductory exercise requirements as exercise requirements, rather than attributing them to a universal Fux rule.
- Updated the rule version and stale expectation; regenerated historical assessments without changing the original score data or original disagreement evidence.
- Made the audit runner's dependency imports compatible with the documented `node scripts/audit_sources.ts` command.
- Retained source-specific exceptions and unresolved findings instead of changing scores or adding figure-ID exemptions to obtain passes.

## Remaining obstacles to exact fidelity

1. **Species-specific cadence detail:** the two-voice cadence test accepts either major sixth or minor third, rather than fully enforcing the given-voice position and each species' full penultimate-bar formula. Phrygian and crossing cases need particular care before tightening this.
2. **Contrary leaps into octaves/unisons:** pp.53–54 contain a distinction not represented by the present similar-motion checks. This needs dedicated motifs and source-example comparison.
3. **Fuller harmony:** upper-voice fourths and tritones are admitted using a broad bass-context test. Complete chord disposition, constrained voice leading, and all multivoice exceptions are not exhaustively represented.
4. **Simultaneous moving-voice dissonances:** Figures 134, 183, 186, 203, and 204 still retain findings that the current simple treatment does not settle. They must not be advertised as proven errors by Fux.
5. **Accidentals and editorial interpretation:** musica ficta, cross-relations, accidental scope (including Figures 169–170), and the Figure 55 clef/erratum issue remain partly unresolved. The review state is appropriate where the implementation cannot decide.
6. **Cantus assumptions and locked voices:** the checker is designed around supplied cantus firmi; it does not apply all melodic checks to locked voices. Its introductory cantus recipe is a local assignment, not a complete historical theory of acceptable cantus firmi.

These are concrete limits on a claim of exactness. They are not resolved merely by updating a version number or by making all historical examples pass.

## Reproduction

Run `node scripts/audit_sources.ts`, `npm test`, and `npm run build`. The source preservation hash and the original 46-disagreement ledger remain guarded by tests. Current numerical results are recorded in `public/sources/fux-review.json`. After the corrections, all 103 tests pass and the production build succeeds; the historical verdict totals remain 105 pass, 13 needs-review, and 5 violations.
