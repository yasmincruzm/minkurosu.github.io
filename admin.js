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


const ALLOWED_EMAILS = [
    'mincruzm@gmail.com',
    'yasmincruzm@hotmail.com'
];

function isAllowed(email) {
    return !!email && ALLOWED_EMAILS.includes(email);
}


const IMGBB_API_KEY = 'SUA_API_KEY_AQUI';


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);

if (!isMobile) {
    provider.setCustomParameters({ prompt: 'select_account' });
}

console.log('[admin] isMobile =', isMobile);

function msg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type}`;
}

setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('[admin] setPersistence falhou:', err);
});



getRedirectResult(auth)
    .then(cred => {
        console.log('[admin] getRedirectResult:', cred);
        if (!cred) return;

        if (!isAllowed(cred.user.email)) {
            signOut(auth);
            const lm = document.getElementById('login-message');
            msg(lm, 'acesso negado.', 'error');
            return;
        }
        localStorage.setItem('min_admin', '1');
        localStorage.setItem('mku_admin', '1');
        const lm = document.getElementById('login-message');
        msg(lm, 'logged in!', 'success');
    })
    .catch(err => {
        console.error('[admin] redirect login error:', err);
        const lm = document.getElementById('login-message');
        msg(lm, `erro no login: ${err.code || err.message}`, 'error');
    });


async function uploadImageToImgBB(file) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY === 'SUA_API_KEY_AQUI') {
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

    let ltfLoaded = false;

    onAuthStateChanged(auth, user => {
        if (!adminPanel || !loginForm) return;

        if (user) {
            console.log('[admin] logado como:', user.email);

            if (!isAllowed(user.email)) {
                signOut(auth);
                msg(loginMessage, 'acesso negado.', 'error');
                return;
            }

            adminPanel.style.display = 'block';
            loginForm.style.display  = 'none';

            // Carrega LiveTrafficFeed só uma vez, após o painel estar visível
            if (!ltfLoaded) {
                ltfLoaded = true;
                loadLiveTrafficFeed();
            }

            loadVisitorTracker(app);
            loadCityList(app);
            loadDrawings(app);
            loadMailbox(db);
        } else {
            console.log('[admin] deslogado');
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
                msg(loginMessage, 'acesso negado.', 'error');
                return;
            }
            localStorage.setItem('min_admin', '1');
            localStorage.setItem('mku_admin', '1');
            msg(loginMessage, 'logged in!', 'success');
        } catch (err) {
            msg(loginMessage, `erro: ${err.message}`, 'error');
        }
    });

    googleLoginBtn?.addEventListener('click', async () => {
        msg(loginMessage, 'abrindo login do google...', 'info');

        if (isMobile) {
            console.log('[admin] mobile → signInWithRedirect');
            try {
                await signInWithRedirect(auth, provider);
            } catch (err) {
                console.error('[admin] redirect login error:', err);
                msg(loginMessage, `erro: ${err.code || err.message}`, 'error');
            }
            return;
        }

        try {
            const cred = await signInWithPopup(auth, provider);

            if (!isAllowed(cred.user.email)) {
                await signOut(auth);
                msg(loginMessage, 'acesso negado. use uma conta autorizada.', 'error');
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
            localStorage.removeItem('mku_admin');
            msg(loginMessage, 'logged out.', 'info');
        } catch (err) {
            msg(loginMessage, `logout error: ${err.message}`, 'error');
        }
    });


    // Novo post (pessoal)
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
            msg(postMsg, 'escreva algo primeiro.', 'error');
            return;
        }

        try {
            msg(postMsg, 'publicando...', 'info');

            let fileUrl = '';
            if (file) {
                msg(postMsg, 'enviando imagem...', 'info');
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
                type: 'personal',
                profile: 'personal',
                timestamp: serverTimestamp()
            });

            msg(postMsg, 'post pessoal publicado!', 'success');
            if (postContent)   postContent.value  = '';
            if (postImageUrl)  postImageUrl.value  = '';
            if (postImageFile) postImageFile.value = '';
        } catch (err) {
            console.error(err);
            msg(postMsg, `erro: ${err.message}`, 'error');
        }
    });

    // Novo post (arte digital / profissional)
    const artPostContent   = document.getElementById('art-post-content');
    const artPostImageUrl  = document.getElementById('art-post-image-url');
    const artPostImageFile = document.getElementById('art-post-image-file');
    const publishArtBtn    = document.getElementById('publish-art-post-btn');
    const artPostMsg       = document.getElementById('art-post-message');

    publishArtBtn?.addEventListener('click', async () => {
        let content = (artPostContent?.value || '').trim();
        const enteredUrl = (artPostImageUrl?.value || '').trim();
        const file = artPostImageFile?.files[0];

        if (!content && !enteredUrl && !file) {
            msg(artPostMsg, 'adicione uma imagem ou descrição da arte.', 'error');
            return;
        }

        try {
            msg(artPostMsg, 'publicando arte...', 'info');

            let fileUrl = '';
            if (file) {
                msg(artPostMsg, 'enviando arte...', 'info');
                fileUrl = await uploadImageToImgBB(file);
            }

            const parts = [];
            if (content)    parts.push(content);
            if (enteredUrl) parts.push(enteredUrl);
            if (fileUrl)    parts.push(fileUrl);
            const finalContent = parts.join('\n');

            const artDoc = {
                content: finalContent,
                imageUrl: fileUrl || enteredUrl || '',
                type: 'art',
                profile: 'professional_art',
                category: 'digital_art',
                timestamp: serverTimestamp()
            };

            await addDoc(collection(db, 'posts'), artDoc);
            await addDoc(collection(db, 'art_posts'), artDoc);

            msg(artPostMsg, 'arte profissional publicada!', 'success');
            if (artPostContent)   artPostContent.value  = '';
            if (artPostImageUrl)  artPostImageUrl.value  = '';
            if (artPostImageFile) artPostImageFile.value = '';
        } catch (err) {
            console.error(err);
            msg(artPostMsg, `erro: ${err.message}`, 'error');
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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function loadLiveTrafficFeed() {
    const container = document.getElementById('ltf-widget-container');
    if (!container) return;

    container.innerHTML = '';

    const widgetUrl = 'https://cdn.livetrafficfeed.com/static/v5/live.js?bc=2d2d2d&tc=d5d5d5&brd1=813d3d&lnk=813d3d&hc=d5d5d5&hfc=2d2d2d&nc=813d3d&vv=409&tft=10&ro=0&tz=America%2FSao_Paulo&res=1&l=https%3A%2F%2Fminkurosu.site%2F';

    const frame = document.createElement('iframe');
    frame.title = 'live traffic feed de minkurosu.site';
    frame.style.cssText = 'display:block;width:100%;max-width:640px;height:420px;border:0;background:transparent;';
    frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;}</style></head><body>'
        + '<script type="text/javascript" src="https://livetrafficfeed.com/static/v5/livetrafficfeed.js"><\/script>'
        + '<script type="text/javascript" src="' + widgetUrl + '"><\/script>'
        + '</body></html>';

    frame.addEventListener('load', () => {
        let doc;
        try { doc = frame.contentDocument; } catch { return; }
        if (!doc || !doc.body) return;

        const fit = () => {
            const h = doc.body.scrollHeight;
            if (h > 40) frame.style.height = h + 'px';
        };

        fit();
        setTimeout(fit, 1200);
        setTimeout(fit, 3500);
        if (window.ResizeObserver) new ResizeObserver(fit).observe(doc.body);
    });

    container.appendChild(frame);
}