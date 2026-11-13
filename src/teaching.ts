import {
  type Score,
  type Finding,
  type Pitch,
  assignedSpecies,
  degree,
  label,
  midi,
} from "./model.ts";

export const FUX_URL =
  "https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035";
type Lesson = {
  id: string;
  title: string;
  summary: string;
  why: string;
  action: string;
  pages: string;
};
export const lessons: Lesson[] = [
  {
    id: "openings",
    title: "Establish the mode",
    summary: "Choose the opening consonance and the bass foundation.",
    why: "In two voices, the position of the given line matters: a fifth above it can establish the mode, while a fifth below changes the foundation. In a fuller texture, hear the whole opening chord from its bass.",
    action:
      "Above the cantus, try its unison, fifth or octave. Below it, try its unison or octave. For three or four voices, build the opening on the modal final in the bass.",
    pages: "46–49, 82–90",
  },
  {
    id: "motion",
    title: "Hear independent voices",
    summary: "Distinguish parallel, similar, contrary and oblique motion.",
    why: "Two moving voices can arrive at the same kind of perfect interval in parallel. Contrary motion moves them in opposite directions; oblique motion leaves one voice still. These are different musical events.",
    action:
      "Compare both voices before and after the interval. In two-voice first species, approach perfect consonances by contrary or oblique motion. In higher species, also listen to the structural beats and the intervening notes.",
    pages: "41–42, 49–50, 57–60, 94–98, 104–106",
  },
  {
    id: "melody",
    title: "Shape a singable line",
    summary: "Balance steps, leaps, recovery and range.",
    why: "A line should be singable in its own right. Fux prohibits the major sixth and seventh in his corrections; the minor-sixth leap is explicitly available in the later discussion.",
    action:
      "Sing the line alone. After a large leap, consider stepping back. Use the actual spelling to distinguish a minor sixth from a major sixth or an augmented interval.",
    pages: "51–55, 59–60",
  },
  {
    id: "passing",
    title: "Connect consonances by step",
    summary: "Place a passing dissonance between consonant anchors.",
    why: "In second species the weak half note can fill a third between two consonances. Third species gives more positions, but a run of quarters still has a consonant framework.",
    action:
      "Write the consonant notes first, then fill the gap by step in the same direction. A dissonance on the third quarter needs consonant second and fourth quarters around it.",
    pages: "56–59, 63–64",
  },
  {
    id: "neighbours",
    title: "Step away and return",
    summary:
      "Use a weak-quarter neighbour without losing the consonant framework.",
    why: "A neighbour returns to its starting pitch. It is different from a passing tone, which connects two different pitches. The third quarter is not interchangeable with the weaker second and fourth quarters.",
    action:
      "On a second or fourth quarter, step away from a consonance and return to the same pitch. On the third quarter, use the supported passing treatment instead.",
    pages: "63–65",
  },
  {
    id: "cambiata",
    title: "Recognize the cambiata",
    summary:
      "A specific descending figure permits leaving a dissonance by a third.",
    why: "The cambiata is a named exception, not a general license to leap away from any dissonance. Fux places the dissonance on the second quarter and explains the consonant framework around it.",
    action:
      "From a consonance, step down on the second quarter, descend a third to a consonance, then step up. Check the position and the surrounding consonances as well as the melodic outline.",
    pages: "64–66",
  },
  {
    id: "suspensions",
    title: "Prepare, hold, resolve",
    summary:
      "Tie a prepared note across the barline and resolve a dissonance downward.",
    why: "Fourth species is defined by syncopation. A consonant preparation is held into the next harmony; if it becomes dissonant, the delayed note resolves down by step. Fux also discusses consonant ties, breaks, and a stationary-bass exception in fuller textures.",
    action:
      "Check the preparation against the harmony at its own time, keep the same pitch through the tie, and write the resolution. A chain made entirely of untied half notes is second species.",
    pages: "69–75, 104–110",
  },
  {
    id: "cadences",
    title: "Plan the ending first",
    summary:
      "Let the modal final and the voice positions determine the approach.",
    why: "The two-voice ending normally expands a major sixth to an octave, or contracts a minor third to a unison. The Phrygian semitone lies in a different place. Three and four voices need a complete cadential texture, not just a correct final chord.",
    action:
      "Write the final and its approach before filling the middle. Normally one voice rises by semitone to the final; retain the natural Phrygian alternative. Check the sounding bass and the other voices too.",
    pages: "46–48, 56–62, 65–66, 73–75, 89–90",
  },
  {
    id: "florid",
    title: "Mix rhythms with purpose",
    summary: "Keep the rule of each note value while varying the motion.",
    why: "Fifth species combines the earlier species, including decorated suspensions. Fux explicitly calls his warning about two quarters followed by an untied half advice rather than a prohibition. The source also contains rearticulations and ornamental figures that a blanket ban would reject.",
    action:
      "Use consonant attacks on downbeats, supported weak-note figures, and prepared ties. Prefer short stepwise eighth-note groups; distinguish an ornament requiring review from a proven rule error.",
    pages: "76–80, 111–114, 136–138",
  },
  {
    id: "mode",
    title: "Understand an inflection",
    summary: "Read accidentals in their modal and voice-leading context.",
    why: "Fux's examples include lowered notes, raised cadential degrees and changes intended to avoid an adverse relation. A scale-membership test alone cannot decide every case of musica ficta.",
    action:
      "Identify the modal final, the direction of resolution and the other voices. If the accidental remains unclear, compare the passage with the original example.",
    pages: "54–55, 68–69, 89–92",
  },
  {
    id: "cantus",
    title: "Give one melody a direction",
    summary: "Establish a final and make a deliberate approach to it.",
    why: "Fux permits taking a cantus from chant or inventing one. Our introductory cantus studies additionally ask for a stepwise ending; that is an exercise requirement, not a claim that Fux states a complete universal cantus recipe.",
    action:
      "Begin and end on the assigned final, plan a stepwise ending, and sing the middle for shape.",
    pages: "45–46; introductory exercise requirement",
  },
];
export function lessonById(id?: string) {
  return lessons.find((l) => l.id === id) || lessons[0];
}

