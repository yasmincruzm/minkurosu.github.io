import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(function ensureStyles() {
  const already = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some(l => /(^|\/)post\.css(\?|$)/.test(l.getAttribute("href") || ""));
  if (already) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("post.css", import.meta.url).href;
  document.head.appendChild(link);
})();

window.__postCleanup?.();
const pageAbort = new AbortController();
const pageUnsubs = [];
window.__postCleanup = () => { pageAbort.abort(); pageUnsubs.forEach(fn => { try { fn(); } catch {} }); };

const config = {
  firebase: {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
  },
  adminEmails: [
  "mincruzm@gmail.com",
  "yasmincruzm@hotmail.com"
],
  // colecao onde novos posts/reposts sao gravados
  collectionName: "posts",
  // colecoes antigas que tambem sao lidas (posts ja existentes ficam visiveis)
  legacyCollections: ["post"],
  deletedCollection: "deletedSync",
  imageHostUrl: "https://api.imgbb.com/1/upload",
  displayName: "min*",
  handle: "minkurosu",
  avatarUrl: "imgs/site_imgs/twitteravatar.jpg"
};

const isAllowed = email => !!email && config.adminEmails.includes(email);
const defaultBskyHandle = `${config.handle}.bsky.social`;

const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(config.firebase);
const auth = getAuth(app);
const db = getFirestore(app);
const feed = document.getElementById("postFeed");
if (feed) feed.classList.add("postFeed");
else console.error("#postFeed nao encontrado: o post.js precisa do <div id=\"postFeed\"> na pagina.");

let isAdmin = false;

pageUnsubs.push(onAuthStateChanged(auth, user => {
  isAdmin = !!(user && isAllowed(user.email));
  updateAdminUi();
  rerenderAll();
}));

function updateAdminUi() {
  if (isAdmin) {
    injectComposeBox();
    injectAdminActions();
    return;
  }
  document.getElementById("composeBox")?.remove();
  document.getElementById("adminActions")?.replaceChildren();
}

const settingsKey = "crosspost_settings_v1";
const prefsKey = "crosspost_prefs_v1";
const limits = { bluesky: 300, x: 280, mastodon: 500 };
const isAllowedBsky = handle =>
  String(handle || "").replace(/^@/, "").toLowerCase().split(".")[0] === config.handle;

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(settingsKey)) || {}; }
  catch { return {}; }
}

function saveSettings(s) {
  if (s.bskyHandle && !isAllowedBsky(s.bskyHandle)) {
    throw new Error(`bluesky handle must be @${config.handle}...`);
  }
  localStorage.setItem(settingsKey, JSON.stringify(s));
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(prefsKey)) || {}; }
  catch { return {}; }
}

function savePrefs(p) {
  localStorage.setItem(prefsKey, JSON.stringify(p));
}

function isConfigured(network) {
  const s = loadSettings();
  if (network === "bluesky") return !!(s.bskyHandle && s.bskyPassword);
  if (network === "mastodon") return !!(s.mastoInstance && s.mastoToken);
  if (network === "x") return true;
  return false;
}

function graphemeLength(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return [...text].length;
}

function buildText({ content, repostUrl }) {
  const parts = [];
  if (content) parts.push(content.trim());
  if (repostUrl) parts.push(repostUrl.trim());
  return parts.join("\n").trim();
}

function validateLengths(text, networks) {
  const problems = [];
  const len = graphemeLength(text);
  for (const n of networks) {
    const max = n === "mastodon" ? (loadSettings().mastoMax || limits.mastodon) : limits[n];
    if (len > max) problems.push(`${n}: ${len}/${max} chars`);
  }
  return problems;
}

async function readError(res) {
  try {
    const j = await res.json();
    const err = typeof j.error === "string" ? j.error : j.error?.message;
    return j.message || j.error_description || err || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function uploadImage(file) {
  const key = loadSettings().imgbbKey;
  if (!key) throw new Error("imgbb key not configured");
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${config.imageHostUrl}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    body: fd
  });
  if (!res.ok) throw new Error(`imgbb: ${await readError(res)}`);
  const json = await res.json();
  const url = json?.data?.image?.url || json?.data?.url;
  if (!url) throw new Error("imgbb: no image url returned");
  return url;
}

async function resolveImageBlob({ file, imageUrl }) {
  if (file) return file;
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}

async function shrinkImage(blob, maxBytes = 950_000) {
  if (blob.size <= maxBytes) return blob;
  const bitmap = await createImageBitmap(blob);
  let scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  let quality = 0.9;
  for (let i = 0; i < 8; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
    if (out && out.size <= maxBytes) return out;
    quality = Math.max(0.5, quality - 0.1);
    scale *= 0.85;
  }
  throw new Error("image too large for bluesky");
}

const bskyBaseUrl = "https://bsky.social/xrpc";
let bskySession = null;

