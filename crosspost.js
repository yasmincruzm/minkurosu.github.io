const SETTINGS_KEY = 'crosspost_settings_v1';
const PREFS_KEY    = 'crosspost_prefs_v1';

export const LIMITS = { bluesky: 300, x: 280, mastodon: 500 };

export const ALLOWED_USER = 'minkurosu';

const isAllowedBsky = handle =>
  String(handle || '').replace(/^@/, '').toLowerCase().split('.')[0] === ALLOWED_USER;

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  if (s.bskyHandle && !isAllowedBsky(s.bskyHandle)) {
    throw new Error(`bluesky handle must be @${ALLOWED_USER}...`);
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

export function savePrefs(p) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export function isConfigured(network) {
  const s = loadSettings();
  if (network === 'bluesky')  return !!(s.bskyHandle && s.bskyPassword);
  if (network === 'mastodon') return !!(s.mastoInstance && s.mastoToken);
  if (network === 'x')        return true;
  return false;
}

export function graphemeLength(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
  }
  return [...text].length;
}

export function buildText({ content, repostUrl }) {
  const parts = [];
  if (content)   parts.push(content.trim());
  if (repostUrl) parts.push(repostUrl.trim());
  return parts.join('\n').trim();
}

export function validateLengths(text, networks) {
  const problems = [];
  const len = graphemeLength(text);
  for (const n of networks) {
    const max = n === 'mastodon' ? (loadSettings().mastoMax || LIMITS.mastodon) : LIMITS[n];
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
    return blob.type.startsWith('image/') ? blob : null;
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
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (out && out.size <= maxBytes) return out;
    quality = Math.max(0.5, quality - 0.1);
    scale *= 0.85;
  }
  throw new Error('image too large for bluesky');
}

const BSKY = 'https://bsky.social/xrpc';
let bskySession = null;

