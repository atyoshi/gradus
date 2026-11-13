import { check, assess, RULE_VERSION } from "./rules";
import { type Score } from "./model";
import { studyLesson } from "./teaching";
import { compatiblePitches } from "./candidates";
import { analyze } from "./analysis";
import { catalogue, fresh, solve } from "./exercises";
self.onmessage = ({ data }) => {
  const { id, type, score, rows } = data;
  try {
    let result: any;
    if (type === "check") result = check(score);
    else if (type === "revalidate")
      result = data.scores.map((s: Score) => ({
        ...s,
        verified: assess(s).status === "pass",
        validationVersion: RULE_VERSION,
      }));
    else if (type === "catalogue") result = catalogue(rows);
    else if (type === "generate") result = fresh(score, data.excluded);
    else if (type === "solve") result = solve(score, score.solution, 8000);
    else if (type === "progress") {
      result = data.scores
        .filter((s: Score) => !!s.path)
        .map((s: Score) => ({
          id: s.path!.studyId,
          lessonId: studyLesson({ ...s, id: s.path!.studyId }).id,
          status: assess(s).status,
          ruleVersion: RULE_VERSION,
        }));
    } else if (type === "candidates") {
      result = compatiblePitches(
        score,
        data.noteId,
        data.inputDuration ?? null,
      );
    } else if (type === "analysis") {
      result = analyze(score, data.selected, check(score));
    } else if (type === "review") {
      const counts: Record<string, number> = {};
      for (const s of data.scores)
        for (const f of check(s))
          if (f.severity === "error")
            counts[f.rule] = (counts[f.rule] || 0) + 1;
      result = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    }
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String(e) });
  }
};