async function bskyLogin(force = false) {
  const s = loadSettings();
  if (!s.bskyHandle || !s.bskyPassword) throw new Error("bluesky credentials not configured");
  if (bskySession && !force) return bskySession;

  const res = await fetch(`${bskyBaseUrl}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: s.bskyHandle.replace(/^@/, "").trim(),
      password: s.bskyPassword.trim()
    })
  });
  if (!res.ok) throw new Error(`bluesky login: ${await readError(res)}`);
  const sess = await res.json();
  if (!isAllowedBsky(sess.handle)) {
    throw new Error(`blocked: account is @${sess.handle}, only @${config.handle} allowed`);
  }
  bskySession = sess;
  return bskySession;
}

function buildFacets(text) {
  const enc = new TextEncoder();
  const facets = [];
  const byteIndex = charIdx => enc.encode(text.slice(0, charIdx)).length;

  for (const m of text.matchAll(/https?:\/\/[^\s<]+/g)) {
    let url = m[0].replace(/[).,;:!?'"\\]}]+$/, "");
    const start = m.index;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + url.length) },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: url }]
    });
  }

  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const tag = m[2];
    if (/^\d+$/.test(tag)) continue;
    const start = m.index + m[1].length;
    const end = start + tag.length + 1;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(end) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag }]
    });
  }
  return facets;
}

async function bskyRequest(path, init, retry = true) {
  const sess = await bskyLogin();
  const res = await fetch(`${bskyBaseUrl}/${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${sess.accessJwt}` }
  });
  if (res.status === 401 && retry) {
    await bskyLogin(true);
    return bskyRequest(path, init, false);
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

async function postToBluesky({ text, file, imageUrl }) {
  const sess = await bskyLogin();
  let finalText = text;
  let embed;

  const raw = await resolveImageBlob({ file, imageUrl });
  if (raw) {
    try {
      const blob = await shrinkImage(raw);
      const up = await bskyRequest("com.atproto.repo.uploadBlob", {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob
      });
      embed = {
        $type: "app.bsky.embed.images",
        images: [{ alt: "", image: up.blob }]
      };
    } catch (err) {
      console.warn("image failed for bluesky:", err);
      if (imageUrl && !finalText.includes(imageUrl)) finalText += `\n${imageUrl}`;
    }
  } else if (imageUrl && !finalText.includes(imageUrl)) {
    finalText += `\n${imageUrl}`;
  }

  const record = {
    $type: "app.bsky.feed.post",
    text: finalText,
    createdAt: new Date().toISOString()
  };
  const facets = buildFacets(finalText);
  if (facets.length) record.facets = facets;
  if (embed) record.embed = embed;

  const res = await bskyRequest("com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: sess.did,
      collection: "app.bsky.feed.post",
      record
    })
  });
  const rkey = (res.uri || "").split("/").pop();
  const postUrl = rkey ? `https://bsky.app/profile/${sess.handle}/post/${rkey}` : "";
  return { id: res.cid, uri: res.uri, url: postUrl };
}

function getMastodonInstance() {
  const s = loadSettings();
  let inst = (s.mastoInstance || "").trim().replace(/\/+$/, "");
  if (!inst) throw new Error("mastodon instance not configured");
  if (!/^https?:\/\//i.test(inst)) inst = `https://${inst}`;
  return inst;
}

async function postToMastodon({ text, file, imageUrl }) {
  const s = loadSettings();
  if (!s.mastoToken) throw new Error("mastodon token not configured");
  const base = getMastodonInstance();
  const token = s.mastoToken.trim();
  const mediaIds = [];

  const raw = await resolveImageBlob({ file, imageUrl });
  if (raw) {
    try {
      const fd = new FormData();
      fd.append("file", raw, file?.name || "image.jpg");
      const upRes = await fetch(`${base}/api/v2/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!upRes.ok) throw new Error(`media upload: ${await readError(upRes)}`);
      const up = await upRes.json();
      if (up.id) mediaIds.push(up.id);
    } catch (err) {
      console.warn("media upload failed for mastodon:", err);
      if (imageUrl && !text.includes(imageUrl)) text += `\n${imageUrl}`;
    }
  } else if (imageUrl && !text.includes(imageUrl)) {
    text += `\n${imageUrl}`;
  }

  const bodyObj = {
    status: text,
    visibility: s.mastoVisibility || "public"
  };
  if (mediaIds.length) bodyObj.media_ids = mediaIds;

  const res = await fetch(`${base}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(bodyObj)
  });
  if (!res.ok) throw new Error(`status: ${await readError(res)}`);
  const data = await res.json();
  return { id: data.id, url: data.url };
}

async function refreshMastodonLimit() {
  try {
    const base = getMastodonInstance();
    const res = await fetch(`${base}/api/v1/instance`);
    if (!res.ok) return;
    const data = await res.json();
    const max = data?.configuration?.statuses?.max_characters || data?.max_toot_chars;
    if (typeof max === "number" && max > 0) {
      const s = loadSettings();
      s.mastoMax = max;
      saveSettings(s);
    }
  } catch (err) {
    console.warn("could not fetch mastodon instance config:", err);
  }
}

function openXWindow() {
  const w = 550, h = 420;
  const y = window.top.outerHeight / 2 + window.top.screenY - (h / 2);
  const x = window.top.outerWidth / 2 + window.top.screenX - (w / 2);
  return window.open("about:blank", "x_intent", `width=${w},height=${h},top=${y},left=${x},toolbar=no,menubar=no`);
}

function fillXWindow(win, { text, imageUrl }) {
  if (!win || win.closed) return false;
  let final = text;
  if (imageUrl && !final.includes(imageUrl)) final += `\n${imageUrl}`;
  const u = `https://x.com/intent/post?text=${encodeURIComponent(final)}`;
  try {
    win.location.replace(u);
    win.focus();
    return true;
  } catch {
    return false;
  }
}

async function crosspostAll({ networks, text, file, imageUrl }) {
  const tasks = [];
  if (networks.includes("bluesky")) tasks.push(["bluesky", postToBluesky({ text, file, imageUrl })]);
  if (networks.includes("mastodon")) tasks.push(["mastodon", postToMastodon({ text, file, imageUrl })]);

  const settled = await Promise.allSettled(tasks.map(t => t[1]));
  const results = {};
  settled.forEach((r, i) => {
    const name = tasks[i][0];
    results[name] = r.status === "fulfilled"
      ? { ok: true, ...r.value }
      : { ok: false, error: r.reason?.message || String(r.reason) };
  });
  return results;
}

const embedPatterns = {
  image: /\.(gif|png|jpe?g|webp|avif|svg)(\?\S*)?$/i,
  video: /\.(mp4|webm|ogg|mov)(\?\S*)?$/i,
  youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/,
  spotify: /open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/
};

function stripTrailingPunctuation(url) {
  const trailChars = /[).,;:!?'"\\]}]$/;
  let core = url, trail = "";
  while (trailChars.test(core)) {
    const last = core.slice(-1);
    if (last === ")") {
      const opens = (core.match(/\(/g) || []).length;
      const closes = (core.match(/\)/g) || []).length;
      if (closes <= opens) break;
    }
    trail = last + trail;
    core = core.slice(0, -1);
  }
  return { core, trail };
}

function isEmbeddable(url) {
  return embedPatterns.image.test(url)
    || embedPatterns.video.test(url)
    || embedPatterns.youtube.test(url)
    || embedPatterns.spotify.test(url);
}

function buildEmbedHtml(url) {
  const u = escHtml(url);
  if (embedPatterns.image.test(url)) {
    return `<img class="embedMedia" src="${u}" alt="" loading="lazy">`;
  }
  if (embedPatterns.video.test(url)) {
    return `<video class="embedMedia" src="${u}" controls loading="lazy"></video>`;
  }
  let m = url.match(embedPatterns.youtube);
  if (m) {
    return `<div class="embedYoutube">
      <iframe src="https://www.youtube.com/embed/${m[1]}" title="youtube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  m = url.match(embedPatterns.spotify);
  if (m) {
    const height = (m[1] === "track" || m[1] === "episode") ? 152 : 352;
    return `<div class="embedSpotify">
      <iframe src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0"
        width="100%" height="${height}" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    </div>`;
  }
  return "";
}

function buildEmbeds(text) {
  const seen = new Set();
  let html = "";
  for (const m of text.matchAll(/(https?:\/\/[^\s<]+)/g)) {
    const { core } = stripTrailingPunctuation(m[1]);
    if (seen.has(core)) continue;
    seen.add(core);
    html += buildEmbedHtml(core);
  }
  return html;
}

function linkify(text) {
  return escHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, raw => {
      const { core, trail } = stripTrailingPunctuation(raw);
      if (isEmbeddable(core)) return trail;
      return `<a class="postLink" href="${core}" target="_blank" rel="noopener">${core}</a>${trail}`;
    })
    .replace(/#(\w+)/g, '<span class="postTag">#$1</span>');
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeUrl(u) {
  try {
    const x = new URL(u);
    return (x.protocol === "http:" || x.protocol === "https:") ? x.href : "";
  } catch { return ""; }
}

function shortLink(u) {
  try {
    const x = new URL(u);
    const s = x.hostname.replace(/^www\./, "") + (x.pathname !== "/" ? x.pathname : "");
    return s.length > 48 ? s.slice(0, 47) + "…" : s;
  } catch { return u; }
}

function isRepost(d) {
  return d.type === "repost" || /^RT @/i.test((d.content || "").trim());
}

function isSyncedRepost(d) {
  return d.source === "bluesky" || d.source === "mastodon";
}

function repostParts(d) {
  const content = d.content || "";
  if (!isRepost(d)) return { comment: content, quoted: "", field: "content" };
  if (isSyncedRepost(d) || /^RT @/i.test(content.trim())) {
    return { comment: d.comment || "", quoted: content, field: "comment" };
  }
  return { comment: content, quoted: d.repostText || "", field: "content" };
}

function authorFromUrl(u) {
  try {
    const x = new URL(u);
    let m = x.pathname.match(/^\/profile\/([^/]+)\/post\//);
    if (m) return m[1];
    m = x.pathname.match(/^\/@([^/]+)\//);
    if (m) return `${m[1]}@${x.hostname}`;
  } catch {}
  return "";
}

const xpNetworks = ["bluesky", "mastodon", "x"];
const xpId = n => "xp" + n.charAt(0).toUpperCase() + n.slice(1);
let lastRetry = null;

function currentKind() {
  return document.querySelector('#composeBox input[name="composeKind"]:checked')?.value || "original";
}

function resetSubmitLabel() {
  const b = document.getElementById("composeSubmit");
  if (b) b.textContent = currentKind() === "repost" ? "repost" : "post";
}

function setComposeStatus(lines, kind = "", withRetry = false) {
  const el = document.getElementById("composeStatus");
  if (!el) return;
  el.className = "xpStatus " + kind;
  el.innerHTML = lines.map(l => `<div>${l}</div>`).join("")
    + (withRetry ? `<button type="button" class="xpLinkBtn" id="xpRetry">retry failed</button>` : "");
}

function resultLines(results) {
  return Object.entries(results).map(([n, r]) => {
    if (r.ok) {
      const link = r.url ? safeUrl(r.url) : "";
      return link
        ? `✓ ${n}: <a href="${escHtml(link)}" target="_blank" rel="noopener">view</a>`
        : `✓ ${n}: ok`;
    }
    return `✗ ${n}: ${escHtml(r.error || "error")}`;
  });
}

function xResult(win, text, imageUrl) {
  return fillXWindow(win, { text, imageUrl })
    ? { ok: true }
    : { ok: false, error: "popup blocked — allow popups for this site" };
}

function updateXpCounter() {
  const el = document.getElementById("xpCounter");
  if (!el) return;
  const nets = xpNetworks.filter(n => document.getElementById(xpId(n))?.checked);
  if (!nets.length) { el.textContent = ""; return; }
  const repostUrl = currentKind() === "repost"
    ? safeUrl(document.getElementById("composeRepostUrl")?.value.trim() || "") : "";
  const text = buildText({ content: document.getElementById("composeText")?.value || "", repostUrl });
  const len = graphemeLength(text);
  const s = loadSettings();
  el.innerHTML = nets.map(n => {
    const max = n === "mastodon" ? (s.mastoMax || limits.mastodon) : limits[n];
    return `<span class="${len > max ? "over" : ""}">${n} ${len}/${max}</span>`;
  }).join(" · ");
}

async function finishCrosspost(ref, results, payload) {
  const upd = {};
  const failed = [];
  for (const [n, r] of Object.entries(results)) {
    if (r.ok) { if (r.url) upd[`crossposted.${n}`] = { url: r.url }; }
    else failed.push(n);
  }
  if (Object.keys(upd).length) {
    try { await updateDoc(ref, upd); }
    catch (e) { console.warn("could not save crosspost links:", e); }
  }
  lastRetry = failed.length ? { ref, ...payload, failed } : null;
  setComposeStatus(resultLines(results), failed.length ? "err" : "ok", failed.length > 0);
}

async function retryFailed() {
  if (!isAdmin || !lastRetry) return;
  const { ref, text, file, imageUrl, failed } = lastRetry;
  const xWin = failed.includes("x") ? openXWindow() : null;
  setComposeStatus(["retrying..."], "info");
  const results = {};
  const apiNets = failed.filter(n => n !== "x");
  if (apiNets.length) Object.assign(results, await crosspostAll({ networks: apiNets, text, file, imageUrl }));
  if (failed.includes("x")) results.x = xResult(xWin, text, imageUrl);
  await finishCrosspost(ref, results, { text, file, imageUrl });
}

async function createPost() {
  if (!isAdmin) return;
  const box = document.getElementById("composeBox");
  const textEl = document.getElementById("composeText");
  const urlEl = document.getElementById("composeImage");
  const fileEl = document.getElementById("composeImageFile");
  const repostEl = document.getElementById("composeRepostUrl");
  const submitBtn = document.getElementById("composeSubmit");

  const kind = currentKind();
  const content = textEl.value.trim();
  const pastedUrl = urlEl.value.trim();
  const file = fileEl.files[0] || null;
  const repostUrl = kind === "repost" ? safeUrl(repostEl.value.trim()) : "";

  if (kind === "repost") {
    if (!repostUrl) {
      setComposeStatus(["paste the link of the original post (https://...)"], "err");
      return;
    }
  } else if (!content && !pastedUrl && !file) {
    return;
  }

  if (file && !loadSettings().imgbbKey) {
    setComposeStatus([`configure the imgbb key in "⚙\uFE0E accounts".`], "err");
    document.getElementById("xpSettings")?.classList.add("open");
    return;
  }

  const networks = xpNetworks.filter(n => document.getElementById(xpId(n))?.checked);
  const text = buildText({ content, repostUrl });

  const problems = validateLengths(text, networks);
  if (problems.length) {
    setComposeStatus([`text too long — ${escHtml(problems.join(" · "))}. shorten or uncheck network.`], "err");
    return;
  }
  const missing = networks.filter(n => !isConfigured(n));
  if (missing.length) {
    setComposeStatus([`configure accounts for ${missing.join(", ")} in "⚙\uFE0E accounts".`], "err");
    document.getElementById("xpSettings")?.classList.add("open");
    return;
  }

  savePrefs(Object.fromEntries(xpNetworks.map(n => [n, networks.includes(n)])));

  const xWin = networks.includes("x") ? openXWindow() : null;

  submitBtn.disabled = true;
  setComposeStatus([], "");
  lastRetry = null;

  try {
    let imageUrl = pastedUrl || "";
    if (file) {
      submitBtn.textContent = "uploading image...";
      imageUrl = await uploadImage(file);
    }

    submitBtn.textContent = "posting...";
    const docData = { content, imageUrl, type: kind, timestamp: serverTimestamp() };
    if (repostUrl) docData.repostUrl = repostUrl;
    const ref = await addDoc(collection(db, config.collectionName), docData);

    textEl.value = "";
    repostEl.value = "";
    if (box && box._clearImageSelection) box._clearImageSelection();
    updateXpCounter();

    if (!networks.length) {
      setComposeStatus(["✓ published on site"], "ok");
      return;
    }

    submitBtn.textContent = "crossposting...";
    const results = {};
    const apiNets = networks.filter(n => n !== "x");
    if (apiNets.length) {
      Object.assign(results, await crosspostAll({ networks: apiNets, text, file, imageUrl }));
    }
    if (networks.includes("x")) results.x = xResult(xWin, text, imageUrl);
    await finishCrosspost(ref, results, { text, file, imageUrl });
  } catch (err) {
    console.error("error:", err);
    if (xWin && !xWin.closed) xWin.close();
    setComposeStatus([`error: ${escHtml(err.message || String(err))}`], "err");
  } finally {
    submitBtn.disabled = false;
    resetSubmitLabel();
  }
}

function injectComposeBox() {
  if (document.getElementById("composeBox")) return;
  const targetContainer = document.getElementById("postList");
  if (!targetContainer || !targetContainer.parentNode) return;

  const box = document.createElement("div");
  box.id = "composeBox";
  box.innerHTML = `
    <div class="composeBody">
      <img src="${escHtml(config.avatarUrl)}" alt="avatar">
      <div class="composeFields">
        <div class="composeKind">
          <label><input type="radio" name="composeKind" value="original" checked> original</label>
          <label><input type="radio" name="composeKind" value="repost"> repost</label>
        </div>
        <input type="text" id="composeRepostUrl" placeholder="link to original post (https://...)">
        <textarea id="composeText" placeholder="what's on your mind?"></textarea>
        <div class="composeImageRow">
          <input type="text" id="composeImage" placeholder="image url (optional)">
          <label class="composeUploadBtn" for="composeImageFile">upload image</label>
          <input type="file" id="composeImageFile" accept="image/*" hidden>
        </div>
        <div id="composeImagePreview" class="composeImagePreview">
          <img id="composeImagePreviewImg" src="" alt="preview">
          <button type="button" class="composeImageRemove" id="composeImageRemove" title="remove image">×</button>
        </div>

        <div class="xpRow">
          <span>crosspost:</span>
          <label><input type="checkbox" id="xpBluesky"> bluesky</label>
          <label><input type="checkbox" id="xpMastodon"> mastodon</label>
          <label><input type="checkbox" id="xpX"> x</label>
          <button type="button" class="xpLinkBtn" id="xpSettingsToggle">⚙\uFE0E accounts</button>
        </div>
        <div class="xpCounter" id="xpCounter"></div>

        <div class="xpSettings" id="xpSettings">
          <h4>bluesky</h4>
          <input type="text" id="xpBskyHandle" value="${defaultBskyHandle}" readonly title="only @${config.handle}">
          <input type="password" id="xpBskyPass" placeholder="app password (xxxx-xxxx-xxxx-xxxx)" autocomplete="off">
          <small>app password generated at bsky.app → settings → app passwords.</small>

          <h4>mastodon</h4>
          <input type="text" id="xpMastoInstance" placeholder="instance (e.g. mastodon.social)">
          <input type="password" id="xpMastoToken" placeholder="access token" autocomplete="off">
          <select id="xpMastoVis">
            <option value="public">public</option>
            <option value="unlisted">unlisted</option>
          </select>
          <small>token needs write:statuses, write:media and read:accounts scopes.</small>

          <h4>imgbb</h4>
          <input type="password" id="xpImgbbKey" placeholder="api key" autocomplete="off">
          <small>hosts the images you upload (api.imgbb.com).</small>

          <h4>x</h4>
          <small>opens an intent popup pre-filled with text and link.</small>

          <small>credentials saved only in this browser (localStorage).</small>
          <div class="xpBtns">
            <button type="button" class="xpLinkBtn" id="xpSave">save</button>
            <button type="button" class="xpLinkBtn" id="xpClear">clear</button>
          </div>
        </div>

        <div class="xpStatus" id="composeStatus"></div>
      </div>
    </div>
    <div class="composeActions">
      <button id="composeSubmit">post</button>
    </div>
  `;
  targetContainer.parentNode.insertBefore(box, targetContainer);

  const kindRadios = box.querySelectorAll('input[name="composeKind"]');
  const repostUrlInput = box.querySelector("#composeRepostUrl");
  kindRadios.forEach(r => {
    r.addEventListener("change", () => {
      const isRep = currentKind() === "repost";
      repostUrlInput.classList.toggle("show", isRep);
      resetSubmitLabel();
      updateXpCounter();
    });
  });

  const urlInput = box.querySelector("#composeImage");
  const fileInput = box.querySelector("#composeImageFile");
  const preview = box.querySelector("#composeImagePreview");
  const previewImg = box.querySelector("#composeImagePreviewImg");
  const removeBtn = box.querySelector("#composeImageRemove");

  function showPreview(src) {
    previewImg.src = src;
    preview.classList.add("active");
  }

  function clearImageSelection() {
    fileInput.value = "";
    urlInput.value = "";
    urlInput.disabled = false;
    preview.classList.remove("active");
    previewImg.src = "";
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    urlInput.value = "";
    urlInput.disabled = true;
    const reader = new FileReader();
    reader.onload = e => showPreview(e.target.result);
    reader.readAsDataURL(file);
  });

  urlInput.addEventListener("input", () => {
    const val = urlInput.value.trim();
    if (!val) {
      if (!fileInput.files[0]) preview.classList.remove("active");
      return;
    }
    fileInput.value = "";
    showPreview(val);
  });

  removeBtn.addEventListener("click", () => clearImageSelection());
  box._clearImageSelection = clearImageSelection;

  box.querySelector("#composeText").addEventListener("input", updateXpCounter);
  repostUrlInput.addEventListener("input", updateXpCounter);

  const savedPrefs = loadPrefs();
  xpNetworks.forEach(n => {
    const cb = box.querySelector(`#${xpId(n)}`);
    if (cb) {
      cb.checked = !!savedPrefs[n];
      cb.addEventListener("change", updateXpCounter);
    }
  });

  const settingsEl = box.querySelector("#xpSettings");
  const s = loadSettings();
  box.querySelector("#xpBskyHandle").value = s.bskyHandle || defaultBskyHandle;
  box.querySelector("#xpBskyPass").value = s.bskyPassword || "";
  box.querySelector("#xpMastoInstance").value = s.mastoInstance || "";
  box.querySelector("#xpMastoToken").value = s.mastoToken || "";
  box.querySelector("#xpMastoVis").value = s.mastoVisibility || "public";
  box.querySelector("#xpImgbbKey").value = s.imgbbKey || "";

  box.querySelector("#xpSettingsToggle").addEventListener("click", () => {
    settingsEl.classList.toggle("open");
  });

  box.querySelector("#xpSave").addEventListener("click", () => {
    try {
      saveSettings({
        ...loadSettings(),
        bskyHandle: box.querySelector("#xpBskyHandle").value.trim(),
        bskyPassword: box.querySelector("#xpBskyPass").value.trim(),
        mastoInstance: box.querySelector("#xpMastoInstance").value.trim(),
        mastoToken: box.querySelector("#xpMastoToken").value.trim(),
        mastoVisibility: box.querySelector("#xpMastoVis").value,
        imgbbKey: box.querySelector("#xpImgbbKey").value.trim()
      });
      setComposeStatus(["✓ saved in browser"], "ok");
      refreshMastodonLimit().then(updateXpCounter);
    } catch (e) {
      setComposeStatus([`✗ ${escHtml(e.message)}`], "err");
    }
  });

  box.querySelector("#xpClear").addEventListener("click", () => {
    if (!confirm("clear credentials in this browser?")) return;
    saveSettings({});
    ["#xpBskyPass", "#xpMastoInstance", "#xpMastoToken", "#xpImgbbKey"].forEach(sel => { box.querySelector(sel).value = ""; });
    setComposeStatus(["credentials cleared"], "info");
  });

  box.addEventListener("click", e => {
    if (e.target.id === "xpRetry") retryFailed();
  });

  document.getElementById("composeSubmit").addEventListener("click", createPost);
  updateXpCounter();
}

const syncDocId = (source, key) => `sync_${source}_${String(key).replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 200);

function syncTimestamp(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d : serverTimestamp();
}

async function syncRepost() {
  if (!isAdmin || !isAllowed(auth.currentUser?.email)) return;
  const syncBtn = document.getElementById("xpSyncRepost");
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = "syncing...";
  }

  let importedCount = 0;
  try {
    const s = loadSettings();
    const deletedUrls = new Set();
    try {
      const delSnap = await getDocs(collection(db, config.deletedCollection));
      delSnap.forEach(d => { const u = d.data().repostUrl; if (u) deletedUrls.add(u); });
    } catch (errDel) {
      console.warn("could not read deleted list:", errDel);
    }
    const handle = s.bskyHandle || defaultBskyHandle;
    const bskyRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=40`);
    if (bskyRes.ok) {
      const data = await bskyRes.json();
      const existingUrls = new Set(cachedDocs.map(d => d.data.repostUrl).filter(Boolean));

      for (const item of (data.feed || [])) {
        if (!item.reason || item.reason.$type !== "app.bsky.feed.defs#reasonRepost") continue;
        const p = item.post;
        if (!p) continue;

        const rkey = p.uri.split("/").pop();
        const postUrl = `https://bsky.app/profile/${p.author.handle}/post/${rkey}`;
        if (existingUrls.has(postUrl) || deletedUrls.has(postUrl)) continue;

        let imageUrl = "";
        if (p.embed?.images && p.embed.images[0]) {
          imageUrl = p.embed.images[0].fullsize || p.embed.images[0].thumb || "";
        } else if (p.embed?.media?.images && p.embed.media.images[0]) {
          imageUrl = p.embed.media.images[0].fullsize || p.embed.media.images[0].thumb || "";
        }

        const id = syncDocId("bsky", p.uri.replace(/^at:\/\//, ""));
        if (cachedDocs.some(d => d.id === id)) { existingUrls.add(postUrl); continue; }
        await setDoc(doc(db, config.collectionName, id), {
          content: p.record?.text || "",
          imageUrl,
          repostUrl: postUrl,
          repostAuthor: p.author.handle,
          type: "repost",
          source: "bluesky",
          timestamp: syncTimestamp(item.reason.indexedAt)
        });
        existingUrls.add(postUrl);
        importedCount++;
      }
    }

    if (s.mastoInstance && s.mastoToken) {
      try {
        let base = s.mastoInstance.trim().replace(/\/+$/, "");
        if (!/^https?:\/\//.test(base)) base = `https://${base}`;
        const meRes = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
          headers: { Authorization: `Bearer ${s.mastoToken.trim()}` }
        });
        if (meRes.ok) {
          const me = await meRes.json();
          const statRes = await fetch(`${base}/api/v1/accounts/${me.id}/statuses?exclude_replies=true&limit=40`, {
            headers: { Authorization: `Bearer ${s.mastoToken.trim()}` }
          });
          if (statRes.ok) {
            const statuses = await statRes.json();
            const existingUrls = new Set(cachedDocs.map(d => d.data.repostUrl).filter(Boolean));
            for (const st of statuses) {
              if (!st.reblog) continue;
              const orig = st.reblog;
              const postUrl = orig.url;
              if (!postUrl || existingUrls.has(postUrl) || deletedUrls.has(postUrl)) continue;

              const cleanText = (orig.content || "").replace(/<[^>]+>/g, "").trim();
              const imageUrl = orig.media_attachments?.[0]?.url || "";

              const id = syncDocId("masto", postUrl);
              if (cachedDocs.some(d => d.id === id)) { existingUrls.add(postUrl); continue; }
              await setDoc(doc(db, config.collectionName, id), {
                content: cleanText,
                imageUrl,
                repostUrl: postUrl,
                repostAuthor: orig.account?.acct || "",
                type: "repost",
                source: "mastodon",
                timestamp: syncTimestamp(st.created_at)
              });
              existingUrls.add(postUrl);
              importedCount++;
            }
          }
        }
      } catch (errMasto) {
        console.warn("mastodon sync error:", errMasto);
      }
    }

    if (importedCount > 0) {
      alert(`✓ ${importedCount} new repost(s) synced!`);
    } else {
      alert("no new repost found to sync.");
    }
  } catch (err) {
    console.error("sync error:", err);
    alert(`sync error: ${err.message || err}`);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = "↻ sync repost";
    }
  }
}

