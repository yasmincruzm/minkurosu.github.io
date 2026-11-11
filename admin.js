import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect,
  getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut,
  setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit,
  onSnapshot, deleteDoc, doc, updateDoc, getDocs, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
  authDomain: "minkurosu.firebaseapp.com",
  projectId: "minkurosu",
  storageBucket: "minkurosu.firebasestorage.app",
  messagingSenderId: "290821725607",
  appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
  measurementId: "G-M7PWC6DDRH"
};

const ALLOWED_EMAILS = [
  'mincruzm@gmail.com',
  'yasmincruzm@hotmail.com'
];

function isAllowed(email) {
  return !!email && ALLOWED_EMAILS.includes(email);
}

const IMGBB_API_KEY = '94a7816a5bcd01a3e4a2943ed77faecd';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
if (!isMobile) {
  provider.setCustomParameters({ prompt: 'select_account' });
}

function msg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
}

const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function safeImg(u) {
  const s = String(u || '');
  return /^https?:\/\//i.test(s) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s) ? s : '';
}

const SETTINGS_KEY = 'crosspost_settings_v1';
const LIMITS       = { bluesky: 300, x: 280, mastodon: 500 };
const ALLOWED_USER = 'minkurosu';

const isAllowedBsky = handle =>
  String(handle || '').replace(/^@/, '').toLowerCase().split('.')[0] === ALLOWED_USER;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(s) {
  if (s.bskyHandle && !isAllowedBsky(s.bskyHandle)) {
    throw new Error(`bluesky handle must be @${ALLOWED_USER}...`);
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function isConfigured(network) {
  const s = loadSettings();
  if (network === 'bluesky')  return !!(s.bskyHandle && s.bskyPassword);
  if (network === 'mastodon') return !!(s.mastoInstance && s.mastoToken);
  if (network === 'x')        return true;
  return false;
}

function graphemeLength(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
  }
  return [...text].length;
}

function buildText({ content, repostUrl }) {
  const parts = [];
  if (content)   parts.push(content.trim());
  if (repostUrl) parts.push(repostUrl.trim());
  return parts.join('\n').trim();
}

function validateLengths(text, networks) {
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

async function fetchJson(url, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function firstRichLink(text) {
  for (const m of text.matchAll(/https?:\/\/[^\s<]+/g)) {
    const { core } = stripTrailingPunctuation(m[0]);
    if (isRichLink(core)) return core;
  }
  return null;
}

async function buildBskyCard(text) {
  const link = firstRichLink(text);
  if (!link) return null;

  const q = encodeURIComponent(link);
  const meta = (RE_EMBED.spotify.test(link) && await fetchJson(`https://open.spotify.com/oembed?url=${q}`))
    || await fetchJson(`https://noembed.com/embed?url=${q}`);

  const host = new URL(link).hostname.replace(/^www\./, '');
  const card = {
    uri: link,
    title: String(meta?.title || host).slice(0, 300),
    description: String(meta?.author_name || meta?.provider_name || '').slice(0, 300),
  };

  if (meta?.thumbnail_url) {
    try {
      const res = await fetch(meta.thumbnail_url);
      if (res.ok) {
        const blob = await shrinkImage(await res.blob());
        const up = await bskyRequest('com.atproto.repo.uploadBlob', {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'image/jpeg' },
          body: blob,
        });
        card.thumb = up.blob;
      }
    } catch (err) {
      console.warn('[crosspost] card thumbnail failed:', err);
    }
  }
  return { $type: 'app.bsky.embed.external', external: card };
}

async function postToBluesky({ text, file, imageUrl }) {
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

  if (!embed) {
    try { embed = await buildBskyCard(finalText); }
    catch (err) { console.warn('[crosspost] link card failed for bluesky:', err); }
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

function normalizeMastoInstance(raw) {
  let v = String(raw || '').trim().replace(/^https?:\/\//i, '');
  v = v.split(/[\/?#]/)[0];
  if (v.includes('@')) v = v.split('@').pop();
  return v.replace(/\.+$/, '').toLowerCase();
}

function mastoBase() {
  const s = loadSettings();
  if (!s.mastoInstance || !s.mastoToken) throw new Error('mastodon credentials not configured');
  const host = normalizeMastoInstance(s.mastoInstance);
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/.test(host)) {
    throw new Error('invalid mastodon instance, use only the domain (e.g. mastodon.social)');
  }
  const scheme = /^http:\/\//i.test(s.mastoInstance.trim()) ? 'http' : 'https';
  return { base: `${scheme}://${host}`, token: s.mastoToken.trim() };
}

async function refreshMastodonLimit() {
  try {
    const { base } = mastoBase();
    const res = await fetch(`${base}/api/v2/instance`);
    if (!res.ok) return;
    const j = await res.json();
    const max = j?.configuration?.statuses?.max_characters;
    if (max) saveSettings({ ...loadSettings(), mastoMax: max });
  } catch { }
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

async function postToMastodon({ text, file, imageUrl }) {
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

function openXWindow() {
  const w = window.open('about:blank', '_blank');
  return w || null;
}

function fillXWindow(win, { text, imageUrl }) {
  let t = text;
  if (imageUrl && !t.includes(imageUrl)) t += `\n${imageUrl}`;
  const url = `https://x.com/intent/post?text=${encodeURIComponent(t)}`;
  if (win && !win.closed) {
    win.location.href = url;
    return true;
  }
  return false;
}

async function crosspostAll({ networks, text, file, imageUrl }) {
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

const RE_EMBED = {
  image:      /\.(gif|png|jpe?g|webp|avif|svg)(\?\S*)?$/i,
  video:      /\.(mp4|webm|ogv|mov)(\?\S*)?$/i,
  audio:      /\.(mp3|wav|m4a|aac|flac|oga|ogg|opus)(\?\S*)?$/i,
  youtube:    /(?:youtube\.com\/watch\?(?:\S*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/,
  vimeo:      /vimeo\.com\/(?:video\/)?(\d{6,})/,
  spotify:    /open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/,
  soundcloud: /soundcloud\.com\/[\w-]+\/(?:sets\/)?[\w-]+/,
  apple:      /music\.apple\.com\/[a-z]{2}\/(album|playlist|song)\/[^\s?#]+/i,
};

function stripTrailingPunctuation(url) {
  const trailChars = /[).,;:!?'"\\]}]$/;
  let core = url, trail = '';
  while (trailChars.test(core)) {
    const last = core.slice(-1);
    if (last === ')') {
      const opens  = (core.match(/\(/g) || []).length;
      const closes = (core.match(/\)/g) || []).length;
      if (closes <= opens) break;
    }
    trail = last + trail;
    core  = core.slice(0, -1);
  }
  return { core, trail };
}

function isEmbeddable(url) {
  return Object.values(RE_EMBED).some(re => re.test(url));
}

function isRichLink(url) {
  return ['youtube', 'vimeo', 'spotify', 'soundcloud', 'apple'].some(k => RE_EMBED[k].test(url));
}

function buildEmbedHtml(url) {
  const u = esc(url);
  const media = 'max-width:100%;border-radius:10px;margin-top:10px;display:block;';
  const box   = 'margin-top:10px;border-radius:12px;overflow:hidden;';
  const ratio = (src, title) => `<div style="margin-top:10px;border-radius:10px;overflow:hidden;position:relative;padding-top:56.25%;">
      <iframe src="${src}" title="${title}"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  const player = (src, height, allow) => `<div style="${box}">
      <iframe src="${src}" width="100%" height="${height}" frameborder="0"
        allow="${allow}" loading="lazy"></iframe>
    </div>`;

  if (RE_EMBED.image.test(url)) return `<img src="${u}" alt="" loading="lazy" style="${media}">`;
  if (RE_EMBED.video.test(url)) return `<video src="${u}" controls preload="metadata" style="${media}"></video>`;
  if (RE_EMBED.audio.test(url)) return `<audio src="${u}" controls preload="none" style="width:100%;margin-top:10px;display:block;"></audio>`;

  let m = url.match(RE_EMBED.youtube);
  if (m) return ratio(`https://www.youtube.com/embed/${m[1]}`, 'youtube video');

  m = url.match(RE_EMBED.vimeo);
  if (m) return ratio(`https://player.vimeo.com/video/${m[1]}`, 'vimeo video');

  m = url.match(RE_EMBED.spotify);
  if (m) {
    const height = (m[1] === 'track' || m[1] === 'episode') ? 152 : 352;
    return player(`https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`, height,
      'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
  }

  if (RE_EMBED.soundcloud.test(url)) {
    const height = /\/sets\//.test(url) ? 300 : 166;
    const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23813d3d&auto_play=false&hide_related=true&show_comments=false`;
    return player(esc(src), height, 'autoplay');
  }

  m = url.match(RE_EMBED.apple);
  if (m) {
    const height = m[1] === 'song' ? 175 : 450;
    return player(esc(url.replace('://music.apple.com', '://embed.music.apple.com')), height,
      'autoplay *; encrypted-media *; fullscreen *; clipboard-write');
  }
  return '';
}

function buildEmbeds(text) {
  const seen = new Set();
  let html = '';
  for (const m of text.matchAll(/(https?:\/\/[^\s<]+)/g)) {
    const { core } = stripTrailingPunctuation(m[1]);
    if (seen.has(core)) continue;
    seen.add(core);
    html += buildEmbedHtml(core);
  }
  return html;
}

function linkify(text) {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, raw => {
      const { core, trail } = stripTrailingPunctuation(raw);
      if (isEmbeddable(core)) return trail;
      return `<a href="${core}" target="_blank" rel="noopener" style="color:#3BB9E3;">${core}</a>${trail}`;
    })
    .replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, '$1<span style="color:#3BB9E3;">#$2</span>');
}

function renderContent(text) {
  if (!text) return '';
  return `<p style="white-space:pre-wrap;word-wrap:break-word;">${linkify(text)}</p>${buildEmbeds(text)}`;
}

let myIp = null;

async function getMyIp() {
  try {
    const res  = await fetch('https://ip-api.com/json/?fields=query');
    const data = await res.json();
    myIp = data.query || null;
  } catch { myIp = null; }
}

function countryFlag(cc) {
  if (!cc || cc.length !== 2) return '🌐';
  return [...cc.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

function fmtTime(seconds) {
  if (seconds == null || seconds < 0) return null;
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(date) {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('pt-BR');
}

function scrollBar(pct) {
  if (pct == null) return '—';
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
}

function deviceIcon(d) {
  if (d === 'Mobile') return '📱';
  if (d === 'Tablet') return '💻';
  return '🖥️';
}

function browserIcon(b) {
  return ({ Chrome: '🟡', Firefox: '🟠', Safari: '🔵', Edge: '🟢', Opera: '🔴' })[b] || '🌐';
}

function ipAvatar(ip) {
  if (!ip || ip === 'unknown') return '??';
  const parts = ip.split('.');
  if (parts.length >= 2) return parts[0].slice(-1) + parts[1].slice(-1);
  return ip.slice(0, 2);
}

function ipColor(ip) {
  if (!ip) return '#534F4A';
  let hash = 0;
  for (const c of ip) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 30%, 35%)`;
}

function renderCard(d, exit, isMe) {
  const flag     = countryFlag(d.cc || '');
  const ts       = d.timestamp?.toDate();
  const ago      = timeAgo(ts);
  const location = [d.city, d.region, d.country]
    .filter(v => v && v !== 'unknown' && v !== '')
    .join(', ') || 'unknown location';

  const isNew    = d.isNewVisitor || d.visitCount === 1;
  const visitLabel = isNew
    ? `<span class="vc-badge vc-badge-new">new visitor</span>`
    : `<span class="vc-badge vc-badge-return">visit #${esc(d.visitCount)}</span>`;

  const firstVisitLine = d.firstVisit && !isNew
    ? `<div class="vc-row"><span class="vc-key">first visit</span><span class="vc-val">${new Date(d.firstVisit).toLocaleDateString('pt-BR')}</span></div>`
    : '';

  const referrerDisplay = !d.referrer || d.referrer === 'direct'
    ? 'direct'
    : d.referrer.length > 35 ? d.referrer.slice(0, 35) + '…' : d.referrer;

  const activeTimeStr = exit?.activeTime != null ? fmtTime(exit.activeTime) : null;
  const clickStr      = exit?.clickCount  != null ? `${exit.clickCount} clicks` : null;
  const scrollStr     = (exit?.maxScroll ?? d.maxScroll) != null ? scrollBar(exit?.maxScroll ?? d.maxScroll) : null;

  const avatar    = ipAvatar(d.ip);
  const avatarBg  = isMe ? '#3a3330' : ipColor(d.ip);
  const meBadge   = isMe ? `<span class="vc-me">👑 me</span>` : '';

  const pagesVisited = (d.pagesVisited && d.pagesVisited.length ? d.pagesVisited : [d.page]).filter(Boolean);
  const pagesHtml = pagesVisited.length > 1
    ? `<div class="vc-row" style="align-items:flex-start;">
           <span class="vc-key">pages (${pagesVisited.length})</span>
           <span class="vc-val">${pagesVisited.map(p => `<span class="vc-page-tag">${esc(p)}</span>`).join('')}</span>
       </div>`
    : `<div class="vc-row"><span class="vc-key">page</span><span class="vc-val">${esc(d.page || '—')}</span></div>`;

  return `
  <div class="vc-card${isMe ? ' vc-card-me' : ''}" data-ip="${esc(d.ip)}">
      <div class="vc-header">
          <div class="vc-avatar" style="background:${avatarBg}">${esc(avatar)}</div>
          <div class="vc-header-info">
              <span class="vc-location">${flag} ${esc(location)}${meBadge}</span>
              <span class="vc-ago">${ago}</span>
          </div>
          ${visitLabel}
      </div>
      <div class="vc-body">
          <div class="vc-row"><span class="vc-key">device</span><span class="vc-val">${deviceIcon(d.device)} ${esc(d.device)} · ${browserIcon(d.browser)} ${esc(d.browser)} · ${esc(d.os)}</span></div>
          ${pagesHtml}
          <div class="vc-row"><span class="vc-key">referrer</span><span class="vc-val">${esc(referrerDisplay)}</span></div>
          <div class="vc-row"><span class="vc-key">language</span><span class="vc-val">${esc(d.lang || '—')}</span></div>
          ${firstVisitLine}
          <div class="vc-divider"></div>
          <div class="vc-row"><span class="vc-key">scroll</span><span class="vc-val vc-mono">${esc(scrollStr || '—')}</span></div>
          ${activeTimeStr ? `<div class="vc-row"><span class="vc-key">active time</span><span class="vc-val">${esc(activeTimeStr)}</span></div>` : ''}
          ${clickStr      ? `<div class="vc-row"><span class="vc-key">clicks</span><span class="vc-val">${esc(clickStr)}</span></div>` : ''}
      </div>
  </div>`;
}

function renderAnalytics(byIp) {
  const section = document.getElementById('analytics-section');
  if (!section) return;

  const all = Object.values(byIp);
  const total   = all.length;
  const newV    = all.filter(d => d.isNewVisitor || d.visitCount === 1).length;
  const returnV = total - newV;

  const pages = {}, countries = {}, devices = {}, browsers = {}, refs = {};
  all.forEach(d => {
    const pgs = (d.pagesVisited && d.pagesVisited.length ? d.pagesVisited : [d.page]).filter(Boolean);
    pgs.forEach(p => { pages[p] = (pages[p] || 0) + 1; });

    if (d.country && d.country !== 'unknown') countries[d.country] = (countries[d.country] || 0) + 1;
    if (d.device)  devices[d.device]   = (devices[d.device]   || 0) + 1;
    if (d.browser) browsers[d.browser] = (browsers[d.browser] || 0) + 1;
    const r = (!d.referrer || d.referrer === 'direct') ? 'direct' : d.referrer;
    refs[r] = (refs[r] || 0) + 1;
  });

  const top = (obj, n = 5) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  const bar = (v, max) => {
    const pct = max ? Math.round((v / max) * 100) : 0;
    return `<span class="an-bar" style="--pct:${pct}%"></span>`;
  };
  const tbl = (title, rows) => {
    if (!rows.length) return '';
    const max = rows[0][1];
    return `<div class="an-block"><span class="an-label">${title}</span>${
      rows.map(([k, v]) => `<div class="an-row"><span class="an-key">${esc(k)}</span>${bar(v, max)}<span class="an-val">${v}</span></div>`).join('')
    }</div>`;
  };

  section.innerHTML = `
  <div class="an-stats">
      <div class="an-stat"><span class="an-n">${total}</span><span class="an-l">unique visitors</span></div>
      <div class="an-stat"><span class="an-n">${newV}</span><span class="an-l">new</span></div>
      <div class="an-stat"><span class="an-n">${returnV}</span><span class="an-l">returning</span></div>
  </div>
  <div class="an-grid">
      ${tbl('pages', top(pages))}
      ${tbl('countries', top(countries))}
      ${tbl('devices', top(devices))}
      ${tbl('browsers', top(browsers))}
      ${tbl('referrers', top(refs))}
  </div>`;
}

async function loadVisitorTracker(appInstance) {
  await getMyIp();

  const firestoreDb = getFirestore(appInstance);
  const container   = document.getElementById('visitor-tracker');
  if (!container) return;

  const q     = query(collection(firestoreDb, 'visitors'),      orderBy('timestamp', 'desc'), limit(500));
  const qExit = query(collection(firestoreDb, 'visitors_exit'), orderBy('timestamp', 'desc'), limit(400));

  const exitMap = {};
  onSnapshot(qExit, snap => {
    snap.docs.forEach(docSnap => {
      const d = docSnap.data();
      const key = (d.sessionId || '') + (d.page || '');
      if (key && !exitMap[key]) exitMap[key] = d;
    });
  }, err => {
    console.warn('[tracker] visitors_exit error:', err.code, err.message);
  });

  onSnapshot(q, snapshot => {
    if (snapshot.empty) {
      container.innerHTML = `<p class="tracker-empty">no visitors yet.</p>`;
      return;
    }

    const byIp = {};
    snapshot.docs.forEach(docSnap => {
      const d = docSnap.data();
      const hasIp = d.ip && d.ip !== 'unknown';
      const key = d.sessionId ? `sid:${d.sessionId}` : (hasIp ? d.ip : `doc:${docSnap.id}`);

      if (!byIp[key]) {
        byIp[key] = { ...d, pagesVisited: d.page ? [d.page] : [] };
      } else if (d.page && !byIp[key].pagesVisited.includes(d.page)) {
        byIp[key].pagesVisited.push(d.page);
      }
    });

    renderAnalytics(byIp);

    const sorted = Object.values(byIp).sort((a, b) => {
      const ta = a.timestamp?.toDate?.()?.getTime() || (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : Date.now());
      const tb = b.timestamp?.toDate?.()?.getTime() || (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : Date.now());
      return tb - ta;
    });

    container.innerHTML = sorted.map(d => {
      const exit = exitMap[(d.sessionId || '') + (d.page || '')] || {};
      const isMe = (myIp && d.ip === myIp) || d.isAdmin === true;
      return renderCard(d, exit, isMe);
    }).join('');
  }, err => {
    console.error('[tracker] visitors error:', err.code, err.message);
    container.innerHTML = `<p class="tracker-empty" style="color:#bf6a6a;">error loading visits: ${err.code || err.message}<br><small>check firestore rules in firebase console</small></p>`;
  });
}

setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('[admin] setPersistence failed:', err);
});

getRedirectResult(auth)
  .then(cred => {
    if (!cred) return;
    if (!isAllowed(cred.user.email)) {
      signOut(auth);
      msg(document.getElementById('login-message'), 'access denied.', 'error');
      return;
    }
    localStorage.setItem('min_admin', '1');
    localStorage.setItem('mku_admin', '1');
    msg(document.getElementById('login-message'), 'logged in!', 'success');
  })
  .catch(err => {
    console.error('[admin] redirect login error:', err);
    msg(document.getElementById('login-message'), `login error: ${err.code || err.message}`, 'error');
  });

async function uploadImageToImgBB(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const form = new FormData();
  form.append('key', IMGBB_API_KEY);
  form.append('image', base64);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form
  });

  if (!res.ok) throw new Error(`imgbb responded ${res.status}`);

  const json = await res.json();
  if (!json.success || !json.data?.url) {
    throw new Error(json.error?.message || 'imgbb upload failed');
  }

  return json.data.url;
}

const XP_NETS = ['bluesky', 'mastodon', 'x'];

function selectedNetworks(prefix) {
  const ids = {
    bluesky:  `${prefix}-crosspost-bsky`,
    mastodon: `${prefix}-crosspost-mastodon`,
    x:        `${prefix}-crosspost-x`
  };
  return XP_NETS.filter(n => document.getElementById(ids[n])?.checked);
}

function checkCrosspost(networks, text) {
  const problems = validateLengths(text, networks);
  if (problems.length) return `text too long — ${problems.join(' · ')}. shorten or uncheck network.`;
  const missing = networks.filter(n => !isConfigured(n));
  if (missing.length) return `configure as contas ("contas do crosspost") ou desligue: ${missing.join(', ')}`;
  return '';
}

async function runCrosspost({ networks, text, file, imageUrl, xWin, refs }) {
  const results = {};
  const apiNets = networks.filter(n => n !== 'x');
  if (apiNets.length) {
    Object.assign(results, await crosspostAll({ networks: apiNets, text, file, imageUrl }));
  }
  if (networks.includes('x')) {
    results.x = fillXWindow(xWin, { text, imageUrl })
      ? { ok: true }
      : { ok: false, error: 'popup blocked — allow popups for this site' };
  }

  const upd = {};
  for (const [n, r] of Object.entries(results)) {
    if (r.ok && r.url) upd[`crossposted.${n}`] = { url: r.url };
  }
  if (Object.keys(upd).length) {
    for (const ref of refs) {
      try { await updateDoc(ref, upd); }
      catch (e) { console.warn('[admin] could not save crosspost links:', e); }
    }
  }
  return results;
}

function showCrosspostResult(el, base, results) {
  const parts = Object.entries(results).map(([n, r]) => r.ok ? `✓ ${n}` : `✗ ${n}: ${r.error}`);
  const failed = Object.values(results).some(r => !r.ok);
  msg(el, parts.length ? `${base} ${parts.join(' · ')}` : base, failed ? 'error' : 'success');
}

let previewObjectUrl = null;

function updatePreview() {
  const box = document.getElementById('post-preview');
  if (!box) return;
  const content = (document.getElementById('post-content')?.value || '').trim();
  const imgUrl  = (document.getElementById('post-image-url')?.value || '').trim();
  const file    = document.getElementById('post-image-file')?.files?.[0];
  const imgStyle = 'max-width:100%;border-radius:10px;margin-top:10px;display:block;';

  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

  let html = renderContent(content);
  if (/^https?:\/\//i.test(imgUrl)) {
    html += isEmbeddable(imgUrl)
      ? buildEmbeds(imgUrl)
      : `<img src="${esc(imgUrl)}" alt="" style="${imgStyle}" onerror="this.remove()">`;
  }
  if (file) {
    previewObjectUrl = URL.createObjectURL(file);
    html += `<img src="${previewObjectUrl}" alt="" style="${imgStyle}">`;
  }
  box.innerHTML = html || '<p class="tracker-empty">a prévia com os embeds aparece aqui</p>';
}

function resetCrosspostChecks() {
  ['post-crosspost-mastodon', 'post-crosspost-bsky', 'post-crosspost-x', 'post-crosspost-rss']
    .forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = true; });
}

function resetPostForm() {
  ['post-content', 'post-image-url', 'post-image-file']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  resetCrosspostChecks();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm      = document.getElementById('login-form');
  const loginEmailForm = document.getElementById('login-email-form');
  const loginEmail     = document.getElementById('login-email');
  const loginPassword  = document.getElementById('login-password');
  const loginMessage   = document.getElementById('login-message');
  const adminPanel     = document.getElementById('admin-panel-section');
  const logoutBtn      = document.getElementById('logout-btn');
  const googleLoginBtn = document.getElementById('google-login-btn');

  let ltfLoaded = false;

  onAuthStateChanged(auth, user => {
    if (!adminPanel || !loginForm) return;

    if (user) {
      if (!isAllowed(user.email)) {
        signOut(auth);
        msg(loginMessage, 'access denied.', 'error');
        return;
      }

      adminPanel.style.display = 'block';
      loginForm.style.display  = 'none';

      if (!ltfLoaded) {
        ltfLoaded = true;
        loadLiveTrafficFeed();
      }

      loadVisitorTracker(app);
      loadMailbox(db);
    } else {
      ltfLoaded = false;
      adminPanel.style.display = 'none';
      loginForm.style.display  = 'block';
    }
  });

  loginEmailForm?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
      if (!isAllowed(cred.user.email)) {
        await signOut(auth);
        msg(loginMessage, 'access denied.', 'error');
        return;
      }
      localStorage.setItem('min_admin', '1');
      localStorage.setItem('mku_admin', '1');
      msg(loginMessage, 'logged in!', 'success');
    } catch (err) {
      msg(loginMessage, `error: ${err.message}`, 'error');
    }
  });

  googleLoginBtn?.addEventListener('click', async () => {
    msg(loginMessage, 'opening google login...', 'info');

    if (isMobile) {
      try {
        await signInWithRedirect(auth, provider);
      } catch (err) {
        console.error('[admin] redirect login error:', err);
        msg(loginMessage, `error: ${err.code || err.message}`, 'error');
      }
      return;
    }

    try {
      const cred = await signInWithPopup(auth, provider);
      if (!isAllowed(cred.user.email)) {
        await signOut(auth);
        msg(loginMessage, 'access denied. use an authorized account.', 'error');
        return;
      }
      localStorage.setItem('min_admin', '1');
      localStorage.setItem('mku_admin', '1');
      msg(loginMessage, 'logged in!', 'success');
    } catch (err) {
      console.error('[admin] popup login error:', err.code, err.message);

      const popupIssues = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment'
      ];

      if (popupIssues.includes(err.code)) {
        msg(loginMessage, 'popup blocked, redirecting...', 'info');
        try {
          await signInWithRedirect(auth, provider);
        } catch (err2) {
          msg(loginMessage, `error: ${err2.code || err2.message}`, 'error');
        }
        return;
      }

      if (err.code === 'auth/unauthorized-domain') {
        msg(loginMessage, 'domain not authorized in firebase (authentication > settings > authorized domains).', 'error');
        return;
      }

      msg(loginMessage, `error: ${err.code || err.message}`, 'error');
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('min_admin');
      localStorage.removeItem('mku_admin');
      msg(loginMessage, 'logged out.', 'info');
    } catch (err) {
      msg(loginMessage, `logout error: ${err.message}`, 'error');
    }
  });

  const bskyPass      = document.getElementById('bsky-app-password');
  const bskyCredMsg   = document.getElementById('bsky-cred-message');
  const mastoInstance = document.getElementById('masto-instance');
  const mastoToken    = document.getElementById('masto-token');
  const mastoCredMsg  = document.getElementById('masto-cred-message');

  const xpSaved = loadSettings();
  if (bskyPass)      bskyPass.value      = xpSaved.bskyPassword  || '';
  if (mastoInstance) mastoInstance.value = normalizeMastoInstance(xpSaved.mastoInstance);
  if (mastoToken)    mastoToken.value    = xpSaved.mastoToken    || '';

  localStorage.removeItem('crosspost_prefs_v1');
  resetCrosspostChecks();

  document.getElementById('save-bsky-btn')?.addEventListener('click', () => {
    try {
      saveSettings({ ...loadSettings(), bskyHandle: 'minkurosu.bsky.social', bskyPassword: (bskyPass?.value || '').trim() });
      msg(bskyCredMsg, '✓ saved in this browser. account verified at post time (only @minkurosu).', 'success');
    } catch (err) {
      msg(bskyCredMsg, `error: ${err.message}`, 'error');
    }
  });

  document.getElementById('save-masto-btn')?.addEventListener('click', () => {
    try {
      const host = normalizeMastoInstance(mastoInstance?.value);
      if (mastoInstance) mastoInstance.value = host;
      saveSettings({
        ...loadSettings(),
        mastoInstance: host,
        mastoToken: (mastoToken?.value || '').trim()
      });
      msg(mastoCredMsg, '✓ saved in this browser. token must belong to @minkurosu (verified at post time).', 'success');
      refreshMastodonLimit();
    } catch (err) {
      msg(mastoCredMsg, `error: ${err.message}`, 'error');
    }
  });

  const postContent   = document.getElementById('post-content');
  const postImageUrl  = document.getElementById('post-image-url');
  const postImageFile = document.getElementById('post-image-file');
  const publishBtn    = document.getElementById('publish-post-btn');
  const postMsg       = document.getElementById('post-message');

  [postContent, postImageUrl, postImageFile].forEach(el => {
    el?.addEventListener('input', updatePreview);
    el?.addEventListener('change', updatePreview);
  });

  publishBtn?.addEventListener('click', async () => {
    let content = (postContent?.value || '').trim();
    const enteredUrl = (postImageUrl?.value || '').trim();
    const file = postImageFile?.files[0];

    if (!content && !enteredUrl && !file) {
      msg(postMsg, 'write something first.', 'error');
      return;
    }

    const networks = selectedNetworks('post');
    const xpError = checkCrosspost(networks, content);
    if (xpError) {
      msg(postMsg, xpError, 'error');
      if (networks.some(n => !isConfigured(n))) document.getElementById('xp-accounts')?.setAttribute('open', '');
      return;
    }
    const inRss = !!document.getElementById('post-crosspost-rss')?.checked;
    const xWin = networks.includes('x') ? openXWindow() : null;

    try {
      msg(postMsg, 'publishing...', 'info');

      let fileUrl = '';
      if (file) {
        msg(postMsg, 'uploading image...', 'info');
        fileUrl = await uploadImageToImgBB(file);
      }

      const parts = [];
      if (content)    parts.push(content);
      if (enteredUrl) parts.push(enteredUrl);
      if (fileUrl)    parts.push(fileUrl);
      const finalContent = parts.join('\n');

      const postRef = await addDoc(collection(db, 'posts'), {
        content: finalContent,
        imageUrl: fileUrl || enteredUrl || '',
        type: 'personal',
        profile: 'personal',
        rss: inRss,
        timestamp: serverTimestamp()
      });

      resetPostForm();

      if (networks.length) {
        msg(postMsg, 'published on site! sending to other networks...', 'info');
        const results = await runCrosspost({
          networks, text: content, file, imageUrl: fileUrl || enteredUrl, xWin, refs: [postRef]
        });
        showCrosspostResult(postMsg, 'personal post published!', results);
      } else {
        msg(postMsg, 'personal post published!', 'success');
      }
    } catch (err) {
      console.error(err);
      if (xWin && !xWin.closed) xWin.close();
      msg(postMsg, `error: ${err.message}`, 'error');
    }
  });

  const dreamContent = document.getElementById('dream-content');
  const publishDream = document.getElementById('publish-dream-btn');
  const dreamMsg     = document.getElementById('dream-message');

  publishDream?.addEventListener('click', async () => {
    const content = (dreamContent?.value || '').trim();
    if (!content) { msg(dreamMsg, 'write something first.', 'error'); return; }
    try {
      msg(dreamMsg, 'saving...', 'info');
      await addDoc(collection(db, 'dreams'), { content, timestamp: serverTimestamp() });
      msg(dreamMsg, 'dream saved!', 'success');
      if (dreamContent) dreamContent.value = '';
    } catch (err) {
      msg(dreamMsg, `error: ${err.message}`, 'error');
    }
  });
});

function loadMailbox(firestoreDb) {
  const container = document.getElementById('mailbox-list');
  if (!container) return;

  const q = query(collection(firestoreDb, 'mailbox'), orderBy('timestamp', 'desc'));

  onSnapshot(q, snapshot => {
    if (snapshot.empty) {
      container.innerHTML = `<p class="tracker-empty">no messages yet.</p>`;
      return;
    }

    container.innerHTML = snapshot.docs.map(docSnap => {
      const d  = docSnap.data();
      const id = docSnap.id;
      const ts = d.timestamp?.toDate();
      const ago = ts
        ? ts.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

      return `
      <div class="mb-card" data-id="${esc(id)}">
          <div class="mb-msg">${esc(d.message || '')}</div>
          <div class="mb-meta">
              <span class="mb-ip">🌐 ${esc(d.ip || 'unknown')}</span>
              <span>${ago}</span>
          </div>
          <button class="mb-delete" data-id="${esc(id)}">delete</button>
      </div>`;
    }).join('');

    container.querySelectorAll('.mb-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('delete this message?')) return;
        try {
          await deleteDoc(doc(firestoreDb, 'mailbox', btn.dataset.id));
        } catch (err) {
          alert('delete error: ' + err.message);
        }
      });
    });
  }, err => {
    console.warn('loadMailbox:', err);
    container.innerHTML = `<p class="tracker-empty">error loading messages.</p>`;
  });
}

