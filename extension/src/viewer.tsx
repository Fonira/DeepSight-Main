import React from "react";
import { createRoot } from "react-dom/client";
import { ViewerApp } from "./viewer/ViewerApp";

const params = new URLSearchParams(window.location.search);
const summaryId = parseInt(params.get("id") || "0", 10);

const rootEl = document.getElementById("viewer-root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<ViewerApp summaryId={summaryId} />);
}
