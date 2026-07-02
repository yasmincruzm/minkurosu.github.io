import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
  authDomain: "minkurosu.firebaseapp.com",
  projectId: "minkurosu",
  storageBucket: "minkurosu.firebasestorage.app",
  messagingSenderId: "290821725607",
  appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
  measurementId: "G-M7PWC6DDRH"
};

const ADMIN_EMAIL = "mincruzm@gmail.com";

const app      = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

window.mkuAuth = auth;
window.isSiteAdmin = false;

const style = document.createElement("style");
style.textContent = `
  #site-login-btn {
    display: block;
    margin: 6px auto 0;
    background: none;
    border: 1px solid #555;
    color: #888;
    font-family: "MinFont", sans-serif;
    font-size: 10px;
    padding: 2px 6px;
    cursor: pointer;
    letter-spacing: 0.05em;
    opacity: 0.6;
    transition: opacity 0.2s, color 0.2s;
  }
  #site-login-btn:hover { opacity: 1; color: #ccc; }

  #mku-login-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 9999;
    align-items: center;
    justify-content: center;
  }
  #mku-login-overlay.open { display: flex; }

  #mku-login-modal {
    background-color: #24211e;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 30px 28px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    max-width: 380px;
    width: 90%;
    border: 1px solid #534F4A;
    gap: 14px;
    position: relative;
    font-family: "MinFont", monospace;
  }
  #mku-login-modal h1 {
    margin: 0 0 10px 0;
    color: #d5d5d5;
    font-family: "MinFont", monospace;
    text-align: center;
    font-size: 1.8em;
    letter-spacing: 1px;
    width: 100%;
  }
  #mku-login-close {
    position: absolute;
    top: 10px; right: 12px;
    background: none;
    border: none;
    color: #888;
    font-size: 18px;
    cursor: pointer;
    width: auto;
    padding: 0;
  }
  #mku-login-modal .field {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 6px;
  }
  #mku-login-modal label {
    font-weight: bold;
    color: #888;
    font-family: "MinFont", monospace;
    font-size: 0.9em;
  }
  #mku-login-modal input {
    padding: 11px 13px;
    border: 1px solid #3a3632;
    border-radius: 6px;
    font-size: 0.95em;
    font-family: "MinFont", monospace;
    background-color: #1a1815;
    color: #d5d5d5;
    width: 100%;
    outline: none;
  }
  #mku-login-modal input:focus { border-color: #6C6661; }
  #mku-login-modal button[type="submit"],
  #mku-login-modal #mku-google-btn {
    padding: 11px 20px;
    background-color: #333;
    color: #d5d5d5;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1em;
    font-family: "MinFont", monospace;
    font-weight: bold;
    width: 100%;
    transition: background-color 0.25s;
  }
  #mku-login-modal button[type="submit"]:hover,
  #mku-login-modal #mku-google-btn:hover { background-color: #6C6661; }
  #mku-login-modal .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 2px 0;
  }
  #mku-login-modal .divider::before,
  #mku-login-modal .divider::after {
    content: '';
    flex: 1;
    border-top: 1px solid #3a3632;
  }
  #mku-login-modal .divider span {
    color: #4a4642;
    font-size: 0.8em;
    letter-spacing: 1px;
  }
  #mku-google-btn {
    background-color: #1e1b18 !important;
    border: 1px solid #534F4A !important;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  #mku-google-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
  #mku-login-message {
    width: 100%;
    text-align: center;
    font-size: 0.85em;
    border-radius: 6px;
  }
  #mku-login-message:empty { display: none; }
  #mku-login-message.success { background: #1e2a1e; border: 1px solid #2e4a2e; color: #6abf6a; padding: 10px 12px; }
  #mku-login-message.error   { background: #2a1e1e; border: 1px solid #4a2e2e; color: #bf6a6a; padding: 10px 12px; }
`;
document.head.appendChild(style);

function buildModal() {
  if (document.getElementById("mku-login-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "mku-login-overlay";
  overlay.innerHTML = `
    <div id="mku-login-modal">
      <button type="button" id="mku-login-close">✕</button>
      <h1>login</h1>
      <form id="mku-login-form" style="width:100%; display:flex; flex-direction:column; gap:14px;">
        <div class="field">
          <label for="mku-login-email">email:</label>
          <input type="email" id="mku-login-email" required>
        </div>
        <div class="field">
          <label for="mku-login-password">senha:</label>
          <input type="password" id="mku-login-password" required>
        </div>
        <button type="submit">entrar</button>
      </form>
      <div class="divider"><span>ou</span></div>
      <button type="button" id="mku-google-btn">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        entrar com google
      </button>
      <div id="mku-login-message"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector("#mku-login-message");
  const setMsg = (text, type) => {
    msgEl.textContent = text;
    msgEl.className = type || "";
  };

  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector("#mku-login-close").addEventListener("click", closeModal);

  overlay.querySelector("#mku-login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = overlay.querySelector("#mku-login-email").value;
    const pass  = overlay.querySelector("#mku-login-password").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (cred.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setMsg("acesso negado.", "error");
        return;
      }
      closeModal();
    } catch (err) {
      setMsg(`erro: ${err.message}`, "error");
    }
  });

  overlay.querySelector("#mku-google-btn").addEventListener("click", async () => {
    try {
      const cred = await signInWithPopup(auth, provider);
      if (cred.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setMsg("acesso negado. use sua conta autorizada.", "error");
        return;
      }
      closeModal();
    } catch (err) {
      setMsg(`erro: ${err.message}`, "error");
    }
  });
}

function openModal() {
  buildModal();
  document.getElementById("mku-login-overlay").classList.add("open");
}
function closeModal() {
  const overlay = document.getElementById("mku-login-overlay");
  if (overlay) overlay.classList.remove("open");
}

function injectTrigger() {
  if (document.getElementById("site-login-btn")) return;
  const anchor = document.getElementById("crt-toggle");
  if (!anchor || !anchor.parentNode) return;

  const btn = document.createElement("button");
  btn.id = "site-login-btn";
  btn.type = "button";
  btn.textContent = "entrar";
  anchor.parentNode.insertBefore(btn, anchor.nextSibling);

  btn.addEventListener("click", () => {
    if (window.isSiteAdmin) {
      signOut(auth);
    } else {
      openModal();
    }
  });
}

onAuthStateChanged(auth, user => {
  window.isSiteAdmin = !!(user && user.email === ADMIN_EMAIL);
  const btn = document.getElementById("site-login-btn");
  if (btn) btn.textContent = window.isSiteAdmin ? "sair" : "entrar";
  window.dispatchEvent(new CustomEvent("mku-auth-change", { detail: { isAdmin: window.isSiteAdmin } }));
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectTrigger);
} else {
  injectTrigger();
}
