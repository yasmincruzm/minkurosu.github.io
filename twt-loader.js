import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, onSnapshot, getDocs, doc, addDoc, updateDoc, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── styles ─────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
    #tweets-container li .info p,
    #tweets-container .reply .content,
    #secret-posts-container li .info p { text-align:justify; hyphens:auto; }
    .link-card { display:flex; flex-direction:column; border:1px solid #3A3A3A; border-radius:16px; overflow:hidden; margin-top:10px; text-decoration:none; transition:background 0.18s; background:#1e2124; max-width:100%; cursor:pointer; }
    .link-card:hover { background:#252a2e; }
    .link-card .lc-img { width:100%; max-height:220px; object-fit:cover; display:block; }
    .link-card .lc-body { padding:10px 14px 12px; }
    .link-card .lc-domain { font-size:12px; color:#6e7c86; margin-bottom:3px; }
    .link-card .lc-title { font-size:14px; color:#E1E8ED; font-weight:bold; line-height:1.35; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .link-card .lc-desc { font-size:13px; color:#8899A6; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .link-card-loading { border:1px solid #3A3A3A; border-radius:16px; margin-top:10px; padding:12px 14px; background:#1e2124; color:#6e7c86; font-size:12px; }
`;
document.head.appendChild(style);

// ── media helpers ──────────────────────────────
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

function getYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) {
            return u.searchParams.get('v')
                || (u.pathname.startsWith('/embed/')  ? u.pathname.split('/')[2] : null)
                || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null);
        }
    } catch(e) {}
    return null;
}

function getSpotifyEmbed(url) {
    try {
        const u = new URL(url);
        if (!u.hostname.includes('spotify.com')) return null;
        const m = u.pathname.match(/\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
        if (m) return 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] + '?utm_source=generator&theme=0';
    } catch(e) {}
    return null;
}

function isImageUrl(url) {
    const base = url.split('?')[0];
    return IMAGE_EXT.test(base)
        || url.includes('tenor.com') || url.includes('giphy.com')
        || url.includes('i.imgur.com') || url.includes('pbs.twimg.com')
        || url.includes('media.discordapp') || url.includes('cdn.discordapp')
        || url.includes('i.redd.it') || url.includes('preview.redd.it')
        || url.includes('picmix.com');
}

function isVideoUrl(url) { return VIDEO_EXT.test(url.split('?')[0]); }

function extractUrls(text) { return [...(text.match(/https?:\/\/[^\s<>"]+/g) || [])]; }

function cleanUrl(url) { return url.replace(/[.,;!?)'"\]]+$/, ''); }

function embedOne(rawUrl) {
    const url = cleanUrl(rawUrl);
    const ytId = getYouTubeId(url);
    if (ytId) return '<div style="margin-top:10px;border-radius:16px;overflow:hidden;max-width:100%;"><iframe src="https://www.youtube.com/embed/' + ytId + '" width="100%" height="280" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen style="border-radius:16px;display:block;"></iframe></div>';
    const spotUrl = getSpotifyEmbed(url);
    if (spotUrl) {
        const h = url.includes('/track/') ? '152' : '352';
        return '<div style="margin-top:10px;"><iframe src="' + spotUrl + '" width="100%" height="' + h + '" frameborder="0" allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" loading="lazy" style="border-radius:12px;display:block;"></iframe></div>';
    }
    if (isImageUrl(url)) return '<img src="' + url + '" alt="" style="max-width:100%;border-radius:16px;margin-top:10px;display:block;">';
    if (isVideoUrl(url)) return '<video controls style="max-width:100%;border-radius:16px;margin-top:10px;display:block;"><source src="' + url + '"></video>';
    return '';
}

// ── link cards ─────────────────────────────────
const cardPromises = {};
let _uid = 0;

function fetchLinkCard(url) {
    if (cardPromises[url]) return cardPromises[url];
    const controller = new AbortController();
    const tid = setTimeout(function() { controller.abort(); }, 8000);
    cardPromises[url] = fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url), { signal: controller.signal })
        .then(function(res) { clearTimeout(tid); return res.ok ? res.json() : null; })
        .then(function(json) {
            if (!json) return null;
            const html = json.contents || '';
            function getMeta(prop) {
                const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']+)["\']', 'i');
                const re2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + prop + '["\']', 'i');
                const m = html.match(re1) || html.match(re2);
                return m ? m[1].replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'") : '';
            }
            const ogTitle = getMeta('og:title');
            const titleM  = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            let domain = url;
            try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch(e) {}
            return { title: ogTitle || (titleM ? titleM[1].trim() : ''), description: getMeta('og:description') || getMeta('description'), image: getMeta('og:image'), domain: domain };
        })
        .catch(function() { return null; });
    return cardPromises[url];
}

function renderLinkCard(url, card) {
    let domain = url;
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch(e) {}
    if (!card || !card.title) {
        return '<a href="' + url + '" target="_blank" rel="noopener" class="link-card"><div class="lc-body"><div class="lc-domain">' + domain + '</div><div class="lc-title">' + url + '</div></div></a>';
    }
    return '<a href="' + url + '" target="_blank" rel="noopener" class="link-card">'
        + (card.image ? '<img class="lc-img" src="' + card.image + '" alt="" onerror="this.style.display=\'none\'">' : '')
        + '<div class="lc-body"><div class="lc-domain">' + card.domain + '</div><div class="lc-title">' + card.title + '</div>'
        + (card.description ? '<div class="lc-desc">' + card.description + '</div>' : '')
        + '</div></a>';
}

async function injectLinkCard(container, url, uid) {
    const el = container.querySelector('[data-card-uid="' + uid + '"]');
    if (!el) return;
    const card = await fetchLinkCard(url);
    el.outerHTML = renderLinkCard(url, card);
}

function buildEmbeds(urls) {
    const seen = new Set();
    let html = '';
    const plain = [];
    for (let i = 0; i < urls.length; i++) {
        const url = cleanUrl(urls[i]);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const em = embedOne(url);
        if (em) {
            html += em;
        } else {
            const uid = ++_uid;
            plain.push({ url: url, uid: uid });
            html += '<div class="link-card-loading" data-card-uid="' + uid + '">loading preview...</div>';
        }
    }
    return { html: html, plain: plain };
}

function fmt(ts) {
    if (!ts) return '';
    const d = ts.toDate();
    const pad = function(n) { return String(n).padStart(2,'0'); };
    return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + String(d.getFullYear()).slice(2) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function renderPost(post, postId) {
    const raw    = post.content || '';
    const urls   = extractUrls(raw);
    const legacy = (post.imageUrl || '').trim();
    if (legacy && !raw.includes(legacy)) urls.push(legacy);

    let text = raw;
    for (let i = 0; i < urls.length; i++) { text = text.split(urls[i]).join(''); }
    text = text.replace(/\n/g, '<br>').trim();

    const built  = buildEmbeds(urls);
    const liked  = (JSON.parse(localStorage.getItem('likedPosts') || '[]')).includes(postId);
    const count  = post.likeCount || 0;

    return {
        html: '<img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">'
            + '<div class="info">'
            + '<strong>min* <span>@minkurosu \u2022 ' + fmt(post.timestamp) + '</span></strong>'
            + '<p>' + text + '</p>'
            + built.html
            + '<div class="post-actions">'
            + '<div class="action-button reply-button"><span>reply</span></div>'
            + '<div class="action-button like-button ' + (liked ? 'liked' : '') + '" data-type="post">'
            + '<svg viewBox="0 0 24 24"><path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"></path></svg>'
            + '<span class="like-count">' + count + '</span>'
            + '</div></div>'
            + '<form class="reply-form">'
            + '<input type="text" name="authorName" placeholder="user" required maxlength="49">'
            + '<textarea name="content" placeholder="write your reply" required maxlength="999"></textarea>'
            + '<button type="submit">send</button>'
            + '</form>'
            + '<div class="replies-section"></div>'
            + '</div>',
        plain: built.plain
    };
}

function listenForPosts() {
    const container = document.getElementById('tweets-container');
    if (!container) return;
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    onSnapshot(q, function(snap) {
        container.innerHTML = '';
        if (snap.empty) { container.innerHTML = '<li><p>no posts found.</p></li>'; return; }
        snap.forEach(function(docSnap) {
            const li = document.createElement('li');
            li.dataset.postId = docSnap.id;
            const result = renderPost(docSnap.data(), docSnap.id);
            li.innerHTML = result.html;
            container.appendChild(li);
            listenForReplies(docSnap.id);
            result.plain.forEach(function(p) { injectLinkCard(li, p.url, p.uid); });
        });
    }, function(err) {
        console.error('posts error:', err);
        container.innerHTML = '<li><p>something went wrong.</p></li>';
    });
}

function listenForReplies(postId) {
    const postEl = document.querySelector('li[data-post-id="' + postId + '"]');
    if (!postEl) return;
    const box = postEl.querySelector('.replies-section');
    const q   = query(collection(db, 'posts', postId, 'replies'), orderBy('timestamp', 'asc'));
    onSnapshot(q, function(snap) {
        box.innerHTML = '';
        box.style.display = snap.empty ? 'none' : 'block';
        if (snap.empty) return;
        snap.forEach(function(docSnap) {
            const r     = docSnap.data();
            const raw   = r.content || '';
            const urls  = extractUrls(raw);
            const liked = (JSON.parse(localStorage.getItem('likedReplies') || '[]')).includes(docSnap.id);
            let text = raw;
            for (let i = 0; i < urls.length; i++) { text = text.split(urls[i]).join(''); }
            text = text.replace(/\n/g, '<br>').trim();
            const built = buildEmbeds(urls);
            const div = document.createElement('div');
            div.className = 'reply';
            div.dataset.replyId = docSnap.id;
            div.innerHTML = '<div class="info">'
                + '<strong class="author-name">' + r.authorName + ' <span>\u2022 ' + fmt(r.timestamp) + '</span></strong>'
                + '<p class="content">' + text + '</p>'
                + built.html
                + '<div class="actions"><div class="action-button like-button ' + (liked ? 'liked' : '') + '" data-type="reply">'
                + '<svg viewBox="0 0 24 24"><path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"></path></svg>'
                + '<span class="like-count">' + (r.likeCount || 0) + '</span>'
                + '</div></div></div>';
            box.appendChild(div);
            built.plain.forEach(function(p) { injectLinkCard(div, p.url, p.uid); });
        });
    });
}

async function loadSecretPosts() {
    const container = document.getElementById('secret-posts-container');
    if (!container) return;
    container.innerHTML = '<li style="justify-content:center;padding:20px;font-weight:bold;color:#667580;">loading secrets...</li>';
    try {
        const snap = await getDocs(query(collection(db, 'private_entries'), orderBy('timestamp', 'desc')));
        if (snap.empty) { container.innerHTML = '<li style="text-align:center;color:#B3B3B3;padding:15px;">no secret entries found.</li>'; return; }
        container.innerHTML = '';
        snap.forEach(function(docSnap) {
            const post = docSnap.data();
            const li   = document.createElement('li');
            li.innerHTML = '<img src="https://pbs.twimg.com/profile_images/1853559456900042752/PFV06W_5_400x400.jpg" alt="Avatar">'
                + '<div class="info"><strong>min* <span>@minkurosu \u2022 ' + fmt(post.timestamp) + '</span></strong>'
                + '<p>' + (post.content || '').replace(/\n/g, '<br>') + '</p></div>';
            container.appendChild(li);
        });
    } catch(err) {
        console.error('secret posts error:', err);
        container.innerHTML = '<li style="text-align:center;color:#dc3545;padding:15px;">error loading entries.</li>';
    }
}

function initSecret() {
    const unlockBtn  = document.getElementById('unlock-button');
    const passwordIn = document.getElementById('secret-password');
    const container  = document.getElementById('secret-posts-container');
    const msgEl      = document.getElementById('password-message');
    if (!unlockBtn || !passwordIn || !container || !msgEl) return;
    unlockBtn.addEventListener('click', function() {
        if (passwordIn.value === 'lili') {
            passwordIn.style.display = 'none';
            unlockBtn.style.display  = 'none';
            const hint = document.querySelector('#secret-section p');
            if (hint) hint.style.display = 'none';
            msgEl.textContent = '';
            container.style.display = 'block';
            loadSecretPosts();
        } else {
            msgEl.textContent = 'senha incorreta.';
            passwordIn.value  = '';
        }
    });
}

async function handleActionClick(e) {
    const replyBtn = e.target.closest('.reply-button');
    if (replyBtn) {
        replyBtn.closest('li[data-post-id]').querySelector('.reply-form').classList.toggle('active');
        return;
    }
    const likeBtn = e.target.closest('.like-button');
    if (!likeBtn) return;
    const postEl = likeBtn.closest('li[data-post-id]');
    if (!postEl) return;
    const postId = postEl.dataset.postId;
    const type   = likeBtn.dataset.type;
    let docRef, storageKey, itemId;
    if (type === 'post') {
        docRef = doc(db, 'posts', postId); storageKey = 'likedPosts'; itemId = postId;
    } else if (type === 'reply') {
        const replyEl = likeBtn.closest('.reply[data-reply-id]');
        if (!replyEl) return;
        docRef = doc(db, 'posts', postId, 'replies', replyEl.dataset.replyId); storageKey = 'likedReplies'; itemId = replyEl.dataset.replyId;
    } else return;
    const liked = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (liked.includes(itemId)) return;
    try {
        await updateDoc(docRef, { likeCount: increment(1) });
        liked.push(itemId);
        localStorage.setItem(storageKey, JSON.stringify(liked));
        likeBtn.classList.add('liked');
        const counter = likeBtn.querySelector('.like-count');
        if (counter) counter.textContent = Number(counter.textContent) + 1;
    } catch(err) { console.error('like error:', err); }
}

async function handleReplySubmit(e) {
    if (!e.target.classList.contains('reply-form')) return;
    e.preventDefault();
    const form    = e.target;
    const postId  = form.closest('li[data-post-id]').dataset.postId;
    const author  = form.querySelector('input[name="authorName"]').value.trim();
    const content = form.querySelector('textarea[name="content"]').value.trim();
    if (!author || !content) { alert('please fill in your name and reply.'); return; }
    try {
        await addDoc(collection(db, 'posts', postId, 'replies'), { authorName: author, content: content, likeCount: 0, timestamp: serverTimestamp() });
        form.reset();
        form.classList.remove('active');
    } catch(err) { console.error('reply error:', err); alert("couldn't send reply."); }
}

// ── init ───────────────────────────────────────
function init() {
    const container = document.getElementById('tweets-container');
    if (container) {
        container.addEventListener('click', handleActionClick);
        container.addEventListener('submit', handleReplySubmit);
    }
    listenForPosts();
    initSecret();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}