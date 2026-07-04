import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

async function tryLoadDashboardWidgets(app) {
    try {
        const mod = await import('./admin-widgets.js');
        if (typeof mod.loadDashboardWidgets === 'function') {
            mod.loadDashboardWidgets(app);
        }
    
}

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

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const storage  = getStorage(app);
const provider = new GoogleAuthProvider();

function msg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type}`;
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

    getRedirectResult(auth).then(cred => {
        if (!cred) return;
        if (cred.user.email !== ALLOWED_EMAIL) {
            signOut(auth);
            msg(loginMessage, 'acesso negado.', 'error');
            return;
        }
        localStorage.setItem('mku_admin', '1');
        msg(loginMessage, 'logged in!', 'success');
    }).catch(err => {
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
            tryLoadDashboardWidgets(app);
            loadMailbox(db);
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
            localStorage.setItem('mku_admin', '1');
            msg(loginMessage, 'logged in!', 'success');
        } catch (err) {
            msg(loginMessage, `erro: ${err.message}`, 'error');
        }
    });


    googleLoginBtn?.addEventListener('click', async () => {
        msg(loginMessage, 'abrindo login do google...', 'info');
        try {
            const cred = await signInWithPopup(auth, provider);
            if (cred.user.email !== ALLOWED_EMAIL) {
                await signOut(auth);
                msg(loginMessage, 'acesso negado. use sua conta autorizada.', 'error');
                return;
            }
            localStorage.setItem('mku_admin', '1');
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
            localStorage.removeItem('mku_admin');
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

            if (file) {
                msg(postMsg, 'uploading image...', 'info');
                const storageRef = ref(storage, `blog_images/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                const fileUrl = await getDownloadURL(storageRef);
                content = content ? `${content}\n${fileUrl}` : fileUrl;
            }

            if (enteredUrl) {
                content = content ? `${content}\n${enteredUrl}` : enteredUrl;
            }

            await addDoc(collection(db, 'posts'), {
                content,
                imageUrl: '',
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
    });
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}