const ruleLessons: Record<string, string> = {
  "extended-tie": "suspensions",
  boundary: "openings",
  opening: "openings",
  "opening-bass": "openings",
  "opening-sonority": "openings",
  parallels: "motion",
  "direct-perfect": "motion",
  "downbeat-parallels": "motion",
  "interior-unison": "motion",
  crossing: "motion",
  "melodic-interval": "melody",
  repetition: "melody",
  "full-sonority": "openings",
  dissonance: "passing",
  "chromatic-clash": "mode",
  mode: "mode",
  "chromatic-motion": "mode",
  "source-editorial": "mode",
  tie: "suspensions",
  "species-tie": "suspensions",
  "suspension-chain": "suspensions",
  "broken-suspensions": "suspensions",
  cadence: "cadences",
  "leading-tone": "cadences",
  "cadential-interval": "cadences",
  "final-bass": "cadences",
  "final-sonority": "cadences",
  "multivoice-cadence": "cadences",
  "final-rhythm": "cadences",
  "doubled-leading-tone": "cadences",
  "species-rhythm": "florid",
  "eighth-placement": "florid",
  "eighth-step": "florid",
  "rest-placement": "florid",
  "modal-final": "cantus",
  "cantus-final": "cantus",
  "cantus-cadence": "cantus",
};
export function explainFindings(s: Score, findings: Finding[]): Finding[] {
  return findings.map((f) => {
    let id = ruleLessons[f.rule] || "melody";
    const located = s.voices.flatMap((v) =>
      v.notes.filter((n) => f.notes.includes(n.id)).map((n) => ({ v, n })),
    );
    if (f.rule === "dissonance" && located.some(({ n }) => n.tieStop))
      id = "suspensions";
    const lesson = lessonById(id);
    const details = located
      .slice(0, 6)
      .map(
        ({ v, n }) =>
          `${v.name}: ${n.rest ? "rest" : label(n.pitch)}, bar ${Math.floor(n.time / 8) + 1}, beat ${1 + (n.time % 8) / 2}`,
      )
      .join("; ");
    const review =
      (f.rule === "extended-tie" && f.severity === "suggestion") ||
      f.rule === "mode" ||
      f.rule === "chromatic-motion" ||
      f.basis === "review";
    return {
      ...f,
      lessonId: id,
      basis: review
        ? "review"
        : f.rule === "cantus-cadence" && s.requirements?.stepwiseCantusEnding
          ? "exercise"
          : f.severity === "suggestion"
            ? "craft"
            : "rule",
      details,
      action: lesson.action,
      source:
        f.rule === "source-editorial"
          ? f.source
          : `Fux (1725), pp. ${lesson.pages}.`,
      reference: {
        title: "Gradus ad Parnassum (1725)",
        url: f.rule === "source-editorial" && s.source ? s.source.url : FUX_URL,
        pages:
          f.rule === "source-editorial" && s.source?.page
            ? String(s.source.page)
            : lesson.pages,
      },
    };
  });
}

