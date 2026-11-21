import { useLayoutEffect, useRef } from "react";

export function RhythmIcon({ glyph }: { glyph: string }) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const center = () => {
      const text = svg.current?.querySelector("text");
      const ctx = document.createElement("canvas").getContext("2d");
      if (!active || !text || !ctx || !svg.current) return;
      ctx.font = "32px Bravura";
      const ink = ctx.measureText(glyph);
      const x = (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2;
      const y = (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2;
      svg.current.setAttribute("viewBox", `${x - 18} ${y - 22} 36 44`);
    };
    center();
    document.fonts.ready.then(center);
    return () => { active = false; };
  }, [glyph]);
  return (
    <svg className="duration-glyph" ref={svg} viewBox="-18 -22 36 44" aria-hidden="true">
      <text fontFamily="Bravura" fontSize="32" fill="currentColor">{glyph}</text>
    </svg>
  );
}

function AccidentalIcon({ name }: { name: "flat" | "natural" | "sharp" }) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const fit = () => {
      const el = svg.current;
      const text = el?.querySelector("text");
      const ctx = document.createElement("canvas").getContext("2d");
      if (!active || !el || !text || !ctx) return;
      ctx.font = "32px Bravura";
      const ink = ctx.measureText(text.textContent || "");
      const x = -ink.actualBoundingBoxLeft;
      const y = -ink.actualBoundingBoxAscent;
      const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
      const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
      if (width && height)
        el.setAttribute(
          "viewBox",
          `${x - 2} ${y - 2} ${width + 4} ${height + 4}`,
        );
    };
    fit();
    document.fonts.ready.then(fit);
    return () => {
      active = false;
    };
  }, [name]);
  return (
    <svg
      ref={svg}
      className="editor-icon"
      viewBox="-16 -32 32 48"
      aria-hidden="true"
    >
      <text
        fontFamily="Bravura"
        fontSize="32"
        fill="currentColor"
        stroke="none"
      >
        {{ flat: "\uE260", natural: "\uE261", sharp: "\uE262" }[name]}
      </text>
    </svg>
  );
}

/** Music/control icons use explicit ink bounds, independent of font metrics. */
export function EditorIcon({
  name,
}: {
  name:
    | "flat"
    | "natural"
    | "sharp"
    | "up"
    | "down"
    | "play"
    | "stop"
    | "quarter"
    | "undo"
    | "redo";
}) {
  if (name === "flat" || name === "natural" || name === "sharp")
    return <AccidentalIcon name={name} />;
  const paths = {
    up: <path d="M12 21V3m-7 7 7-7 7 7" />,
    down: <path d="M12 3v18m-7-7 7 7 7-7" />,
    play: <path d="m7 4 13 8-13 8Z" fill="currentColor" stroke="none" />,
    stop: (
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    ),
    quarter: (
      <>
        <path d="M16 17V2" />
        <ellipse
          cx="11"
          cy="18"
          rx="5"
          ry="3.5"
          transform="rotate(-20 11 18)"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
    undo: <path d="m8 5-5 5 5 5M3 10h10a7 7 0 0 1 7 7" />,
    redo: <path d="m16 5 5 5-5 5m5-5H11a7 7 0 0 0-7 7" />,
  };
  return (
    <svg
      className="editor-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
