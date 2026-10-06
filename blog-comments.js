import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, onSnapshot,
  serverTimestamp, updateDoc, doc, increment, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { mountReactions } from './reactions.js';

const firebaseConfig = {
  apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
  authDomain: "minkurosu.firebaseapp.com",
  projectId: "minkurosu",
  storageBucket: "minkurosu.firebasestorage.app",
  messagingSenderId: "290821725607",
  appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
  measurementId: "G-M7PWC6DDRH"
};

const ADMIN_EMAIL = 'mincruzm@gmail.com';

const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

let IS_ADMIN = false;
const adminListeners = new Set();

function onAdminChange(fn) {
  adminListeners.add(fn);
  fn(IS_ADMIN);
  return () => adminListeners.delete(fn);
}

function setAdmin(v) {
  if (IS_ADMIN === v) return;
  IS_ADMIN = v;
  document.body.classList.toggle('is-admin', v);
  adminListeners.forEach(fn => { try { fn(v); } catch {} });
}

onAuthStateChanged(auth, user => {
  setAdmin(!!user && user.email === ADMIN_EMAIL);
});

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nameColor(name) {
  let hash = 0;
  for (const c of String(name)) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return `hsl(${Math.abs(hash) % 360}, 30%, 30%)`;
}

function initial(name) {
  return String(name).trim().slice(0, 1).toUpperCase() || '?';
}

