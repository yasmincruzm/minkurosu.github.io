import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

function msg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type}`;
}

function injectLTFScript(container) {
    if (document.getElementById('ltf-script')) return;
    const s = document.createElement('script');
    s.id   = 'ltf-script';
    s.type = 'text/javascript';
    const pageUrl = encodeURIComponent('https://minkurosu.site/admin.html');
    s.src  = `https://cdn.livetrafficfeed.com/static/v5/live.js?bc=2d2d2d&tc=d5d5d5&brd1=813d3d&lnk=813d3d&hc=d5d5d5&hfc=2d2d2d&nc=813d3d&vv=409&tft=10&ro=0&tz=America%2FSao_Paulo&res=1&l=${pageUrl}`;
    container.innerHTML = '';
    container.appendChild(s);
}

document.addEventListener('DOMContentLoaded', () => {

    // ── auth ──────────────────────────────────
    const loginForm     = document.getElementById('login-form');
    const loginEmail    = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginMessage  = document.getElementById('login-message');
    const adminPanel    = document.getElementById('admin-panel-section');
    const logoutBtn     = document.getElementById('logout-btn');

    onAuthStateChanged(auth, user => {
        if (!adminPanel || !loginForm) return;
        if (user) {
            adminPanel.style.display = 'block';
            loginForm.style.display  = 'none';

            const ltfContainer = document.getElementById('ltf-container');
            if (ltfContainer && !document.getElementById('ltf-script')) {
                injectLTFScript(ltfContainer);
            }
        } else {
            adminPanel.style.display = 'none';
            loginForm.style.display  = 'block';
        }
    });

    loginForm?.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            msg(loginMessage, 'logged in!', 'success');
        } catch (err) {
            msg(loginMessage, `login error: ${err.message}`, 'error');
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            msg(loginMessage, 'logged out.', 'info');
        } catch (err) {
            msg(loginMessage, `logout error: ${err.message}`, 'error');
        }
    });

    // ── thoughts post ──────────────────────────
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

    // ── close friends (private entries) ───────
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

    // ── dreams ─────────────────────────────────
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

    // ── blog posts ─────────────────────────────
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