function injectTabs() {
  if (!feed || document.getElementById("postTabList")) return;

  let host = document.getElementById("postTabs");
  if (!host) {
    host = document.createElement("div");
    host.id = "postTabs";
    feed.parentNode.insertBefore(host, feed);
  }

  host.innerHTML = `
    <div class="postTabs">
      <ul id="postTabList">
        <li class="active" data-tab="original"><span>post</span><strong id="countOriginal">0</strong></li>
        <li data-tab="repost"><span>repost</span><strong id="countRepost">0</strong></li>
      </ul>
      <div class="postAdminActions" id="adminActions"></div>
    </div>
  `;

  host.querySelectorAll("#postTabList li").forEach(li => {
    li.addEventListener("click", () => setActiveTab(li.dataset.tab));
  });
}

function injectAdminActions() {
  const bar = document.getElementById("adminActions");
  if (!bar || document.getElementById("xpSyncRepost")) return;
  bar.innerHTML = `<button type="button" class="postSyncBtn" id="xpSyncRepost" title="sync repost from bluesky & mastodon">↻ sync repost</button>`;
  bar.querySelector("#xpSyncRepost").addEventListener("click", syncRepost);
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll("#postTabList li").forEach(li => {
    li.classList.toggle("active", li.dataset.tab === tab);
  });
  renderList();
}

