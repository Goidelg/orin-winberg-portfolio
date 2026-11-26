import {
  PROFILE,
  VIDEOS,
  GALLERY_ITEMS,
  FEATURED_PRINTS,
  WORKBENCH_DATA,
  CATALOGUE_ITEMS,
  NOTEBOOK_SPREADS,
} from "../data/portfolioData.js";
import { assetUrl } from "../utils/assetUrl.js";

const DRAFT_KEY = "orin-cms-draft-v1";
const PUBLISH_CFG_KEY = "orin-cms-github-v1";

export const DEFAULT_GITHUB_CONFIG = {
  owner: "Goidelg",
  repo: "orin-winberg-portfolio",
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Merge saved partial overrides onto defaults so new code keys never break older JSON files
function deepMerge(base, patch) {
  if (patch === undefined) return deepClone(base);
  if (Array.isArray(patch)) return deepClone(patch);
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out = deepClone(base);
    for (const key of Object.keys(patch)) {
      out[key] = key in base ? deepMerge(base[key], patch[key]) : deepClone(patch[key]);
    }
    return out;
  }
  return deepClone(patch);
}

// Capture pristine code defaults once on module load
const DEFAULT_SNAPSHOT = deepClone({
  PROFILE,
  VIDEOS,
  GALLERY_ITEMS,
  FEATURED_PRINTS,
  WORKBENCH_DATA,
  CATALOGUE_ITEMS,
  NOTEBOOK_SPREADS,
});

let publishedSnapshot = deepClone(DEFAULT_SNAPSHOT);
let hasLocalDraft = false;
let lastPublishedMeta = null;
const changeListeners = new Set();

