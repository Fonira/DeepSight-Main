/**
 * Jest mock for webextension-polyfill
 *
 * Redirects `import Browser from "webextension-polyfill"` to the same
 * `chrome` mock defined in `chrome-api-mock.ts` (which already exposes
 * Promise-based APIs — no callback wrapping needed).
 *
 * This keeps a single source of truth for the mocked APIs while letting
 * production code import via the cross-browser polyfill.
 */

const browserMock = (globalThis as unknown as { chrome: unknown }).chrome;

export default browserMock;
module.exports = browserMock;
module.exports.default = browserMock;