async function deletePost(id, liEl) {
  if (!confirm("delete this post?")) return;
  try {
    const found = cachedDocs.find(d => d.id === id);
    if (found && found.data.repostUrl && isSyncedRepost(found.data)) {
      await setDoc(doc(db, config.deletedCollection, syncDocId("del", found.data.repostUrl)), {
        repostUrl: found.data.repostUrl,
        source: found.data.source || "",
        deletedAt: serverTimestamp()
      });
    }
    await deleteDoc(doc(db, found?.col || config.collectionName, id));
    liEl.style.transition = "opacity 0.3s";
    liEl.style.opacity = "0";
    setTimeout(() => liEl.remove(), 310);
  } catch (err) {
    console.error("error:", err);
    alert("error");
  }
}

async function saveEdit(id, field, newContent) {
  try {
    const col = cachedDocs.find(d => d.id === id)?.col || config.collectionName;
    await updateDoc(doc(db, col, id), { [field]: newContent });
  } catch (err) {
    console.error("error:", err);
    alert("error");
  }
}

function enterEditMode(id, liEl, currentValue, field = "content", allowEmpty = false) {
  const infoDiv = liEl.querySelector(".postInfo");
  const pEl = infoDiv.querySelector(".postText");
  if (!pEl) return;

  pEl.style.display = "none";

  const form = document.createElement("div");
  form.className = "editForm";
  form.innerHTML = `
    <textarea class="editTextarea"></textarea>
    <div class="editActions">
      <button class="editCancel">cancel</button>
      <button class="editSave">save</button>
    </div>
  `;

  const textarea = form.querySelector(".editTextarea");
  textarea.value = currentValue;

  form.querySelector(".editCancel").addEventListener("click", e => {
    e.stopPropagation();
    form.remove();
    pEl.style.display = "";
  });

  form.querySelector(".editSave").addEventListener("click", async e => {
    e.stopPropagation();
    const newContent = textarea.value.trim();
    if (!newContent && !allowEmpty) return;

    await saveEdit(id, field, newContent);
    pEl.innerHTML = linkify(newContent);
    pEl.hidden = !newContent;
    const embedsEl = infoDiv.querySelector(".postEmbeds");
    if (embedsEl) embedsEl.innerHTML = buildEmbeds(newContent);
    form.remove();
    pEl.style.display = "";
  });

  pEl.after(form);
}

