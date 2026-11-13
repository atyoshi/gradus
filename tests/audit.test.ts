import { test, expect } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { catalogue } from "../src/exercises";
import { check, assess, RULE_VERSION } from "../src/rules";
import { parseKern } from "../src/model";
test("audit source coverage", () => {
  const scores = catalogue(
    JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8")),
  );
  const coverage: any = {};
  for (const s of scores) {
    const key = `${s.voices.length}v species ${s.species}`;
    coverage[key] ??= { all: 0, checked: 0 };
    coverage[key].all++;
    if (s.verified) coverage[key].checked++;
    expect(Number.isFinite(s.bars)).toBe(true);
    expect(s.voices.every((v) => v.notes.length)).toBe(true);
  }
  fs.writeFileSync(
    "data/coverage.json",
    JSON.stringify(
      {
        coverage,
        scores: scores.map((s) => ({
          id: s.id,
          species: s.species,
          voices: s.voices.length,
          verified: s.verified,
          errors: check(s).filter((f) => f.severity === "error"),
        })),
      },
      null,
      2,
    ),
  );
  expect(scores.length).toBe(123);
});

test("the review ledger preserves evidence and agrees with current reproducible assessments", () => {
  const bytes = fs.readFileSync("public/sources/fux.json");
  const review = JSON.parse(
    fs.readFileSync("public/sources/fux-review.json", "utf8"),
  );
  const audit = JSON.parse(
    fs.readFileSync("public/sources/fux-audit.json", "utf8"),
  );
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    review.sourceSha256,
  );
  expect(review.records).toHaveLength(46);
  expect(new Set(review.records.map((r: any) => r.id)).size).toBe(46);
  const summary: Record<string, number> = {};
  for (const row of JSON.parse(bytes.toString())) {
    const score = parseKern(row),
      result = assess(score);
    const stored = audit.find((a: any) => a.id === score.id);
    expect(stored.assessment).toEqual(result);
    summary[result.status] = (summary[result.status] || 0) + 1;
    const evidence = review.records.find((r: any) => r.id === score.id);
    if (evidence) {
      expect(evidence.baselineFindings.length).toBeGreaterThan(0);
      expect(evidence.observation.length).toBeGreaterThan(40);
      expect(evidence.sourceUrl).toMatch(/^https:/);
      expect(evidence.currentRuleVersion).toBe(RULE_VERSION);
      expect(evidence.currentStatus).toBe(result.status);
      expect(stored.evidence).toEqual(evidence);
    }
  }
  expect(review.summary).toEqual(summary);
});