async function bskyLogin(force = false) {
  const s = loadSettings();
  if (!s.bskyHandle || !s.bskyPassword) throw new Error('bluesky credentials not configured');
  if (bskySession && !force) return bskySession;

  const res = await fetch(`${BSKY}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: s.bskyHandle.replace(/^@/, '').trim(),
      password: s.bskyPassword.trim(),
    }),
  });
  if (!res.ok) throw new Error(`bluesky login: ${await readError(res)}`);
  const sess = await res.json();
  if (!isAllowedBsky(sess.handle)) {
    throw new Error(`blocked: account is @${sess.handle}, only @${ALLOWED_USER} allowed`);
  }
  bskySession = sess;
  return bskySession;
}

function buildFacets(text) {
  const enc = new TextEncoder();
  const facets = [];
  const byteIndex = charIdx => enc.encode(text.slice(0, charIdx)).length;

  for (const m of text.matchAll(/https?:\/\/[^\s<]+/g)) {
    let url = m[0].replace(/[).,;:!?'"\\]}]+$/, '');
    const start = m.index;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + url.length) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
    });
  }

  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const tag = m[2];
    if (/^\d+$/.test(tag)) continue;
    const start = m.index + m[1].length;
    const end = start + tag.length + 1;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(end) },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
    });
  }
  return facets;
}

async function bskyRequest(path, init, retry = true) {
  const sess = await bskyLogin();
  const res = await fetch(`${BSKY}/${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${sess.accessJwt}` },
  });
  if (res.status === 401 && retry) {
    await bskyLogin(true);
    return bskyRequest(path, init, false);
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function postToBluesky({ text, file, imageUrl }) {
  const sess = await bskyLogin();
  let finalText = text;
  let embed;

  const raw = await resolveImageBlob({ file, imageUrl });
  if (raw) {
    try {
      const blob = await shrinkImage(raw);
      const up = await bskyRequest('com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      });
      embed = {
        $type: 'app.bsky.embed.images',
        images: [{ alt: '', image: up.blob }],
      };
    } catch (err) {
      console.warn('[crosspost] image failed for bluesky:', err);
      if (imageUrl && !finalText.includes(imageUrl)) finalText += `\n${imageUrl}`;
    }
  } else if (imageUrl && !finalText.includes(imageUrl)) {
    finalText += `\n${imageUrl}`;
  }

  const record = {
    $type: 'app.bsky.feed.post',
    text: finalText,
    createdAt: new Date().toISOString(),
  };
  const facets = buildFacets(finalText);
  if (facets.length) record.facets = facets;
  if (embed) record.embed = embed;

  const out = await bskyRequest('com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: sess.did, collection: 'app.bsky.feed.post', record }),
  });

  const rkey = out.uri.split('/').pop();
  return { uri: out.uri, url: `https://bsky.app/profile/${sess.handle}/post/${rkey}` };
}

function mastoBase() {
  const s = loadSettings();
  if (!s.mastoInstance || !s.mastoToken) throw new Error('mastodon credentials not configured');
  let base = s.mastoInstance.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;
  return { base, token: s.mastoToken.trim() };
}

export async function refreshMastodonLimit() {
  try {
    const { base } = mastoBase();
    const res = await fetch(`${base}/api/v2/instance`);
    if (!res.ok) return;
    const j = await res.json();
    const max = j?.configuration?.statuses?.max_characters;
    if (max) saveSettings({ ...loadSettings(), mastoMax: max });
  } catch { /* keep default 500 */ }
}

async function mastoUploadMedia(base, token, blob) {
  const form = new FormData();
  form.append('file', blob, blob.name || 'image');
  const res = await fetch(`${base}/api/v2/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`media upload: ${await readError(res)}`);
  const media = await res.json();

  if (res.status === 202) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const check = await fetch(`${base}/api/v1/media/${media.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (check.status === 200) break;
    }
  }
  return media.id;
}

const mastoVerified = new Set();

async function assertMastodonIsMine(base, token) {
  const key = `${base}|${token}`;
  if (mastoVerified.has(key)) return;
  const res = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('could not verify account: add read:accounts permission to the token');
  }
  if (!res.ok) throw new Error(`mastodon account check: ${await readError(res)}`);
  const me = await res.json();
  if (String(me.username || '').toLowerCase() !== ALLOWED_USER) {
    throw new Error(`blocked: token belongs to @${me.username}, only @${ALLOWED_USER} allowed`);
  }
  mastoVerified.add(key);
}

export async function postToMastodon({ text, file, imageUrl }) {
  const { base, token } = mastoBase();
  await assertMastodonIsMine(base, token);
  let finalText = text;
  const mediaIds = [];

  const blob = await resolveImageBlob({ file, imageUrl });
  if (blob) {
    try {
      mediaIds.push(await mastoUploadMedia(base, token, blob));
    } catch (err) {
      console.warn('[crosspost] image failed for mastodon:', err);
      if (imageUrl && !finalText.includes(imageUrl)) finalText += `\n${imageUrl}`;
    }
  } else if (imageUrl && !finalText.includes(imageUrl)) {
    finalText += `\n${imageUrl}`;
  }

  const body = { status: finalText, visibility: loadSettings().mastoVisibility || 'public' };
  if (mediaIds.length) body.media_ids = mediaIds;

  const res = await fetch(`${base}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  const j = await res.json();
  return { url: j.url, id: j.id };
}

export function openXWindow() {
  const w = window.open('about:blank', '_blank');
  return w || null;
}

export function fillXWindow(win, { text, imageUrl }) {
  let t = text;
  if (imageUrl && !t.includes(imageUrl)) t += `\n${imageUrl}`;
  const url = `https://x.com/intent/post?text=${encodeURIComponent(t)}`;
  if (win && !win.closed) {
    win.location.href = url;
    return true;
  }
  return false;
}

export async function crosspostAll({ networks, text, file, imageUrl }) {
  const tasks = [];
  if (networks.includes('bluesky'))  tasks.push(['bluesky',  postToBluesky({ text, file, imageUrl })]);
  if (networks.includes('mastodon')) tasks.push(['mastodon', postToMastodon({ text, file, imageUrl })]);

  const settled = await Promise.allSettled(tasks.map(t => t[1]));
  const results = {};
  settled.forEach((r, i) => {
    const name = tasks[i][0];
    results[name] = r.status === 'fulfilled'
      ? { ok: true, ...r.value }
      : { ok: false, error: r.reason?.message || String(r.reason) };
  });
  return results;
}
