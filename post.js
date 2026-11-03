import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
  authDomain: "minkurosu.firebaseapp.com",
  projectId: "minkurosu",
  storageBucket: "minkurosu.firebasestorage.app",
  messagingSenderId: "290821725607",
  appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
  measurementId: "G-M7PWC6DDRH"
};

const allowedEmails = [
  "mincruzm@gmail.com",
  "yasmincruzm@hotmail.com"
];

const isAllowed = email => !!email && allowedEmails.includes(email);

const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let isAdmin = false;

onAuthStateChanged(auth, user => {
  isAdmin = !!(user && isAllowed(user.email));
  const composeBox = document.getElementById("compose-post");
  if (composeBox) composeBox.style.display = isAdmin ? "block" : "none";
  const actionsBar = document.getElementById("admin-actions-bar");
  if (actionsBar) actionsBar.style.display = isAdmin ? "flex" : "none";
  rerenderAll();
});

const settingsKey = "crosspost_settings_v1";
const prefsKey = "crosspost_prefs_v1";
const limits = { bluesky: 300, x: 280, mastodon: 500 };
const allowedUser = "minkurosu";

const isAllowedBsky = handle =>
  String(handle || "").replace(/^@/, "").toLowerCase().split(".")[0] === allowedUser;

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(settingsKey)) || {}; }
  catch { return {}; }
}

