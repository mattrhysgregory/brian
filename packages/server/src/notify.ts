import type { Issue } from "@brian/shared";

export type Notifier = (issue: Issue) => void;

export interface CreateNotifierOptions {
  /** Master switch. Typically `process.env.BRIAN_NOTIFY !== "0"`. */
  enabled: boolean;
  /** Typically `process.platform`; notifications only fire on "darwin". */
  platform: NodeJS.Platform;
  /** Runs a command, e.g. Bun.spawn. Injectable for tests. */
  run: (cmd: string[]) => void;
}

const SUBTITLES: Record<"needs_attention" | "blocked", string> = {
  needs_attention: "Needs attention",
  blocked: "Blocked",
};

/**
 * Fires a macOS notification when an issue transitions into needs_attention
 * or blocked. Fire-and-forget: never throws, never blocks the caller.
 */
export function createNotifier(options: CreateNotifierOptions): Notifier {
  const { enabled, platform, run } = options;
  return (issue: Issue) => {
    if (!enabled || platform !== "darwin") return;
    if (issue.status !== "needs_attention" && issue.status !== "blocked") return;

    try {
      const title = `#${issue.id} ${issue.title}`;
      const subtitle = issue.project
        ? `${SUBTITLES[issue.status]} · ${issue.project}`
        : SUBTITLES[issue.status];

      // Text is passed to osascript as argv (`item 1 of argv`) rather than
      // interpolated into the AppleScript source, so no quoting/escaping of
      // the issue title or project can break out of the script.
      const script = `on run argv
  display notification (item 1 of argv) with title "brian" subtitle (item 2 of argv)
end run`;
      run(["osascript", "-e", script, title, subtitle]);
    } catch {
      // Never let a notification failure affect the request that triggered it.
    }
  };
}

/** Default notifier wired from environment/platform, spawning osascript via Bun. */
export function createDefaultNotifier(): Notifier {
  return createNotifier({
    enabled: process.env.BRIAN_NOTIFY !== "0",
    platform: process.platform,
    run: (cmd) => {
      try {
        Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
      } catch {
        // best-effort; never throw
      }
    },
  });
}
