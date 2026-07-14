const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("node:path");
const webpack = require("webpack");
const projectConfig = require("../project.config");

const _resolve = (_path) => path.resolve(__dirname, _path);
const pwaEnabled =
  process.env.GITHUB_PAGES === "true" || process.env.PWA_ENABLED === "true";
const sharedTemplateParameters = {
  API_URL: projectConfig.site.pages.api.url,
  BUNDLE_FILENAME: `${projectConfig.package.bundleBaseName}.min.js`,
  DISPLAY_NAME: projectConfig.brand.displayName,
  GITHUB_URL: projectConfig.urls.github,
  IIFE_GLOBAL: projectConfig.package.iifeGlobal,
  INSTALL_COMMAND: projectConfig.package.installCommand,
  LICENSE_URL: projectConfig.urls.license,
  NPM_URL: projectConfig.urls.npm,
  PACKAGE_NAME: projectConfig.package.name,
  PLAYGROUND_DESCRIPTION: projectConfig.site.pages.playground.description,
  PLAYGROUND_JSON_LD: JSON.stringify(projectConfig.seo.playgroundJsonLd),
  PLAYGROUND_TITLE: projectConfig.site.pages.playground.title,
  PLAYGROUND_URL: projectConfig.site.pages.playground.url,
  ROOT_DESCRIPTION: projectConfig.site.pages.home.description,
  ROOT_JSON_LD: JSON.stringify(projectConfig.seo.rootJsonLd),
  ROOT_TITLE: projectConfig.site.pages.home.title,
  SITEMAP_URL: projectConfig.urls.sitemap,
  SITE_URL: projectConfig.site.url,
  THEME_COLOR_DARK: projectConfig.site.theme.colorDark,
  THEME_COLOR_LIGHT: projectConfig.site.theme.colorLight,
  THEME_COLOR_PRIMARY: projectConfig.site.theme.colorPrimary,
  THEME_PRIMARY_ACTIVE: projectConfig.site.theme.primary.light.active,
  THEME_PRIMARY_DARK: projectConfig.site.theme.primary.dark.base,
  THEME_PRIMARY_DARK_ACTIVE: projectConfig.site.theme.primary.dark.active,
  THEME_PRIMARY_DARK_HOVER: projectConfig.site.theme.primary.dark.hover,
  THEME_PRIMARY_DARK_HOVER_RGB: projectConfig.site.theme.primary.dark.hoverRgb,
  THEME_PRIMARY_DARK_RGB: projectConfig.site.theme.primary.dark.rgb,
  THEME_PRIMARY_DARK_SOFT: projectConfig.site.theme.primary.dark.soft,
  THEME_PRIMARY_HOVER: projectConfig.site.theme.primary.light.hover,
  THEME_PRIMARY_HOVER_RGB: projectConfig.site.theme.primary.light.hoverRgb,
  THEME_PRIMARY_RGB: projectConfig.site.theme.primary.light.rgb,
  THEME_PRIMARY_SOFT: projectConfig.site.theme.primary.light.soft,
  THEME_STORAGE_KEY_JSON: JSON.stringify(projectConfig.site.theme.storageKey),
};
const templateParameters = (siteRoot) => ({
  ...sharedTemplateParameters,
  FAVICON_URL: `${siteRoot}images/${projectConfig.assets.faviconFile}`,
  LOGO_URL: `${siteRoot}images/${projectConfig.assets.logoFile}`,
  MANIFEST_URL: pwaEnabled
    ? `${siteRoot}${projectConfig.pwa.manifestFile}`
    : null,
});
const runtimeConfig = {
  packageName: projectConfig.package.name,
  displayName: projectConfig.brand.displayName,
  installCommand: projectConfig.package.installCommand,
  themeStorageKey: projectConfig.site.theme.storageKey,
  pwa: {
    appName: projectConfig.brand.displayName,
    enabled: pwaEnabled,
    serviceWorkerFile: projectConfig.pwa.serviceWorkerFile,
  },
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
    publicPath: "auto",
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
      __SITE_RUNTIME_CONFIG__: JSON.stringify(runtimeConfig),
    }),
    new MiniCssExtractPlugin({
      filename: "assets/[name].css",
    }),
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: _resolve("../site/index.html"),
      chunks: ["shared", "home"],
      inject: "body",
      templateParameters: templateParameters("./"),
    }),
    new HtmlWebpackPlugin({
      filename: "playground/index.html",
      template: _resolve("../examples/index.html"),
      chunks: ["shared", "playground"],
      inject: "body",
      templateParameters: templateParameters("../"),
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