function saveSettings(s) {
  if (s.bskyHandle && !isAllowedBsky(s.bskyHandle)) {
    throw new Error(`bluesky handle must be @${allowedUser}...`);
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
    return j.message || j.error_description || j.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
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
    throw new Error(`blocked: account is @${sess.handle}, only @${allowedUser} allowed`);
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
    return `<img src="${u}" alt="" loading="lazy" style="max-width:100%;border-radius:10px;margin-top:10px;display:block;">`;
  }
  if (embedPatterns.video.test(url)) {
    return `<video src="${u}" controls loading="lazy" style="max-width:100%;border-radius:10px;margin-top:10px;display:block;"></video>`;
  }
  let m = url.match(embedPatterns.youtube);
  if (m) {
    return `<div style="margin-top:10px;border-radius:10px;overflow:hidden;position:relative;padding-top:56.25%;">
      <iframe src="https://www.youtube.com/embed/${m[1]}" title="youtube video"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  m = url.match(embedPatterns.spotify);
  if (m) {
    const height = (m[1] === "track" || m[1] === "episode") ? 152 : 352;
    return `<div style="margin-top:10px;border-radius:12px;overflow:hidden;">
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
      return `<a href="${core}" target="_blank" rel="noopener" style="color:#3BB9E3;">${core}</a>${trail}`;
    })
    .replace(/#(\w+)/g, '<span style="color:#3BB9E3;">#$1</span>');
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

const xpNetworks = ["bluesky", "mastodon", "x"];
let lastRetry = null;

function currentKind() {
  return document.querySelector('#compose-post input[name="compose-kind"]:checked')?.value || "original";
}

function resetSubmitLabel() {
  const b = document.getElementById("compose-submit");
  if (b) b.textContent = currentKind() === "repost" ? "repost" : "post";
}

function setComposeStatus(lines, kind = "", withRetry = false) {
  const el = document.getElementById("compose-status");
  if (!el) return;
  el.className = "xp-status " + kind;
  el.innerHTML = lines.map(l => `<div>${l}</div>`).join("")
    + (withRetry ? `<button type="button" class="xp-link-btn" id="xp-retry">retry failed</button>` : "");
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
  const el = document.getElementById("xp-counter");
  if (!el) return;
  const nets = xpNetworks.filter(n => document.getElementById(`xp-${n}`)?.checked);
  if (!nets.length) { el.textContent = ""; return; }
  const repostUrl = currentKind() === "repost"
    ? safeUrl(document.getElementById("compose-repost-url")?.value.trim() || "") : "";
  const text = buildText({ content: document.getElementById("compose-text")?.value || "", repostUrl });
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
  const box = document.getElementById("compose-post");
  const textEl = document.getElementById("compose-text");
  const urlEl = document.getElementById("compose-image");
  const fileEl = document.getElementById("compose-image-file");
  const repostEl = document.getElementById("compose-repost-url");
  const submitBtn = document.getElementById("compose-submit");

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

  const networks = xpNetworks.filter(n => document.getElementById(`xp-${n}`)?.checked);
  const text = buildText({ content, repostUrl });

  const problems = validateLengths(text, networks);
  if (problems.length) {
    setComposeStatus([`text too long — ${escHtml(problems.join(" · "))}. shorten or uncheck network.`], "err");
    return;
  }
  const missing = networks.filter(n => !isConfigured(n));
  if (missing.length) {
    setComposeStatus([`configure accounts for ${missing.join(", ")} in "⚙ accounts".`], "err");
    document.getElementById("xp-settings")?.classList.add("open");
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
      const path = `posts/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      imageUrl = await getDownloadURL(fileRef);
    }

    submitBtn.textContent = "posting...";
    const docData = { content, imageUrl, type: kind, timestamp: serverTimestamp() };
    if (repostUrl) docData.repostUrl = repostUrl;
    const ref = await addDoc(collection(db, "posts"), docData);

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
  if (document.getElementById("compose-post")) return;
  const targetContainer = document.getElementById("posts-container");
  if (!targetContainer || !targetContainer.parentNode) return;

  const box = document.createElement("div");
  box.id = "compose-post";
  box.innerHTML = `
    <div class="compose-body">
      <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
      <div class="compose-fields">
        <div class="compose-kind">
          <label><input type="radio" name="compose-kind" value="original" checked> original</label>
          <label><input type="radio" name="compose-kind" value="repost"> repost</label>
        </div>
        <input type="text" id="compose-repost-url" placeholder="link to original post (https://...)">
        <textarea id="compose-text" placeholder="what's on your mind?"></textarea>
        <div class="compose-image-row">
          <input type="text" id="compose-image" placeholder="image url (optional)">
          <label class="compose-upload-btn" for="compose-image-file">upload image</label>
          <input type="file" id="compose-image-file" accept="image/*" hidden>
        </div>
        <div id="compose-image-preview" class="compose-image-preview">
          <img id="compose-image-preview-img" src="" alt="preview">
          <button type="button" class="compose-image-remove" id="compose-image-remove" title="remove image">×</button>
        </div>

        <div class="xp-row">
          <span>crosspost:</span>
          <label><input type="checkbox" id="xp-bluesky"> bluesky</label>
          <label><input type="checkbox" id="xp-mastodon"> mastodon</label>
          <label><input type="checkbox" id="xp-x"> x</label>
          <button type="button" class="xp-link-btn" id="xp-settings-toggle">⚙ accounts</button>
        </div>
        <div class="xp-counter" id="xp-counter"></div>

        <div class="xp-settings" id="xp-settings">
          <h4>bluesky</h4>
          <input type="text" id="xp-bsky-handle" value="minkurosu.bsky.social" readonly title="only @minkurosu">
          <input type="password" id="xp-bsky-pass" placeholder="app password (xxxx-xxxx-xxxx-xxxx)" autocomplete="off">
          <small>app password generated at bsky.app → settings → app passwords.</small>

          <h4>mastodon</h4>
          <input type="text" id="xp-masto-instance" placeholder="instance (e.g. mastodon.social)">
          <input type="password" id="xp-masto-token" placeholder="access token" autocomplete="off">
          <select id="xp-masto-vis">
            <option value="public">public</option>
            <option value="unlisted">unlisted</option>
          </select>
          <small>token needs write:statuses, write:media and read:accounts scopes.</small>

          <h4>x</h4>
          <small>opens an intent popup pre-filled with text and link.</small>

          <small>credentials saved only in this browser (localStorage).</small>
          <div class="xp-btns">
            <button type="button" class="xp-link-btn" id="xp-save">save</button>
            <button type="button" class="xp-link-btn" id="xp-clear">clear</button>
          </div>
        </div>

        <div class="xp-status" id="compose-status"></div>
      </div>
    </div>
    <div class="compose-actions">
      <button id="compose-submit">post</button>
    </div>
  `;
  targetContainer.parentNode.insertBefore(box, targetContainer);

  const kindRadios = box.querySelectorAll('input[name="compose-kind"]');
  const repostUrlInput = box.querySelector("#compose-repost-url");
  kindRadios.forEach(r => {
    r.addEventListener("change", () => {
      const isRep = currentKind() === "repost";
      repostUrlInput.classList.toggle("show", isRep);
      resetSubmitLabel();
      updateXpCounter();
    });
  });

  const urlInput = box.querySelector("#compose-image");
  const fileInput = box.querySelector("#compose-image-file");
  const preview = box.querySelector("#compose-image-preview");
  const previewImg = box.querySelector("#compose-image-preview-img");
  const removeBtn = box.querySelector("#compose-image-remove");

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

  box.querySelector("#compose-text").addEventListener("input", updateXpCounter);
  repostUrlInput.addEventListener("input", updateXpCounter);

  const savedPrefs = loadPrefs();
  xpNetworks.forEach(n => {
    const cb = box.querySelector(`#xp-${n}`);
    if (cb) {
      cb.checked = !!savedPrefs[n];
      cb.addEventListener("change", updateXpCounter);
    }
  });

  const settingsEl = box.querySelector("#xp-settings");
  const s = loadSettings();
  box.querySelector("#xp-bsky-handle").value = s.bskyHandle || "minkurosu.bsky.social";
  box.querySelector("#xp-bsky-pass").value = s.bskyPassword || "";
  box.querySelector("#xp-masto-instance").value = s.mastoInstance || "";
  box.querySelector("#xp-masto-token").value = s.mastoToken || "";
  box.querySelector("#xp-masto-vis").value = s.mastoVisibility || "public";

  box.querySelector("#xp-settings-toggle").addEventListener("click", () => {
    settingsEl.classList.toggle("open");
  });

  box.querySelector("#xp-save").addEventListener("click", () => {
    try {
      saveSettings({
        ...loadSettings(),
        bskyHandle: box.querySelector("#xp-bsky-handle").value.trim(),
        bskyPassword: box.querySelector("#xp-bsky-pass").value.trim(),
        mastoInstance: box.querySelector("#xp-masto-instance").value.trim(),
        mastoToken: box.querySelector("#xp-masto-token").value.trim(),
        mastoVisibility: box.querySelector("#xp-masto-vis").value
      });
      setComposeStatus(["✓ saved in browser"], "ok");
      refreshMastodonLimit().then(updateXpCounter);
    } catch (e) {
      setComposeStatus([`✗ ${escHtml(e.message)}`], "err");
    }
  });

  box.querySelector("#xp-clear").addEventListener("click", () => {
    if (!confirm("clear credentials in this browser?")) return;
    saveSettings({});
    ["#xp-bsky-pass", "#xp-masto-instance", "#xp-masto-token"].forEach(sel => { box.querySelector(sel).value = ""; });
    setComposeStatus(["credentials cleared"], "info");
  });

  box.addEventListener("click", e => {
    if (e.target.id === "xp-retry") retryFailed();
  });

  document.getElementById("compose-submit").addEventListener("click", createPost);
  box.style.display = isAdmin ? "block" : "none";
  updateXpCounter();
}