function loadLiveTrafficFeed() {
  const container = document.getElementById('ltf-widget-container');
  if (!container) return;

  container.innerHTML = '';

  const widgetUrl = 'https://cdn.livetrafficfeed.com/static/v5/live.js?bc=2d2d2d&tc=d5d5d5&brd1=813d3d&lnk=813d3d&hc=d5d5d5&hfc=2d2d2d&nc=813d3d&vv=409&tft=10&ro=0&tz=America%2FSao_Paulo&res=1&l=https%3A%2F%2Fminkurosu.site%2F';

  const frame = document.createElement('iframe');
  frame.title = 'live traffic feed - minkurosu.site';
  frame.style.cssText = 'display:block;width:100%;max-width:640px;height:420px;border:0;background:transparent;';
  frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;}</style></head><body>'
    + '<script type="text/javascript" src="https://livetrafficfeed.com/static/v5/livetrafficfeed.js"><\/script>'
    + '<script type="text/javascript" src="' + widgetUrl + '"><\/script>'
    + '</body></html>';

  frame.addEventListener('load', () => {
    let frameDoc;
    try { frameDoc = frame.contentDocument; } catch { return; }
    if (!frameDoc || !frameDoc.body) return;

    const fit = () => {
      const h = frameDoc.body.scrollHeight;
      if (h > 40) frame.style.height = h + 'px';
    };

    fit();
    setTimeout(fit, 1200);
    setTimeout(fit, 3500);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(frameDoc.body);
  });

  container.appendChild(frame);
}