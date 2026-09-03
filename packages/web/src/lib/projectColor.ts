/**
 * Deterministic colour per project name. Same name → same hue on every
 * machine, no config. Uses oklch so the tints stay legible in light and
 * dark themes; only the hue varies.
 */
export function projectHue(project: string): number {
  let h = 2166136261;
  for (let i = 0; i < project.length; i++) {
    h ^= project.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 360);
}

export function projectStyle(project: string): React.CSSProperties {
  const hue = projectHue(project);
  return {
    "--project-hue": String(hue),
  } as React.CSSProperties;
}
