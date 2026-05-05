import { useEffect } from "react";

interface Options {
  /** CSS selector that must contain the active focus / mouse target for interception */
  scopeSelector: string;
  /** Called when Cmd/Ctrl+F is pressed inside scope */
  onIntercept: () => void;
  /** Disable the listener (e.g. user is in a textarea) */
  enabled?: boolean;
}

export function useCmdFIntercept({
  scopeSelector,
  onIntercept,
  enabled = true,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const isCmdF =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f" && !e.shiftKey;
      if (!isCmdF) return;
      // Strict scope policy: only intercept Cmd/Ctrl+F when the *event target*
      // is inside the scope element (typically `.analysis-page`). Anywhere
      // else on the app, leave the browser default Find-in-page intact —
      // intercepting globally surprises users on dashboards / settings / etc.
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(scopeSelector)) return;
      e.preventDefault();
      onIntercept();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scopeSelector, onIntercept, enabled]);
}
