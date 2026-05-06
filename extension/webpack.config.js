const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// Charge `extension/.env` si présent (gitignored). Permet de définir
// POSTHOG_KEY / POSTHOG_HOST sans les exposer dans le repo. CI peut aussi
// passer ces vars directement via `process.env` (sans .env).
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const manifestMap = {
  chrome: "manifest.json",
  firefox: "manifest.firefox.json",
  safari: "manifest.safari.json",
};

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";
  const targetBrowser = env?.target || "chrome";
  const manifestFile = manifestMap[targetBrowser] || "manifest.json";

  // If an explicit target is set, output to dist/<target>; otherwise dist/ for backwards compat
  const outputDir = env?.target
    ? path.resolve(__dirname, "dist", targetBrowser)
    : path.resolve(__dirname, "dist");

  // PostHog config injectée dans le bundle. Lue depuis l'env du process de
  // build : POSTHOG_KEY (clé publique safe à committer mais on garde via env
  // pour parité frontend) + POSTHOG_HOST optionnel. Build sans clé = posthog
  // no-op (cf. src/lib/posthog.ts).
  const POSTHOG_KEY = process.env.POSTHOG_KEY || "";
  const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

  return {
    entry: {
      background: "./src/background.ts",
      content: "./src/content/index.ts",
      authSync: "./src/authSync/index.ts",
      authSyncMain: "./src/authSyncMain/index.ts",
      sidepanel: "./src/sidepanel/index.tsx",
      viewer: "./src/viewer.tsx",
      "offscreen-mic": "./src/offscreen-mic.ts",
      "mic-permission": "./src/mic-permission.ts",
    },
    output: {
      path: outputDir,
      filename: "[name].js",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: [/node_modules/, /__tests__/],
        },
        {
          test: /\.css$/,
          resourceQuery: /raw/,
          type: "asset/source",
        },
        {
          test: /\.css$/,
          resourceQuery: { not: [/raw/] },
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
      alias: {
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        __TARGET_BROWSER__: JSON.stringify(targetBrowser),
        // Expose POSTHOG_KEY / POSTHOG_HOST au bundle (lu via process.env.* dans
        // src/lib/posthog.ts). Sans clé → init no-op, build clean.
        "process.env.POSTHOG_KEY": JSON.stringify(POSTHOG_KEY),
        "process.env.POSTHOG_HOST": JSON.stringify(POSTHOG_HOST),
      }),
      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),
      new HtmlWebpackPlugin({
        template: "./public/sidepanel.html",
        filename: "sidepanel.html",
        chunks: ["sidepanel"],
        inject: "body",
      }),
      new CopyPlugin({
        patterns: [
          { from: `public/${manifestFile}`, to: "manifest.json" },
          { from: "public/_locales", to: "_locales" },
          { from: "public/viewer.html", to: "viewer.html" },
          { from: "public/offscreen-mic.html", to: "offscreen-mic.html" },
          { from: "public/mic-permission.html", to: "mic-permission.html" },
          // [B10] Self-host les worklets ElevenLabs — sinon le SDK essaie
          // de créer un blob: URL bloqué par notre CSP MV3 stricte
          // (script-src 'self'). Erreur user : "Failed to load the
          // rawAudioProcessor worklet module".
          {
            from: "node_modules/@elevenlabs/client/worklets/rawAudioProcessor.js",
            to: "rawAudioProcessor.js",
          },
          {
            from: "node_modules/@elevenlabs/client/worklets/audioConcatProcessor.js",
            to: "audioConcatProcessor.js",
          },
          { from: "src/styles/design-tokens.css", to: "design-tokens.css" },
          { from: "src/styles/viewer.css", to: "viewer.css" },
          { from: "src/styles/tokens.css", to: "tokens.css" },
          { from: "icons", to: "icons" },
          {
            from: "../frontend/public/logo.png",
            to: "assets/deep-sight-logo.png",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/deepsight-logo-cosmic.png",
            to: "assets/deepsight-logo-cosmic.png",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/spinner-cosmic.jpg",
            to: "assets/spinner-cosmic.jpg",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/spinner-wheel.jpg",
            to: "assets/spinner-wheel.jpg",
            noErrorOnMissing: true,
          },
          { from: "public/platforms", to: "platforms", noErrorOnMissing: true },
          { from: "public/brand", to: "brand", noErrorOnMissing: true },
          {
            from: "public/assets/ambient",
            to: "assets/ambient",
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    optimization: {
      minimize: isProd,
    },
    devtool: isProd ? false : "cheap-module-source-map",
  };
};