function timeAgo(date) {
  if (!date) return '—';
  const d = Math.floor((Date.now() - date.getTime()) / 1000);
  if (d < 60)    return `${d}s ago`;
  if (d < 3600)  return `${Math.floor(d / 60)}min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return date.toLocaleDateString('pt-BR');
}

function deviceIcon(d) {
  if (d === 'Mobile') return '📱';
  if (d === 'Tablet') return '💻';
  return '🖥️';
}
function browserIcon(b) {
  return ({ Chrome: '🟡', Firefox: '🟠', Safari: '🔵', Edge: '🟢', Opera: '🔴' })[b] || '🌐';
}

function renderMd(text) {
  let s = escHtml(text);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/__([^_]+)__/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return s;
}

let myInfo = null;
async function getMyInfo() {
  if (myInfo) return myInfo;

  const info = {
    ip: 'unknown', city: 'unknown', region: 'unknown',
    country: 'unknown', cc: '',
    device: 'Desktop', browser: 'Unknown', os: 'Unknown',
    lang: navigator.language || 'unknown'
  };

  const ua = navigator.userAgent;
  const match = (list, fallback) => (list.find(([re]) => re.test(ua)) || [, fallback])[1];
  info.device = match([[/Tablet|iPad/i, 'Tablet'], [/Mobi|Android/i, 'Mobile']], 'Desktop');
  info.browser = match([[/Firefox/i, 'Firefox'], [/Edg\//i, 'Edge'], [/OPR|Opera/i, 'Opera'], [/Chrome/i, 'Chrome'], [/Safari/i, 'Safari']], 'Unknown');
  info.os = match([[/Windows/i, 'Windows'], [/Mac OS X/i, 'MacOS'], [/Android/i, 'Android'], [/iPhone|iPad|iPod/i, 'iOS'], [/Linux/i, 'Linux']], 'Unknown');

  try {
    const r = await fetch('https://ip-api.com/json/?fields=query,city,regionName,country,countryCode');
    const d = await r.json();
    if (d && d.query) {
      info.ip      = d.query;
      info.city    = d.city       || 'unknown';
      info.region  = d.regionName || 'unknown';
      info.country = d.country    || 'unknown';
      info.cc      = d.countryCode || '';
    }
  } catch {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const d = await r.json();
      info.ip = d.ip || 'unknown';
    } catch {}
  }

  myInfo = info;
  return info;
}

const AVATAR_KEY = 'min_avatar';
const NAME_KEY   = 'min_name';
const SITE_KEY   = 'min_site';
const OWN_KEY    = 'min_own_comments';

function getSavedAvatar() { return localStorage.getItem(AVATAR_KEY) || ''; }
function saveAvatar(url)  { if (url) localStorage.setItem(AVATAR_KEY, url); else localStorage.removeItem(AVATAR_KEY); }

function getOwnIds() {
  try { return JSON.parse(localStorage.getItem(OWN_KEY) || '[]'); } catch { return []; }
}
function addOwnId(id) {
  const arr = getOwnIds();
  if (!arr.includes(id)) arr.push(id);
  localStorage.setItem(OWN_KEY, JSON.stringify(arr));
}
function isOwnId(id) { return getOwnIds().includes(id); }

function resizeImage(file, maxSize = 96, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mountComments(box, { postId }) {
  box.innerHTML = `
    <div class="min-cmt-widget">
      <div class="min-cmt-head">
        <span class="min-cmt-head-title">leave a comment</span>
        <span class="min-cmt-head-hint">anonymous</span>
      </div>

      <div class="min-cmt-row">
        <div class="min-cmt-field">
          <label class="min-cmt-label">name <span class="req">*</span></label>
          <input type="text" class="min-cmt-input min-cmt-name" maxlength="60">
        </div>
        <div class="min-cmt-field">
          <label class="min-cmt-label">site (optional)</label>
          <input type="text" class="min-cmt-input min-cmt-site" maxlength="200">
        </div>
      </div>

      <div class="min-cmt-avatar-line">
        <div class="min-cmt-avatar-preview min-cmt-avatar-el">?</div>
        <button type="button" class="min-cmt-avatar-btn">upload avatar</button>
        <input type="file" class="min-cmt-avatar-input" accept="image/*" hidden>
      </div>

      <label class="min-cmt-label">comment <span class="req">*</span></label>
      <div class="min-cmt-toolbar">
        <button type="button" class="min-cmt-tool" data-md="**"><b>B</b></button>
        <button type="button" class="min-cmt-tool" data-md="*"><em>I</em></button>
        <button type="button" class="min-cmt-tool" data-md="~~"><s>S</s></button>
        <button type="button" class="min-cmt-tool" data-md="__"><u>U</u></button>
        <button type="button" class="min-cmt-tool" data-md="link">🔗</button>
      </div>
      <textarea class="min-cmt-textarea min-cmt-message" maxlength="2000" placeholder="say something nice..."></textarea>

      <button type="button" class="min-cmt-submit">post comment</button>
      <div class="min-cmt-status"></div>
      <div class="min-cmt-powered">powered by <b>min ★</b></div>

      <div class="min-cmt-list-head">
        <span class="min-cmt-count-label">0 comments</span>
        <select class="min-cmt-sort">
          <option value="desc">newest first</option>
          <option value="asc">oldest first</option>
        </select>
      </div>
      <div class="min-cmt-list"></div>
    </div>
  `;

  const $ = sel => box.querySelector(sel);
  const nameEl = $('.min-cmt-name'), siteEl = $('.min-cmt-site'), msgEl = $('.min-cmt-message');
  const submitEl = $('.min-cmt-submit'), statusEl = $('.min-cmt-status');
  const countLabel = $('.min-cmt-count-label'), sortEl = $('.min-cmt-sort'), listEl = $('.min-cmt-list');
  const avPrevEl = $('.min-cmt-avatar-el'), avBtn = $('.min-cmt-avatar-btn'), avInput = $('.min-cmt-avatar-input');

  let currentAvatar = getSavedAvatar();

  function updateAvatarPreview() {
    avPrevEl.innerHTML = currentAvatar
      ? `<img src="${currentAvatar}" alt="">`
      : `?`;
  }
  updateAvatarPreview();

  if (localStorage.getItem(NAME_KEY)) nameEl.value = localStorage.getItem(NAME_KEY);
  if (localStorage.getItem(SITE_KEY)) siteEl.value = localStorage.getItem(SITE_KEY);

  avBtn.addEventListener('click', () => avInput.click());
  avInput.addEventListener('change', async () => {
    const file = avInput.files[0];
    if (!file) return;
    try {
      const url = await resizeImage(file, 96, 0.85);
      currentAvatar = url;
      saveAvatar(url);
      updateAvatarPreview();
    } catch (e) { console.error('[avatar]', e); }
  });

  box.querySelectorAll('.min-cmt-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      const md = btn.dataset.md;
      const s = msgEl.selectionStart, e = msgEl.selectionEnd;
      const text = msgEl.value;
      const sel = text.slice(s, e);

      let insert, cursor;
      if (md === 'link') {
        const url = prompt('URL:', 'https://');
        if (!url) return;
        insert = `[${sel || 'link'}](${url})`;
        cursor = s + insert.length;
      } else {
        insert = md + (sel || 'text') + md;
        cursor = s + md.length + (sel ? sel.length : 4) + md.length;
      }
      msgEl.value = text.slice(0, s) + insert + text.slice(e);
      msgEl.focus();
      msgEl.selectionStart = msgEl.selectionEnd = cursor;
    });
  });

  let allComments = [];
  const q = query(collection(db, 'comments'), where('postId', '==', postId));
  onSnapshot(q,
    snap => {
      allComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList();
    },
    err => {
      console.warn('[comments]  error:', err);
      listEl.innerHTML = `<div class="min-cmt-empty">error</div>`;
    }
  );

  sortEl.addEventListener('change', renderList);

  onAdminChange(() => renderList());

  function renderList() {
    const dir = sortEl.value;
    const items = [...allComments].sort((a, b) => {
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return dir === 'asc' ? ta - tb : tb - ta;
    });

    countLabel.textContent = `${items.length} comment${items.length === 1 ? '' : 's'}`;

    const details = box.closest('details');
    const countEl = details?.querySelector('.min-cmt-count');
    if (countEl) countEl.textContent = `(${items.length})`;

    const top = items.filter(c => !c.parentId);
    const replies = {};
    items.forEach(c => {
      if (c.parentId) {
        if (!replies[c.parentId]) replies[c.parentId] = [];
        replies[c.parentId].push(c);
      }
    });

    if (top.length === 0) {
      listEl.innerHTML = `<div class="min-cmt-empty">no comments yet. be the first!</div>`;
      return;
    }

    listEl.innerHTML = top.map(c => renderComment(c, replies[c.id] || [], 0)).join('');
    bindActions();
  }

  function renderComment(c, replies, depth) {
    const ts = c.timestamp?.toDate ? c.timestamp.toDate() : null;
    const name = c.name || 'anonymous';
    const site = c.site || '';
    const avatar = c.avatar || '';

    const nameHtml = site
      ? `<a href="${escHtml(site)}" target="_blank" rel="noopener">${escHtml(name)}</a>`
      : escHtml(name);

    const avatarHtml = avatar
      ? `<img src="${avatar}" alt="">`
      : `<span>${escHtml(initial(name))}</span>`;

    const liked = !!localStorage.getItem(`cmt_like_${c.id}`);
    const likes = c.likes || 0;

    const metaParts = [];
    if (IS_ADMIN) {
      if (c.city && c.city !== 'unknown') metaParts.push(`🌐 ${escHtml(c.city)}`);
      if (c.device)                       metaParts.push(`${deviceIcon(c.device)} ${escHtml(c.device)}`);
      if (c.browser && c.browser !== 'Unknown') metaParts.push(`${browserIcon(c.browser)} ${escHtml(c.browser)}`);
      if (c.os && c.os !== 'Unknown')     metaParts.push(`${escHtml(c.os)}`);
      if (c.ip && c.ip !== 'unknown')     metaParts.push(`🌐 ${escHtml(c.ip)}`);
    }

    const canDelete = IS_ADMIN || isOwnId(c.id);

    const repliesHtml = replies.length
      ? `<div class="min-cmt-replies">${replies.map(r => renderComment(r, [], depth + 1)).join('')}</div>`
      : '';

    return `
      <div class="min-cmt-item" data-id="${c.id}">
        <div class="min-cmt-item-avatar" style="background:${nameColor(name)}">${avatarHtml}</div>
        <div class="min-cmt-item-main">
          <div class="min-cmt-item-head">
            <span class="min-cmt-item-name">${nameHtml}</span>
            <span class="min-cmt-item-time">${timeAgo(ts)}</span>
          </div>
          <div class="min-cmt-item-text">${renderMd(c.message || '')}</div>
          <div class="min-cmt-item-actions">
            <button type="button" class="min-cmt-action min-cmt-like ${liked ? 'liked' : ''}">
              ♡ <span class="min-cmt-like-n">${likes}</span>
            </button>
            <button type="button" class="min-cmt-action min-cmt-reply-btn">↩ reply</button>
            ${canDelete ? `<button type="button" class="min-cmt-action min-cmt-delete-btn" title="delete">✕ delete</button>` : ''}
          </div>
          ${metaParts.length ? `<div class="min-cmt-item-meta">${metaParts.map(m => `<span>${m}</span>`).join('')}</div>` : ''}
          ${repliesHtml}
        </div>
      </div>`;
  }

  function bindActions() {
    listEl.querySelectorAll('.min-cmt-item').forEach(item => {
      const id = item.dataset.id;

      const likeBtn = item.querySelector('.min-cmt-like');
      if (likeBtn) {
        likeBtn.addEventListener('click', async e => {
          e.stopPropagation();
          const key = `cmt_like_${id}`;
          const already = !!localStorage.getItem(key);
          already ? localStorage.removeItem(key) : localStorage.setItem(key, '1');
          try {
            await updateDoc(doc(db, 'comments', id), { likes: increment(already ? -1 : 1) });
          } catch (err) {
            console.error(err);
            already ? localStorage.setItem(key, '1') : localStorage.removeItem(key);
          }
        });
      }

      const replyBtn = item.querySelector('.min-cmt-reply-btn');
      if (replyBtn) {
        replyBtn.addEventListener('click', e => {
          e.stopPropagation();
          showReplyForm(item, id);
        });
      }

      const deleteBtn = item.querySelector('.min-cmt-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async e => {
          e.stopPropagation();
          if (!confirm('delete this comment?')) return;
          try {
            await deleteDoc(doc(db, 'comments', id));
          } catch (err) {
            console.error(err);
            alert('error deleting: ' + err.message);
          }
        });
      }
    });
  }

  function showReplyForm(parentItem, parentId) {
    box.querySelectorAll('.min-cmt-reply-form').forEach(el => el.remove());

    const form = document.createElement('div');
    form.className = 'min-cmt-reply-form';
    form.innerHTML = `
      <input type="text" class="min-cmt-input min-cmt-reply-name" placeholder="name *" maxlength="60" value="${escHtml(localStorage.getItem(NAME_KEY) || '')}">
      <textarea class="min-cmt-textarea min-cmt-reply-msg" placeholder="reply..." maxlength="2000"></textarea>
      <div class="min-cmt-reply-actions">
        <button type="button" class="min-cmt-submit min-cmt-reply-send">reply</button>
        <button type="button" class="min-cmt-submit min-cmt-reply-cancel min-cmt-ghost">cancel</button>
      </div>
    `;
    parentItem.querySelector('.min-cmt-item-main').appendChild(form);

    form.querySelector('.min-cmt-reply-cancel').addEventListener('click', () => form.remove());
    form.querySelector('.min-cmt-reply-send').addEventListener('click', async () => {
      const name = form.querySelector('.min-cmt-reply-name').value.trim();
      const message = form.querySelector('.min-cmt-reply-msg').value.trim();
      if (!name || !message) return;

      localStorage.setItem(NAME_KEY, name);
      const info = await getMyInfo();
      try {
        const ref = await addDoc(collection(db, 'comments'), {
          postId, parentId,
          name, message, site: '',
          avatar: getSavedAvatar(),
          likes: 0,
          ip: info.ip, city: info.city, region: info.region,
          country: info.country, cc: info.cc,
          device: info.device, browser: info.browser,
          os: info.os, lang: info.lang,
          timestamp: serverTimestamp()
        });
        addOwnId(ref.id);
        form.remove();
      } catch (err) { console.error(err); }
    });
  }

  submitEl.addEventListener('click', async () => {
    const name = nameEl.value.trim();
    const site = siteEl.value.trim();
    const message = msgEl.value.trim();

    if (!name)    { setStatus('please enter a name', 'err'); return; }
    if (!message) { setStatus('please write something', 'err'); return; }

    localStorage.setItem(NAME_KEY, name);
    if (site) localStorage.setItem(SITE_KEY, site);

    submitEl.disabled = true;
    setStatus('sending...', 'info');

    try {
      const info = await getMyInfo();
      const ref = await addDoc(collection(db, 'comments'), {
        postId, parentId: null,
        name, site, message,
        avatar: currentAvatar,
        likes: 0,
        ip: info.ip, city: info.city, region: info.region,
        country: info.country, cc: info.cc,
        device: info.device, browser: info.browser,
        os: info.os, lang: info.lang,
        timestamp: serverTimestamp()
      });
      addOwnId(ref.id);
      msgEl.value = '';
      setStatus('posted! ♡', 'ok');
      setTimeout(() => setStatus('', ''), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error: ' + err.message, 'err');
    } finally {
      submitEl.disabled = false;
    }
  });

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'min-cmt-status' + (type ? ' ' + type : '');
  }
}


function setupLazyComments() {
  document.querySelectorAll('details.min-cmt-details').forEach(details => {
    const postId = details.dataset.postId;
    if (!postId || details._wired) return;
    details._wired = true;

    getDocs(query(collection(db, 'comments'), where('postId', '==', postId)))
      .then(snap => {
        const countEl = details.querySelector('.min-cmt-count');
        if (countEl) countEl.textContent = `(${snap.size})`;
      })
      .catch(() => {});

    details.addEventListener('toggle', () => {
      if (!details.open || details._mounted) return;
      details._mounted = true;

      const body = details.querySelector('.min-cmt-body');
      if (!body) return;

      const reactBox = document.createElement('div');
      reactBox.className = 'blog-reactions-box min-reactions';
      reactBox.dataset.blogId = postId;
      body.appendChild(reactBox);
      try { mountReactions(reactBox, { targetId: postId }); } catch (e) { console.warn(e); }

      const cmtBox = document.createElement('div');
      cmtBox.className = 'min-cmt-mount';
      body.appendChild(cmtBox);
      mountComments(cmtBox, { postId });
    });
  });
}

function init() {
  setupLazyComments();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.minSetupBlogComments = setupLazyComments;