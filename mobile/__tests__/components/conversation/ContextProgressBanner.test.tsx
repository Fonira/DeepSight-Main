/**
 * Tests for ContextProgressBanner.
 * Verifies render per state (streaming vs complete) + clamped progress.
 */
import React from "react";
import { render } from "@testing-library/react-native";

import { ContextProgressBanner } from "../../../src/components/conversation/ContextProgressBanner";

describe("ContextProgressBanner", () => {
  it("renders streaming label with floor(progress)%", () => {
    const { getByText, getByTestId } = render(
      <ContextProgressBanner progress={42.7} complete={false} />,
    );
    expect(getByTestId("context-progress-banner")).toBeTruthy();
    expect(getByText(/Analyse en cours : 42%/)).toBeTruthy();
  });

  it("renders complete label when complete=true", () => {
    const { getByText } = render(
      <ContextProgressBanner progress={100} complete={true} />,
    );
    expect(getByText(/Contexte vidéo complet/)).toBeTruthy();
  });

  it("does NOT render the streaming label once complete", () => {
    const { queryByText } = render(
      <ContextProgressBanner progress={100} complete={true} />,
    );
    expect(queryByText(/Analyse en cours/)).toBeNull();
  });

  it("clamps progress > 100 to 100% in label", () => {
    const { getByText } = render(
      <ContextProgressBanner progress={150} complete={false} />,
    );
    expect(getByText(/Analyse en cours : 100%/)).toBeTruthy();
  });

  it("clamps progress < 0 to 0% in label", () => {
    const { getByText } = render(
      <ContextProgressBanner progress={-25} complete={false} />,
    );
    expect(getByText(/Analyse en cours : 0%/)).toBeTruthy();
  });
});
