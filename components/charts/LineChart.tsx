"use client";

import { useMemo, useState } from "react";

import { fmtCompact, fmtMoney, fmtNumber, fmtDate } from "@/lib/utils/time";

export interface SeriesPoint {
  x: number; // unix seconds
  y: number;
}

export interface Series {
  name: string;
  points: SeriesPoint[];
  /** series ramp index (0 = accent teal) */
  tone?: number;
}

/**
 * Serializable format selectors. Server components cannot pass functions to
 * client components, so callers pass a format name instead.
 */
export type ValueFormat = "compact" | "number" | "money" | "decimal";
export type LabelFormat = "date" | "month" | "datetime";

const TONES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

function formatValue(v: number, fmt: ValueFormat): string {
  switch (fmt) {
    case "number":
      return fmtNumber(v);
    case "money":
      return fmtMoney(v);
    case "decimal":
      return v.toFixed(1);
    default:
      return fmtCompact(v);
  }
}

function formatLabel(x: number, fmt: LabelFormat): string {
  const d = new Date(x * 1000);
  switch (fmt) {
    case "month":
      return d.toISOString().slice(0, 7);
    case "datetime":
      return `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)}`;
    default:
      return fmtDate(x);
  }
}

interface Props {
  series: Series[];
  height?: number;
  valueFormat?: ValueFormat;
  labelFormat?: LabelFormat;
  area?: boolean;
}

/**
 * Dependency-free line chart.
 * Uses an SVG viewBox with padding for axes and a teal-led ramp.
 */
export default function LineChart({
  series,
  height = 240,
  valueFormat = "compact",
  labelFormat = "date",
  area = true,
}: Props) {
  const W = 800;
  const H = height;
  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const [hover, setHover] = useState<number | null>(null);

  const { maxY, paths, allX, sx } = useMemo(() => {
    const allPoints = series.flatMap((s) => s.points);
    const xsArr = Array.from(new Set(allPoints.map((p) => p.x))).sort(
      (a, b) => a - b,
    );
    const maxYv = Math.max(1, ...allPoints.map((p) => p.y));
    const minX = xsArr.length ? xsArr[0] : 0;
    const maxX = xsArr.length ? xsArr[xsArr.length - 1] : 1;

    const sxFn = (x: number) =>
      padL + ((x - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);
    const sy = (y: number) => padT + (1 - y / maxYv) * (H - padT - padB);

    const built = series.map((s) => {
      const sorted = [...s.points].sort((a, b) => a.x - b.x);
      if (sorted.length === 0) return { line: "", area: "" };
      const line = sorted
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"}${sxFn(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
        )
        .join(" ");
      const areaPath = `${line} L${sxFn(sorted[sorted.length - 1].x).toFixed(1)},${(
        H - padB
      ).toFixed(1)} L${sxFn(sorted[0].x).toFixed(1)},${(H - padB).toFixed(1)} Z`;
      return { line, area: areaPath };
    });

    return { maxY: maxYv, paths: built, allX: xsArr, sx: sxFn };
  }, [series, H, padB, padL, padR, padT]);

  const gridLines = 4;

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padT + (i / gridLines) * (H - padT - padB);
          const value = maxY * (1 - i / gridLines);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--text-faint)"
              >
                {formatValue(value, valueFormat)}
              </text>
            </g>
          );
        })}

        {area &&
          paths.map((p, i) =>
            p.area ? (
              <path
                key={`a${i}`}
                d={p.area}
                fill={TONES[series[i].tone ?? i] ?? TONES[2]}
                opacity={0.06}
              />
            ) : null,
          )}

        {paths.map((p, i) =>
          p.line ? (
            <path
              key={`l${i}`}
              d={p.line}
              fill="none"
              stroke={TONES[series[i].tone ?? i] ?? TONES[2]}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}

        {hover !== null && allX.length > 0 && (
          <line
            x1={sx(hover)}
            x2={sx(hover)}
            y1={padT}
            y2={H - padB}
            stroke="var(--text-faint)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {allX.length > 0 &&
          [0, Math.floor(allX.length / 2), allX.length - 1]
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .map((idx) => (
              <text
                key={idx}
                x={sx(allX[idx])}
                y={H - 8}
                textAnchor={
                  idx === 0 ? "start" : idx === allX.length - 1 ? "end" : "middle"
                }
                fontSize={10}
                fill="var(--text-faint)"
              >
                {formatLabel(allX[idx], labelFormat)}
              </text>
            ))}

        <rect
          x={padL}
          y={padT}
          width={W - padL - padR}
          height={H - padT - padB}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.target as SVGRectElement).getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (allX.length === 0) return;
            const idx = Math.min(
              allX.length - 1,
              Math.max(0, Math.round(ratio * (allX.length - 1))),
            );
            setHover(allX[idx]);
          }}
        />
      </svg>

      <div
        className="row wrap fs-12"
        style={{ gap: 14, paddingLeft: padL, marginTop: 6 }}
      >
        {series.map((s, i) => (
          <span key={s.name} className="row" style={{ gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 2.5,
                background: TONES[s.tone ?? i] ?? TONES[2],
                display: "inline-block",
              }}
            />
            <span className="muted">{s.name}</span>
          </span>
        ))}
      </div>

      {hover !== null && (
        <div
          className="fs-12"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            color: "var(--text-muted)",
          }}
        >
          {formatLabel(hover, labelFormat)}
        </div>
      )}
    </div>
  );
}
