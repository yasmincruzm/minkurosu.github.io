
import { initializeApp, getApps }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBn3bPbxmRYX5nZ4mj1L8e4hLoUX0ywHcQ",
  authDomain: "minkurosu-site.firebaseapp.com",
  projectId: "minkurosu-site",
  storageBucket: "minkurosu-site.appspot.com",
  messagingSenderId: "397200745609",
  appId: "1:397200745609:web:b0f4a3e1c2d5f6a7b8c9d0"
};

const ADMIN_EMAIL = "minkurosu@gmail.com"; // ← seu e-mail

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const STYLES = `
  #pc-fab {
    position: fixed;
    bottom: 28px;
    right: 28px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #3BB9E3;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: background 0.2s, transform 0.15s;
  }
  #pc-fab:hover { background: #2da0c7; transform: scale(1.07); }
  #pc-fab svg { width: 24px; height: 24px; fill: #1A1A1A; }

  #pc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #pc-modal {
    background: #1A1A1A;
    border: 1px solid #3A3A3A;
    border-radius: 14px;
    padding: 22px 22px 18px;
    width: 480px;
    max-width: calc(100vw - 32px);
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    animation: pcIn 0.2s ease;
  }
  @keyframes pcIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  #pc-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  #pc-header img {
    width: 42px; height: 42px;
    border-radius: 50%; object-fit: cover;
  }
  #pc-header span {
    color: #E1E8ED;
    font-size: 15px;
    font-weight: bold;
    font-family: "Helvetica Neue", Arial, sans-serif;
  }

  #pc-textarea {
    width: 100%;
    min-height: 100px;
    background: #252525;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    padding: 12px;
    color: #E1E8ED;
    font-size: 15px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    resize: vertical;
    outline: none;
    line-height: 1.5;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  #pc-textarea:focus { border-color: #3BB9E3; }
  #pc-textarea::placeholder { color: #555; }

  #pc-image-url {
    width: 100%;
    background: #252525;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    padding: 10px 12px;
    color: #E1E8ED;
    font-size: 13px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  #pc-image-url:focus { border-color: #3BB9E3; }
  #pc-image-url::placeholder { color: #555; }

  #pc-footer {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  #pc-chars {
    flex: 1;
    font-size: 12px;
    color: #555;
    font-family: "Helvetica Neue", Arial, sans-serif;
  }
  #pc-chars.warn { color: #E0245E; }

  #pc-cancel {
    background: transparent;
    border: 1px solid #3A3A3A;
    color: #B3B3B3;
    border-radius: 20px;
    padding: 8px 18px;
    cursor: pointer;
    font-size: 14px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    transition: border-color 0.2s, color 0.2s;
  }
  #pc-cancel:hover { border-color: #6A6A6A; color: #E1E8ED; }

  #pc-submit {
    background: #3BB9E3;
    border: none;
    color: #1A1A1A;
    border-radius: 20px;
    padding: 8px 22px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    font-family: "Helvetica Neue", Arial, sans-serif;
    transition: background 0.2s;
  }
  #pc-submit:hover { background: #2da0c7; }
  #pc-submit:disabled { background: #1e7a99; cursor: not-allowed; }

  #pc-status {
    font-size: 13px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    text-align: center;
    min-height: 18px;
  }
  #pc-status.ok  { color: #6abf6a; }
  #pc-status.err { color: #bf6a6a; }
`;

let styleEl = null;

function mountComposer() {
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  const fab = document.createElement("button");
  fab.id = "pc-fab";
  fab.title = "novo post";
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
      <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34
               a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  `;
  document.body.appendChild(fab);

  const overlay = document.createElement("div");
  overlay.id = "pc-overlay";
  overlay.innerHTML = `
    <div id="pc-modal">
      <div id="pc-header">
        <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
        <span>min*</span>
      </div>
      <textarea id="pc-textarea" placeholder="o que está acontecendo?"></textarea>
      <input id="pc-image-url" type="url" placeholder="URL de imagem (opcional)">
      <div id="pc-footer">
        <span id="pc-chars">0 / 280</span>
        <button id="pc-cancel">cancelar</button>
        <button id="pc-submit" disabled>postar</button>
      </div>
      <div id="pc-status"></div>
    </div>
  `;

  fab.addEventListener("click", () => {
    document.body.appendChild(overlay);
    document.getElementById("pc-textarea").focus();
  });

  function closeModal() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.getElementById("pc-textarea").value = "";
    document.getElementById("pc-image-url").value = "";
    document.getElementById("pc-chars").textContent = "0 / 280";
    document.getElementById("pc-chars").classList.remove("warn");
    document.getElementById("pc-status").textContent = "";
    document.getElementById("pc-status").className = "";
    document.getElementById("pc-submit").disabled = true;
  }

  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModal();
  });

  overlay.addEventListener("click", e => {
    if (e.target.id === "pc-cancel") closeModal();
  });

  overlay.addEventListener("input", e => {
    if (e.target.id !== "pc-textarea") return;
    const len = e.target.value.length;
    const chars = document.getElementById("pc-chars");
    chars.textContent = `${len} / 280`;
    chars.classList.toggle("warn", len > 280);
    document.getElementById("pc-submit").disabled = len === 0 || len > 280;
  });

  overlay.addEventListener("click", async e => {
    if (e.target.id !== "pc-submit") return;
    const text = document.getElementById("pc-textarea").value.trim();
    if (!text) return;

    const submitBtn = document.getElementById("pc-submit");
    const status    = document.getElementById("pc-status");
    submitBtn.disabled = true;
    status.textContent = "publicando…";
    status.className = "";

    try {
      const postData = { text, timestamp: serverTimestamp(), likes: 0 };
      const imgUrl = document.getElementById("pc-image-url").value.trim();
      if (imgUrl) postData.imageUrl = imgUrl;

      await addDoc(collection(db, "tweets"), postData);

      status.textContent = "publicado!";
      status.className = "ok";
      setTimeout(closeModal, 900);
    } catch (err) {
      console.error(err);
      status.textContent = "erro ao publicar. tente novamente.";
      status.className = "err";
      submitBtn.disabled = false;
    }
  });
}

function unmountComposer() {
  ["pc-fab", "pc-overlay"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

onAuthStateChanged(auth, user => {
  unmountComposer(); 
  if (user && user.email === ADMIN_EMAIL) {
    mountComposer();
  }
});