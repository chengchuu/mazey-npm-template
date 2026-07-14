const path = require("node:path");

function normalizeArtifactFile(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").includes("..")
  )
    throw new Error(`Invalid artifact-relative file: ${value}`);
  return normalized;
}

function relativeRootFromFile(value) {
  const normalized = normalizeArtifactFile(value);
  const depth = normalized.split("/").length - 1;
  return depth ? "../".repeat(depth) : "./";
}

function directoryUrl(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url;
}

function artifactDocumentUrl(deploymentBaseUrl, documentFile) {
  const encodedFile = normalizeArtifactFile(documentFile)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return new URL(encodedFile, directoryUrl(deploymentBaseUrl));
}

function resolveArtifactReference(reference, documentFile, deploymentBaseUrl) {
  const base = directoryUrl(deploymentBaseUrl);
  const documentUrl = artifactDocumentUrl(base, documentFile);
  const resolvedUrl = new URL(reference, documentUrl);
  const isLocal =
    resolvedUrl.origin === base.origin &&
    resolvedUrl.pathname.startsWith(base.pathname);
  if (!isLocal) return { isLocal: false, resolvedUrl };

  let artifactPath = decodeURIComponent(
    resolvedUrl.pathname.slice(base.pathname.length),
  );
  if (!artifactPath || artifactPath.endsWith("/")) artifactPath += "index.html";
  return {
    artifactPath: normalizeArtifactFile(artifactPath),
    isLocal: true,
    resolvedUrl,
  };
}

function normalizePublicBasePath(value) {
  const url = new URL(value, "https://preview.invalid/");
  let pathname = url.pathname;
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (!pathname.endsWith("/")) pathname += "/";
  return pathname;
}

function artifactPathToFile(root, artifactPath) {
  return path.join(root, ...normalizeArtifactFile(artifactPath).split("/"));
}

module.exports = {
  artifactDocumentUrl,
  artifactPathToFile,
  directoryUrl,
  normalizeArtifactFile,
  normalizePublicBasePath,
  relativeRootFromFile,
  resolveArtifactReference,
};