export function studyLesson(s: Score): Lesson {
  if (s.cantusOnly) return lessonById("cantus");
  const index = Number(s.id.match(/practice-\d-\d-(\d)/)?.[1] || 0) % 3;
  const focus: Record<number, string[]> = {
    1: ["openings", "motion", "cadences"],
    2: ["passing", "motion", "cadences"],
    3: ["passing", "neighbours", "cambiata"],
    4: ["suspensions", "suspensions", "cadences"],
    5: ["florid", "suspensions", "cadences"],
  };
  return lessonById((focus[s.species] || focus[1])[index]);
}
export function guidance(s: Score, id: string): string {
  const v = s.voices.find((v) => v.notes.some((n) => n.id === id));
  const n = v?.notes.find((n) => n.id === id);
  if (!v || !n || v.locked)
    return "Select an editable note to see guidance for its place in the exercise.";
  if (s.cantusOnly)
    return n.time === 0
      ? "Begin on the final of the assigned mode."
      : n.time >= (s.bars - 2) * 8
        ? "Plan a stepwise approach to the final, then sing the ending."
        : "Sing the line alone. Connect steps and leaps into a clear shape.";
  if (n.time >= (s.bars - 2) * 8)
    return "Cadence: identify the final, then plan its stepwise approach and the other voices around it.";
  if (n.time < 8)
    return "Opening: establish the mode. Above the given line, try a perfect consonance; below it, a unison or octave. In several voices, hear the chord from the bass.";
  const sp = assignedSpecies(s, v);
  if (n.tieStop)
    return "This note continues a tie. Check its preparation; if it is dissonant now, resolve it down by step.";
  if (sp === 4)
    return "Prepare the next tie on this half note. Check its consonance now and its resolution in the following bar.";
  if (n.time % 8 === 0)
    return "Struck downbeat: make the harmony consonant, checking every sounding voice and the actual bass.";
  if (sp === 2)
    return "Weak half note: a dissonance must connect two consonances by step in the same direction.";
  if (sp === 3 && n.time % 8 === 4)
    return "Third quarter: a dissonance must pass by step in the same direction between consonant second and fourth quarters.";
  return "Weak note: choose a supported passing, neighbour or cambiata figure; keep the consonant anchors clear.";
}
export function musicalStrengths(s: Score, findings: Finding[]): string[] {
  if (
    s.voices.some((v) => v.notes.some((n) => !n.pitch && !n.rest)) ||
    findings.some((f) => f.severity === "error" || f.basis === "review")
  )
    return [];
  let steps = 0,
    moves = 0,
    ties = 0;
  for (const v of s.voices.filter((v) => !v.locked))
    for (let i = 0; i < v.notes.length; i++) {
      const n = v.notes[i],
        p = v.notes[i - 1];
      if (n.tieStop) {
        ties++;
        continue;
      }
      if (n.pitch && p?.pitch && !n.rest && !p.rest) {
        moves++;
        if (Math.abs(degree(n.pitch) - degree(p.pitch)) === 1) steps++;
      }
    }
  const result = moves
    ? [
        `${steps} of ${moves} melodic moves are steps. Listen to how the leaps connect them.`,
      ]
    : [];
  if (ties)
    result.push(
      `${ties} tied continuations retain their written pitch with supported preparation and resolution.`,
    );
  return result;
}

