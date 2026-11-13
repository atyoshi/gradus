import {
  PlaybackSettings,
  ExerciseActions,
  StudyHelp,
} from "./WorkspaceControls";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import {
  type Score,
  type Finding,
  type Pitch,
  type Voice,
  modes,
  steps,
  degree,
  pitch,
  label,
  clone,
  blank,
  complete,
  upgradeScore,
  solutionMatches,
} from "./model";
import { lessons, studyLesson } from "./teaching";
import { LessonPanel } from "./LessonPanel";
import {
  RuleFeedback,
  ReviewFindings,
  AnalysisPanel,
  HistoricalNotes,
} from "./FeedbackPanel";
import type { MusicalAnalysis } from "./analysis";
import { pathStudy, orderedPath } from "./path";
import { ScoreView } from "./ScoreView";
import {
  enterPitch,
  toggleTie,
  tieAvailability,
  entryDuration,
  prepareEntry,
  resizeMeasure,
  restoreSelection,
} from "./entry";
import { cantus, fromCantus, cantusKey } from "./exercises";
import { exportXML, importXML } from "./musicxml";
import { play, stop } from "./audio";
import { EditorIcon } from "./EditorIcon";
import {
  nextWritingPosition,
  resetLinePattern,
  normalizeTempo,
  MIN_TEMPO,
  MAX_TEMPO,
} from "./editor";
import "./style.css";
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
let seq = 0;
const callbacks = new Map<
  number,
  { resolve: (x: any) => void; reject: (x: any) => void }
