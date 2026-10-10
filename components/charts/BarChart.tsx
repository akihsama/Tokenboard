"use client";

import { fmtCompact, fmtMoney, fmtNumber } from "@/lib/utils/time";

export interface BarDatum {
  label: string;
  value: number;
  tone?: number;
}

export type BarValueFormat = "compact" | "number" | "money";

const TONES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

function formatValue(v: number, fmt: BarValueFormat): string {
  switch (fmt) {
    case "number":
      return fmtNumber(v);
    case "money":
      return fmtMoney(v);
    default:
      return fmtCompact(v);
  }
}

/**
 * Horizontal bar chart for platform / model distribution.
 * Bars use the teal-led ramp by index.
 */
export default function BarChart({
  data,
  valueFormat = "compact",
  maxItems = 8,
}: {
  data: BarDatum[];
  valueFormat?: BarValueFormat;
  maxItems?: number;
}) {
  const rows = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return <div className="muted fs-13">暂无数据</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="row-between fs-13" style={{ marginBottom: 5 }}>
            <span
              className="nowrap"
              style={{ overflow: "hidden", textOverflow: "ellipsis" }}
              title={r.label}
            >
              {r.label}
            </span>
            <span className="num strong">{formatValue(r.value, valueFormat)}</span>
          </div>
          <div className="bar">
            <span
              style={{
                width: `${(r.value / max) * 100}%`,
                background: TONES[r.tone ?? i] ?? TONES[3],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
