import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, updateDoc, onSnapshot, increment, deleteField
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

console.log("[reactions] módulo carregado");

const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const db = getFirestore(app);

let isAdmin = false;
export function setReactionsAdmin(v) {
  isAdmin = !!v;
  document.body.classList.toggle("is-admin", isAdmin);
  document.querySelectorAll(".reactions-wrapper").forEach(w => {
    if (typeof w._rerender === "function") w._rerender();
  });
}
window.setReactionsAdmin = setReactionsAdmin;

const UNICODE_CATEGORIES = {
  faces: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","💩","🤡","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  hands: ["👋","🤚","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","💅"],
  animals: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐴","🦄","🐝","🐛","🦋","🐌","🐢","🐍","🦎","🐙","🐬","🐳","🐋","🦈"],
  food: ["🍎","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🥦","🌽","🥕","🥔","🍞","🧀","🥚","🍳","🥓","🍔","🍟","🍕","🌭","🍣","🍜","🍰","🎂","🍭","🍫","🍿","🍩","🍪","☕","🍵","🍺","🍷"],
  objects: ["🏠","🏡","🏢","🏥","🏦","🏨","🏫","🏰","⛪","🕌","🚂","🚗","🚕","🚌","🚑","🚒","🚓","🚲","🛴","✈️","🚀","🛸","⌚","📱","💻","📷","🎥","📺","🔦","💡","🔑","🚪"],
  symbols: ["⚽","🏀","🏈","⚾","🎾","🏐","🎱","🏓","🏸","🥊","🎯","🎮","🎲","🎰","🎨","🎬","🎤","🎧","🎸","🎹","🎺","🥁","🏆","🥇","🎖️","🎗️"],
  hearts: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","💕","💞","💓","💗","💖","💘","💝","✨","⭐","🌟","💫","⚡","🔥","💥","❄️","🌈","☀️","🌙"]
};

let reactionImagesPromise = null;

function loadReactionImages() {
  if (!reactionImagesPromise) {
    console.log("[reactions] buscando emotes.json...");
    reactionImagesPromise = fetch("emotes.json")
      .then(r => {
        console.log("[reactions] emotes.json status:", r.status);
        if (!r.ok) return { emotes: [] };
        return r.json();
      })
      .then(data => {
        const files = Array.isArray(data.emotes) ? data.emotes : [];
        console.log("[reactions] emotes.json carregado:", files.length, "arquivos");
        return files.map(f => ({
          id: "react_" + slug(f),
          name: f.replace(/\.[^.]+$/, ""),
          url: "imgs/emotes/" + f
        }));
      })
      .catch(err => {
        console.error("[reactions] ERRO no fetch do emotes.json:", err);
        return [];
      });
  }
  return reactionImagesPromise;
}

/**
 * Gera um id estável e único pra QUALQUER string,
 * inclusive emojis unicode (que não têm letras/números).
 */
function slug(str) {
  const s = String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (s) return s;

  // fallback: usa codepoints hexadecimais (únicos por emoji)
  return "u" + [...String(str)]
    .map(c => c.codePointAt(0).toString(16))
    .join("_");
}

function escId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function likedKey(t, r) {
  return `reaction_${t}_${r}`;
}