>();
worker.onmessage = ({ data }) => {
  const cb = callbacks.get(data.id);
  if (cb) {
    data.error ? cb.reject(Error(data.error)) : cb.resolve(data.result);
    callbacks.delete(data.id);
  }
};
function job(type: string, args: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    callbacks.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...args });
  });
}
async function api(path: string, body?: unknown) {
  const res = await fetch(
    "/api/" + path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Could not save");
  return data;
}
function download(name: string, body: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const speciesNames = [
  "",
  "Note against note",
  "Two against one",
  "Four against one",
  "Suspensions",
  "Florid counterpoint",
];
function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem("gradus-theme") || "system",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("gradus-theme", theme);
  }, [theme]);
  const [catalog, setCatalog] = useState<Score[]>([]),
    [library, setLibrary] = useState<Score[]>([]),
    [score, setScore] = useState<Score | null>(null),
    [selected, setSelected] = useState(""),
    [inputDuration, setInputDuration] = useState<number | null>(null),
    [findings, setFindings] = useState<Finding[]>([]),
    [validatedScore, setValidatedScore] = useState<Score | null>(null),
    [live, setLive] = useState(true),
    [view, setView] = useState("practice"),
    [lessonId, setLessonId] = useState("openings"),
    [sourceReview, setSourceReview] = useState<any>(null),
    [onlyUnsettled, setOnlyUnsettled] = useState(true),
    [progress, setProgress] = useState<
      { id: string; lessonId: string; status: string; ruleVersion: string }[]
    >([]),
    [species, setSpecies] = useState(1),
    [voices, setVoices] = useState(2),
    [mode, setMode] = useState("Dorian"),
    [pathMode, setPathMode] = useState("Any"),
    [cfPosition, setCFPosition] = useState(-1),
    [tempo, setTempo] = useState(88),
    [tempoDraft, setTempoDraft] = useState("88"),
    [instrument, setInstrument] = useState("piano"),
    [muted, setMuted] = useState<string[]>([]),
    [loop, setLoop] = useState(false),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(1),
    [time, setTime] = useState(-1),
    [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState("Loading Fux’s score collection…"),
    [notice, setNoticeMessage] = useState(""),
    [noticeTone, setNoticeTone] = useState<"error" | "status">("error"),
    [saved, setSaved] = useState(""),
    [hint, setHint] = useState(""),
    [hintLevel, setHintLevel] = useState(0),
    [model, setModel] = useState(false),
    [sample, setSample] = useState<Voice[] | null>(null),
    [sampleFindings, setSampleFindings] = useState<Finding[]>([]),
    [candidates, setCandidates] = useState<Pitch[]>([]),
    [showCandidates, setShowCandidates] = useState(false),
    [zoom, setZoom] = useState(125),
    [entryAccidental, setEntryAccidental] = useState(0),
    [candidateStatus, setCandidateStatus] = useState(""),
    [candidateSnapshot, setCandidateSnapshot] = useState<{
      score: Score;
      id: string;
      duration: number | null;
      accidental: number;
    } | null>(null),
    [analysisResult, setAnalysisResult] = useState<{
      score: Score;
      selected: string;
      data: MusicalAnalysis;
    } | null>(null),
    [review, setReview] = useState<[string, number][]>([]),
    [history, setHistory] = useState<Score[]>([]),
    [future, setFuture] = useState<Score[]>([]);
  const saveQueue = useRef(Promise.resolve());
  const setNotice = useCallback(
    (message: string, tone: "error" | "status" = "error") => {
      setNoticeMessage(message);
      setNoticeTone(tone);
    },
    [],
  );
  const current = useRef(score);
  current.current = score;
  const displayScore = useMemo(
    () => (score && model && sample ? { ...score, voices: sample } : score),
    [score, model, sample],
  );
  const [displaySettings, setDisplaySettings] = useState(false);
  const displayOpener = useRef<HTMLButtonElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const restore = useRef<HTMLInputElement>(null);
  useEffect(() => {
    Promise.all([
      Promise.all([
        fetch("/sources/fux.json")
          .then((r) => r.json())
          .then((rows) => job("catalogue", { rows })),
        fetch("/sources/practice.json").then((r) => r.json()),
      ]).then(async ([raw, practice]) => [
        ...raw,
        ...(await job("revalidate", { scores: practice })),
      ]),
      api("library"),
      api("settings"),
    ])
      .then(([cat, lib, settings]) => {
        setCatalog(cat);
        lib = lib.map((s: Score) => upgradeScore(s, cat));
        setLibrary(lib);
        setLive(true);
        setTempo(normalizeTempo(settings.tempo ?? 88));
        setTempoDraft(String(normalizeTempo(settings.tempo ?? 88)));
        setInstrument(settings.instrument || "piano");
        let recovery: Score | undefined;
        try {
          recovery = JSON.parse(
            localStorage.getItem("gradus-recovery") || "null",
          );
        } catch {}
        const first = upgradeScore(
          recovery ||
            lib.find((s: Score) => s.id === settings.lastId) ||
            lib[0] ||
            blank(cat.find((s: Score) => s.id === "gap_005")),
          cat,
        );
        setScore(first);
        setSpecies(first.species);
        setVoices(Math.max(2, first.voices.length));
        setMode(first.mode);
        setSelected(
          first.voices
            .find((v: Voice) => !v.locked)
            ?.notes.find((n: any) => !n.rest)?.id || "",
        );
        setBusy("");
      })
      .catch((e) => {
        setBusy("");
        setNotice(e.message);
      });
    return () => stop();
  }, []);
  useEffect(() => {
    if (!score) return;
    let active = true;
    // Keep the last feedback visible while checking an edit; clearing it here
    // makes the score colors and feedback panel flash on every note.
    job("check", { score }).then((result) => {
      if (active) {
        setFindings(result);
        setValidatedScore(score);
      }
    });
    return () => {
      active = false;
    };
  }, [score, live]);
  useEffect(() => {
    if (!score) return;
    try {
      localStorage.setItem("gradus-recovery", JSON.stringify(score));
    } catch {}
    setSaved("Saving…");
    const timer = setTimeout(() => {
      const snapshot = clone(score);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(async () => {
          await api("library", snapshot);
          setLibrary((xs) => [
            snapshot,
            ...xs.filter((x) => x.id !== snapshot.id),
          ]);
          if (current.current?.id === snapshot.id)
            setSaved("Saved on this Mac");
        })
        .catch((e) => setSaved("Save failed: " + e.message));
    }, 400);
    return () => clearTimeout(timer);
  }, [score]);
  useEffect(() => {
    if (score)
      api("settings", { live, tempo, instrument, lastId: score.id }).catch(
        (e) => setNotice(e.message),
      );
  }, [live, tempo, instrument, score?.id]);
  useEffect(() => {
    stop();
    setPlaying(false);
    setTime(-1);
    setFrom(1);
    setTo(score?.bars || 1);
    setMuted([]);
  }, [score?.id]);
  const edit = useCallback((fn: (s: Score) => void) => {
    setModel(false);
    setScore((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      fn(next);
      setHistory((h) => [...h.slice(-59), prev]);
      setFuture([]);
      return next;
    });
    setHint("");
  }, []);
  const select = useCallback((id: string) => {
    setSelected(id);
    const p = current.current?.voices
      .flatMap((v) => v.notes)
      .find((n) => n.id === id)?.pitch;
    if (p) setEntryAccidental(p.alter || 0);
  }, []);
  const candidateTarget =
    score && !model ? nextWritingPosition(score, selected) : undefined;
  const candidateId = candidateTarget?.id || "";
  const candidateDuration =
    score && candidateId
      ? entryDuration(score, candidateId, inputDuration)
      : null;
  const resetPattern = useMemo(
    () => (score && !model ? resetLinePattern(score, selected, catalog) : null),
    [score, selected, catalog, model],
  );
  function clearLine() {
    if (!score || !resetPattern || model) return;
    stop();
    setPlaying(false);
    setTime(-1);
    const voiceId = score.voices.find((v) =>
      v.notes.some((n) => n.id === selected),
    )!.id;
    edit((s) => {
      s.voices.find((v) => v.id === voiceId)!.notes = clone(resetPattern);
    });
    setSelected(resetPattern.find((n) => !n.rest)?.id || "");
    setInputDuration(null);
    setEntryAccidental(0);
    setNotice("Line cleared. Undo restores your work.", "status");
  }
  const setPitch = useCallback(
    (id: string, p: Pitch, advance: boolean | "unwritten" = false) =>
      edit((s) => {
        const n = enterPitch(s, id, p, inputDuration);
        if (!n) return;
        if (advance) {
          const notes = s.voices.flatMap((v) => (v.locked ? [] : v.notes));
          setSelected(
            advance === "unwritten"
              ? nextWritingPosition(s, id)?.id || id
              : notes[notes.findIndex((n) => n.id === id) + 1]?.id || id,
          );
        }
      }),
    [edit, inputDuration],
  );
  const enterCandidate = useCallback(
    (id: string, p: Pitch) => setPitch(id, p, "unwritten"),
    [setPitch],
  );
  useEffect(() => {
    if (view === "path") {
      let active = true;
      job("progress", { scores: library }).then((p) => {
        if (active) setProgress(p);
      });
      job("review", { scores: library })
        .then(setReview)
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [view, library]);
  useEffect(() => {
    setCandidates([]);
    setCandidateSnapshot(null);
    if (!showCandidates || !score || !candidateId || model) return;
    let active = true;
    setCandidateStatus("Finding locally compatible pitches…");
    job("candidates", {
      score,
      noteId: candidateId,
      inputDuration: candidateDuration,
    })
      .then((xs) => {
        if (active) {
          setCandidates(xs);
          setCandidateSnapshot({
            score,
            id: candidateId,
            duration: candidateDuration,
            accidental: entryAccidental,
          });
          setCandidateStatus(
            xs.length
              ? "Locally compatible · Future notes may change these choices."
              : "No locally compatible pitches found for this slot.",
          );
        }
      })
      .catch(() => {
        if (active)
          setCandidateStatus(
            "Pitch hints are unavailable. You can keep writing.",
          );
      });
    return () => {
      active = false;
    };
  }, [
    showCandidates,
    score,
    candidateId,
    candidateDuration,
    entryAccidental,
    model,
  ]);
  useEffect(() => {
    if (!displayScore) return;
    let active = true;
    job("analysis", { score: displayScore, selected })
      .then((data) => {
        if (active) setAnalysisResult({ score: displayScore, selected, data });
      })
      .catch(() => {
        if (active) setAnalysisResult(null);
      });
    return () => {
      active = false;
    };
  }, [displayScore, selected]);
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(".feedback");
    if (!panel) return;
    const update = () =>
      panel.classList.toggle(
        "fits-viewport",
        panel.offsetHeight <= window.innerHeight - 32,
      );
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [view, !!score]);
  const editable =
    score?.voices.flatMap((v) => (v.locked ? [] : v.notes)) || [];
  const note = score?.voices
    .flatMap((v) => v.notes)
    .find((n) => n.id === selected);
  const locked =
    model ||
    score?.voices.some(
      (v) => v.locked && v.notes.some((n) => n.id === selected),
    );
  function move(delta: number) {
    if (note && !locked)
      setPitch(
        note.id,
        pitch(degree(note.pitch || pitch(28)) + delta, note.pitch?.alter || 0),
      );
  }
  function undo() {
    if (!history.length || !score) return;
    setModel(false);
    setSelected(restoreSelection(history.at(-1)!, score, selected));
    setFuture((f) => [score, ...f]);
    setScore(history.at(-1)!);
    setHistory((h) => h.slice(0, -1));
  }
  function redo() {
    if (!future.length || !score) return;
    setModel(false);
    setSelected(restoreSelection(future[0], score, selected));
    setHistory((h) => [...h, score]);
    setScore(future[0]);
    setFuture((f) => f.slice(1));
  }
  function transport() {
    if (!score) return;
    if (playing) {
      stop();
      setPlaying(false);
      setTime(-1);
    } else {
      setPlaying(true);
      play(
        displayScore || score,
        tempo,
        muted,
        (from - 1) * 8,
        to * 8,
        loop,
        setTime,
        () => {
          setPlaying(false);
          setTime(-1);
        },
        instrument,
      ).catch((e) => {
        setPlaying(false);
        setNotice(e.message);
      });
    }
  }
  useEffect(() => {
    stop();
    setPlaying(false);
    setTime(-1);
  }, [view]);
  useEffect(() => {
    if (view !== "sources" || sourceReview) return;
    let active = true;
    fetch("/sources/fux-review.json")
      .then((r) => {
        if (!r.ok) throw Error("Could not load the source review.");
        return r.json();
      })
      .then((data) => {
        if (active) setSourceReview(data);
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
    };
  }, [view, sourceReview]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        view !== "practice" ||
        e.repeat ||
        /INPUT|SELECT|TEXTAREA|BUTTON/.test(
          (e.target as HTMLElement).tagName,
        ) ||
        (e.metaKey && !["z", "ArrowUp", "ArrowDown"].includes(e.key))
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        transport();
        return;
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        move((e.key === "ArrowUp" ? 1 : -1) * (e.metaKey || e.ctrlKey ? 7 : 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const index = editable.findIndex((n) => n.id === selected);
        setSelected(
          editable[
            Math.max(
              0,
              Math.min(
                editable.length - 1,
                index + (e.key === "ArrowRight" ? 1 : -1),
              ),
            )
          ]?.id || "",
        );
      }
      if (/^[a-g]$/i.test(e.key) && note && !locked) {
        const previous = editable
          .slice(
            0,
            editable.findIndex((n) => n.id === selected),
          )
          .reverse()
          .find((n) => n.pitch);
        const d = degree(note.pitch || previous?.pitch || pitch(28));
        const target = steps.indexOf(e.key.toUpperCase());
        let nd = Math.floor(d / 7) * 7 + target;
        if (nd - d > 3) nd -= 7;
        if (d - nd > 3) nd += 7;
        setPitch(note.id, pitch(nd, entryAccidental), true);
      }
      if ((e.key === "Backspace" || e.key === "Delete") && !locked) {
        e.preventDefault();
        edit((s) =>
          s.voices
            .filter((v) => !v.locked)
            .forEach((v) =>
              v.notes
                .filter((n) => n.id === selected)
                .forEach((n) => {
                  n.pitch = null;
                  n.rest = false;
                }),
            ),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function commitTempo() {
    const value = tempoDraft.trim() ? Number(tempoDraft) : tempo;
    const next = normalizeTempo(value, tempo);
    setTempo(next);
    setTempoDraft(String(next));
  }
  function openPath(seed: Score) {
    open(pathStudy(seed, library, score));
  }
  function open(s: Score, saveCurrent = true) {
    s = upgradeScore(s, catalog);
    setInputDuration(null);
    setSpecies(s.species);
    setVoices(Math.max(2, s.voices.length));
    setMode(s.mode);
    setCFPosition(-1);
    if (score && saveCurrent)
      api("library", score).catch((e) => setNotice(e.message));
    setScore(s);
    setSelected(
      s.voices.find((v) => !v.locked)?.notes.find((n) => !n.rest)?.id || "",
    );
    setHistory([]);
    setFuture([]);
    setHint("");
    setHintLevel(0);
    setModel(false);
    setFindings([]);
    setView("practice");
  }
  const pool = catalog.filter(
    (s) =>
      s.species === species &&
      s.voices.length === voices &&
      (mode === "Any" || s.mode === mode) &&
      (cfPosition === -1 || s.voices[cfPosition]?.locked),
  );
  async function newExercise(generated = false) {
    const valid = pool.filter((s) => s.verified);
    const distinct = pool.filter(
      (s) => !score || cantusKey(s) !== cantusKey(score),
    );
    const seeds = generated ? valid : distinct;
    if (!seeds.length) {
      setNotice(
        "No different source cantus matches these settings. Choose another mode or given-voice position, or generate a cantus.",
        "status",
      );
      return;
    }
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    setBusy(generated ? "Finding a new, solvable cantus…" : "");
    try {
      const next = generated
        ? await job("generate", {
            score: seed,
            excluded: [
              seed,
              ...(score ? [score] : []),
              ...library.filter((s) => s.generated),
            ].map(cantusKey),
          })
        : blank(seed);
      open(next);
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy("");
    }
  }
  async function giveHint() {
    if (!score) return;
    setBusy("Looking at your line…");
    try {
      const errors: Finding[] = await job("check", { score });
      const f = errors.find((f) => f.severity === "error");
      if (f) {
        setHint(f.message);
        setSelected(
          f.notes.find((id) => editable.some((n) => n.id === id)) || selected,
        );
      } else if (hintLevel === 0) {
        setHint(
          "Plan the ending first. Seek contrary motion and consonant downbeats; use steps to connect the stronger notes.",
        );
      } else {
        const answer = await job("solve", { score });
        if (!answer)
          setHint(
            "No completion was found within the search limit. This does not prove your line is impossible. Try revising the last few notes.",
          );
        else {
          const next = editable.find((n) => !n.pitch && !n.rest);
          const p = answer
            .flatMap((v: Voice) => v.notes)
            .find((n: any) => n.id === next?.id)?.pitch;
          setHint(
            next && p
              ? `One possible next choice is ${label(p)}. A complete continuation is available from this choice.`
              : "Your exercise is complete. Listen for the shape and independence of each line.",
          );
          if (next) setSelected(next.id);
        }
      }
      setHintLevel((h) => h + 1);
    } catch (e) {
      setHint(String(e));
    } finally {
      setBusy("");
    }
  }
  async function showModel() {
    if (!score) return;
    if (model) {
      setModel(false);
      return;
    }
    setBusy("Checking a sample answer…");
    try {
      const requestScore = score;
      const prompt = clone(score);
      prompt.voices
        .filter((v) => !v.locked)
        .forEach((v) =>
          v.notes.forEach((n) => {
            if (!n.rest) n.pitch = null;
          }),
        );
      const historical = solutionMatches(score);
      const answer = historical
        ? score.solution
        : await job("solve", { score: prompt });
      if (answer) {
        const result: Finding[] = await job("check", {
          score: { ...score, voices: answer },
        });
        if (current.current !== requestScore) return;
        setSample(clone(answer));
        setSampleFindings(result);
        setModel(true);
        setHint(
          result.some((f) => f.severity === "error")
            ? "This source answer has findings requiring review. They are shown on the score; compare its source context. Your draft is preserved."
            : result.some((f) => f.basis === "review")
              ? "This answer has a musical question worth comparing with the original example."
              : "This answer passes the current contextual checks. Other solutions are possible; listen to its phrasing too.",
        );
      } else
        setHint(
          "No sample solution found within the search limit. Your work is unchanged.",
        );
    } catch (e) {
      setHint(String(e));
    } finally {
      setBusy("");
    }
  }
  function rhythm(duration: number) {
    if (score?.path) {
      setNotice(
        "This path study keeps its assigned rhythm. Use free practice for a different setup.",
        "status",
      );
      return;
    }
    if (!note || locked || !score) return;
    setInputDuration(duration);
    edit((s) => {
      const v = s.voices.find((v) => v.notes.some((n) => n.id === selected))!;
      resizeMeasure(v, note, duration);
    });
  }
  const shownFindings = model ? sampleFindings : findings;
  const analysis =
    analysisResult && analysisResult.score.id === displayScore?.id
      ? analysisResult.data
      : null;
  const hintsCurrent =
    candidateSnapshot?.score === score &&
    candidateSnapshot.id === candidateId &&
    candidateSnapshot.duration === candidateDuration &&
    candidateSnapshot.accidental === entryAccidental;
  const visibleCandidates = useMemo(
    () =>
      showCandidates && hintsCurrent && !model
        ? candidates.filter((p) => p.alter === entryAccidental)
        : [],
    [showCandidates, hintsCurrent, model, candidates, entryAccidental],
  );
  const tieReason = model
    ? "Sample answers are read-only."
    : score
      ? tieAvailability(score, selected)
      : "Select a note.";
  const errors = shownFindings.filter((f) => f.severity === "error"),
    suggestions = shownFindings.filter((f) => f.severity === "suggestion"),
    needsReview = shownFindings.some((f) => f.basis === "review");
  function openLesson(id: string) {
    stop();
    setPlaying(false);
    setTime(-1);
    setLessonId(id);
    setView("learn");
  }
  function studyStarted(s: Score) {
    return [score, ...library].some(
      (x) => x && (x.path?.studyId === s.id || x.id === s.id),
    );
  }
  function studyStatus(s: Score) {
    const status = progress.find((p) => p.id === s.id)?.status;
    return status === "pass"
      ? "Checks passed · revisit"
      : status === "needs-review"
        ? "Source review needed · resume"
        : studyStarted(s)
          ? "Started · resume this study"
          : "Start this study";
  }
  const pathSeeds = orderedPath(catalog);
  const pathIndex = pathSeeds.findIndex(
    (s) =>
      s.id === (score?.path?.studyId || score?.source?.exerciseId || score?.id),
  );
  const canContinue =
    !!score &&
    !model &&
    validatedScore === score &&
    complete(score) &&
    !errors.length;
  const nextSeed =
    pathIndex >= 0
      ? pathSeeds[pathIndex + 1]
      : pathSeeds.find((s) => !s.cantusOnly && s.species === score?.species);
  const continueSeed = pathSeeds.find(
    (s) => progress.find((p) => p.id === s.id)?.status !== "pass",
  );
  const written = editable.filter((n) => n.pitch || n.rest).length;
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("practice");
          }}
        >
          <span className="mark">g.</span>
          <span>
            gradus<small>AD PARNASSUM</small>
          </span>
        </a>
        <div className="side-label">YOUR STUDIO</div>
        <nav className="studio-nav" aria-label="Studio">
          {[
            ["practice", "✎", "Practice"],
            ["path", "↗", "The path"],
            ["learn", "♫", "Lessons"],
            ["library", "▤", "Your notebook"],
            ["sources", "§", "Sources & rules"],
          ].map(([key, icon, text]) => (
            <button
              key={key}
              className={"nav " + (view === key ? "active" : "")}
              onClick={() => setView(key)}
            >
              <span>{icon}</span>
              {text}
              {key === "library" && <small>{library.length}</small>}
            </button>
          ))}
        </nav>
        <header className="topbar">
          <select
            aria-label="Appearance"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <span className="save-status">
            {saved || "Local · private · yours"}
          </span>
        </header>
      </aside>
      <main>
        {notice && (
          <div
            className={`notice ${noticeTone}`}
            role={noticeTone === "error" ? "alert" : "status"}
          >
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}
        {view === "practice" && (
          <>
            <div className="practice-heading">
              <div>
                <h1>{score?.title || "Counterpoint practice"}</h1>
                {score && (
                  <p>
                    {score.mode} ·{" "}
                    {score.cantusOnly
                      ? "Cantus firmus"
                      : `${score.voices.length} voices · Species ${score.species}`}
                  </p>
                )}
              </div>
              <details className="study-about">
                <summary>About this study</summary>
                <a
                  href={
                    score?.source?.url ||
                    "https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {score?.source?.title || "Fux · Cantus firmus practice"} ↗
                </a>
              </details>{" "}
              <ExerciseActions
                hasScore={!!score}
                onImport={() => file.current?.click()}
                onExport={() =>
                  score &&
                  download(
                    "counterpoint.musicxml",
                    exportXML(score),
                    "application/vnd.recordare.musicxml+xml",
                  )
                }
              />
              <details className="exercise-setup">
                <summary>New exercise</summary>
                <div className="cantus-action">
                  <button
                    className="text-button"
                    onClick={() =>
                      open(cantus(mode === "Any" ? "Dorian" : mode))
                    }
                  >
                    Write a cantus
                  </button>
                </div>{" "}
                <section className="setup">
                  <label>
                    SPECIES
                    <select
                      aria-label="Species"
                      value={species}
                      onChange={(e) => setSpecies(+e.target.value)}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} · {speciesNames[n]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    VOICES
                    <select
                      aria-label="Voices"
                      value={voices}
                      onChange={(e) => {
                        setVoices(+e.target.value);
                        setCFPosition(-1);
                      }}
                    >
                      {[2, 3, 4].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    MODE
                    <select
                      aria-label="Mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      {["Any", ...modes].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    GIVEN VOICE
                    <select
                      aria-label="Cantus position"
                      value={cfPosition}
                      onChange={(e) => setCFPosition(+e.target.value)}
                    >
                      <option value={-1}>Any position</option>
                      {Array.from({ length: voices }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0
                            ? "Top · write below"
                            : i === voices - 1
                              ? "Bottom · write above"
                              : "Middle " + i}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button"
                    disabled={!!busy}
                    onClick={() => newExercise()}
                  >
                    Different source cantus ↗
                  </button>
                  <button
                    className="button primary"
                    disabled={!!busy || !pool.some((s) => s.verified)}
                    onClick={() => newExercise(true)}
                  >
                    Generate new cantus +
                  </button>
                </section>
                <section className="source-picker">
                  <h2>Practice from a specific example.</h2>
                  <p>
                    Keep the example’s given melody and write the other voices.{" "}
                    {pool.length} examples match your settings, using{" "}
                    {new Set(pool.map(cantusKey)).size} distinct cantus
                    melodies. Historical examples and their practice adaptations
                    can share a cantus.
                  </p>
                  <div className="exercise-grid">
                    {pool.map((s) => (
                      <button
                        key={s.id}
                        className="exercise"
                        onClick={() => open(blank(s))}
                      >
                        <small>
                          {s.mode} · {s.bars} bars
                        </small>
                        <h3>{s.title}</h3>
                        {s.source?.corrected && (
                          <p className="study-focus">
                            “Corrected” is the source’s label for this version
                            of the example.
                          </p>
                        )}
                        <span>Practice this cantus ↗</span>
                      </button>
                    ))}
                  </div>
                  {!pool.length && (
                    <p>Choose another mode or given-voice position.</p>
                  )}
                </section>
              </details>
            </div>
            {score && (
              <>
                <div className="workspace">
                  <div className="score-column">
                    <section className="score-card">
                      <div className="transport">
                        <button
                          className="play"
                          aria-label={playing ? "Stop playback" : "Play score"}
                          onClick={transport}
                        >
                          <EditorIcon name={playing ? "stop" : "play"} />
                        </button>
                        <label>
                          <EditorIcon name="quarter" /> BPM{" "}
                          <input
                            aria-label="Tempo"
                            type="number"
                            min={MIN_TEMPO}
                            max={MAX_TEMPO}
                            value={tempoDraft}
                            onChange={(e) => setTempoDraft(e.target.value)}
                            onBlur={commitTempo}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitTempo();
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={loop}
                            onChange={(e) => setLoop(e.target.checked)}
                          />{" "}
                          Loop
                        </label>
                        {loop && (
                          <label>
                            Bars{" "}
                            <input
                              aria-label="Loop start"
                              type="number"
                              min="1"
                              max={to}
                              value={from}
                              onChange={(e) =>
                                setFrom(
                                  Math.max(1, Math.min(to, +e.target.value)),
                                )
                              }
                            />{" "}
                            —{" "}
                            <input
                              aria-label="Loop end"
                              type="number"
                              min={from}
                              max={score.bars}
                              value={to}
                              onChange={(e) =>
                                setTo(
                                  Math.max(
                                    from,
                                    Math.min(score.bars, +e.target.value),
                                  ),
                                )
                              }
                            />
                          </label>
                        )}
                        <label className="zoom-control">
                          Score size
                          <select
                            aria-label="Score zoom"
                            value={zoom}
                            onChange={(e) => setZoom(+e.target.value)}
                          >
                            {[100, 125, 150, 175, 200].map((z) => (
                              <option key={z} value={z}>
                                {z}%
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          aria-expanded={displaySettings}
                          onClick={() => setDisplaySettings((x) => !x)}
                          ref={displayOpener}
                        >
                          Playback & display
                        </button>{" "}
                      </div>
                      {displaySettings && (
                        <PlaybackSettings
                          score={score}
                          model={model}
                          instrument={instrument}
                          setInstrument={setInstrument}
                          muted={muted}
                          setMuted={setMuted}
                          edit={edit}
                          onClose={() => {
                            setDisplaySettings(false);
                            displayOpener.current?.focus();
                          }}
                        />
                      )}
                      {model && (
                        <p className="hint">
                          Viewing a sample answer. Your draft is preserved;
                          return to your work to continue editing.
                        </p>
                      )}
                      <ScoreView
                        score={displayScore!}
                        selected={selected}
                        onSelect={select}
                        onPitch={setPitch}
                        findings={shownFindings}
                        time={time}
                        inputDuration={model ? null : inputDuration}
                        readOnly={model}
                        zoom={zoom / 100}
                        candidates={visibleCandidates}
                        candidateTarget={candidateId}
                        entryAccidental={entryAccidental}
                        onCandidate={enterCandidate}
                      />
                      <div
                        className="note-toolbar"
                        onClick={(e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "button:not(:disabled)",
                            )
                          )
                            document
                              .querySelector<HTMLElement>(
                                '[aria-label="Score editor"]',
                              )
                              ?.focus({ preventScroll: true });
                        }}
                      >
                        <button
                          disabled={!history.length}
                          onClick={undo}
                          title="Undo"
                        >
                          <EditorIcon name="undo" />
                        </button>
                        <button
                          disabled={!future.length}
                          onClick={redo}
                          title="Redo"
                        >
                          <EditorIcon name="redo" />
                        </button>
                        <span className="divider" />
                        <button
                          disabled={!note || locked}
                          className="pitch-control"
                          aria-label="Raise pitch"
                          onClick={() => move(1)}
                        >
                          <EditorIcon name="up" />
                        </button>
                        <button
                          disabled={!note || locked}
                          className="pitch-control"
                          aria-label="Lower pitch"
                          onClick={() => move(-1)}
                        >
                          <EditorIcon name="down" />
                        </button>
                        {[-1, 0, 1].map((a) => (
                          <button
                            key={a}
                            className="accidental-control"
                            aria-label={
                              a === -1 ? "Flat" : a === 0 ? "Natural" : "Sharp"
                            }
                            aria-pressed={entryAccidental === a}
                            disabled={!note || locked}
                            onClick={() => {
                              setEntryAccidental(a);
                              if (note?.pitch)
                                setPitch(note.id, { ...note.pitch, alter: a });
                            }}
                          >
                            <EditorIcon
                              name={
                                a === -1
                                  ? "flat"
                                  : a === 0
                                    ? "natural"
                                    : "sharp"
                              }
                            />
                          </button>
                        ))}
                        <span className="divider" />
                        <select
                          aria-label="Note duration"
                          title={
                            score.path
                              ? "Assigned rhythm for this path study"
                              : undefined
                          }
                          disabled={!note || locked || !!score.path}
                          value={
                            note
                              ? entryDuration(score, note.id, inputDuration)
                              : 8
                          }
                          onChange={(e) => {
                            if (
                              note &&
                              note.time + Number(e.target.value) >
                                (Math.floor(note.time / 8) + 1) * 8
                            ) {
                              setNotice(
                                "That duration extends beyond the bar.",
                              );
                              return;
                            }
                            rhythm(+e.target.value);
                          }}
                        >
                          {[
                            [8, "Whole"],
                            [6, "Dotted half"],
                            [4, "Half"],
                            [3, "Dotted quarter"],
                            [2, "Quarter"],
                            [1, "Eighth"],
                          ].map(([v, t]) => (
                            <option key={v} value={v}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={!note || locked || !!score.path}
                          onClick={() =>
                            edit((s) => {
                              const n = prepareEntry(
                                s,
                                selected,
                                inputDuration,
                              );
                              if (n) {
                                n.rest = !n.rest;
                                n.pitch = null;
                              }
                            })
                          }
                        >
                          Rest
                        </button>
                        <button
                          disabled={!!tieReason}
                          aria-pressed={!!note?.tieStart}
                          aria-describedby="tie-availability"
                          title={
                            tieReason ||
                            (note?.tieStart
                              ? "Remove this tie"
                              : "Tie to the following slot")
                          }
                          onClick={() =>
                            edit((s) => {
                              toggleTie(s, selected);
                            })
                          }
                        >
                          {note?.tieStart ? "Remove tie" : "Add tie"}
                        </button>
                        <button
                          disabled={!note || locked}
                          aria-pressed={showCandidates}
                          onClick={() => setShowCandidates((x) => !x)}
                        >
                          Pitch hints
                        </button>

                        <button
                          disabled={!resetPattern || locked}
                          onClick={clearLine}
                          title="Start this voice over with the exercise’s empty rhythm. Custom lines reset to their species pattern. Undo restores your work."
                        >
                          Clear line
                        </button>
                        <span className="selection">
                          {note ? label(note.pitch) : "Select a note"}
                        </span>
                      </div>
                      <div
                        className="entry-status"
                        id="tie-availability"
                        role="status"
                      >
                        {showCandidates && !locked && candidateTarget ? (
                          <>
                            <span className="candidate-label">
                              Locally compatible · Bar{" "}
                              {Math.floor(candidateTarget.time / 8) + 1}, beat{" "}
                              {(candidateTarget.time % 8) / 2 + 1}
                            </span>
                            <span>
                              {hintsCurrent
                                ? visibleCandidates.length
                                  ? "Future notes may change these choices."
                                  : "No compatible pitches with this accidental."
                                : candidateStatus || "Finding pitches…"}
                            </span>
                          </>
                        ) : (
                          <span>
                            {tieReason ||
                              "Drag notes or use arrow keys to adjust. Ties connect adjacent notes."}
                          </span>
                        )}
                      </div>
                      {showCandidates && !locked && candidateTarget && (
                        <details className="candidate-panel">
                          <summary>Pitch choices by name</summary>
                          <div>
                            {visibleCandidates.map((p, i) => (
                              <button
                                key={i}
                                onClick={() =>
                                  setPitch(candidateId, p, "unwritten")
                                }
                              >
                                {label(p)}
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </section>
                    <StudyHelp
                      busy={!!busy}
                      model={model}
                      hint={hint}
                      onGuidance={giveHint}
                      onSample={showModel}
                      onLesson={() => openLesson(studyLesson(score).id)}
                    />{" "}
                    <div className="score-analysis">
                      <AnalysisPanel analysis={analysis} />
                      <ReviewFindings
                        score={displayScore!}
                        findings={shownFindings}
                        analysis={analysis}
                        selected={selected}
                        onSelect={select}
                        onLesson={openLesson}
                      />
                    </div>
                  </div>
                  <aside className="feedback">
                    <div className="status">
                      <h3>
                        {errors.length
                          ? ""
                          : complete(displayScore!) &&
                              (model || validatedScore === score)
                            ? needsReview
                              ? "Source review needed."
                              : "Practice checks passed."
                            : "A line in the making."}
                      </h3>
                      <p>
                        {errors.length
                          ? "Select a finding to see its passage."
                          : complete(displayScore!)
                            ? model || validatedScore === score
                              ? needsReview
                                ? "This passage has a musical question worth revisiting. You can continue and return to it later."
                                : "Current contextual checks passed. Review the musical suggestions, then listen to the whole."
                              : "Checking your updated score…"
                            : `${written} of ${editable.length} notes written. Future notes may change the feedback.`}
                      </p>
                    </div>
                    {canContinue && (
                      <div className="completion-next">
                        <p>
                          {nextSeed
                            ? `Up next: ${nextSeed.title} · ${nextSeed.mode}`
                            : "You’ve reached the end of the path. Revisit a study or explore free practice."}
                        </p>
                        <button
                          className="button primary"
                          onClick={() =>
                            nextSeed ? openPath(nextSeed) : setView("path")
                          }
                        >
                          {nextSeed ? "Next exercise →" : "Review the path →"}
                        </button>
                      </div>
                    )}
                    <HistoricalNotes score={displayScore!} />
                    <RuleFeedback
                      score={displayScore!}
                      findings={shownFindings}
                      analysis={analysis}
                      selected={selected}
                      onSelect={select}
                      onLesson={openLesson}
                    />
                  </aside>
                </div>
              </>
            )}
          </>
        )}
        {view === "learn" && (
          <section className="page learning-page">
            <p className="eyebrow">THE MUSICAL IDEA</p>
            <h1>Understand what you hear.</h1>
            <p>
              Study one idea, listen to the short example, then return to your
              own line.
            </p>
            <LessonPanel
              key={lessonId}
              id={lessonId}
              onReturn={() => setView("practice")}
            />
            <h2>Explore lessons</h2>
            <div className="lesson-grid">
              {lessons.map((l) => (
                <button
                  className={
                    "lesson-card " + (lessonId === l.id ? "active" : "")
                  }
                  key={l.id}
                  onClick={() => {
                    setLessonId(l.id);
                    document
                      .querySelector(".lesson-panel")
                      ?.scrollIntoView({ block: "start" });
                  }}
                  aria-pressed={lessonId === l.id}
                >
                  <h3>{l.title}</h3>
                  <p>{l.summary}</p>
                </button>
              ))}
            </div>
          </section>
        )}
        {view === "library" && (
          <section className="page">
            <p className="eyebrow">YOUR NOTEBOOK</p>
            <h1>Keep the work.</h1>
            <p>
              Every attempt is saved on this Mac. Reopen a line and pick up
              where you left off.
            </p>
            <details className="side-bottom">
              <summary>Notebook backups</summary>
              <div className="local-dot" /> PERSONAL EDITION
              <p>
                One line at a time.
                <br />A little closer to Parnassus.
              </p>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    if (score) await api("library", score);
                    await saveQueue.current;
                    download(
                      "gradus-backup.json",
                      JSON.stringify(await api("backup"), null, 2),
                    );
                  } catch (e) {
                    setNotice(String(e));
                  }
                }}
              >
                ↓ Back up your notebook
              </button>
              <button
                className="text-button"
                onClick={() => restore.current?.click()}
              >
                ↑ Restore a backup
              </button>
            </details>{" "}
            <div className="exercise-grid">
              {library.map((s) => (
                <button key={s.id} className="exercise" onClick={() => open(s)}>
                  <small>
                    {s.mode} · {s.voices.length} voices · species {s.species}
                  </small>
                  <h3>{s.title}</h3>
                  <span>
                    {
                      s.voices.flatMap((v) => v.notes).filter((n) => n.pitch)
                        .length
                    }{" "}
                    notes written ↗
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        {view === "path" && (
          <section className="page">
            <p className="eyebrow">THE PATH</p>
            <h1>Small steps. Independent voices.</h1>
            <p>
              Begin with cantus firmus, then work through species I–V in order.
              Explore the Fux catalogue and practice studies in all six modes.
              Expand a species to choose a study. Your work resumes when you
              return.
            </p>
            <label>
              Mode
              <select
                aria-label="Path mode"
                value={pathMode}
                onChange={(e) => setPathMode(e.target.value)}
              >
                {["Any", ...modes].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <p className="path-progress" role="status">
              {progress.filter((p) => p.status === "pass").length} studies pass
              the current contextual checks. Completed studies are reassessed
              when the rules change.
            </p>
            {continueSeed && (
              <div className="path-context">
                <span>
                  Next on your path: {continueSeed.title} · {continueSeed.mode}
                </span>
                <button
                  className="button primary"
                  onClick={() => openPath(continueSeed)}
                >
                  {library.some((s) => s.path)
                    ? "Continue the path →"
                    : "Start the path →"}
                </button>
              </div>
            )}
            <details className="path-stage" open={!!score?.cantusOnly}>
              <summary className="path-row">
                <span>00</span>
                <div>
                  <h2>Cantus firmus</h2>
                  <p>
                    Start here. Give one melody a direction, then continue to
                    species I.
                  </p>
                </div>
                <b aria-hidden="true">⌄</b>
              </summary>
              <div className="path-study-list">
                <div className="exercise-grid">
                  {pathSeeds
                    .filter(
                      (s) =>
                        s.cantusOnly &&
                        (pathMode === "Any" || s.mode === pathMode),
                    )
                    .map((s) => (
                      <button
                        key={s.id}
                        className={`exercise${studyStarted(s) ? " study-started" : ""}`}
                        onClick={() => openPath(s)}
                      >
                        <small>
                          Study {pathSeeds.findIndex((x) => x.id === s.id) + 1}{" "}
                          · One line · {s.mode}
                        </small>
                        {studyStarted(s) && (
                          <span className="study-badge">Started</span>
                        )}
                        <h3>{s.title}</h3>
                        <p className="study-focus">
                          Focus: {studyLesson(s).title}
                        </p>
                        <span
                          className={
                            progress.some(
                              (p) => p.id === s.id && p.status === "pass",
                            )
                              ? "study-passed"
                              : undefined
                          }
                        >
                          {studyStatus(s)} ↗
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </details>
            {[1, 2, 3, 4, 5].map((n) => (
              <details
                className="path-stage"
                key={n}
                open={!score?.cantusOnly && score?.species === n}
              >
                <summary className="path-row">
                  <span>0{n}</span>
                  <div>
                    <h2>{speciesNames[n]}</h2>
                    <p>
                      Species {n} · expand to choose a study · two, three, or
                      four voices
                    </p>
                  </div>
                  <b aria-hidden="true">⌄</b>
                </summary>
                <div className="path-study-list">
                  <div className="exercise-grid">
                    {pathSeeds
                      .filter(
                        (s) =>
                          !s.cantusOnly &&
                          s.species === n &&
                          (pathMode === "Any" || s.mode === pathMode),
                      )
                      .map((s) => (
                        <button
                          key={s.id}
                          className={`exercise${studyStarted(s) ? " study-started" : ""}`}
                          onClick={() => openPath(s)}
                        >
                          <small>
                            Study{" "}
                            {pathSeeds.findIndex((x) => x.id === s.id) + 1} ·{" "}
                            {s.mode} · {s.voices.length} voices · species{" "}
                            {s.species}
                          </small>
                          {studyStarted(s) && (
                            <span className="study-badge">Started</span>
                          )}
                          <h3>{s.title}</h3>
                          {s.source?.exerciseId && (
                            <p>
                              Historical source
                              {s.verified
                                ? ""
                                : " · Sample has passages to review"}
                            </p>
                          )}
                          <p className="study-focus">
                            Focus: {studyLesson(s).title}
                          </p>
                          <span
                            className={
                              progress.some(
                                (p) => p.id === s.id && p.status === "pass",
                              )
                                ? "study-passed"
                                : undefined
                            }
                          >
                            {studyStatus(s)} ↗
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              </details>
            ))}
            {!!review.length && (
              <div className="hint">
                <h3>Worth another look</h3>
                {review.map(([rule, count]) => (
                  <p key={rule}>
                    {rule.replaceAll("-", " ")} · {count} findings across saved
                    attempts
                  </p>
                ))}
              </div>
            )}
            <h2 className="future-title">Beyond the foundation</h2>
            {[
              "Mozart & Attwood · Harmony, counterpoint, canon & composition",
              "Jeppesen · Renaissance polyphony",
              "Gauldin · Tonal counterpoint",
              "Salzer & Schachter · Structural voice leading",
              "Gédalge & Mann · Fugue",
              "Bach, Ledbetter & Dirst · Advanced studies",
            ].map((t) => (
              <div className="future-course" key={t}>
                {t}
                <small>FUTURE COURSE</small>
              </div>
            ))}
          </section>
        )}
        {view === "sources" && (
          <section className="page sources">
            <p className="eyebrow">SOURCES & RULES</p>
            <h1>Know why a note is marked.</h1>
            <p>
              Fux is the authority for this first course. This is a documented
              practice interpretation, not a claim to judge every historical
              exception or the quality of a composition.
            </p>
            <h2>Primary source</h2>
            <p>
              <a
                href="https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035"
                target="_blank"
              >
                Gradus ad Parnassum · Vienna, 1725 ↗
              </a>
              . Source-page links accompany each exercise. The 123 score
              transcriptions are by Jay Wilson and Mark Gotham /
              FourScoreAndMore.org, released CC0. Figure numbers follow the Mann
              edition; rule prose here is original.
            </p>
            <h2>Checking policy</h2>
            <p>
              Rules: supported dissonance treatment, actual parallel fifths and
              octaves, singable interval qualities, valid ties, and openings and
              cadences appropriate to the number of voices. Each written voice
              has its own species assignment. Fourth species needs syncopation;
              quarter-note neighbours and cambiatas depend on their beat and
              consonant framework. A missing bass postpones judgments that
              depend on it.
            </p>
            <p>
              Craft advice is separate from rule errors. Repetition in first
              species and florid rearticulation are not blanket prohibitions;
              minor-sixth leaps are admitted in both directions. The source
              supports fuller cadential ties, a stationary-bass preparation
              exception, and rests in suspension studies. Our introductory
              cantus exercise additionally asks for a stepwise ending, clearly
              labeled as a study requirement.
            </p>
            <p>
              Unsettled modal inflections receive a source-review finding and
              cannot produce a clean pass. Simultaneous decorated dissonances
              between moving voices and some editorial readings remain open
              questions. The original 46 disagreements have been reviewed below;
              their evidence and remaining limits are retained. Historical music
              is preserved. A passing result describes the current checks, not
              artistic merit or exhaustive historical certification.
            </p>
            <h2>Working with MusicXML</h2>
            <p>
              Use separate monophonic parts in 4/4 or 2/2, complete measures,
              and whole through eighth notes. Chords, tuplets, grace notes,
              pickups, and multiple voices per staff are rejected with an
              explanation. Imports use your selected species and mode unless
              they retain this app’s species and given voices. The bottom part
              becomes the cantus unless the file retains the given voice’s role.
            </p>
            <h2>Credits</h2>
            <p>
              Engraving: VexFlow (MIT), Bravura music font (SIL Open Font
              License). Audio: Tone.js (MIT), tonejs-instruments by Nicholaus P.
              Brosowsky. Its code is MIT; its samples are CC BY 3.0. Samples are
              bundled locally and may be repitched.{" "}
              <a href="/sources/audio-license.txt" target="_blank">
                Sample license ↗
              </a>
            </p>
            <h2>Source comparison</h2>
            <p>
              All 123 source examples have a versioned comparison ledger.
              Disagreements are identified for review, rather than treated as
              proof that Fux is wrong.{" "}
              <a href="/sources/fux-audit.json" target="_blank">
                Inspect the source comparison ↗
              </a>
            </p>
            {sourceReview && (
              <div className="source-review-list">
                <p>
                  {sourceReview.baselineCount} original disagreements reviewed.
                  Current corpus: {sourceReview.summary.pass || 0} pass the
                  implemented checks,{" "}
                  {sourceReview.summary["needs-review"] || 0} need context
                  review, and {sourceReview.summary.violations || 0} retain rule
                  findings.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyUnsettled}
                    onChange={(e) => setOnlyUnsettled(e.target.checked)}
                  />{" "}
                  Show unresolved or editorial questions only
                </label>
                {sourceReview.records
                  .filter(
                    (r: any) =>
                      !onlyUnsettled ||
                      r.currentStatus !== "pass" ||
                      r.classification === "transcription-uncertainty",
                  )
                  .map((r: any) => (
                    <details key={r.id}>
                      <summary>
                        {r.id.replace("gap_", "Figure ")} · p. {r.printedPage} ·{" "}
                        {r.classification.replaceAll("-", " ")}
                      </summary>
                      <p>{r.observation}</p>
                      <p>
                        Current result: {r.currentStatus.replaceAll("-", " ")}.{" "}
                        {r.remainingFindings.length} unresolved findings.
                      </p>
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                        Inspect this source page ↗
                      </a>
                    </details>
                  ))}
                <p>
                  <a
                    href="/sources/fux-review.json"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Full evidence ledger ↗
                  </a>
                </p>
              </div>
            )}
            <h2>Rule references</h2>
            <p>
              See the primary source, Book II, First Exercise: the five species
              in two parts. The Second and Third Exercises extend the species to
              three and four parts. Each score links its own printed page. The
              source document supplies the context for exceptions.
            </p>
            <h2>Later courses</h2>
            <p>
              Mozart and Attwood: harmony, species counterpoint, canon, and free
              composition, documented in the Attwood studies (NMA X/30/1).
              Jeppesen: Renaissance vocal polyphony. Gauldin: eighteenth-century
              counterpoint. Salzer and Schachter: Counterpoint in Composition.
              Gédalge and Mann: fugue. Ledbetter’s Bach’s Well-tempered Clavier
              and Dirst’s Bach’s Art of Fugue and Musical Offering: advanced
              Bach studies. These courses require source review before
              implementation; they are not currently taught or checked.
            </p>
          </section>
        )}
        <footer className="page-footer">
          GRADUS AD PARNASSUM<span>A personal practice, patiently built.</span>
        </footer>
      </main>
      {busy && (
        <div className="busy" role="status">
          <span className="spinner" />
          {busy}
        </div>
      )}
      <input
        ref={file}
        hidden
        type="file"
        accept=".xml,.musicxml,.mxl"
        onChange={async (e) => {
          try {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5_000_000)
                throw Error("Import a score smaller than 5MB.");
              const imported = importXML(
                new Uint8Array(await f.arrayBuffer()),
                f.name,
                species,
                mode === "Any" ? "Dorian" : mode,
              );
              open(
                imported.voices.length === 1
                  ? fromCantus(
                      imported,
                      species,
                      voices,
                      cfPosition === -1 ? voices - 1 : cfPosition,
                    )
                  : imported,
              );
            }
          } catch (e) {
            setNotice(String(e));
          } finally {
            e.target.value = "";
          }
        }}
      />
      <input
        ref={restore}
        hidden
        type="file"
        accept=".json"
        onChange={async (e) => {
          try {
            const f = e.target.files?.[0];
            if (f) {
              await saveQueue.current;
              await api("restore", JSON.parse(await f.text()));
              const restored = (await api("library")).map((s: Score) =>
                upgradeScore(s, catalog),
              );
              setLibrary(restored);
              localStorage.removeItem("gradus-recovery");
              const next =
                restored.find((s: Score) => s.id === score?.id) || restored[0];
              if (next) open(next, false);
              setNotice(
                "Backup restored. Existing attempts were preserved; matching IDs were updated.",
                "status",
              );
            }
          } catch (e) {
            setNotice(String(e));
          } finally {
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
