const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Enable CSS support for web
config.resolver.sourceExts.push("css");

// Watch the @deepsight/lighting-engine workspace package so Metro picks up
// changes during development (file: dependency is not in node_modules tree).
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, "../packages/lighting-engine"),
];

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    "@deepsight/lighting-engine": path.resolve(
      __dirname,
      "../packages/lighting-engine",
    ),
  },
};

module.exports = config;
