import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
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

const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const db = getFirestore(app);

let reactionImagesPromise = null;

function loadReactionImages() {
  if (!reactionImagesPromise) {
    reactionImagesPromise = fetch("emotes.json")
      .then(r => (r.ok ? r.json() : { emotes: [] }))
      .then(data => {
        const files = Array.isArray(data.emotes) ? data.emotes : [];
        return files.map(filename => ({
          id: "react_" + slug(filename),
          name: filename.replace(/\.[^.]+$/, ""),
          url: "imgs/emotes/" + filename
        }));
      })
      .catch(() => []);
  }
  return reactionImagesPromise;
}

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function likedKey(targetId, reactionId) {
  return `mink_reacted_${targetId}_${reactionId}`;
}

export async function mountReactions(container, opts = {}) {
  if (!container || !opts.targetId) return null;

  const targetId = escId(opts.targetId);
  const imageReactions = await loadReactionImages();
  const optionsById = new Map();
  imageReactions.forEach(o => optionsById.set(o.id, o));

  const ADD_ICON = container.dataset.addIcon || "imgs/emotes/add-reaction.png";

  container.innerHTML = `
    <div class="mink-reactions-wrapper">
      <ul class="mink-reactions-list"></ul>
      <button type="button" class="mink-reaction-add-btn" title="Add reaction" aria-label="Add reaction">
        <img src="${ADD_ICON}" alt="add reaction">
      </button>
      <div class="mink-reaction-picker"></div>
    </div>
  `;

  const wrapper = container.querySelector(".mink-reactions-wrapper");
  const listEl  = wrapper.querySelector(".mink-reactions-list");
  const addBtn  = wrapper.querySelector(".mink-reaction-add-btn");
  const picker  = wrapper.querySelector(".mink-reaction-picker");
  const docRef  = doc(db, "reactions", targetId);

  addBtn.querySelector("img").addEventListener("error", () => {
    addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none"/>
        <path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/>
        <path d="M19 3v6M16 6h6" stroke-width="2"/>
      </svg>
    `;
  });

  function iconHtml(reactionId) {
    const opt = optionsById.get(reactionId);
    if (opt && opt.url) return `<img src="${opt.url}" alt="${opt.name || ""}" loading="lazy">`;
    return reactionId;
  }

  function renderList(counts) {
    listEl.innerHTML = "";
    const entries = Object.entries(counts || {}).filter(([, n]) => n > 0);
    entries.sort((a, b) => b[1] - a[1]);
    entries.forEach(([reactionId, count]) => {
      const reacted = !!localStorage.getItem(likedKey(targetId, reactionId));
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mink-reaction-chip" + (reacted ? " mink-reacted" : "");
      btn.innerHTML = `<span class="mink-reaction-icon">${iconHtml(reactionId)}</span><span class="mink-reaction-count">${count}</span>`;
      btn.addEventListener("click", e => {
        e.stopPropagation();
        toggleReaction(reactionId);
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  async function toggleReaction(reactionId) {
    const key = likedKey(targetId, reactionId);
    const already = !!localStorage.getItem(key);
    already ? localStorage.removeItem(key) : localStorage.setItem(key, "1");
    try {
      await setDoc(docRef, {}, { merge: true });
      await updateDoc(docRef, { [`counts.${reactionId}`]: increment(already ? -1 : 1) });
    } catch (err) {
      console.error("[reactions] erro ao reagir:", err);
      already ? localStorage.setItem(key, "1") : localStorage.removeItem(key);
    }
  }

  onSnapshot(
    docRef,
    snap => renderList(snap.exists() ? snap.data().counts : {}),
    err => console.error("[reactions] erro ao carregar:", err)
  );

  picker.innerHTML = `
    <div class="mink-picker-header">
      <input type="text" class="mink-picker-search" placeholder="Add reaction">
    </div>
    <div class="mink-picker-body"><div class="mink-picker-grid"></div></div>
    <div class="mink-picker-footer">powered by <b>Widget⭐Star</b></div>
  `;

  const searchEl = picker.querySelector(".mink-picker-search");
  const gridEl   = picker.querySelector(".mink-picker-grid");

  function renderGrid() {
    const q = searchEl.value.trim().toLowerCase();
    let items = imageReactions;
    if (q) items = items.filter(it => (it.name || "").toLowerCase().includes(q));

    gridEl.innerHTML = "";
    if (!items.length) {
      gridEl.innerHTML = `<div class="mink-picker-empty">${
        imageReactions.length === 0
          ? "nenhum emote encontrado em emotes.json"
          : "nada encontrado"
      }</div>`;
      return;
    }
    items.forEach(it => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mink-picker-item-btn";
      btn.title = it.name || "";
      btn.innerHTML = `<img src="${it.url}" alt="${it.name || ""}" loading="lazy">`;
      btn.addEventListener("click", () => {
        optionsById.set(it.id, it);
        toggleReaction(it.id);
        closePicker();
      });
      gridEl.appendChild(btn);
    });
  }

  function positionPicker() {
    const btnRect = addBtn.getBoundingClientRect();
    picker.style.visibility = "hidden";
    picker.style.display = "flex";
    const pw = picker.offsetWidth;
    const ph = picker.offsetHeight;
    picker.style.display = "";
    picker.style.visibility = "";

    let left = btnRect.left + btnRect.width / 2 - pw / 2;
    const margin = 8;
    if (left < margin) left = margin;
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;

    let top = btnRect.bottom + 8;
    if (top + ph > window.innerHeight - margin) {
      const topAbove = btnRect.top - ph - 8;
      if (topAbove > margin) {
        top = topAbove;
      } else {
        top = margin;
      }
    }

    picker.style.left = left + "px";
    picker.style.top  = top + "px";
  }

  searchEl.addEventListener("click", e => e.stopPropagation());
  searchEl.addEventListener("input", renderGrid);

  function openPicker() {
    renderGrid();
    picker.classList.add("mink-open");
    positionPicker();
    // reposiciona em scroll/resize enquanto estiver aberto
    window.addEventListener("scroll", positionPicker, true);
    window.addEventListener("resize", positionPicker);
  }
  function closePicker() {
    picker.classList.remove("mink-open");
    window.removeEventListener("scroll", positionPicker, true);
    window.removeEventListener("resize", positionPicker);
  }

  addBtn.addEventListener("click", e => {
    e.stopPropagation();
    picker.classList.contains("mink-open") ? closePicker() : openPicker();
  });

  document.addEventListener("click", e => {
    if (!wrapper.contains(e.target) && !picker.contains(e.target)) closePicker();
  });

  return { wrapper };
}