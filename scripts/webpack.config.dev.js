const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("node:path");
const siteConfig = require("./site-config");

const _resolve = (_path) => path.resolve(__dirname, _path);
const pagesBase =
  process.env.GITHUB_PAGES === "true" ? "/mazey-npm-template/" : "/";

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
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "assets/[name].css",
    }),
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: _resolve("../site/index.html"),
      chunks: ["shared", "home"],
      inject: "body",
      templateParameters: siteConfig,
    }),
    new HtmlWebpackPlugin({
      filename: "playground/index.html",
      template: _resolve("../examples/index.html"),
      chunks: ["shared", "playground"],
      inject: "body",
      templateParameters: siteConfig,
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
