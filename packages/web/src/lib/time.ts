const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["week", 7 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000],
];

/** "3 minutes ago" / "in 2 days", falling back to "just now" under a minute. */
export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return RTF.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
