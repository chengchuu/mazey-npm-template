/** @jest-environment node */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import webpack from "webpack";
import config from "../scripts/webpack.config.dev.js";
import { attribute } from "../scripts/validate-seo.js";
import projectConfig from "../project.config.js";

test("production HTML remains compatible with Pages validators", async () => {
  const outputPath = mkdtempSync(path.join(os.tmpdir(), "template-webpack-"));
  const compiler = webpack({
    ...config,
    mode: "production",
    output: { ...config.output, path: outputPath },
  });

  try {
    // Guard against Webpack enabling a second HTML minifier by default.
    expect(compiler.options.experiments.html).toBe(false);
    await new Promise((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error) return reject(error);
        if (stats.hasErrors()) return reject(new Error(stats.toString()));
        resolve();
      });
    });

    for (const [file, page] of [
      ["index.html", projectConfig.site.pages.home],
      ["playground/index.html", projectConfig.site.pages.playground],
    ]) {
      const html = readFileSync(path.join(outputPath, file), "utf8");
      expect(attribute(html, "meta", "name", "description")?.content).toBe(
        page.description,
      );
      expect(attribute(html, "link", "rel", "canonical")?.href).toBe(page.url);
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain('data-bs-theme="light"');
    }
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
    rmSync(outputPath, { recursive: true, force: true });
  }
}, 30000);
