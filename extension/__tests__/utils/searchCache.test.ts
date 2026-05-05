/** @jest-environment jsdom */
//
// Tests — searchCache helpers (chrome.storage.local LRU 5 queries)
// Source : src/utils/searchCache.ts (Phase 4 Semantic Search V1)

import { resetChromeMocks } from "../setup/chrome-api-mock";
import {
  getCachedQueries,
  pushCachedQuery,
  clearCachedQueries,
} from "../../src/utils/searchCache";

describe("searchCache", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("returns empty array when no queries cached yet", async () => {
    const queries = await getCachedQueries();
    expect(queries).toEqual([]);
  });

  it("pushes a new query at the head and persists it", async () => {
    await pushCachedQuery("transition énergétique");
    const queries = await getCachedQueries();
    expect(queries).toEqual(["transition énergétique"]);
  });

  it("keeps only the 5 most recent queries (LRU cap)", async () => {
    for (let i = 1; i <= 7; i++) {
      await pushCachedQuery(`query ${i}`);
    }
    const queries = await getCachedQueries();
    expect(queries).toHaveLength(5);
    // Most recent first
    expect(queries[0]).toBe("query 7");
    expect(queries[4]).toBe("query 3");
  });

  it("dedupes : pushing an existing query moves it to the head", async () => {
    await pushCachedQuery("a");
    await pushCachedQuery("b");
    await pushCachedQuery("c");
    await pushCachedQuery("a"); // already present → moved to head
    const queries = await getCachedQueries();
    expect(queries).toEqual(["a", "c", "b"]);
  });

  it("trims whitespace and ignores empty queries", async () => {
    await pushCachedQuery("   ");
    await pushCachedQuery("");
    const queries = await getCachedQueries();
    expect(queries).toEqual([]);
  });

  it("clearCachedQueries empties the cache", async () => {
    await pushCachedQuery("x");
    await clearCachedQueries();
    const queries = await getCachedQueries();
    expect(queries).toEqual([]);
  });
});
