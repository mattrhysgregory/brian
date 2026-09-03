import { useEffect } from "react";

/**
 * Reflects a count on the app icon (Badging API, used by the installed PWA on
 * the macOS Dock) and in the tab title, so an un-installed browser tab shows
 * the same signal. Both are best-effort: Safari/Chrome only expose
 * `setAppBadge` in secure contexts, and it rejects when the app is not
 * installed.
 */
export function useAppBadge(count: number) {
  useEffect(() => {
    document.title = count > 0 ? `(${count}) brain` : "brain";
  }, [count]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (count > 0) void nav.setAppBadge?.(count).catch(() => {});
      else void nav.clearAppBadge?.().catch(() => {});
    } catch {
      /* Badging unsupported or blocked; the title still carries the count. */
    }
  }, [count]);
}
