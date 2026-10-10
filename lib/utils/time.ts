/** Time helpers. All persisted timestamps are unix seconds (UTC). */

export const nowSec = (): number => Math.floor(Date.now() / 1000);

export const DAY = 86400;
export const HOUR = 3600;
export const MINUTE = 60;

/** Bucket width string ("1d" | "1h" | "1m") → seconds. */
export function bucketSeconds(width: string): number {
  switch (width) {
    case "1m":
      return MINUTE;
    case "1h":
      return HOUR;
    default:
      return DAY;
  }
}

export const toUnixSeconds = (value: number): number =>
  value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);

export const toIso = (unixSec: number): string =>
  new Date(unixSec * 1000).toISOString();

/** Start-of-day (UTC) for a unix-second timestamp. */
export function floorToDay(unixSec: number): number {
  return Math.floor(unixSec / DAY) * DAY;
}

/** Human friendly relative time, e.g. "3h ago". */
export function relativeTime(unixSec: number | null | undefined): string {
  if (!unixSec) return "从未";
  const diff = nowSec() - unixSec;
  if (diff < 60) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

/** Format a unix-second timestamp as YYYY-MM-DD (UTC). */
export function fmtDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

export function bytes(value: number): string {
  if (value < 1000) return String(value);
  const units = ["K", "M", "B", "T"];
  let v = value;
  let i = -1;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)}${units[i]}`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function fmtCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  return bytes(Math.round(value));
}

export function fmtMoney(
  value: number | null | undefined,
  currency = "USD",
): string {
  if (value == null) return "—";
  const symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : "";
  return `${symbol}${value.toFixed(value < 1 ? 4 : 2)}`;
}

/**
 * Format a set of per-currency totals. Amounts in different currencies are not
 * additive, so they are rendered side by side: "¥12.34 + $5.67".
 */
export function fmtMoneyMulti(
  costs: { currency: string; amount: number }[] | null | undefined,
): string {
  const list = (costs ?? []).filter((c) => c.amount > 0);
  if (list.length === 0) return fmtMoney(0, "USD");
  return list.map((c) => fmtMoney(c.amount, c.currency)).join(" + ");
}

/** Parse a "Nd" / "Nh" range token into seconds. */
export function rangeToSeconds(range: string): number {
  const m = /^(\d+)([dhm])$/.exec(range);
  if (!m) return 30 * DAY;
  const n = Number(m[1]);
  switch (m[2]) {
    case "h":
      return n * HOUR;
    case "m":
      return n * MINUTE;
    default:
      return n * DAY;
  }
}
