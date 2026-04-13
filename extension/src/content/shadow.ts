// ── Shadow DOM encapsulation ──
// Provides isolated DOM for the DeepSight widget.
// All DOM queries within the widget MUST use these helpers instead of document.*.

let _shadowRoot: ShadowRoot | null = null;

export function getShadowRoot(): ShadowRoot | null {
  return _shadowRoot;
}

export function setShadowRoot(root: ShadowRoot): void {
  _shadowRoot = root;
}

/** Query by ID within the shadow root. Falls back to null if shadow not ready. */
export function $id<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return (_shadowRoot?.getElementById(id) as T) ?? null;
}

/** querySelector within the shadow root. */
export function $qs<T extends Element = Element>(selector: string): T | null {
  return _shadowRoot?.querySelector<T>(selector) ?? null;
}

/** querySelectorAll within the shadow root. */
export function $qsa<T extends Element = Element>(
  selector: string,
): NodeListOf<T> {
  if (!_shadowRoot)
    return document.createDocumentFragment().querySelectorAll<T>(selector); // empty list
  return _shadowRoot.querySelectorAll<T>(selector);
}