const P = (text: string): Pitch => ({
  step: text[0],
  alter: text.includes("#") ? 1 : text.includes("b") ? -1 : 0,
  octave: Number(text.at(-1)),
});
function fragment(
  title: string,
  top: string[],
  bass: string[],
  duration = 8,
): Score {
  const bars = Math.max(1, (top.length * duration) / 8);
  return {
    version: 1,
    id: "lesson-" + title,
    title,
    species: duration === 8 ? 1 : duration === 4 ? 2 : 3,
    mode: "Ionian",
    bars,
    voices: [
      {
        id: "top",
        name: "Upper voice",
        locked: true,
        notes: top.map((p, i) => ({
          id: `top${i}`,
          time: i * duration,
          duration,
          pitch: P(p),
        })),
      },
      {
        id: "bass",
        name: "Bass",
        locked: true,
        notes: bass.map((p, i) => ({
          id: `bass${i}`,
          time: i * 8,
          duration: 8,
          pitch: P(p),
        })),
      },
    ],
  };
}
export function lessonExamples(
  id: string,
): { title: string; caption: string; score: Score }[] {
  const data: Record<
    string,
    { title: string; caption: string; score: Score }[]
  > = {
    openings: [
      {
        title: "Perfect opening",
        caption: "An octave above the final establishes the two-voice opening.",
        score: fragment("Perfect opening", ["C5", "E5"], ["C4", "C4"]),
      },
    ],
    motion: [
      {
        title: "Parallel fifths",
        caption: "C–G moves to D–A with both voices rising.",
        score: fragment("Parallel fifths", ["G4", "A4"], ["C4", "D4"]),
      },
      {
        title: "Contrary motion",
        caption:
          "The upper voice rises while the bass falls. The motion is contrary.",
        score: fragment("Contrary motion", ["E4", "G4"], ["C4", "B3"]),
      },
    ],
    melody: [
      {
        title: "Leap and recovery",
        caption:
          "A fifth upward is answered by a step back down. This is a melodic fragment.",
        score: fragment(
          "Leap and recovery",
          ["C4", "G4", "F4"],
          ["C3", "E3", "D3"],
        ),
      },
    ],
    passing: [
      {
        title: "Passing second",
        caption:
          "D passes between E and C over a held C bass: third, second, unison.",
        score: fragment(
          "Passing second",
          ["E4", "D4", "C4", "E4"],
          ["C4", "C4"],
          4,
        ),
      },
    ],
    neighbours: [
      {
        title: "Weak-quarter neighbour",
        caption: "F on quarter two steps away from E and returns to E over C.",
        score: fragment(
          "Weak-quarter neighbour",
          ["E4", "F4", "E4", "G4"],
          ["C4"],
          2,
        ),
      },
    ],
    cambiata: [
      {
        title: "Descending cambiata",
        caption:
          "C–B–G–A over C: octave, seventh, fifth, sixth. The seventh on quarter two is left by a descending third.",
        score: fragment(
          "Descending cambiata",
          ["C5", "B4", "G4", "A4"],
          ["C4"],
          2,
        ),
      },
    ],
    cadences: [
      {
        title: "Sixth to octave",
        caption:
          "B above D forms a major sixth; C above C closes the octave by contrary steps.",
        score: fragment("Sixth to octave", ["B4", "C5"], ["D4", "C4"]),
      },
    ],
    mode: [
      {
        title: "Raised cadential degree",
        caption:
          "In Dorian, C-sharp rises to D while E falls to D. This inflection belongs to the cadence.",
        score: {
          ...fragment("Raised cadential degree", ["C#5", "D5"], ["E4", "D4"]),
          mode: "Dorian",
        },
      },
    ],
    cantus: [
      {
        title: "Stepwise ending",
        caption:
          "E approaches the D final by step. Our introductory cantus exercise asks for this kind of ending.",
        score: {
          ...fragment(
            "Stepwise ending",
            ["F4", "E4", "D4"],
            ["D3", "C3", "D3"],
          ),
          mode: "Dorian",
        },
      },
    ],
    florid: [
      {
        title: "Quarter-note figure",
        caption:
          "A passing quarter connects consonances. In florid writing its treatment still depends on its beat and note value.",
        score: fragment(
          "Quarter-note figure",
          ["G4", "F4", "E4", "G4"],
          ["C4"],
          2,
        ),
      },
    ],
  };
  if (id === "suspensions") {
    const s = fragment(
      "Prepared 4–3 suspension",
      ["C5", "C5", "C5", "B4"],
      ["A3", "G3"],
      4,
    );
    s.species = 4;
    s.voices[0].notes[0].rest = true;
    s.voices[0].notes[0].pitch = null;
    s.voices[0].notes[1].tieStart = true;
    s.voices[0].notes[2].tieStop = true;
    return [
      {
        title: "Prepared 4–3 suspension",
        caption:
          "C is consonant over A, held as a fourth over G, then resolves down to B.",
        score: s,
      },
    ];
  }
  if (id === "cantus") {
    const e = data.cantus[0];
    e.score.voices = [e.score.voices[0]];
    e.score.voices[0].name = "Cantus";
    return [e];
  }
  if (id === "florid") {
    const s = fragment(
      "Half and quarter notes",
      ["G4", "F4", "E4", "C5"],
      ["C4", "C4"],
      4,
    );
    s.species = 5;
    s.voices[0].notes = [
      { id: "top0", time: 0, duration: 4, pitch: P("G4") },
      { id: "top4", time: 4, duration: 2, pitch: P("F4") },
      { id: "top6", time: 6, duration: 2, pitch: P("E4") },
      { id: "top8", time: 8, duration: 8, pitch: P("C5") },
    ];
    return [
      {
        title: "Half and quarter notes",
        caption:
          "A half-note G leads through a passing F to E in quarters, then an octave over the bass. The third-quarter F connects two consonances by step.",
        score: s,
      },
    ];
  }
  return data[id] || data.openings;
}
