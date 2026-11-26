// Bulletproof asset URL resolver derived from import.meta.url.
// Works across localhost, reverse-proxy subpaths, /boring URLs, and GitHub Pages.

const APP_ROOT = (() => {
  const url = import.meta.url;
  const srcIdx = url.indexOf("/src/");
  if (srcIdx !== -1) return url.slice(0, srcIdx + 1);
  const assetsIdx = url.indexOf("/assets/");
  if (assetsIdx !== -1) return url.slice(0, assetsIdx + 1);
  return new URL("./", document.baseURI).href;
})();

export function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const clean = String(path).replace(/^(\.\/|\/)+/, "");
  return new URL(clean, APP_ROOT).href;
}
