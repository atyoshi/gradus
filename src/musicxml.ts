import { XMLParser, XMLValidator } from "fast-xml-parser";
import { unzipSync, strFromU8 } from "fflate";
import { type Score, type Note, assignedSpecies, assignSpecies } from "./model";
const esc = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const arr = (x: any): any[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];
export function exportXML(s: Score) {
  const metadata = s.voices
    .map(
      (v, i) =>
        `<miscellaneous-field name="gradus-species-P${i}">${assignedSpecies(s, v)}</miscellaneous-field><miscellaneous-field name="gradus-given-P${i}">${v.locked}</miscellaneous-field>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${esc(s.title)}</work-title></work><identification><miscellaneous>${metadata}</miscellaneous></identification><part-list>${s.voices.map((v, i) => `<score-part id="P${i}"><part-name>${esc(v.name)}</part-name></score-part>`).join("")}</part-list>${s.voices
    .map(
      (v, i) =>
        `<part id="P${i}">${Array.from(
          { length: s.bars },
          (_, b) =>
            `<measure number="${b + 1}">${b === 0 ? `<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${i === s.voices.length - 1 ? "F" : "G"}</sign><line>${i === s.voices.length - 1 ? 4 : 2}</line></clef></attributes>` : ""}${v.notes
              .filter((n) => Math.floor(n.time / 8) === b)
              .map(
                (n) =>
                  `<note>${n.pitch ? `<pitch><step>${n.pitch.step}</step><alter>${n.pitch.alter}</alter><octave>${n.pitch.octave}</octave></pitch>` : "<rest/>"}<duration>${n.duration}</duration>${n.tieStop ? '<tie type="stop"/>' : ""}${n.tieStart ? '<tie type="start"/>' : ""}${n.tieStart || n.tieStop ? `<notations>${n.tieStop ? '<tied type="stop"/>' : ""}${n.tieStart ? '<tied type="start"/>' : ""}</notations>` : ""}</note>`,
              )
              .join("")}</measure>`,
        ).join("")}</part>`,
    )
    .join("")}</score-partwise>`;
}
export function importXML(
  bytes: Uint8Array,
  filename: string,
  species: number,
  mode: string,
): Score {
  let xml: string;
  if (filename.toLowerCase().endsWith(".mxl")) {
    const files = unzipSync(bytes);
    const container = files["META-INF/container.xml"];
    if (!container) throw Error("Missing MusicXML container.");
    const c = new XMLParser({ ignoreAttributes: false }).parse(
      strFromU8(container),
    );
    const path = arr(c.container.rootfiles.rootfile)[0]["@_full-path"];
    if (!files[path]) throw Error("Missing root score.");
    xml = strFromU8(files[path]);
  } else xml = strFromU8(bytes);
  if (xml.length > 3_000_000)
    throw Error("This score is too large. Import a short exercise.");
  if (/<!ENTITY/i.test(xml))
    throw Error("XML entity declarations are unsupported.");
  xml = xml.replace(/<!DOCTYPE[^>]*>/gi, "");
  if (XMLValidator.validate(xml) !== true)
    throw Error("Invalid MusicXML document.");
  const p = new XMLParser({
    ignoreAttributes: false,
    alwaysCreateTextNode: false,
  });
  const doc = p.parse(xml)["score-partwise"];
  if (!doc) throw Error("Import a partwise MusicXML score.");
  const parts = arr(doc.part);
  if (parts.length < 1 || parts.length > 4)
    throw Error("Use one to four monophonic parts.");
  const names = arr(doc["part-list"]?.["score-part"]);
  const fields = new Map<string, string>(
    arr(doc.identification?.miscellaneous?.["miscellaneous-field"]).map(
      (x: any) => [x["@_name"], String(x["#text"])],
    ),
  );
  const given = parts.map(
    (_: any, i: number) => fields.get(`gradus-given-P${i}`) === "true",
  );
  const explicitGiven = given.filter(Boolean).length === 1;
  let bars = 0;
  const voices = parts.map((part: any, i: number) => {
    let time = 0,
      div = 2;
    const notes: Note[] = [];
    const measures = arr(part.measure);
    bars = Math.max(bars, measures.length);
    for (const m of measures) {
      if (m.backup || m.forward)
        throw Error(
          "Multiple voices on one staff are unsupported. Export each voice as a separate part.",
        );
      if (m.attributes?.divisions) div = Number(m.attributes.divisions);
      if (
        m.attributes?.time &&
        (Number(m.attributes.time.beats) !== 4 ||
          Number(m.attributes.time["beat-type"]) !== 4) &&
        !(
          Number(m.attributes.time.beats) === 2 &&
          Number(m.attributes.time["beat-type"]) === 2
        )
      )
        throw Error("Use 4/4 or 2/2 measures.");
      const start = time;
      for (const n of arr(m.note)) {
        if ("chord" in n || "grace" in n || n["time-modification"])
          throw Error("Chords, grace notes, and tuplets are unsupported.");
        const duration = (Number(n.duration) * 2) / div;
        if (![1, 1.5, 2, 3, 4, 6, 8].includes(duration))
          throw Error("Use whole through eighth notes, with optional dots.");
        const ties = arr(n.tie);
        notes.push({
          id: `v${i}n${time}`,
          time,
          duration,
          pitch: n.pitch
            ? {
                step: String(n.pitch.step),
                alter: Number(n.pitch.alter || 0),
                octave: Number(n.pitch.octave),
              }
            : null,
          rest: "rest" in n,
          tieStart: ties.some((t) => t["@_type"] === "start"),
          tieStop: ties.some((t) => t["@_type"] === "stop"),
        });
        time += duration;
      }
      if (Math.abs(time - start - 8) > 0.001)
        throw Error(
          "Each measure must contain one whole note of time; pickups are unsupported.",
        );
    }
    return {
      id: `v${i}`,
      name: String(
        names.find((x: any) => x["@_id"] === part["@_id"])?.["part-name"] ||
          `Voice ${i + 1}`,
      ),
      locked:
        parts.length > 1 && (explicitGiven ? given[i] : i === parts.length - 1),
      species: /^[1-5]$/.test(fields.get(`gradus-species-P${i}`) || "")
        ? Number(fields.get(`gradus-species-P${i}`))
        : undefined,
      notes,
    };
  });
  if (
    voices.some(
      (v) => v.notes.at(-1)!.time + v.notes.at(-1)!.duration !== bars * 8,
    )
  )
    throw Error("Parts must have equal lengths.");
  if (bars > 32) throw Error("Import at most 32 bars.");
  return assignSpecies({
    version: 1,
    id: crypto.randomUUID(),
    title: String(doc.work?.["work-title"] || "Imported exercise"),
    species,
    mode,
    bars,
    voices,
    cantusOnly: voices.length === 1,
  });
}
