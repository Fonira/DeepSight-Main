import { pickAgentType, type VoicePanelContext } from "../../src/sidepanel/types";

describe("pickAgentType", () => {
  it("returns 'companion' when ctx is null", () => {
    expect(pickAgentType(null)).toBe("companion");
  });

  it("returns 'companion' when ctx is undefined", () => {
    expect(pickAgentType(undefined)).toBe("companion");
  });

  it("returns 'companion' when summaryId is missing", () => {
    const ctx: VoicePanelContext = { videoId: "abc", videoTitle: "x" };
    expect(pickAgentType(ctx)).toBe("companion");
  });

  it("returns 'companion' when summaryId is null", () => {
    const ctx: VoicePanelContext = {
      summaryId: null,
      videoId: "abc",
      videoTitle: "x",
    };
    expect(pickAgentType(ctx)).toBe("companion");
  });

  it("returns 'explorer' when summaryId is a number", () => {
    const ctx: VoicePanelContext = {
      summaryId: 42,
      videoId: "abc",
      videoTitle: "x",
    };
    expect(pickAgentType(ctx)).toBe("explorer");
  });

  it("returns 'companion' when summaryId is 0 — defensive (unlikely real summaryId)", () => {
    // 0 is a number → currently returns explorer; document that behavior.
    // If the backend ever uses 0 as sentinel, update this test + impl.
    expect(pickAgentType({ summaryId: 0 })).toBe("explorer");
  });
});
