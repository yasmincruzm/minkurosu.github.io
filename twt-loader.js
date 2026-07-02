import { initializeApp, getApps }     from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
};

const ADMIN_EMAIL = "mincruzm@gmail.com"; // ← mesmo e-mail do admin.js

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const provider = new GoogleAuthProvider();

let isAdmin = false;

onAuthStateChanged(auth, user => {
  isAdmin = !!(user && user.email === ADMIN_EMAIL);

  const composeBox = document.getElementById("compose-post");
  if (composeBox) composeBox.style.display = isAdmin ? "block" : "none";

  const loginBtn = document.getElementById("twt-login-btn");
  if (loginBtn) loginBtn.textContent = isAdmin ? "sair" : "entrar";

  rerenderAll();
});

const style = document.createElement("style");
style.textContent = `
  #thoughts-root #tweets-container li { position: relative; }

  .twt-menu-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    background: transparent;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 2px 8px;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
    z-index: 10;
  }
  .twt-menu-btn:hover { background: #2a2a2a; color: #E1E8ED; }

  .twt-dropdown {
    display: none;
    position: absolute;
    top: 34px;
    right: 12px;
    background: #252525;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    z-index: 20;
    min-width: 140px;
    overflow: hidden;
    animation: ddIn 0.15s ease;
  }
  @keyframes ddIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .twt-dropdown.open { display: block; }

  .twt-dropdown-btn {
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: #bf6a6a;
    font-size: 13px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s;
  }
  .twt-dropdown-btn:hover { background: #2a2020; }
  .twt-dropdown-btn svg {
    width: 14px; height: 14px;
    fill: none; stroke: currentColor; stroke-width: 2;
    flex-shrink: 0;
  }

  #compose-post {
    display: none;
    background: #1A1A1A;
    border-bottom: 1px solid #3A3A3A;
    padding: 15px;
  }
  #compose-post .compose-body {
    display: flex;
    gap: 10px;
  }
  #compose-post .compose-body img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  #compose-post .compose-fields {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  #compose-post textarea {
    width: 100%;
    background: transparent;
    border: none;
    resize: vertical;
    min-height: 60px;
    color: #E1E8ED;
    font-size: 15px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    outline: none;
  }
  #compose-post input[type="text"] {
    background: #252525;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    padding: 8px 10px;
    color: #E1E8ED;
    font-size: 13px;
    margin-top: 8px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  #compose-post .compose-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }
  #compose-post button {
    background: #3BB9E3;
    color: #FFF;
    border: none;
    border-radius: 16px;
    padding: 8px 18px;
    font-weight: bold;
    cursor: pointer;
  }
  #compose-post button:hover { background: #2da0c7; }
  #compose-post button:disabled { background: #2a4a56; cursor: default; }

  .edit-form { margin-top: 5px; }
  .edit-form textarea {
    width: 100%;
    background: #252525;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    padding: 10px;
    color: #E1E8ED;
    font-size: 14px;
    resize: vertical;
    min-height: 60px;
    margin-bottom: 8px;
    box-sizing: border-box;
  }
  .edit-form .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .edit-form .edit-save {
    background: #3BB9E3;
    color: #FFF;
    border: none;
    border-radius: 16px;
    padding: 6px 14px;
    font-weight: bold;
    cursor: pointer;
    font-size: 13px;
  }
  .edit-form .edit-cancel {
    background: transparent;
    color: #B3B3B3;
    border: 1px solid #3A3A3A;
    border-radius: 16px;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 13px;
  }

  #twt-login-btn {
    display: block;
    text-align: right;
    padding: 8px 15px;
    font-size: 12px;
    color: #667580;
    cursor: pointer;
    background: #1A1A1A;
    border-bottom: 1px solid #3A3A3A;
  }
  #twt-login-btn:hover { color: #3BB9E3; }

  #twt-login-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 9999;
    align-items: center;
    justify-content: center;
  }
  #twt-login-overlay.open { display: flex; }

  #twt-login-modal {
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
    font-family: "Helvetica Neue", Arial, sans-serif;
  }
  #twt-login-modal h1 {
    margin: 0 0 10px 0;
    color: #E1E8ED;
    text-align: center;
    font-size: 1.6em;
    letter-spacing: 1px;
    width: 100%;
  }
  #twt-login-close {
    position: absolute;
    top: 10px; right: 12px;
    background: none;
    border: none;
    color: #888;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
  }
  #twt-login-modal .field {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 6px;
  }
  #twt-login-modal label {
    font-weight: bold;
    color: #888;
    font-size: 0.85em;
  }
  #twt-login-modal input {
    padding: 11px 13px;
    border: 1px solid #3a3632;
    border-radius: 6px;
    font-size: 0.95em;
    background-color: #1a1815;
    color: #E1E8ED;
    width: 100%;
    outline: none;
    box-sizing: border-box;
  }
  #twt-login-modal input:focus { border-color: #6C6661; }
  #twt-login-modal button[type="submit"],
  #twt-google-btn {
    padding: 11px 20px;
    background-color: #3BB9E3;
    color: #FFF;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1em;
    font-weight: bold;
    width: 100%;
  }
  #twt-login-modal button[type="submit"]:hover { background-color: #2da0c7; }
  #twt-login-modal .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 2px 0;
  }
  #twt-login-modal .divider::before,
  #twt-login-modal .divider::after {
    content: '';
    flex: 1;
    border-top: 1px solid #3a3632;
  }
  #twt-login-modal .divider span {
    color: #4a4642;
    font-size: 0.8em;
    letter-spacing: 1px;
  }
  #twt-google-btn {
    background-color: #1e1b18 !important;
    border: 1px solid #534F4A !important;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  #twt-google-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
  #twt-login-message {
    width: 100%;
    text-align: center;
    font-size: 0.85em;
    border-radius: 6px;
  }
  #twt-login-message:empty { display: none; }
  #twt-login-message.error { background: #2a1e1e; border: 1px solid #4a2e2e; color: #bf6a6a; padding: 10px 12px; }
`;
document.head.appendChild(style);

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(text) {
  return escHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#3BB9E3;">$1</a>')
    .replace(/#(\w+)/g, '<span style="color:#3BB9E3;">#$1</span>');
}

async function createPost() {
  if (!isAdmin) return;

  const textEl = document.getElementById("compose-text");
  const imageEl = document.getElementById("compose-image");
  const submitBtn = document.getElementById("compose-submit");

  const content = textEl.value.trim();
  const imageUrl = imageEl.value.trim();

  if (!content && !imageUrl) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "postando...";

  try {
    await addDoc(collection(db, "posts"), {
      content,
      imageUrl: imageUrl || "",
      timestamp: serverTimestamp()
    });
    textEl.value = "";
    imageEl.value = "";
  } catch (err) {
    console.error("Erro ao postar:", err);
    alert("Não foi possível criar o post.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "postar";
  }
}

function buildLoginModal() {
  if (document.getElementById("twt-login-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "twt-login-overlay";
  overlay.innerHTML = `
    <div id="twt-login-modal">
      <button type="button" id="twt-login-close">✕</button>
      <h1>login</h1>
      <form id="twt-login-form" style="width:100%; display:flex; flex-direction:column; gap:14px;">
        <div class="field">
          <label for="twt-login-email">email:</label>
          <input type="email" id="twt-login-email" required>
        </div>
        <div class="field">
          <label for="twt-login-password">senha:</label>
          <input type="password" id="twt-login-password" required>
        </div>
        <button type="submit">entrar</button>
      </form>
      <div class="divider"><span>ou</span></div>
      <button type="button" id="twt-google-btn">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        entrar com google
      </button>
      <div id="twt-login-message"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector("#twt-login-message");
  const setMsg = text => { msgEl.textContent = text; msgEl.className = text ? "error" : ""; };

  const close = () => overlay.classList.remove("open");

  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  overlay.querySelector("#twt-login-close").addEventListener("click", close);

  overlay.querySelector("#twt-login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = overlay.querySelector("#twt-login-email").value;
    const pass  = overlay.querySelector("#twt-login-password").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (cred.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setMsg("acesso negado.");
        return;
      }
      close();
    } catch (err) {
      setMsg(`erro: ${err.message}`);
    }
  });

  overlay.querySelector("#twt-google-btn").addEventListener("click", async () => {
    try {
      const cred = await signInWithPopup(auth, provider);
      if (cred.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setMsg("acesso negado. use sua conta autorizada.");
        return;
      }
      close();
    } catch (err) {
      setMsg(`erro: ${err.message}`);
    }
  });
}

function injectLoginTrigger() {
  if (document.getElementById("twt-login-btn")) return;
  const container = document.getElementById("tweets-container");
  if (!container || !container.parentNode) return;

  const btn = document.createElement("div");
  btn.id = "twt-login-btn";
  btn.textContent = isAdmin ? "sair" : "entrar";
  container.parentNode.insertBefore(btn, container);

  btn.addEventListener("click", () => {
    if (isAdmin) {
      signOut(auth);
    } else {
      buildLoginModal();
      document.getElementById("twt-login-overlay").classList.add("open");
    }
  });
}

function injectComposeBox() {
  if (document.getElementById("compose-post")) return;
  const container = document.getElementById("tweets-container");
  if (!container || !container.parentNode) return;

  const box = document.createElement("div");
  box.id = "compose-post";
  box.innerHTML = `
    <div class="compose-body">
      <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
      <div class="compose-fields">
        <textarea id="compose-text" placeholder="o que você está pensando?"></textarea>
        <input type="text" id="compose-image" placeholder="URL da imagem (opcional)">
      </div>
    </div>
    <div class="compose-actions">
      <button id="compose-submit">postar</button>
    </div>
  `;
  container.parentNode.insertBefore(box, container);

  document.getElementById("compose-submit").addEventListener("click", createPost);
  box.style.display = isAdmin ? "block" : "none";
}

async function deletePost(id, liEl) {
  if (!confirm("Apagar este post?")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    liEl.style.transition = "opacity 0.3s";
    liEl.style.opacity = "0";
    setTimeout(() => liEl.remove(), 310);
  } catch (err) {
    console.error("Erro ao deletar:", err);
    alert("Não foi possível deletar o post.");
  }
}

async function saveEdit(id, newContent) {
  try {
    await updateDoc(doc(db, "posts", id), { content: newContent });
  } catch (err) {
    console.error("Erro ao editar:", err);
    alert("Não foi possível editar o post.");
  }
}

function enterEditMode(id, liEl, currentContent) {
  const infoDiv = liEl.querySelector(".info");
  const pEl = infoDiv.querySelector("p");
  if (!pEl) return;

  pEl.style.display = "none";

  const form = document.createElement("div");
  form.className = "edit-form";
  form.innerHTML = `
    <textarea class="edit-textarea"></textarea>
    <div class="edit-actions">
      <button class="edit-cancel">cancelar</button>
      <button class="edit-save">salvar</button>
    </div>
  `;

  const textarea = form.querySelector(".edit-textarea");
  textarea.value = currentContent;

  form.querySelector(".edit-cancel").addEventListener("click", e => {
    e.stopPropagation();
    form.remove();
    pEl.style.display = "";
  });

  form.querySelector(".edit-save").addEventListener("click", async e => {
    e.stopPropagation();
    const newContent = textarea.value.trim();
    if (!newContent) return;

    await saveEdit(id, newContent);
    pEl.innerHTML = linkify(newContent);
    form.remove();
    pEl.style.display = "";
  });

  infoDiv.appendChild(form);
}

function buildPostEl(id, data) {
  const li = document.createElement("li");

  const imgHtml = data.imageUrl
    ? `<img src="${escHtml(data.imageUrl)}" alt=""
         style="max-width:100%;border-radius:10px;margin-top:10px;">`
    : "";

  li.innerHTML = `
    <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
    <div class="info">
      <strong>min* <span>@minkurosu · ${formatDate(data.timestamp)}</span></strong>
      <p>${linkify(data.content || "")}</p>
      ${imgHtml}
    </div>
  `;

  if (isAdmin) {
    const menuBtn = document.createElement("button");
    menuBtn.className = "twt-menu-btn";
    menuBtn.title = "opções";
    menuBtn.setAttribute("aria-label", "opções do post");
    menuBtn.textContent = "⋯";

    const dropdown = document.createElement("div");
    dropdown.className = "twt-dropdown";

    const editBtn = document.createElement("button");
    editBtn.className = "twt-dropdown-btn";
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
      editar post
    `;
    editBtn.style.color = "#B3B3B3";

    editBtn.addEventListener("click", e => {
      e.stopPropagation();
      dropdown.classList.remove("open");
      enterEditMode(id, li, data.content || "");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "twt-dropdown-btn";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
      apagar post
    `;

    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      dropdown.classList.remove("open");
      deletePost(id, li);
    });

    dropdown.appendChild(editBtn);
    dropdown.appendChild(deleteBtn);
    menuBtn.appendChild(dropdown);

    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".twt-dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });

    document.addEventListener("click", () => dropdown.classList.remove("open"));

    li.appendChild(menuBtn);
  }

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "post-actions";

  const likeBtn = document.createElement("span");
  likeBtn.className = "action-button";
  likeBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
               a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84
               a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;

  const storageKey = `liked_${id}`;
  if (localStorage.getItem(storageKey)) likeBtn.classList.add("liked");

  likeBtn.addEventListener("click", async () => {
    const alreadyLiked = likeBtn.classList.contains("liked");
    likeBtn.classList.toggle("liked");
    const delta = alreadyLiked ? -1 : 1;
    alreadyLiked
      ? localStorage.removeItem(storageKey)
      : localStorage.setItem(storageKey, "1");

    try {
      await updateDoc(doc(db, "posts", id), { likes: increment(delta) });
    } catch {
      likeBtn.classList.toggle("liked");
    }
  });

  actionsDiv.appendChild(likeBtn);
  li.querySelector(".info").appendChild(actionsDiv);

  return li;
}

injectLoginTrigger();
injectComposeBox();

const container = document.getElementById("tweets-container");
let cachedDocs = [];

function rerenderAll() {
  if (!container || cachedDocs.length === 0) return;
  container.innerHTML = "";
  cachedDocs.forEach(({ id, data }) => {
    container.appendChild(buildPostEl(id, data));
  });
}

if (!container) {
  console.warn("twt-loader: #tweets-container não encontrado");
} else {
  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));

  onSnapshot(q, snapshot => {
    cachedDocs = [];
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `
        <li style="justify-content:center;padding:20px;color:#667580;">
          nenhum post ainda.
        </li>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      cachedDocs.push({ id: docSnap.id, data });
      container.appendChild(buildPostEl(docSnap.id, data));
    });
  }, err => {
    console.error("twt-loader snapshot error:", err);
    container.innerHTML = `
      <li style="justify-content:center;padding:20px;color:#bf6a6a;">
        erro ao carregar posts.
      </li>`;
  });
}