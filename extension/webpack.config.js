const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      authSync: './src/authSync/index.ts',
      authSyncMain: './src/authSyncMain/index.ts',
      popup: './src/popup/index.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: {
        keep: /^(icons|content\.css|popup\.css|popup\.html)\//,
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'src/styles/popup.css', to: 'popup.css' },
          { from: 'src/styles/content.css', to: 'content.css' },
          { from: 'icons', to: 'icons' },
        ],
      }),
    ],
    optimization: {
      minimize: isProd,
    },
    devtool: isProd ? false : 'cheap-module-source-map',
  };
};
