require("@testing-library/jest-dom");

// Mirror webpack's DefinePlugin for __TARGET_BROWSER__.
// Tests run against the Chrome build by default; override per-test if needed:
//   (globalThis as any).__TARGET_BROWSER__ = "safari";
globalThis.__TARGET_BROWSER__ = "chrome";
