import { initializeApp, getApps }     from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

const ADMIN_EMAIL = "mincruzm@gmail.com"; 

const app  = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let isAdmin = false;

onAuthStateChanged(auth, user => {
  isAdmin = !!(user && user.email === ADMIN_EMAIL);

  const composeBox = document.getElementById("compose-post");
  if (composeBox) composeBox.style.display = isAdmin ? "block" : "none";

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

function buildEmbedHtml(url) {
  if (/\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(url)) {
    return `<img src="${escHtml(url)}" alt="" loading="lazy"
      style="max-width:100%;border-radius:10px;margin-top:10px;display:block;">`;
  }

  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/);
  if (m) {
    return `<div style="margin-top:10px;border-radius:10px;overflow:hidden;position:relative;padding-top:56.25%;">
      <iframe src="https://www.youtube.com/embed/${m[1]}" title="YouTube video"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  }

  m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/);
  if (m) {
    const height = m[1] === "track" || m[1] === "episode" ? 152 : 352;
    return `<div style="margin-top:10px;border-radius:12px;overflow:hidden;">
      <iframe src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0"
        width="100%" height="${height}" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    </div>`;
  }

  return "";
}

function buildEmbeds(text) {
  const urls = [...text.matchAll(/(https?:\/\/[^\s<]+)/g)].map(m => m[1]);
  const seen = new Set();
  let html = "";
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    html += buildEmbedHtml(url);
  }
  return html;
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
    const embedsEl = infoDiv.querySelector(".post-embeds");
    if (embedsEl) embedsEl.innerHTML = buildEmbeds(newContent);
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
      <div class="post-embeds">${buildEmbeds(data.content || "")}</div>
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