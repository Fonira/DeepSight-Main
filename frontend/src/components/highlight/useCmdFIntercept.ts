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
      const scope = document.querySelector(scopeSelector);
      if (!scope) return;
      const active = document.activeElement;
      const inScope = active
        ? scope.contains(active) || scope === active
        : false;
      // Also intercept if the user is just on the page (no input focused)
      const onPageNoInputFocused =
        !active ||
        active === document.body ||
        (active instanceof HTMLElement &&
          !["INPUT", "TEXTAREA"].includes(active.tagName));
      if (inScope || onPageNoInputFocused) {
        e.preventDefault();
        onIntercept();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scopeSelector, onIntercept, enabled]);
}
