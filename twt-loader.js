import { initializeApp, getApps }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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

async function createTweet() {
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
      imageUrl: imageUrl || null,
      likes: 0,
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

const composeSubmitBtn = document.getElementById("compose-submit");
if (composeSubmitBtn) {
  composeSubmitBtn.addEventListener("click", createTweet);
}

async function deleteTweet(id, liEl) {
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

async function saveEdit(id, liEl, newText) {
  try {
    await updateDoc(doc(db, "posts", id), { content: newText });
  } catch (err) {
    console.error("Erro ao editar:", err);
    alert("Não foi possível editar o post.");
  }
}

function enterEditMode(id, liEl, currentText) {
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
  textarea.value = currentText;

  form.querySelector(".edit-cancel").addEventListener("click", e => {
    e.stopPropagation();
    form.remove();
    pEl.style.display = "";
  });

  form.querySelector(".edit-save").addEventListener("click", async e => {
    e.stopPropagation();
    const newText = textarea.value.trim();
    if (!newText) return;

    await saveEdit(id, liEl, newText);
    pEl.innerHTML = linkify(newText);
    form.remove();
    pEl.style.display = "";
  });

  infoDiv.appendChild(form);
}

function buildTweetEl(id, data) {
  const li = document.createElement("li");

  const imgHtml = data.imageUrl
    ? `<img src="${escHtml(data.imageUrl)}" alt=""
         style="max-width:100%;border-radius:10px;margin-top:10px;">`
    : "";

  li.innerHTML = `
    <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
    <div class="info">
      <strong>min* <span>@minkurosu · ${formatDate(data.timestamp)}</span></strong>
      <p>${linkify(data.content)}</p>
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
      deleteTweet(id, li);
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
    <span class="like-count">${data.likes ?? 0}</span>
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

    const countEl = likeBtn.querySelector(".like-count");
    countEl.textContent = parseInt(countEl.textContent) + delta;

    try {
      await updateDoc(doc(db, "posts", id), { likes: increment(delta) });
    } catch {
      likeBtn.classList.toggle("liked");
      countEl.textContent = parseInt(countEl.textContent) - delta;
    }
  });

  actionsDiv.appendChild(likeBtn);
  li.appendChild(actionsDiv);

  return li;
}

const container = document.getElementById("tweets-container");
let cachedDocs = [];

function rerenderAll() {
  if (!container || cachedDocs.length === 0) return;
  container.innerHTML = "";
  cachedDocs.forEach(({ id, data }) => {
    container.appendChild(buildTweetEl(id, data));
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
      container.appendChild(buildTweetEl(docSnap.id, data));
    });
  }, err => {
    console.error("twt-loader snapshot error:", err);
    container.innerHTML = `
      <li style="justify-content:center;padding:20px;color:#bf6a6a;">
        erro ao carregar posts.
      </li>`;
  });
}