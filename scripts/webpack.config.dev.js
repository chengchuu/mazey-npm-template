const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("node:path");
const webpack = require("webpack");
const siteConfig = require("./site-config");

const _resolve = (_path) => path.resolve(__dirname, _path);
const pagesBase =
  process.env.GITHUB_PAGES === "true" ? "/mazey-npm-template/" : "/";
const pwaEnabled =
  process.env.GITHUB_PAGES === "true" || process.env.PWA_ENABLED === "true";
const templateParameters = {
  ...siteConfig,
  FAVICON_URL: `${pagesBase}images/logo-dark-circle-transparent-32x32.png`,
  LOGO_URL: `${pagesBase}images/logo-dark-circle-transparent-200x200.png`,
};

module.exports = {
  mode: "development",
  entry: {
    shared: _resolve("../site/shared.ts"),
    home: {
      import: _resolve("../site/index.ts"),
      dependOn: "shared",
    },
    playground: {
      import: _resolve("../examples/index.ts"),
      dependOn: "shared",
    },
    api: _resolve("../site/api.ts"),
  },
  output: {
    clean: true,
    filename: "assets/[name].js",
    path: _resolve("../dist-dev"),
    publicPath: pagesBase,
  },
  devServer: {
    port: 8080,
    host: "0.0.0.0",
    static: [
      { directory: _resolve("../dist-dev") },
      { directory: _resolve("../docs") },
    ],
    allowedHosts: [".mazey.net"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.png$/i,
        type: "asset/resource",
        generator: {
          filename: "images/[name][ext]",
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __PWA_ENABLED__: JSON.stringify(pwaEnabled),
      __PWA_SCOPE__: JSON.stringify(siteConfig.PWA_BASE_PATH),
      __PWA_SERVICE_WORKER_URL__: JSON.stringify(siteConfig.SERVICE_WORKER_URL),
    }),
    new MiniCssExtractPlugin({
      filename: "assets/[name].css",
    }),
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: _resolve("../site/index.html"),
      chunks: ["shared", "home"],
      inject: "body",
      templateParameters,
    }),
    new HtmlWebpackPlugin({
      filename: "playground/index.html",
      template: _resolve("../examples/index.html"),
      chunks: ["shared", "playground"],
      inject: "body",
      templateParameters,
    }),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  performance: {
    maxAssetSize: 300000,
    maxEntrypointSize: 300000,
  },
};