export function onContentChange(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export function notifyContentChange() {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function replaceObjectInPlace(target, source) {
  for (const k of Object.keys(target)) {
    delete target[k];
  }
  Object.assign(target, deepClone(source));
}

function replaceArrayInPlace(target, source) {
  target.splice(0, target.length, ...deepClone(source));
}

export function applySnapshot(snapshot) {
  const merged = deepMerge(DEFAULT_SNAPSHOT, snapshot || {});
  replaceObjectInPlace(PROFILE, merged.PROFILE);
  replaceArrayInPlace(VIDEOS, merged.VIDEOS);
  replaceArrayInPlace(GALLERY_ITEMS, merged.GALLERY_ITEMS);
  replaceArrayInPlace(FEATURED_PRINTS, merged.FEATURED_PRINTS);
  replaceObjectInPlace(WORKBENCH_DATA, merged.WORKBENCH_DATA);
  replaceArrayInPlace(CATALOGUE_ITEMS, merged.CATALOGUE_ITEMS);
  replaceObjectInPlace(NOTEBOOK_SPREADS, merged.NOTEBOOK_SPREADS);
}

export function getCurrentSnapshot() {
  return deepClone({
    PROFILE,
    VIDEOS,
    GALLERY_ITEMS,
    FEATURED_PRINTS,
    WORKBENCH_DATA,
    CATALOGUE_ITEMS,
    NOTEBOOK_SPREADS,
  });
}

export function getDefaultSnapshot() {
  return deepClone(DEFAULT_SNAPSHOT);
}

export function getHasDraft() {
  return hasLocalDraft;
}

export function getLastPublishedMeta() {
  return lastPublishedMeta;
}

export function saveDraft(notify = true) {
  const snap = getCurrentSnapshot();
  snap._meta = {
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
    hasLocalDraft = true;
  } catch (err) {
    console.warn("Could not save local draft:", err);
  }
  if (notify) notifyContentChange();
}

export function discardDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
  hasLocalDraft = false;
  applySnapshot(publishedSnapshot);
  notifyContentChange();
}

export function resetToDefaults() {
  applySnapshot(DEFAULT_SNAPSHOT);
  saveDraft(true);
}

export function importContentJson(rawText) {
  const parsed = JSON.parse(rawText);
  if (!isPlainObject(parsed)) {
    throw new Error("Invalid JSON root object");
  }
  applySnapshot(parsed);
  saveDraft(true);
}

export function exportContentJson() {
  const snap = getCurrentSnapshot();
  snap._meta = {
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  return JSON.stringify(snap, null, 2);
}

export async function hydrateContent() {
  // 1. Load live published content.json (served from site root)
  try {
    const res = await fetch(`${assetUrl("content.json")}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (isPlainObject(data) && Object.keys(data).length > 0) {
        if (data._meta) lastPublishedMeta = data._meta;
        publishedSnapshot = deepMerge(DEFAULT_SNAPSHOT, data);
        applySnapshot(publishedSnapshot);
      }
    }
  } catch {
    // Offline or first load — keep defaults cleanly
  }

  // 2. Layer local browser draft on top (only visible in Orin's browser until published)
  try {
    const rawDraft = localStorage.getItem(DRAFT_KEY);
    if (rawDraft) {
      const parsed = JSON.parse(rawDraft);
      if (isPlainObject(parsed)) {
        applySnapshot(parsed);
        hasLocalDraft = true;
      }
    }
  } catch {}
}

// =====================================================================
// Direct GitHub Contents API Publishing (Zero-Backend Live Deploy!)
// =====================================================================
export function loadPublishConfig() {
  try {
    const raw = localStorage.getItem(PUBLISH_CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        owner: parsed.owner || DEFAULT_GITHUB_CONFIG.owner,
        repo: parsed.repo || DEFAULT_GITHUB_CONFIG.repo,
        token: parsed.token || "",
      };
    }
  } catch {}
  return { ...DEFAULT_GITHUB_CONFIG, token: "" };
}

export function savePublishConfig({ owner, repo, token }) {
  try {
    localStorage.setItem(
      PUBLISH_CFG_KEY,
      JSON.stringify({
        owner: (owner || DEFAULT_GITHUB_CONFIG.owner).trim(),
        repo: (repo || DEFAULT_GITHUB_CONFIG.repo).trim(),
        token: (token || "").trim(),
      })
    );
  } catch {}
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function upsertGitHubFile({ owner, repo, branch, path, contentStr, token, message }) {
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo
  )}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Fetch existing file SHA if present
  let sha = null;
  const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers,
    cache: "no-store",
  });
  if (getRes.ok) {
    const info = await getRes.json();
    sha = info.sha || null;
  } else if (getRes.status !== 404) {
    const errBody = await getRes.json().catch(() => ({}));
    throw new Error(errBody.message || `GitHub read failed (${getRes.status})`);
  }

  const body = {
    message,
    content: utf8ToBase64(contentStr),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const errBody = await putRes.json().catch(() => ({}));
    throw new Error(errBody.message || `GitHub publish failed (${putRes.status})`);
  }
  return putRes.json();
}

export async function testGitHubConnection({ owner, repo, token }) {
  if (!token || !token.trim()) {
    throw new Error("Missing GitHub token");
  }
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const repoInfo = await res.json();
  if (repoInfo.permissions && repoInfo.permissions.push === false) {
    throw new Error("Token does not have Contents write permission on this repository");
  }
  return {
    fullName: repoInfo.full_name,
    canPush: Boolean(repoInfo.permissions?.push ?? true),
  };
}

export async function publishToGitHub({ owner, repo, token, onStep }) {
  const cleanToken = (token || "").trim();
  const cleanOwner = (owner || DEFAULT_GITHUB_CONFIG.owner).trim();
  const cleanRepo = (repo || DEFAULT_GITHUB_CONFIG.repo).trim();
  if (!cleanToken) throw new Error("Missing GitHub token");

  const jsonStr = exportContentJson();
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const msg = `Update portfolio content via Admin Studio (${timestamp} UTC)`;

  // 1. Publish directly to gh-pages so orinwinberg.com updates in ~20-40 seconds!
  onStep?.("gh-pages");
  await upsertGitHubFile({
    owner: cleanOwner,
    repo: cleanRepo,
    branch: "gh-pages",
    path: "content.json",
    contentStr: jsonStr,
    token: cleanToken,
    message: msg,
  });

  // 2. Sync public/content.json on main so future builds preserve Orin's edits
  onStep?.("main");
  await upsertGitHubFile({
    owner: cleanOwner,
    repo: cleanRepo,
    branch: "main",
    path: "public/content.json",
    contentStr: jsonStr,
    token: cleanToken,
    message: msg,
  });

  // Mark published snapshot & clear draft
  publishedSnapshot = getCurrentSnapshot();
  lastPublishedMeta = { updatedAt: new Date().toISOString(), version: 1 };
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
  hasLocalDraft = false;
  notifyContentChange();
  return lastPublishedMeta;
}
