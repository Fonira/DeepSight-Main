/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          types: ["jest"],
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  setupFiles: ["./__tests__/setup/chrome-api-mock.ts"],
  setupFilesAfterEnv: ["./jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
  moduleNameMapper: {
    "\\.css\\?raw$": "<rootDir>/__tests__/setup/css-raw.stub.ts",
    "\\.(css|less|scss)$": "<rootDir>/__tests__/setup/style-mock.ts",
    "\\.(png|jpg|jpeg|gif|svg)$": "<rootDir>/__tests__/setup/file-mock.ts",
    "^webextension-polyfill$": "<rootDir>/__tests__/setup/polyfill-mock.ts",
    // @deepsight/lighting-engine ships TypeScript via package.json `exports`;
    // ts-jest can't traverse `exports` with `.ts` entries — map directly to the source.
    "^@deepsight/lighting-engine$":
      "<rootDir>/node_modules/@deepsight/lighting-engine/src/index.ts",
  },
};
