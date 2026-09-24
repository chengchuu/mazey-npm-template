# Reusable GitHub Actions Workflows

Use these workflows as a starting point for npm-based frontend projects that publish a generated
`docs` directory to GitHub Pages and release a public package to npm.

## Prepare the repository

Before adding the workflows, confirm that the project meets these requirements:

- Node.js 22 can install, validate, and build the project.
- `package.json` defines `typecheck`, `lint`, `test`, `docs`, `seo:validate`, `pwa:validate`, and
  `build` scripts.
- The documentation build writes the complete GitHub Pages artifact to `docs`.
- GitHub Pages uses **GitHub Actions** as its deployment source.
- The repository has an `NPM_TOKEN` secret with permission to publish the package.

These examples deliberately use `npm install` and do not enable the `actions/setup-node` npm cache.
Adjust the Node.js version or script names only when the target project documents a different
contract.

## Deploy GitHub Pages

Create `.github/workflows/pages.yml` with the following workflow:

```yaml
name: Deploy GitHub Pages

env:
  NODE_VERSION: "22"

on:
  push:
    branches:
      - main
      - "release/v*"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repository
        uses: actions/checkout@v7

      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: npm install

      - name: Check types
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build documentation
        run: npm run docs

      - name: Validate SEO
        run: npm run seo:validate

      - name: Validate PWA
        run: npm run pwa:validate

      - name: Configure GitHub Pages
        uses: actions/configure-pages@v6

      - name: Upload the Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: docs

      - name: Deploy GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

The `github-pages` environment must allow deployments from both configured branches. The
`workflow_dispatch` trigger permits a manual Pages deployment but does not affect npm publishing.

## Publish the npm package

Create `.github/workflows/publish-npm.yml` with the following workflow:

```yaml
name: Publish npm Package

env:
  NODE_VERSION: "22"

on:
  push:
    branches:
      - "release/v*"

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repository
        uses: actions/checkout@v7

      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: ${{ env.NODE_VERSION }}
          registry-url: "https://registry.npmjs.org/"

      - name: Install dependencies
        run: npm install

      - name: Check types
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build the package
        run: npm run build

      - name: Publish to npm
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npm publish --access public
```

This workflow publishes only after a push to a branch matching `release/v*`. It does not run for
pushes to `main`, pull requests, or manual dispatches. Protect release branches and update the
package version before pushing a release branch because every successful run reaches the publish
step.

The example publishes only to npm. Add GitHub Packages publication, release tags, or provenance
only when the target repository defines and validates those policies separately.

## Verify the setup

Before pushing either workflow:

1. Run every referenced npm script locally.
2. Confirm that `npm run docs` creates the `docs` directory.
3. Confirm that `npm pack --dry-run` contains the intended package files.
4. Review repository and environment branch-protection rules.
5. Check that `NPM_TOKEN` is stored as a repository secret and never written to a tracked file.
