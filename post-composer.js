import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const ALLOWED_EMAIL = 'mincruzm@gmail.com';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82"
};

const app  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

const style = document.createElement('style');
style.textContent = `
#composer-wrapper {
    display: none;
    border-bottom: 1px solid #3A3A3A;
    padding: 14px 15px 10px;
}
#composer-wrapper.visible { display: block; }
#composer-box { display: flex; gap: 12px; align-items: flex-start; }
#composer-box img.composer-avatar {
    width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
}
#composer-inner { flex: 1; display: flex; flex-direction: column; gap: 10px; }
#composer-textarea {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid #3A3A3A; color: #E1E8ED;
    font-size: 16px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    resize: none; min-height: 60px; padding: 4px 0 8px; outline: none; line-height: 1.5;
}
#composer-textarea::placeholder { color: #444; }
#composer-footer { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
#composer-char-count { font-size: 12px; color: #667580; }
#composer-char-count.warn  { color: #e0a020; }
#composer-char-count.limit { color: #E0245E; }
#composer-submit {
    background: #3BB9E3; color: #1A1A1A; border: none;
    border-radius: 20px; padding: 8px 18px; font-size: 14px;
    font-weight: bold; cursor: pointer; transition: background 0.15s;
}
#composer-submit:hover:not(:disabled) { background: #2da0c7; }
#composer-submit:disabled { opacity: 0.4; cursor: default; }
#composer-logout-btn {
    display: none; background: none; border: 1px solid #3A3A3A;
    border-radius: 16px; color: #667580; font-size: 11px;
    padding: 3px 10px; cursor: pointer; margin: 0 15px 8px; float: right;
}
#composer-logout-btn.visible { display: inline-block; }
#composer-logout-btn:hover { color: #E1E8ED; }
`;
document.head.appendChild(style);

function injectComposerHTML() {
    const timeline = document.querySelector('#thoughts-root .timeline');
    if (!timeline) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'composer-wrapper';
    wrapper.innerHTML = `
        <div id="composer-box">
            <img class="composer-avatar" src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
            <div id="composer-inner">
                <textarea id="composer-textarea" placeholder="text" maxlength="500" rows="3"></textarea>
                <div id="composer-footer">
                    <span id="composer-char-count">500</span>
                    <button id="composer-submit" disabled>post</button>
                </div>
            </div>
        </div>
    `;

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'composer-logout-btn';
    logoutBtn.textContent = 'sair';

    const divider = timeline.querySelector('.timeline-divider');
    timeline.insertBefore(wrapper, divider);
    timeline.insertBefore(logoutBtn, divider);
}

function initComposer() {
    const textarea  = document.getElementById('composer-textarea');
    const submitBtn = document.getElementById('composer-submit');
    const charCount = document.getElementById('composer-char-count');
    const wrapper   = document.getElementById('composer-wrapper');
    const logoutBtn = document.getElementById('composer-logout-btn');
    const MAX = 500;

    textarea.addEventListener('input', () => {
        const left = MAX - textarea.value.length;
        charCount.textContent = left;
        charCount.className = left <= 20 ? 'limit' : left <= 60 ? 'warn' : '';
        submitBtn.disabled = textarea.value.trim().length === 0;
    });

    submitBtn.addEventListener('click', async () => {
        const content = textarea.value.trim();
        if (!content) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'postando...';
        try {
            await addDoc(collection(db, 'posts'), {
                content,
                imageUrl: '',
                likeCount: 0,
                timestamp: serverTimestamp()
            });
            textarea.value = '';
            charCount.textContent = MAX;
            charCount.className = '';
        } catch (err) {
            console.error('erro ao postar:', err);
            alert('não foi possível postar.');
        } finally {
            submitBtn.textContent = 'post';
            submitBtn.disabled = true;
        }
    });

    logoutBtn.addEventListener('click', () => signOut(auth));

    onAuthStateChanged(auth, (user) => {
        const isOwner = user?.email === ALLOWED_EMAIL;
        wrapper.classList.toggle('visible', isOwner);
        logoutBtn.classList.toggle('visible', isOwner);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectComposerHTML(); initComposer(); });
} else {
    injectComposerHTML();
    initComposer();
}