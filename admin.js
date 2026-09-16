import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect,
  getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut,
  setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy,
  onSnapshot, deleteDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { loadVisitorTracker, loadCityList, loadDrawings } from './admin-tracker.js';


const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
};

const ALLOWED_EMAIL = 'mincruzm@gmail.com';

const IMGBB_API_KEY = 'SUA_API_KEY_AQUI';


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({ prompt: 'select_account' });

const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);

function msg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type}`;
}

setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('setPersistence falhou:', err);
});


async function uploadImageToImgBB(file) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY === '94a7816a5bcd01a3e4a2943ed77faecd') {
        throw new Error('ImgBB API key não configurada no admin.js');
    }

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

    if (!res.ok) {
        throw new Error(`ImgBB respondeu ${res.status}`);
    }

    const json = await res.json();
    if (!json.success || !json.data?.url) {
        throw new Error(json.error?.message || 'Falha no upload do ImgBB');
    }

    return json.data.url;
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

    getRedirectResult(auth)
        .then(cred => {
            if (!cred) return;
            if (cred.user.email !== ALLOWED_EMAIL) {
                signOut(auth);
                msg(loginMessage, 'acesso negado.', 'error');
                return;
            }
            localStorage.setItem('min_admin', '1');
            msg(loginMessage, 'logged in!', 'success');
        })
        .catch(err => {
            console.error('redirect login error:', err);
            msg(loginMessage, `erro no login: ${err.code || err.message}`, 'error');
        });

    onAuthStateChanged(auth, user => {
        if (!adminPanel || !loginForm) return;

        if (user) {
            if (user.email !== ALLOWED_EMAIL) {
                signOut(auth);
                msg(loginMessage, 'acesso negado.', 'error');
                return;
            }
            adminPanel.style.display = 'block';
            loginForm.style.display  = 'none';
            loadVisitorTracker(app);
            loadCityList(app);
            loadDrawings(app);
            loadMailbox(db);
            loadComments(db);
        } else {
            adminPanel.style.display = 'none';
            loginForm.style.display  = 'block';
        }
    });

    loginEmailForm?.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            const cred = await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            if (cred.user.email !== ALLOWED_EMAIL) {
                await signOut(auth);
                msg(loginMessage, 'acesso negado.', 'error');
                return;
            }
            localStorage.setItem('min_admin', '1');
            msg(loginMessage, 'logged in!', 'success');
        } catch (err) {
            msg(loginMessage, `erro: ${err.message}`, 'error');
        }
    });

    googleLoginBtn?.addEventListener('click', async () => {
        msg(loginMessage, 'abrindo login do google...', 'info');

        if (isMobile) {
            try {
                await signInWithRedirect(auth, provider);
            } catch (err) {
                console.error('redirect login error:', err);
                msg(loginMessage, `erro: ${err.code || err.message}`, 'error');
            }
            return;
        }

        try {
            const cred = await signInWithPopup(auth, provider);
            if (cred.user.email !== ALLOWED_EMAIL) {
                await signOut(auth);
                msg(loginMessage, 'acesso negado. use sua conta autorizada.', 'error');
                return;
            }
            localStorage.setItem('min_admin', '1');
            msg(loginMessage, 'logged in!', 'success');
        } catch (err) {
            console.error('google popup login error:', err.code, err.message);

            const popupIssues = [
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/operation-not-supported-in-this-environment'
            ];

            if (popupIssues.includes(err.code)) {
                msg(loginMessage, 'popup bloqueado, redirecionando...', 'info');
                try {
                    await signInWithRedirect(auth, provider);
                } catch (err2) {
                    msg(loginMessage, `erro: ${err2.code || err2.message}`, 'error');
                }
                return;
            }

            if (err.code === 'auth/unauthorized-domain') {
                msg(loginMessage, 'este domínio não está autorizado no firebase (authentication > settings > authorized domains).', 'error');
                return;
            }

            msg(loginMessage, `erro: ${err.code || err.message}`, 'error');
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('min_admin');
            msg(loginMessage, 'logged out.', 'info');
        } catch (err) {
            msg(loginMessage, `logout error: ${err.message}`, 'error');
        }
    });


    const postContent   = document.getElementById('post-content');
    const postImageUrl  = document.getElementById('post-image-url');
    const postImageFile = document.getElementById('post-image-file');
    const publishBtn    = document.getElementById('publish-post-btn');
    const postMsg       = document.getElementById('post-message');

    publishBtn?.addEventListener('click', async () => {
        let content = (postContent?.value || '').trim();
        const enteredUrl = (postImageUrl?.value || '').trim();
        const file = postImageFile?.files[0];

        if (!content && !enteredUrl && !file) {
            msg(postMsg, 'write something first.', 'error');
            return;
        }

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

            await addDoc(collection(db, 'posts'), {
                content: finalContent,
                imageUrl: fileUrl || enteredUrl || '',
                timestamp: serverTimestamp()
            });

            msg(postMsg, 'posted!', 'success');
            if (postContent)   postContent.value  = '';
            if (postImageUrl)  postImageUrl.value  = '';
            if (postImageFile) postImageFile.value = '';
        } catch (err) {
            console.error(err);
            msg(postMsg, `error: ${err.message}`, 'error');
        }
    });


    const privateContent = document.getElementById('private-entry-content');
    const publishPrivate = document.getElementById('publish-private-entry-btn');
    const privateMsg     = document.getElementById('private-entry-message');

    publishPrivate?.addEventListener('click', async () => {
        const content = (privateContent?.value || '').trim();
        if (!content) { msg(privateMsg, 'write something first.', 'error'); return; }
        try {
            msg(privateMsg, 'publishing...', 'info');
            await addDoc(collection(db, 'private_entries'), { content, timestamp: serverTimestamp() });
            msg(privateMsg, 'published!', 'success');
            if (privateContent) privateContent.value = '';
        } catch (err) {
            msg(privateMsg, `error: ${err.message}`, 'error');
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


    const blogTitle   = document.getElementById('blog-title');
    const blogContent = document.getElementById('blog-content');
    const blogImgUrl  = document.getElementById('blog-image-url');
    const publishBlog = document.getElementById('publish-blog-btn');
    const blogMsg     = document.getElementById('blog-message');

    publishBlog?.addEventListener('click', async () => {
        const title    = (blogTitle?.value || '').trim();
        const content  = (blogContent?.value || '').trim();
        const imageUrl = (blogImgUrl?.value || '').trim();
        if (!title || !content) { msg(blogMsg, 'fill in title and content.', 'error'); return; }
        try {
            await addDoc(collection(db, 'blog_posts'), { title, content, imageUrl, timestamp: serverTimestamp() });
            msg(blogMsg, 'published!', 'success');
            if (blogTitle)   blogTitle.value   = '';
            if (blogContent) blogContent.value = '';
            if (blogImgUrl)  blogImgUrl.value  = '';
        } catch (err) {
            msg(blogMsg, `error: ${err.message}`, 'error');
        }
    });
});


function loadMailbox(db) {
    const container = document.getElementById('mailbox-list');
    if (!container) return;

    const q = query(collection(db, 'mailbox'), orderBy('timestamp', 'desc'));

    onSnapshot(q, snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="tracker-empty">nenhuma mensagem ainda.</p>`;
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
            <div class="mb-card" data-id="${id}">
                <div class="mb-msg">${escapeHtml(d.message || '')}</div>
                <div class="mb-meta">
                    <span class="mb-ip">🌐 ${d.ip || 'unknown'}</span>
                    <span>${ago}</span>
                </div>
                <button class="mb-delete" data-id="${id}">deletar</button>
            </div>`;
        }).join('');

        container.querySelectorAll('.mb-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('deletar essa mensagem?')) return;
                try {
                    await deleteDoc(doc(db, 'mailbox', btn.dataset.id));
                } catch (err) {
                    alert('erro ao deletar: ' + err.message);
                }
            });
        });
    }, err => {
        console.warn('loadMailbox:', err);
        container.innerHTML = `<p class="tracker-empty">erro ao carregar mensagens.</p>`;
    });
}

function loadComments(db) {
    const container = document.getElementById('comments-admin-list');
    const filterEl  = document.getElementById('comments-filter');
    if (!container) return;

    let allComments = [];
    let currentFilter = '';

    const q = query(collection(db, 'comments'));

    onSnapshot(q, snapshot => {
        allComments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        allComments.sort((a, b) => {
            const ta = a.timestamp?.seconds || 0;
            const tb = b.timestamp?.seconds || 0;
            return tb - ta;
        });
        render();
    }, err => {
        console.warn('loadComments:', err);
        container.innerHTML = `<p class="tracker-empty">erro ao carregar comentários.</p>`;
    });

    function countryFlag(cc) {
        if (!cc || cc.length !== 2) return '🌐';
        return [...cc.toUpperCase()]
            .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
            .join('');
    }

    function fmtWhen(ts) {
        if (!ts) return '—';
        const time = ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const date = ts.toLocaleDateString('pt-BR');
        return `${time} - ${date}`;
    }

    function render() {
        const filtered = currentFilter
            ? allComments.filter(c => c.postId === currentFilter)
            : allComments;

        if (filtered.length === 0) {
            container.innerHTML = `<p class="tracker-empty">nenhum comentário${currentFilter ? ' nesse post' : ''} ainda.</p>`;
            return;
        }

        container.innerHTML = filtered.map(c => {
            const ts  = c.timestamp?.toDate ? c.timestamp.toDate() : null;
            const when = fmtWhen(ts);

            const siteHtml = c.site
                ? `<a class="cmt-site" href="${escapeHtml(c.site)}" target="_blank" rel="noopener">${escapeHtml(c.site)}</a>`
                : '';

            const location = [c.city, c.region, c.country]
                .filter(v => v && v !== 'unknown' && v !== '')
                .join(', ') || 'localização desconhecida';

            const flag    = countryFlag(c.cc || '');
            const device  = c.device  || '—';
            const browser = c.browser || '—';
            const os      = c.os      || '—';

            return `
            <div class="cmt-card" data-id="${c.id}">
                <div class="cmt-head">
                    <span class="cmt-name">${escapeHtml(c.name || 'anônimo')}</span>
                    ${siteHtml}
                    <span class="cmt-post">${escapeHtml(c.postId || '')}</span>
                </div>
                <div class="cmt-msg">${escapeHtml(c.message || '')}</div>
                <div class="cmt-meta">
                    <span class="cmt-loc">${flag} ${escapeHtml(location)}</span>
                    <span class="cmt-dev">${escapeHtml(device)} · ${escapeHtml(browser)} · ${escapeHtml(os)}</span>
                    <span class="cmt-ip">🌐 ${escapeHtml(c.ip || 'unknown')}</span>
                    <span class="cmt-when">${when}</span>
                </div>
                <button class="cmt-delete" data-id="${c.id}">deletar</button>
            </div>`;
        }).join('');

        container.querySelectorAll('.cmt-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('deletar esse comentário?')) return;
                try {
                    await deleteDoc(doc(db, 'comments', btn.dataset.id));
                } catch (err) {
                    alert('erro ao deletar: ' + err.message);
                }
            });
        });
    }

    filterEl?.addEventListener('change', () => {
        currentFilter = filterEl.value;
        render();
    });
}


function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}