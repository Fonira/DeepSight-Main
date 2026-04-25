// Compile-time constants injected by webpack.DefinePlugin.
// Empty string fallbacks are applied in webpack.config.js — at runtime
// the constants are always defined, but the values may be empty.

declare const __TARGET_BROWSER__: string;
declare const __SENTRY_DSN__: string;
