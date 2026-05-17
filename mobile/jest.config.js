module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect",
    "<rootDir>/jest.setup.js",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/types/**",
  ],
  // Baselined 2026-05-17 from actual coverage on main (statements 18.26%,
  // branches 13.42%, lines 18.61%, functions 15.78%). Set just below each
  // measured value to lock in a no-regression floor without masking the
  // overall low-coverage tech debt. Raise progressively as tests are added.
  coverageThreshold: {
    global: {
      branches: 13,
      functions: 15,
      lines: 18,
      statements: 18,
    },
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