function buildPostEl(id, data) {
  const li = document.createElement("li");
  li.id = "post-" + id;
  li.className = "postItem";

  const repost = isRepost(data);
  const repostLink = safeUrl(data.repostUrl || "");
  if (repostLink) li.dataset.repostUrl = repostLink;
  const xpBadges = ["bluesky", "mastodon"].map(n => {
    const u = safeUrl(data.crossposted?.[n]?.url || "");
    return u
      ? `<a href="${escHtml(u)}" target="_blank" rel="noopener" title="also on ${n}">${n === "bluesky" ? "bsky" : "masto"}</a>`
      : "";
  }).join("");

  const parts = repostParts(data);
  const quotedImage = repost && isSyncedRepost(data);

  const imgHtml = data.imageUrl
    ? `<img class="postImage" src="${escHtml(data.imageUrl)}" alt="">`
    : "";

  const isImported = data.source === "twitter";
  const importedBadge = isImported
    ? ` · <span class="postImported" title="imported from x">𝕏</span>`
    : "";

  const author = data.repostAuthor || authorFromUrl(repostLink);
  const hasQuote = repost && (author || parts.quoted || repostLink || (quotedImage && data.imageUrl));
  const quoteHtml = hasQuote ? `
      <div class="repostQuote">
        ${author ? `<div class="repostQuoteAuthor">${escHtml(author.startsWith("@") ? author : "@" + author)}</div>` : ""}
        ${parts.quoted ? `<p class="repostQuoteText">${linkify(parts.quoted)}</p>` : ""}
        ${quotedImage ? imgHtml : ""}
        ${repostLink ? `<a class="repostCard" href="${escHtml(repostLink)}" target="_blank" rel="noopener">↗\uFE0E ${escHtml(shortLink(repostLink))}</a>` : ""}
        <div class="repostQuoteEmbeds">${buildEmbeds(parts.quoted + (repostLink ? "\n" + repostLink : ""))}</div>
      </div>` : "";

  const plainRepost = repost && !parts.comment;
  if (plainRepost) li.classList.add("plainRepost");

  li.innerHTML = `
    ${plainRepost ? "" : `<img src="${escHtml(config.avatarUrl)}" alt="avatar">`}
    <div class="postInfo">
      ${repost ? `<div class="repostLabel">↻ ${escHtml(config.displayName)} reposted${parts.comment ? " with comment" : ""}${plainRepost ? ` · ${formatDate(data.timestamp)}` : ""}</div>` : ""}
      ${plainRepost ? "" : `<strong>${escHtml(config.displayName)} <span>@${escHtml(config.handle)} · ${formatDate(data.timestamp)}${importedBadge}${xpBadges ? ` · <span class="xpBadges">${xpBadges}</span>` : ""}</span></strong>`}
      <p class="postText"${parts.comment ? "" : " hidden"}>${linkify(parts.comment)}</p>
      ${quotedImage ? "" : imgHtml}
      <div class="postEmbeds">${buildEmbeds(parts.comment)}</div>
      ${quoteHtml}
    </div>
  `;

  if (isAdmin) {
    const menuBtn = document.createElement("button");
    menuBtn.className = "postMenuBtn";
    menuBtn.title = "options";
    menuBtn.setAttribute("aria-label", "post options");
    menuBtn.textContent = "⋯";

    const dropdown = document.createElement("div");
    dropdown.className = "postDropdown";

    if (!isImported) {
      const editBtn = document.createElement("button");
      editBtn.className = "postDropdownBtn";
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
        ${repost && !parts.comment ? "add comment" : "edit post"}
      `;
      editBtn.classList.add("neutral");
      editBtn.addEventListener("click", e => {
        e.stopPropagation();
        dropdown.classList.remove("open");
        enterEditMode(id, li, parts.comment, parts.field, repost);
      });
      dropdown.appendChild(editBtn);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "postDropdownBtn";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
      delete post
    `;
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      dropdown.classList.remove("open");
      deletePost(id, li);
    });

    dropdown.appendChild(deleteBtn);
    menuBtn.appendChild(dropdown);

    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".postDropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });

    li.appendChild(menuBtn);
  }

  return li;
}

