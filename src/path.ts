import { type Score, blank, modes } from "./model";
/** Path selection has a stable exercise identity and resumes that exact study. */
export function pathStudy(
  seed: Score,
  library: Score[],
  current: Score | null,
): Score {
  const existing =
    current?.path?.studyId === seed.id
      ? current
      : library.find((s) => s.path?.studyId === seed.id);
  if (existing) return existing;
  const study = blank(seed);
  study.id = "path-" + seed.id;
  study.path = {
    studyId: seed.id,
    species: seed.species,
    voices: seed.voices.length,
    mode: seed.mode,
  };
  return study;
}

/** Curriculum order matches the numbered studies shown on the path. */
export function orderedPath(catalog: Score[]): Score[] {
  return catalog
    .filter(
      (s) =>
        s.cantusOnly || s.id.startsWith("practice-") || !!s.source?.exerciseId,
    )
    .sort(
      (a, b) =>
        Number(!a.cantusOnly) - Number(!b.cantusOnly) ||
        (a.cantusOnly ? 0 : a.species - b.species) ||
        a.voices.length - b.voices.length ||
        modes.indexOf(a.mode) - modes.indexOf(b.mode),
    );
}