async function syncReposts() {
  if (!isAdmin) return;
  const syncBtn = document.getElementById("xp-sync-reposts");
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = "syncing...";
  }

  let importedCount = 0;
  try {
    const s = loadSettings();
    const handle = s.bskyHandle || "minkurosu.bsky.social";
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
        if (existingUrls.has(postUrl)) continue;

        let imageUrl = "";
        if (p.embed?.images && p.embed.images[0]) {
          imageUrl = p.embed.images[0].fullsize || p.embed.images[0].thumb || "";
        } else if (p.embed?.media?.images && p.embed.media.images[0]) {
          imageUrl = p.embed.media.images[0].fullsize || p.embed.media.images[0].thumb || "";
        }

        await addDoc(collection(db, "posts"), {
          content: p.record?.text || "",
          imageUrl,
          repostUrl: postUrl,
          repostAuthor: p.author.handle,
          type: "repost",
          source: "bluesky",
          timestamp: serverTimestamp()
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
              if (!postUrl || existingUrls.has(postUrl)) continue;

              const cleanText = (orig.content || "").replace(/<[^>]+>/g, "").trim();
              const imageUrl = orig.media_attachments?.[0]?.url || "";

              await addDoc(collection(db, "posts"), {
                content: cleanText,
                imageUrl,
                repostUrl: postUrl,
                repostAuthor: orig.account?.acct || "",
                type: "repost",
                source: "mastodon",
                timestamp: serverTimestamp()
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
      alert("no new reposts found to sync.");
    }
  } catch (err) {
    console.error("sync error:", err);
    alert(`sync error: ${err.message || err}`);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = "🔄 sync reposts";
    }
  }
}

function injectTabs() {
  if (document.getElementById("post-tabs")) return;

  let bar = document.querySelector("#posts-root .bar");
  if (!bar) {
    const timeline = document.querySelector("#posts-root .timeline");
    if (!timeline) return;
    bar = document.createElement("div");
    bar.className = "bar";
    timeline.insertBefore(bar, timeline.firstChild);
  }

  bar.innerHTML = `
    <div class="container" style="display:flex; justify-content:space-between; align-items:center;">
      <ul id="post-tabs">
        <li class="active" data-tab="original"><span>posts</span><strong id="count-original">0</strong></li>
        <li data-tab="reposts"><span>reposts</span><strong id="count-reposts">0</strong></li>
      </ul>
      <div class="actions" id="admin-actions-bar" style="display: ${isAdmin ? 'flex' : 'none'};">
        <button type="button" id="xp-sync-reposts" title="sync reposts from bluesky & mastodon" style="width:auto; padding:0 14px; font-size:12px; cursor:pointer;">🔄 sync reposts</button>
      </div>
    </div>
  `;

  bar.querySelectorAll("#post-tabs li").forEach(li => {
    li.addEventListener("click", () => setActiveTab(li.dataset.tab));
  });

  bar.querySelector("#xp-sync-reposts")?.addEventListener("click", syncReposts);
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll("#post-tabs li").forEach(li => {
    li.classList.toggle("active", li.dataset.tab === tab);
  });
  renderList();
}

async function deletePost(id, liEl) {
  if (!confirm("delete this post?")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    liEl.style.transition = "opacity 0.3s";
    liEl.style.opacity = "0";
    setTimeout(() => liEl.remove(), 310);
  } catch (err) {
    console.error("error:", err);
    alert("error");
  }
}

async function saveEdit(id, newContent) {
  try {
    await updateDoc(doc(db, "posts", id), { content: newContent });
  } catch (err) {
    console.error("error:", err);
    alert("error");
  }
}

function enterEditMode(id, liEl, currentContent) {
  const infoDiv = liEl.querySelector(".info");
  const pEl = infoDiv.querySelector("p");
  if (!pEl) return;

  pEl.style.display = "none";

  const form = document.createElement("div");
  form.className = "edit-form";
  form.innerHTML = `
    <textarea class="edit-textarea"></textarea>
    <div class="edit-actions">
      <button class="edit-cancel">cancel</button>
      <button class="edit-save">save</button>
    </div>
  `;

  const textarea = form.querySelector(".edit-textarea");
  textarea.value = currentContent;

  form.querySelector(".edit-cancel").addEventListener("click", e => {
    e.stopPropagation();
    form.remove();
    pEl.style.display = "";
  });

  form.querySelector(".edit-save").addEventListener("click", async e => {
    e.stopPropagation();
    const newContent = textarea.value.trim();
    if (!newContent) return;

    await saveEdit(id, newContent);
    pEl.innerHTML = linkify(newContent);
    const embedsEl = infoDiv.querySelector(".post-embeds");
    if (embedsEl) embedsEl.innerHTML = buildEmbeds(newContent);
    form.remove();
    pEl.style.display = "";
  });

  infoDiv.appendChild(form);
}

function buildPostEl(id, data) {
  const li = document.createElement("li");
  li.id = "post-" + id;

  const repost = isRepost(data);
  const repostLink = safeUrl(data.repostUrl || "");
  if (repostLink) li.dataset.repostUrl = repostLink;
  const xpBadges = ["bluesky", "mastodon"].map(n => {
    const u = safeUrl(data.crossposted?.[n]?.url || "");
    return u
      ? `<a href="${escHtml(u)}" target="_blank" rel="noopener" title="also on ${n}">${n === "bluesky" ? "🦋" : "🐘"}</a>`
      : "";
  }).join("");

  const imgHtml = data.imageUrl
    ? `<img src="${escHtml(data.imageUrl)}" alt="" style="max-width:100%;border-radius:10px;margin-top:10px;">`
    : "";

  const isImported = data.source === "twitter";
  const importedBadge = isImported
    ? ` · <span title="imported from x" style="color:#3BB9E3;">𝕏</span>`
    : "";

  li.innerHTML = `
    <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
    <div class="info">
      ${repost ? `<div class="repost-label">🔁 min* reposted</div>` : ""}
      <strong>min* <span>@minkurosu · ${formatDate(data.timestamp)}${importedBadge}${xpBadges ? ` · <span class="xp-badges">${xpBadges}</span>` : ""}</span></strong>
      <p>${linkify(data.content || "")}</p>
      ${repostLink ? `<a class="repost-card" href="${escHtml(repostLink)}" target="_blank" rel="noopener">🔗 ${escHtml(shortLink(repostLink))}</a>` : ""}
      ${imgHtml}
      <div class="post-embeds">${buildEmbeds((data.content || "") + (repostLink ? "\n" + repostLink : ""))}</div>
    </div>
  `;

  if (isAdmin) {
    const menuBtn = document.createElement("button");
    menuBtn.className = "post-menu-btn";
    menuBtn.title = "options";
    menuBtn.setAttribute("aria-label", "post options");
    menuBtn.textContent = "⋯";

    const dropdown = document.createElement("div");
    dropdown.className = "post-dropdown";

    if (!isImported) {
      const editBtn = document.createElement("button");
      editBtn.className = "post-dropdown-btn";
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
        edit post
      `;
      editBtn.style.color = "#B3B3B3";
      editBtn.addEventListener("click", e => {
        e.stopPropagation();
        dropdown.classList.remove("open");
        enterEditMode(id, li, data.content || "");
      });
      dropdown.appendChild(editBtn);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "post-dropdown-btn";
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
      document.querySelectorAll(".post-dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });

    document.addEventListener("click", () => dropdown.classList.remove("open"));
    li.appendChild(menuBtn);
  }

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "post-actions";

  const likeBtn = document.createElement("span");
  likeBtn.className = "action-button";
  likeBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
               a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84
               a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;

  const storageKey = `liked_${id}`;
  if (localStorage.getItem(storageKey)) likeBtn.classList.add("liked");

  likeBtn.addEventListener("click", async () => {
    const alreadyLiked = likeBtn.classList.contains("liked");
    likeBtn.classList.toggle("liked");
    const delta = alreadyLiked ? -1 : 1;
    alreadyLiked
      ? localStorage.removeItem(storageKey)
      : localStorage.setItem(storageKey, "1");

    try {
      await updateDoc(doc(db, "posts", id), { likes: increment(delta) });
    } catch {
      likeBtn.classList.toggle("liked");
    }
  });

  actionsDiv.appendChild(likeBtn);
  li.querySelector(".info").appendChild(actionsDiv);

  return li;
}

injectComposeBox();
injectTabs();

const postContainer = document.getElementById("posts-container") || document.getElementById("tweets-container");
let cachedDocs = [];
let activeTab = "original";
let hashHandled = false;

function visibleDocs() {
  return cachedDocs.filter(({ data }) => (activeTab === "reposts") === isRepost(data));
}

function updateTabCounts() {
  const reposts = cachedDocs.filter(({ data }) => isRepost(data)).length;
  const a = document.getElementById("count-original");
  const b = document.getElementById("count-reposts");
  if (a) a.textContent = cachedDocs.length - reposts;
  if (b) b.textContent = reposts;
}

function renderList() {
  if (!postContainer) return;
  postContainer.innerHTML = "";
  updateTabCounts();
  const list = visibleDocs();
  if (list.length === 0) {
    postContainer.innerHTML = `
      <li style="justify-content:center;padding:20px;color:#667580;">
        ${activeTab === "reposts" ? "no reposts yet." : "no posts yet."}
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
  const wanted = isRepost(found.data) ? "reposts" : "original";
  if (wanted !== activeTab) setActiveTab(wanted);
  const el = document.getElementById("post-" + m[1]);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("post-highlight");
  }
}
window.addEventListener("hashchange", goToHash);

if (postContainer) {
  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));

  onSnapshot(q, snapshot => {
    cachedDocs = [];
    snapshot.forEach(docSnap => {
      cachedDocs.push({ id: docSnap.id, data: docSnap.data() });
    });
    renderList();

    if (!hashHandled && cachedDocs.length) {
      hashHandled = true;
      goToHash();
    }
  }, err => {
    console.error("error loading posts snapshot:", err);
    postContainer.innerHTML = `
      <li style="justify-content:center;padding:20px;color:#bf6a6a;">
        error loading posts.
      </li>`;
  });
}
