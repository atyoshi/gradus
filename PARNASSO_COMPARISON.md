# Parnasso comparison and implemented improvements

Reviewed the saved HTML and its `engine_cmj-.js` in the Parnasso subfolder. This is a browser snapshot, with rule logic and client assets; it does not establish what code or services run on Parnasso's server. The snapshot was left unchanged. Its implementation and prose were not copied into the app runtime.

## What Parnasso does well

Its feedback connects a musical event to the affected notes and explains a possible repair. It distinguishes suggestions from violations, offers lessons with audible examples, gives contextual writing guidance, and presents an ordered practice path. It also measures aspects of melodic shape and reports strengths. Those are useful teaching ideas beyond simply showing red notes.

The saved engine has separate treatment for species and fuller textures. This exposed places where our earlier shared checks flattened an important musical distinction. Its named passing, neighbour and cambiata figures were useful comparison points; expected judgments for this revision were established from Fux and independently specified musical fixtures.

## What changed here

| Area | Earlier app limitation | Implemented improvement |
|---|---|---|
| Historical authority | Some restrictive practice interpretations appeared as unconditional Fux rules | Primary-source evidence, explicit craft/study/review labels, and a preserved ledger for all 46 disagreements |
| Melody and repetition | Ascending-only minor sixth; numeric first-species repetition ceiling | Minor sixth in both directions; first-species repetition and florid rearticulation receive advice |
| Species context | A global species value could misjudge accompanying or mixed voices | Per-voice assignments survive blanking, saving, migration and MusicXML round trips |
| Weak dissonance | Melodic outline alone did not adequately establish beat and consonant anchors | Beat-specific neighbours, third-quarter framework, descending cambiata and actual harmony at each anchor |
| Suspensions and cadence | Broad restrictions rejected source-supported rests, preparations and ties | Supported stationary-bass preparation, cadential tie and diminished-fifth resolutions, delayed entries and suspension-study rests |
| Incomplete writing | A rule could decide before its necessary later harmony was written | Unknown pitches remain unknown; targeted regression tests cover bass, ornament and suspension resolution dependencies |
| Teaching | Generic findings and species summaries | Eleven original lessons, playable examples, pitch/bar/beat details, contextual guidance, lesson links and a return preserving the draft |
| Encouragement | Primarily negative feedback | Measured melodic steps and valid tied continuations, shown only after a complete result without errors or unresolved context |
| Practice progress | Species-oriented selection and stored completion flags | Skill focus per study and current-version reassessment; unresolved context does not count as passed |
| Model comparison | A retained answer could have a rhythm the user had changed | Shape compatibility check, current reassessment, and explicit display of unresolved findings |

## Where Parnasso also needs care

The saved engine's melodic interval function explicitly permits the minor sixth only upward. The primary text's p.60 allowance and printed descending examples do not support that blanket directional restriction. Its repetition explanations also make a numerical claim stronger than the corrected Figure 15 supports. Our app inherited similar problems; comparison with another implementation alone would not have corrected them.

A teaching preference, a particular exercise requirement, a textual rule and an unsettled historical reading should remain distinguishable. Rich feedback and a numerical shape score cannot by themselves settle source accuracy or compositional quality. Our implementation uses descriptive observations and leaves unresolved source questions visible, without assigning an artistic grade.

The snapshot's lessons and guided practice are strengths worth retaining as interaction ideas. The next substantial musical-analysis work is richer simultaneous dissonance treatment between moving voices, complete historical cadence variants, cross-relations and accidental scope. This revision does not claim to solve those remaining questions.

## Evidence and validation

[SOURCE_REVIEW.md](SOURCE_REVIEW.md) gives the 46 original disagreements, their scans, classifications and remaining findings. [RULES.md](RULES.md) defines the current contract. Original source music is unchanged. Unit fixtures include allowed and prohibited musical figures, rather than relying solely on a generated answer passing its own checker. Browser checks cover lesson playback and draft preservation, review status, path reassessment, note entry, saving, undo/redo and MusicXML.
