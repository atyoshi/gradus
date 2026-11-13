/** Reproducible disagreement ledger, never a substitute for independent source review. */
import fs from "node:fs";
import { parseKern } from "../src/model.ts";
import { assess } from "../src/rules.ts";
import { createHash } from "node:crypto";
const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const review = JSON.parse(
  fs.readFileSync("public/sources/fux-review.json", "utf8"),
);
const hash = createHash("sha256")
  .update(fs.readFileSync("public/sources/fux.json"))
  .digest("hex");
if (review.sourceSha256 !== hash)
  throw Error(
    "The pinned source changed. Review the evidence ledger before refreshing assessments.",
  );
const result = rows.map((row: any) => {
  const s = parseKern(row);
  const a = assess(s);
  return {
    id: s.id,
    voices: s.voices.length,
    species: s.species,
    source: s.source,
    assessment: a,
    evidence: review.records.find((r: any) => r.id === s.id) || null,
    review:
      a.status === "pass"
        ? "No implemented-rule disagreement; not an independent musical certification"
        : "Source exception or validator disagreement requiring source review",
  };
});
for (const record of review.records) {
  const current = result.find((r: any) => r.id === record.id)!;
  record.currentStatus = current.assessment.status;
  record.currentRuleVersion = current.assessment.ruleVersion;
  record.remainingFindings = current.assessment.findings
    .filter((f: any) => f.severity === "error" || f.basis === "review")
    .map((f: any) => ({
      rule: f.rule,
      notes: f.notes,
      message: f.message,
      basis: f.basis,
    }));
}
review.summary = result.reduce((o: Record<string, number>, r: any) => {
  o[r.assessment.status] = (o[r.assessment.status] || 0) + 1;
  return o;
}, {});
fs.writeFileSync(
  "public/sources/fux-audit.json",
  JSON.stringify(result, null, 2) + "\n",
);
fs.writeFileSync(
  "public/sources/fux-review.json",
  JSON.stringify(review, null, 2) + "\n",
);
const table = review.records
  .map(
    (r: any) =>
      `| ${r.id} | ${r.classification} | ${r.currentStatus} | [p. ${r.printedPage}](${r.sourceUrl}) | ${r.observation.replaceAll("|", "/")} |`,
  )
  .join("\n");
fs.writeFileSync(
  "SOURCE_REVIEW.md",
  `# Fux source review — 31 October 2026\n\n${review.method}\n\n## Method and limits\n\nThe original 46 v2 disagreements are preserved with their note IDs and messages in [the evidence ledger](public/sources/fux-review.json). The 33 source pages were inspected as scans, and their surrounding passages checked against the [1725 primary text](https://www.digital.wienbibliothek.at/wbrobv/download/ftpack/plain/4118035). The source file is pinned by SHA-256: \`${hash}\`. Original pitches, timings, rests and ties have not been rewritten.\n\nThe ledger records checker bugs, source-supported exceptions, transcription uncertainties and questions still requiring source review. No case has been labeled an intentional teaching error without evidence. A corrected source example is distinguished from an erroneous student attempt. The checker does not use figure IDs as exemptions. Current pass counts measure implemented checks, not independent musical certification.\n\n## Result\n\nCurrent assessment of all 123 examples: ${Object.entries(
    review.summary,
  )
    .map(([k, v]) => `${v} ${k}`)
    .join(
      ", ",
    )}. These totals include new contextual review states; they are not directly comparable to the v2 error-only pass count.\n\nSource-supported corrections include both directions of the minor-sixth leap (p.60), the first-species repetition preference rather than a numeric prohibition (corrected fig.15), fuller cadential ties and resolutions (pp.95–96), dissonant preparation over a stationary bass (pp.106–107), the whole-bar rest in the suspension study (p.108), and the consonant-entry eighth-note ornament (pp.112–113). Structural parallels are differentiated by species and texture.\n\nUnsettled inflections remain review findings rather than definitive errors or a clean pass. Simultaneous dissonances between moving voices, including parts of figures 134, 183, 186, 203 and 204, remain explicitly unresolved. The suspected clef issue and original erratum relevant to fig.55 remain editorial evidence.\n\n## Original 46 disagreements\n\n| Example | Classification | Current result | Scan | Observation |\n|---|---|---|---|---|\n${table}\n\n## Reproduction\n\nRun \`node scripts/audit_sources.ts\` to reassess the immutable scores while retaining the review observations. Run \`npm test\` for manually specified allowed/prohibited figures, legacy-score compatibility, and source-preservation checks. Parnasso was used to discover differences, never as the expected-result oracle.\n`,
);
console.log(
  `${result.length} source examples assessed: ${JSON.stringify(review.summary)}. ${review.records.length} original disagreements retained with evidence.`,
);