if (feed) feed.innerHTML = `<ul class="postList" id="postList"><li class="postEmpty">loading...</li></ul>`;
injectTabs();

const postContainer = document.getElementById("postList");
let cachedDocs = [];
let activeTab = "original";
let hashHandled = false;

function visibleDocs() {
  return cachedDocs.filter(({ data }) => (activeTab === "repost") === isRepost(data));
}

function updateTabCounts() {
  const repost = cachedDocs.filter(({ data }) => isRepost(data)).length;
  const a = document.getElementById("countOriginal");
  const b = document.getElementById("countRepost");
  if (a) a.textContent = cachedDocs.length - repost;
  if (b) b.textContent = repost;
}

function renderList() {
  if (!postContainer) return;
  postContainer.innerHTML = "";
  updateTabCounts();
  const list = visibleDocs();
  if (list.length === 0) {
    postContainer.innerHTML = `
      <li class="postEmpty">
        ${activeTab === "repost" ? "no repost yet." : "no post yet."}
      </li>`;
    return;
  }
  list.forEach(({ id, data }) => postContainer.appendChild(buildPostEl(id, data)));
}

function rerenderAll() {
  if (!postContainer || cachedDocs.length === 0) return;
  renderList();
}

function goToHash() {
  const m = location.hash.match(/^#post-([\w-]+)$/);
  if (!m) return;
  const found = cachedDocs.find(d => d.id === m[1]);
  if (!found) return;
  const wanted = isRepost(found.data) ? "repost" : "original";
  if (wanted !== activeTab) setActiveTab(wanted);
  const el = document.getElementById("post-" + m[1]);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("postHighlight");
  }
}
window.addEventListener("hashchange", goToHash, { signal: pageAbort.signal });
document.addEventListener("click", () => {
  document.querySelectorAll(".postDropdown.open").forEach(d => d.classList.remove("open"));
}, { signal: pageAbort.signal });

