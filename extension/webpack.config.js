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

  // If an explicit target is set, output to dist/<target>; otherwise dist/ for backwards compat
  const outputDir = env?.target
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
          { from: "public/viewer.html", to: "viewer.html" },
          { from: "src/styles/design-tokens.css", to: "design-tokens.css" },
          { from: "src/styles/content.css", to: "content.css" },
          { from: "src/styles/widget.css", to: "widget.css" },
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
        ],
      }),
    ],
    optimization: {
      minimize: isProd,
    },
    devtool: isProd ? false : "cheap-module-source-map",
  };
};
