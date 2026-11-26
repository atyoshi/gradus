import { intervalName } from "./analysis";
import { initialClefs } from "./clefs";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
  GhostNote,
  Voice as VFVoice,
  Formatter,
  StaveTie,
  Beam,
  Dot,
  VexFlow,
} from "vexflow/bravura";
import {
  type Score,
  type Finding,
  type Pitch,
  type Note,
  degree,
  pitch,
  label,
  at,
  assignedSpecies,
} from "./model";
import { voiceMeasureFeedback } from "./feedback";
import { entryDuration } from "./entry";
import { eighthBeamGroups, engravedNote, notationDuration as duration } from "./notation";
VexFlow.setFonts("Bravura", "Academico");
type Slot = {
  note: Note;
  vi: number;
  x: number;
  left: number;
  right: number;
  bottomY: number;
  bottom: number;
  clef: string;
  stave: Stave;
  top: number;
  height: number;
};
const slotFill = (note: Note | undefined, selected: string, time: number) =>
  note && time >= note.time && time < note.time + note.duration
    ? "var(--playhead)"
    : note?.id === selected
      ? "var(--selection)"
      : "transparent";
const NO_PITCHES: Pitch[] = [];
export function ScoreView({
  score,
  selected,
  onSelect,
  onPitch,
  findings,
  time,
  inputDuration,
  readOnly = false,
  zoom = 1,
  candidates = NO_PITCHES,
  candidateTarget = "",
  onCandidate = onPitch,
  entryAccidental = 0,
}: {
  score: Score;
  selected: string;
  onSelect: (id: string) => void;
  onPitch: (id: string, p: Pitch) => void;
  findings: Finding[];
  time: number;
  inputDuration: number | null;
  readOnly?: boolean;
  zoom?: number;
  candidates?: Pitch[];
  candidateTarget?: string;
  entryAccidental?: number;
  onCandidate?: (id: string, p: Pitch) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null);
  const slots = useRef<Slot[]>([]);
  const drag = useRef<{
    id: string;
    y: number;
    moved: boolean;
    empty?: boolean;
    previewAt: (e: { clientX: number; clientY: number }) => Pitch | undefined;
    original: Pitch | null;
  } | null>(null);
  const [width, setWidth] = useState(900);
  const [preview, setPreview] = useState<{
    id: string;
    p: Pitch;
    x: number;
    y: number;
    bottomY: number;
    interval: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const clefs = useRef<{ id: string; values: string[] }>({
    id: "",
    values: [],
  });
  if (clefs.current.id !== score.id) {
    clefs.current = {
      id: score.id,
      values: initialClefs(score),
    };
  }
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(300, entries[0].contentRect.width)),
    );
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPreview(null);
  }, [score, selected]);
  useLayoutEffect(() => {
    if (!host.current) return;
    // Engrave offscreen, then swap once so the scroll container never collapses.
    const el = document.createElement("div");
    slots.current = [];
    const bars = Array.from({ length: score.bars }, (_, bar) => {
      const count = Math.max(
        ...score.voices.map(
          (v) => v.notes.filter((n) => Math.floor(n.time / 8) === bar).length,
        ),
      );
      return Math.max(100, count * 38 + 36) + (bar === 0 ? 65 : 0);
    });
    const natural = bars.reduce((a, b) => a + b, 0) + 45;
    const w = Math.max(width / zoom, natural);
    const extra = (w - natural) / score.bars;
    let nextTop = 16;
    const staffLayouts = score.voices.map((v, vi) => {
      const clef = score.clefs?.[vi] || clefs.current.values[vi] || "treble";
      const bottom =
        clef === "bass"
          ? 18
          : clef === "alto"
            ? 24
            : clef === "tenor"
              ? 22
              : 30;
      const ds = v.notes
        .filter((n) => n.pitch && !n.rest)
        .map((n) => degree(n.pitch!));
      if (v.notes.some((n) => n.id === candidateTarget))
        ds.push(...candidates.map(degree));
      const high = Math.max(bottom + 8, ...ds),
        low = Math.min(
          bottom - (!readOnly && !v.locked && clef === "bass" ? 7 : 0),
          ...ds,
        );
      const top = nextTop;
      const y = top + Math.max(32, (high - bottom) * 5 - 24);
      nextTop = y + 80 + Math.max(32, (bottom - low) * 5 + 24) + 16;
      return { clef, bottom, y, top, height: nextTop - top };
    });
    const h = Math.max(nextTop + 16, readOnly ? 0 : 340 / zoom);
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(w * zoom, h * zoom);
    const ctx = renderer.getContext();
    ctx.setFillStyle("var(--ink)");
    ctx.setStrokeStyle("var(--ink)");
    const svg = el.querySelector("svg")!;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.pointerEvents = "auto";
    svg.setAttribute("data-systems", "1");
    svg.setAttribute("data-clefs", staffLayouts.map((s) => s.clef).join(","));
    svg.setAttribute("aria-label", "Counterpoint score");
    const highlights = document.createElementNS(svg.namespaceURI, "g");
    highlights.setAttribute("class", "measure-highlights");
    svg.appendChild(highlights);
    const rendered = new Map<string, StaveNote>();
    const voiceStates = voiceMeasureFeedback(score, findings);
    let x = 20;
    for (let bar = 0; bar < score.bars; bar++) {
      const bw = bars[bar] + extra;
      score.voices.forEach((v, vi) => {
        const severity = voiceStates.get(v.id)?.get(bar + 1);
        if (!severity) return;
        const { top, height } = staffLayouts[vi];
        const highlight = document.createElementNS(svg.namespaceURI, "rect");
        highlight.setAttribute("class", `measure-highlight ${severity}`);
        highlight.setAttribute("x", String(x + 6));
        highlight.setAttribute("y", String(top + 8));
        highlight.setAttribute("width", String(bw - 12));
        highlight.setAttribute("height", String(height - 16));
        highlight.setAttribute("rx", "12");
        highlight.setAttribute("stroke", "none");
        highlight.setAttribute("pointer-events", "none");
        highlight.setAttribute("role", "img");
        highlight.setAttribute(
          "aria-label",
          `${v.name}, bar ${bar + 1}: ${severity === "error" ? "rule violation" : "could be improved"}`,
        );
        highlight.setAttribute("data-voice", v.id);
        highlight.setAttribute("data-measure", String(bar + 1));
        highlight.setAttribute("data-severity", severity);
        highlights.appendChild(highlight);
      });
      const voices: VFVoice[] = [];
      const layouts: {
        stave: Stave;
        vi: number;
        notes: (StaveNote | GhostNote)[];
        ns: Note[];
        beams: Beam[];
        bottom: number;
        clef: string;
      }[] = [];
      score.voices.forEach((v, vi) => {
        const { y, clef, bottom } = staffLayouts[vi];
        const florid = assignedSpecies(score, v) === 5;
        const stave = new Stave(x, y, bw);
        if (bar === 0) stave.addClef(clef);
        stave.setContext(ctx).draw();
        if (bar === 0) {
          ctx.setFont("Arial", 12);
          ctx.fillText(
            v.locked && !readOnly ? "Cantus" : v.name,
            x + 3,
            y - 12,
          );
        }
        if (vi === 0) {
          ctx.setFont("Arial", 12);
          ctx.fillText(String(bar + 1), x + (bar === 0 ? 53 : 8), y + 9);
        }
        const ns = v.notes.filter((n) => Math.floor(n.time / 8) === bar);
        const accidentals = new Map<string, number>();
        const notes = ns.map((n) => {
          if (!n.pitch && !n.rest) {
            const ghost = new GhostNote({ duration: duration(n.duration, florid) });
            if ([6, 3, 1.5].includes(n.duration))
              Dot.buildAndAttach([ghost], { all: true });
            return ghost;
          }
          const p = n.pitch || pitch(bottom + 4);
          const accidentalKey = `${p.step}/${p.octave}`;
          const previousAlter = accidentals.get(accidentalKey) || 0;
          const note = engravedNote(
            p,
            n.duration,
            clef,
            !!n.rest,
            previousAlter,
            florid,
          );
          if (!n.rest) accidentals.set(accidentalKey, p.alter);
          const color = findings.some(
            (f) => f.severity === "error" && f.notes.includes(n.id),
          )
            ? "var(--error)"
            : n.id === selected
              ? "var(--accent)"
              : v.locked
                ? "var(--muted)"
                : "var(--ink)";
          note.setStyle({ fillStyle: color, strokeStyle: color });
          note.setLedgerLineStyle({ strokeStyle: color, lineWidth: 1.2 });
          note.setAttribute("id", `score-note-${n.id}`);
          rendered.set(n.id, note);
          return note;
        });
        const beams = eighthBeamGroups(ns).map((group) =>
          new Beam(group.map((index) => notes[index] as StaveNote), true),
        );
        const voice = new VFVoice({ numBeats: 4, beatValue: 4 })
          .setStrict(false)
          .addTickables(notes);
        voices.push(voice);
        layouts.push({ stave, vi, notes, ns, beams, bottom, clef });
      });
      const formatter = new Formatter();
      voices.forEach((v) => formatter.joinVoices([v]));
      formatter.format(voices, bw - (bar === 0 ? 65 : 20));
      layouts.forEach((l, i) => {
        voices[i].draw(ctx, l.stave);
        l.beams.forEach((beam) => beam.setContext(ctx).draw());
        l.ns.forEach((n, j) => {
          const nx = l.notes[j].getAbsoluteX();
          const next = l.notes[j + 1]?.getAbsoluteX();
          const prev = l.notes[j - 1]?.getAbsoluteX();
          slots.current.push({
            note: n,
            vi: l.vi,
            x: nx,
            left: j === 0 ? x + (bar === 0 ? 45 : 0) : (prev! + nx) / 2,
            right: next ? (nx + next) / 2 : x + bw,
            bottomY: l.stave.getYForLine(4),
            bottom: l.bottom,
            clef: l.clef,
            stave: l.stave,
            top: staffLayouts[l.vi].top,
            height: staffLayouts[l.vi].height,
          });
        });
      });
      x += bw;
    }
    score.voices.forEach((v) =>
      v.notes.forEach((n, i) => {
        const a = rendered.get(n.id),
          b = rendered.get(v.notes[i + 1]?.id);
        if (n.tieStart && n.pitch && v.notes[i + 1]?.pitch && a && b)
          new StaveTie({
            firstNote: a,
            lastNote: b,
            firstIndexes: [0],
            lastIndexes: [0],
          })
            .setContext(ctx)
            .draw();
      }),
    );
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
    overlay.setAttribute("class", "slot-layer");
    svg.appendChild(overlay);
    slots.current.forEach((s) => {
      const v = score.voices[s.vi],
        rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(s.left));
      rect.setAttribute("width", String(s.right - s.left));
      rect.setAttribute("y", String(s.top));
      rect.setAttribute("height", String(s.height));
      rect.setAttribute("rx", "12");
      rect.setAttribute("fill", slotFill(s.note, selected, time));
      rect.setAttribute("stroke", "none");
      rect.setAttribute("role", "button");
      rect.setAttribute("tabindex", readOnly ? "-1" : "0");
      rect.setAttribute(
        "aria-label",
        `${v.name}, bar ${Math.floor(s.note.time / 8) + 1}, beat ${(s.note.time % 8) / 2 + 1}: ${s.note.rest ? "rest" : label(s.note.pitch)}${v.locked ? ", given" : ""}`,
      );
      rect.dataset.note = s.note.id;
      rect.dataset.time = String(s.note.time);
      rect.style.pointerEvents = "all";
      rect.style.cursor = "default";
      overlay.appendChild(rect);
      const previewAt = (e: { clientX: number; clientY: number }) => {
        if (v.locked || readOnly) return;
        const currentSvg = host.current?.querySelector("svg");
        const matrix = currentSvg?.getScreenCTM();
        if (!matrix) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
          matrix.inverse(),
        );
        // Keep the transient preview, including its stem, inside this voice's region.
        const previewY = Math.max(
          s.top + 40,
          Math.min(s.top + s.height - 28, pt.y),
        );
        const p = pitch(
          Math.max(
            0,
            Math.min(62, Math.round((s.bottomY - previewY) / 5) + s.bottom),
          ),
          s.note.pitch?.alter ?? entryAccidental,
        );
        const cf = score.voices.find((v) => v.locked),
          cn = cf && at(cf, s.note.time);
        const value = cn?.pitch
          ? `${intervalName(Math.abs(degree(p) - degree(cn.pitch)) + 1)} with cantus (${label(cn.pitch)})`
          : "";
        setPreview({
          id: s.note.id,
          p,
          x: s.x,
          y: s.bottomY - (degree(p) - s.bottom) * 5,
          bottomY: s.bottomY,
          interval: value,
          clientX: e.clientX,
          clientY: new DOMPoint(0, s.top + 32).matrixTransform(matrix).y,
        });
        return p;
      };
      rect.onpointermove = (e) => {
        if (drag.current && drag.current.id !== s.note.id) return;
        if (drag.current && Math.abs(e.clientY - drag.current.y) > 3)
          drag.current.moved = true;
        previewAt(e);
      };
      rect.onpointerleave = () => {
        if (!drag.current) setPreview(null);
      };
      rect.onpointerdown = (e) => {
        if (v.locked || readOnly) return;
        e.preventDefault();
        scroll.current?.focus({ preventScroll: true });
        onSelect(s.note.id);
        drag.current = {
          id: s.note.id,
          y: e.clientY,
          moved: false,
          empty: !s.note.pitch || !!s.note.rest,
          previewAt,
          original: s.note.pitch,
        };
        scroll.current?.setPointerCapture(e.pointerId);
        previewAt(e);
      };
      rect.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(s.note.id);
        }
        if (e.key === "Escape") {
          drag.current = null;
          setPreview(null);
        }
      };
    });
    const candidateSlot = slots.current.find(
      (s) => s.note.id === candidateTarget,
    );
    if (
      candidateSlot &&
      !readOnly &&
      candidates.length &&
      !score.voices[candidateSlot.vi].locked
    ) {
      const marker = document.createElementNS(svg.namespaceURI, "rect");
      marker.setAttribute("class", "candidate-target");
      marker.setAttribute("x", String(candidateSlot.left));
      marker.setAttribute("y", String(candidateSlot.top));
      marker.setAttribute(
        "width",
        String(candidateSlot.right - candidateSlot.left),
      );
      marker.setAttribute("height", String(candidateSlot.height));
      marker.setAttribute("pointer-events", "none");
      svg.appendChild(marker);
      candidates.forEach((p) => {
        const g = document.createElementNS(
          svg.namespaceURI,
          "g",
        ) as SVGGElement;
        g.setAttribute("class", "candidate-note");
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.setAttribute("aria-label", `Enter ${label(p)}, locally compatible`);
        g.setAttribute("data-candidate-pitch", label(p));
        g.setAttribute("data-candidate-for", candidateTarget);
        const y =
          candidateSlot.bottomY - (degree(p) - candidateSlot.bottom) * 5;
        const x = candidateSlot.x + 7;
        // Candidate heads sit just to the right of the attack; the selected note stays legible.
        const cx = x + 24;
        const target = document.createElementNS(svg.namespaceURI, "rect");
        target.setAttribute("x", String(cx - 11));
        target.setAttribute("y", String(y - 3));
        target.setAttribute("width", "24");
        target.setAttribute("height", "6");
        target.setAttribute("fill", "transparent");
        g.appendChild(target);
        for (let ly = candidateSlot.bottomY + 10; ly <= y + 1; ly += 10) {
          const line = document.createElementNS(svg.namespaceURI, "path");
          line.setAttribute("d", `M${cx - 10},${ly}h20`);
          g.appendChild(line);
        }
        for (let ly = candidateSlot.bottomY - 50; ly >= y - 1; ly -= 10) {
          const line = document.createElementNS(svg.namespaceURI, "path");
          line.setAttribute("d", `M${cx - 10},${ly}h20`);
          g.appendChild(line);
        }
        const head = document.createElementNS(svg.namespaceURI, "ellipse");
        head.setAttribute("cx", String(cx));
        head.setAttribute("cy", String(y));
        head.setAttribute("rx", "6");
        head.setAttribute("ry", "3");
        head.setAttribute("transform", `rotate(-18 ${cx} ${y})`);
        g.appendChild(head);
        g.onpointerdown = (e) => {
          e.stopPropagation();
          e.preventDefault();
          scroll.current?.focus({ preventScroll: true });
        };
        g.onpointerup = (e) => {
          e.stopPropagation();
          onCandidate(candidateTarget, p);
        };
        g.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onCandidate(candidateTarget, p);
          }
        };
        svg.appendChild(g);
      });
    }
    host.current.replaceChildren(...Array.from(el.childNodes));
    const selectedSlot = slots.current.find((s) => s.note.id === selected);
    if (selectedSlot && scroll.current) {
      const left = scroll.current.scrollLeft,
        view = scroll.current.clientWidth;
      if (
        selectedSlot.x * zoom < left + 25 ||
        selectedSlot.x * zoom > left + view - 30
      )
        scroll.current.scrollLeft = Math.max(
          0,
          selectedSlot.x * zoom - view * 0.35,
        );
    }
  }, [
    score,
    findings,
    width,
    onSelect,
    onPitch,
    readOnly,
    selected,
    zoom,
    candidates,
    candidateTarget,
    onCandidate,
    entryAccidental,
  ]);
  useEffect(() => {
    const svg = host.current?.querySelector("svg");
    svg?.querySelector(".pitch-preview")?.remove();
    if (!svg || !preview) return;
    const slot = slots.current.find((s) => s.note.id === preview.id);
    if (!slot) return;
    const value = entryDuration(score, preview.id, inputDuration);
    const previous =
      score.voices[slot.vi].notes
        .filter(
          (n) =>
            n.time < slot.note.time &&
            Math.floor(n.time / 8) === Math.floor(slot.note.time / 8) &&
            !n.rest &&
            n.pitch?.step === preview.p.step &&
            n.pitch.octave === preview.p.octave,
        )
        .at(-1)?.pitch?.alter || 0;
    const note = engravedNote(preview.p, value, slot.clef, false, previous, assignedSpecies(score, score.voices[slot.vi]) === 5);
    note.setStyle({ fillStyle: "var(--accent)", strokeStyle: "var(--accent)" });
    note.setLedgerLineStyle({ strokeStyle: "var(--accent)", lineWidth: 1.2 });
    // Use an isolated context so hovering never clears or reformats the score.
    const renderer = new Renderer(
      document.createElement("div"),
      Renderer.Backends.SVG,
    );
    const ctx = renderer.getContext();
    const g = ctx.openGroup();
    g.setAttribute("class", "pitch-preview");
    g.setAttribute("pointer-events", "none");
    g.setAttribute("opacity", ".9");
    g.setAttribute("data-preview-pitch", label(preview.p));
    g.setAttribute("data-preview-duration", String(value));
    const voice = new VFVoice({ numBeats: 4, beatValue: 4 })
      .setStrict(false)
      .addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], 100);
    note.setStave(slot.stave);
    const tick = note.getTickContext();
    tick.setX(tick.getX() + slot.x - note.getAbsoluteX());
    voice.draw(ctx, slot.stave);
    ctx.closeGroup();
    // VexFlow adds invisible hit rectangles with pointer-events="auto".
    // A transient preview must never intercept the slot beneath the cursor.
    g.querySelectorAll("[pointer-events]").forEach((el: Element) =>
      el.setAttribute("pointer-events", "none"),
    );
    svg.appendChild(g);
  }, [
    preview,
    score,
    inputDuration,
    findings,
    width,
    onSelect,
    onPitch,
    readOnly,
    selected,
    zoom,
    candidates,
    candidateTarget,
    onCandidate,
    entryAccidental,
  ]);
  useEffect(() => {
    host.current
      ?.querySelectorAll<SVGRectElement>("[data-time]")
      .forEach((r) => {
        const n = score.voices
          .flatMap((v) => v.notes)
          .find((n) => n.id === r.dataset.note);
        r.setAttribute("fill", slotFill(n, selected, time));
      });
    const selection = slots.current.find((s) => s.note.id === selected);
    if (time < 0 && selection && scroll.current) {
      const box = scroll.current;
      if (
        selection.x * zoom < box.scrollLeft + 20 ||
        selection.x * zoom > box.scrollLeft + box.clientWidth - 25
      )
        box.scrollLeft = Math.max(
          0,
          selection.x * zoom - box.clientWidth * 0.35,
        );
    }
    const active = slots.current.find(
      (s) => time >= s.note.time && time < s.note.time + s.note.duration,
    );
    if (active && scroll.current && time >= 0) {
      const box = scroll.current;
      if (
        active.x * zoom > box.scrollLeft + box.clientWidth - 35 ||
        active.x * zoom < box.scrollLeft
      )
        box.scrollLeft = Math.max(0, active.x * zoom - 50);
    }
  }, [time, score, selected, zoom, candidates]);
  return (
    <div
      className={"score-scroll" + (readOnly ? " read-only" : "")}
      tabIndex={0}
      aria-label="Score editor"
      ref={scroll}
      onPointerLeave={() => {
        if (!drag.current) setPreview(null);
      }}
      onScroll={() => setPreview(null)}
      onPointerMove={(e) => {
        const gesture = drag.current;
        if (!gesture) return;
        if (Math.abs(e.clientY - gesture.y) > 3) gesture.moved = true;
        gesture.previewAt(e);
      }}
      onPointerUp={(e) => {
        const gesture = drag.current;
        if (!gesture) return;
        const p = gesture.previewAt(e);
        drag.current = null;
        setPreview(null);
        if (
          p &&
          (gesture.empty ||
            gesture.moved ||
            !gesture.original ||
            degree(p) !== degree(gesture.original) ||
            p.alter !== gesture.original.alter)
        )
          onPitch(gesture.id, p);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPreview(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          drag.current = null;
          setPreview(null);
        }
      }}
    >
      <div ref={host} className="engraving" />
      {preview && (
        <div
          className="placement-label"
          role="tooltip"
          aria-label="Note placement"
          style={{
            left: Math.max(
              8,
              Math.min(preview.clientX + 20, window.innerWidth - 128),
            ),
            top: Math.max(
              8,
              Math.min(preview.clientY, window.innerHeight - 36),
            ),
          }}
        >
          <strong>{label(preview.p)}</strong>
          <span>
            {preview.interval
              ? ` · ${preview.interval.split(" with cantus")[0]}`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}