if (postContainer) {
  // le a colecao principal e as antigas ao mesmo tempo e junta tudo.
  // sem orderBy no servidor: o Firestore esconde docs sem o campo "timestamp".
  const allCols = [config.collectionName, ...(config.legacyCollections || [])];
  const buckets = {};
  const failed = new Set();
  const loaded = new Set();

  const tsMillis = t => {
    if (!t) return 0;
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000;
    const n = new Date(t).getTime();
    return isNaN(n) ? 0 : n;
  };

  function mergeAndRender() {
    const seen = new Set();
    cachedDocs = [];
    for (const col of allCols) {
      for (const d of (buckets[col] || [])) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        cachedDocs.push(d);
      }
    }
    cachedDocs.sort((a, b) => tsMillis(b.data.timestamp) - tsMillis(a.data.timestamp));
    console.log("[posts]", cachedDocs.length, "docs",
      Object.fromEntries(allCols.map(c => [c, (buckets[c] || []).length])));
    renderList();

    if (!hashHandled && cachedDocs.length) {
      hashHandled = true;
      goToHash();
    }
  }

  allCols.forEach(col => {
    pageUnsubs.push(onSnapshot(collection(db, col), snapshot => {
      failed.delete(col);
      loaded.add(col);
      buckets[col] = [];
      snapshot.forEach(docSnap => {
        buckets[col].push({ id: docSnap.id, data: docSnap.data(), col });
      });
      mergeAndRender();
    }, err => {
      console.error(`error loading "${col}":`, err.code, err);
      failed.add(col);
      buckets[col] = [];
      if (failed.size === allCols.length) {
        const hint = err.code === "permission-denied"
          ? "firestore recusou a leitura (confira as regras do banco)."
          : (err.code || err.message || "erro desconhecido");
        postContainer.innerHTML = `
          <li class="postError">
            error loading posts — ${escHtml(hint)}
          </li>`;
      } else {
        mergeAndRender();
      }
    }));
  });
}