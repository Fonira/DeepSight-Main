const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const manifestMap = {
  chrome: "manifest.json",
  firefox: "manifest.firefox.json",
  safari: "manifest.safari.json",
};

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";
  const targetBrowser = env?.target || "chrome";
  const manifestFile = manifestMap[targetBrowser] || "manifest.json";

  // `--env voice=off` : build sans les appels vocaux (zip du Chrome Web Store,
  // cf. scripts/package-cws.mjs). Par défaut la voix est compilée, et elle ne
  // s'affiche que si l'API répond voice_available (src/utils/features.ts).
  const voiceEnabled = env?.voice !== "off";

  // `--env out=<dossier>` : sortie hors de dist/, pour que le build du Store
  // n'écrase pas l'extension chargée en local.
  // If an explicit target is set, output to dist/<target>; otherwise dist/ for backwards compat
  const outputDir = env?.out
    ? path.resolve(__dirname, env.out)
    : env?.target
      ? path.resolve(__dirname, "dist", targetBrowser)
      : path.resolve(__dirname, "dist");

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
        __DS_VOICE__: JSON.stringify(voiceEnabled),
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
          // Logo du header (affiché en 28 px) : copie 96 px propre à
          // l'extension. L'original du frontend (1024 px, 1,3 Mo) gonflait
          // le paquet ; l'ancien logo.png copié ici n'était utilisé nulle part.
          {
            from: "public/assets/deepsight-logo-cosmic.png",
            to: "assets/deepsight-logo-cosmic.png",
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