export async function mountReactions(container, opts = {}) {
  if (!container || !opts.targetId) return null;

  const targetId = escId(opts.targetId);
  console.log("[reactions] montando para targetId =", targetId);

  const imageReactions = await loadReactionImages();
  console.log("[reactions] imageReactions:", imageReactions.length);

  const optionsById = new Map();
  imageReactions.forEach(o => optionsById.set(o.id, o));

  const categories = {
    brilho: imageReactions,
    faces: UNICODE_CATEGORIES.faces.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    hands: UNICODE_CATEGORIES.hands.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    animals: UNICODE_CATEGORIES.animals.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    food: UNICODE_CATEGORIES.food.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    objects: UNICODE_CATEGORIES.objects.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    symbols: UNICODE_CATEGORIES.symbols.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    hearts: UNICODE_CATEGORIES.hearts.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e }))
  };

  Object.values(categories).forEach(list => {
    list.forEach(o => { if (!optionsById.has(o.id)) optionsById.set(o.id, o); });
  });

  const ADD_ICON = "imgs/emotes/add-reaction.png";

  container.innerHTML = `
    <div class="reactions-wrapper">
      <ul class="reactions-list"></ul>
      <button type="button" class="reaction-add-btn" title="Add reaction" aria-label="Add reaction">
        <img src="${ADD_ICON}" alt="add reaction">
      </button>
      <div class="reaction-picker"></div>
    </div>
  `;

  const wrapper = container.querySelector(".reactions-wrapper");
  const listEl = wrapper.querySelector(".reactions-list");
  const addBtn = wrapper.querySelector(".reaction-add-btn");
  const picker = wrapper.querySelector(".reaction-picker");
  const docRef = doc(db, "reactions", targetId);

  addBtn.querySelector("img").addEventListener("error", () => {
    addBtn.innerHTML = `<span style="color:#b5bac1;font-size:18px;">+</span>`;
  });

  function iconHtml(reactionId) {
    const opt = optionsById.get(reactionId);
    if (!opt) return reactionId;
    if (opt.url) return `<img src="${opt.url}" alt="">`;
    if (opt.emoji) return opt.emoji;
    return reactionId;
  }

  let lastCounts = {};

  function renderList(counts) {
    lastCounts = counts || {};
    listEl.innerHTML = "";

    Object.entries(lastCounts)
      // filtra: só > 0 E que existam em optionsById (ignora ids órfãos)
      .filter(([id, n]) => n > 0 && optionsById.has(id))
      .sort((a, b) => b[1] - a[1])
      .forEach(([reactionId, count]) => {
        const reacted = !!localStorage.getItem(likedKey(targetId, reactionId));
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reaction-chip" + (reacted ? " reacted" : "");
        btn.innerHTML =
          `<span class="reaction-icon">${iconHtml(reactionId)}</span>` +
          `<span class="reaction-count">${count}</span>` +
          `<button type="button" class="reaction-delete" title="delete">×</button>`;

        btn.addEventListener("click", e => {
          if (e.target.classList.contains("reaction-delete")) return;
          e.stopPropagation();
          toggleReaction(reactionId);
        });

        btn.querySelector(".reaction-delete").addEventListener("click", async e => {
          e.stopPropagation();
          e.preventDefault();
          if (!isAdmin) return;
          if (!confirm("Apagar essa reação?")) return;
          try {
            await setDoc(docRef, {}, { merge: true });
            await updateDoc(docRef, { [`counts.${reactionId}`]: deleteField() });
          } catch (err) { console.error(err); }
        });

        li.appendChild(btn);
        listEl.appendChild(li);
      });
  }

  async function toggleReaction(reactionId) {
    console.log("[reactions] toggle", targetId, reactionId);
    const key = likedKey(targetId, reactionId);
    const already = !!localStorage.getItem(key);
    already ? localStorage.removeItem(key) : localStorage.setItem(key, "1");
    try {
      await setDoc(docRef, {}, { merge: true });
      await updateDoc(docRef, { [`counts.${reactionId}`]: increment(already ? -1 : 1) });
      console.log("[reactions] salvo", already ? -1 : 1);
    } catch (err) {
      console.error("[reactions] ERRO ao reagir:", err);
      already ? localStorage.setItem(key, "1") : localStorage.removeItem(key);
    }
  }

  onSnapshot(docRef,
    snap => {
      const data = snap.exists() ? snap.data() : {};
      console.log("[reactions] snapshot", targetId, data.counts || {});
      renderList(data.counts || {});
    },
    err => console.error("[reactions] ERRO snapshot:", err)
  );

  wrapper._rerender = () => renderList(lastCounts);

  picker.innerHTML = `
    <div class="picker-header">
      <input type="text" class="picker-search" placeholder="Search">
      <span class="picker-handwave">👋</span>
    </div>
    <div class="picker-tabs">
      <button type="button" class="picker-tab-btn active" data-cat="brilho">✨</button>
      <button type="button" class="picker-tab-btn" data-cat="faces">😀</button>
      <button type="button" class="picker-tab-btn" data-cat="hands">👋</button>
      <button type="button" class="picker-tab-btn" data-cat="animals">🐱</button>
      <button type="button" class="picker-tab-btn" data-cat="food">🍎</button>
      <button type="button" class="picker-tab-btn" data-cat="objects">🏠</button>
      <button type="button" class="picker-tab-btn" data-cat="symbols">⚽</button>
      <button type="button" class="picker-tab-btn" data-cat="hearts">❤️</button>
    </div>
    <div class="picker-body"><div class="picker-grid"></div></div>
    <div class="picker-footer">
      <span>powered by</span>
      <b>Widget <svg class="star-icon" viewBox="0 0 24 24"><path d="M12 2l2.9 6.26 6.85.6-5.18 4.55 1.55 6.7L12 16.77 5.88 20.1l1.55-6.7L2.25 8.86l6.85-.6L12 2z"/></svg> Star</b>
    </div>
  `;

  const searchEl = picker.querySelector(".picker-search");
  const gridEl = picker.querySelector(".picker-grid");
  const tabBtns = [...picker.querySelectorAll(".picker-tab-btn")];
  let currentCat = "brilho";

  function renderGrid() {
    const q = searchEl.value.trim().toLowerCase();
    let items = categories[currentCat] || [];
    if (q) {
      const all = [];
      Object.values(categories).forEach(l => all.push(...l));
      items = all.filter(it => (it.name || "").toLowerCase().includes(q));
    }
    console.log("[reactions] renderGrid cat =", currentCat, "itens =", items.length);
    gridEl.innerHTML = "";
    if (!items.length) {
      gridEl.innerHTML = `<div class="picker-empty">nada encontrado</div>`;
      return;
    }
    items.forEach(it => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-item-btn";
      btn.title = it.name || "";
      if (it.url) btn.innerHTML = `<img src="${it.url}" alt="">`;
      else btn.textContent = it.emoji || it.name || "";
      btn.addEventListener("click", () => {
        optionsById.set(it.id, it);
        toggleReaction(it.id);
        closePicker();
      });
      gridEl.appendChild(btn);
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCat = btn.dataset.cat;
      searchEl.value = "";
      renderGrid();
    });
  });

  function positionPicker() {
    const r = addBtn.getBoundingClientRect();
    picker.style.visibility = "hidden";
    picker.style.display = "flex";
    const pw = picker.offsetWidth, ph = picker.offsetHeight;
    picker.style.display = "";
    picker.style.visibility = "";
    let left = r.left + r.width / 2 - pw / 2;
    const m = 8;
    if (left < m) left = m;
    if (left + pw > innerWidth - m) left = innerWidth - m - pw;
    let top = r.bottom + 8;
    if (top + ph > innerHeight - m) {
      const a = r.top - ph - 8;
      top = a > m ? a : m;
    }
    picker.style.left = left + "px";
    picker.style.top = top + "px";
  }

  searchEl.addEventListener("click", e => e.stopPropagation());
  searchEl.addEventListener("input", renderGrid);

  function openPicker() {
    console.log("[reactions] openPicker");
    renderGrid();
    picker.classList.add("open");
    positionPicker();
    window.addEventListener("scroll", positionPicker, true);
    window.addEventListener("resize", positionPicker);
  }
  function closePicker() {
    picker.classList.remove("open");
    window.removeEventListener("scroll", positionPicker, true);
    window.removeEventListener("resize", positionPicker);
  }

  addBtn.addEventListener("click", e => {
    e.stopPropagation();
    console.log("[reactions] clique no add");
    picker.classList.contains("open") ? closePicker() : openPicker();
  });

  document.addEventListener("click", e => {
    if (!wrapper.contains(e.target) && !picker.contains(e.target)) closePicker();
  });

  return { wrapper };
}

console.log("[reactions] módulo pronto");