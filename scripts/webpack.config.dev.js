import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import projectConfig from "../project.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _resolve = (_path) => path.resolve(__dirname, _path);
const pagesBase =
  process.env.GITHUB_PAGES === "true" ? projectConfig.site.basePath : "/";
const pwaEnabled =
  process.env.GITHUB_PAGES === "true" || process.env.PWA_ENABLED === "true";
const siteImageEntries = [
  projectConfig.assets.faviconFile,
  projectConfig.assets.logoFile,
  projectConfig.seo.openGraphImage.file,
].map((file) => _resolve(`../images/${file}`));
const templateParameters = {
  API_URL: projectConfig.site.pages.api.url,
  BUNDLE_FILENAME: `${projectConfig.package.bundleBaseName}.min.js`,
  DISPLAY_NAME: projectConfig.brand.displayName,
  FAVICON_URL: `${pagesBase}images/${projectConfig.assets.faviconFile}`,
  GITHUB_URL: projectConfig.urls.github,
  IIFE_GLOBAL: projectConfig.package.iifeGlobal,
  INSTALL_COMMAND: projectConfig.package.installCommand,
  LICENSE_URL: projectConfig.urls.license,
  LOGO_URL: `${pagesBase}images/${projectConfig.assets.logoFile}`,
  MANIFEST_URL: pwaEnabled ? projectConfig.pwa.manifestUrl : null,
  NPM_URL: projectConfig.urls.npm,
  OPEN_GRAPH_IMAGE_ALT: projectConfig.seo.openGraphImage.alt,
  OPEN_GRAPH_IMAGE_HEIGHT: projectConfig.seo.openGraphImage.height,
  OPEN_GRAPH_IMAGE_TYPE: projectConfig.seo.openGraphImage.type,
  OPEN_GRAPH_IMAGE_URL: projectConfig.seo.openGraphImage.url,
  OPEN_GRAPH_IMAGE_WIDTH: projectConfig.seo.openGraphImage.width,
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
  THEME_PRIMARY_ACTIVE_RGB: projectConfig.site.theme.primary.light.activeRgb,
  THEME_PRIMARY_DARK: projectConfig.site.theme.primary.dark.base,
  THEME_PRIMARY_DARK_ACTIVE: projectConfig.site.theme.primary.dark.active,
  THEME_PRIMARY_DARK_ACTIVE_RGB:
    projectConfig.site.theme.primary.dark.activeRgb,
  THEME_PRIMARY_DARK_HOVER: projectConfig.site.theme.primary.dark.hover,
  THEME_PRIMARY_DARK_HOVER_RGB: projectConfig.site.theme.primary.dark.hoverRgb,
  THEME_PRIMARY_DARK_RGB: projectConfig.site.theme.primary.dark.rgb,
  THEME_PRIMARY_DARK_SOFT: projectConfig.site.theme.primary.dark.soft,
  THEME_PRIMARY_HOVER: projectConfig.site.theme.primary.light.hover,
  THEME_PRIMARY_HOVER_RGB: projectConfig.site.theme.primary.light.hoverRgb,
  THEME_PRIMARY_RGB: projectConfig.site.theme.primary.light.rgb,
  THEME_PRIMARY_SOFT: projectConfig.site.theme.primary.light.soft,
};
const runtimeConfig = {
  installCommand: projectConfig.package.installCommand,
  packageName: projectConfig.package.name,
  themeStorageKey: projectConfig.site.theme.storageKey,
  pwa: {
    appName: projectConfig.brand.displayName,
    enabled: pwaEnabled,
    scope: projectConfig.site.basePath,
    serviceWorkerUrl: projectConfig.pwa.serviceWorkerUrl,
  },
};

export default {
  mode: "development",
  entry: {
    shared: [_resolve("../site/shared.ts"), ...siteImageEntries],
    home: {
      import: _resolve("../site/index.ts"),
      dependOn: "shared",
    },
    playground: {
      import: _resolve("../examples/index.tsx"),
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
