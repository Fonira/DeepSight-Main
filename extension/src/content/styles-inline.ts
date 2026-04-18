// Inlines the 3 stylesheets required by the shadow-DOM widget as strings.
// Rationale: <link rel="stylesheet" href="chrome-extension://..."> inside a
// closed shadow root loads asynchronously. During the load window the widget
// renders unstyled → looks "blank" to the user. Strings applied via <style>
// tags are synchronous and immune to network/CSP timing issues.

import tokensCss from "../styles/tokens.css?raw";
import widgetCss from "../styles/widget.css?raw";
import contentCss from "../styles/content.css?raw";

export function getInlineStyles(): string {
  return [tokensCss, widgetCss, contentCss].join("\n\n");
}
