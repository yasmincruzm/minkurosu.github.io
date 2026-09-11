import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  deleteField
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

export function setReactionsAdmin(value) {
  isAdmin = !!value;
  console.log("[reactions] setReactionsAdmin →", isAdmin);
  document.body.classList.toggle("is-admin", isAdmin);
  document.querySelectorAll(".reactions-wrapper").forEach(w => {
    if (typeof w._rerender === "function") w._rerender();
  });
}
window.setReactionsAdmin = setReactionsAdmin;

const UNICODE_CATEGORIES = {
  faces: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😶‍🌫️","😏","😒","🙄","😬","😮‍💨","🤥","🙂‍↔️","🙂‍↕️","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","😵‍💫","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🫩","🫨","🫠","🫢","🫣","🫡","🫥"],
  hands: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","🫷","🫸","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁️","👅","👄","🫦"],
  animals: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐻‍❄️","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🕸️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔"],
  food: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🫘","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕","🍵","🧃","🥤","🧋","🫙","🍶","🍺","🍻","🥂","🍷","🥃"],
  objects: ["🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🕍","🛕","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆","🌇","🌉","🎠","🎡","🎢","💈","🎪","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🚛","🚜","🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","🛢️","⛽","🚨","🚥","🚦","🛑","🚧","⚓","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🪐","🌠","🌌"],
  symbols: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🪈","🪇","🎲","♟️","🎯","🎳","🎮","🕹️","🎰","🧩"],
  objects2: ["⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","🪪","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","🪬","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","🩻","🩼","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪","🪑"],
  symbols2: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","♦️","♠️","♣️","🃏","🀄","🎴","💯","💢","💥","💫","💦","💨","🕳️","💬","👁️‍🗨️","🗨️","🗯️","💭","💤","✨","⭐","🌟","💫","⚡","🔥","💥","❄️","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","🌀","🌈","🌂","☂️","☔","⛱️","⚡","❄️","☄️","🔥","🌊","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","⛎","🔀","🔁","🔂","▶️","⏩","⏭️","⏯️","◀️","⏪","⏮️","🔼","⏫","🔽","⏬","⏸️","⏹️","⏺️","⏏️","🎦","🔅","🔆","📶","🛜","📳"]
};

let reactionImagesPromise = null;

function loadReactionImages() {
  if (!reactionImagesPromise) {
    reactionImagesPromise = fetch("emotes.json")
      .then(r => (r.ok ? r.json() : { emotes: [] }))
      .then(data => {
        const files = Array.isArray(data.emotes) ? data.emotes : [];
        console.log("[reactions] emotes.json carregado:", files.length, "arquivos");
        return files.map(filename => ({
          id: "react_" + slug(filename),
          name: filename.replace(/\.[^.]+$/, ""),
          url: "imgs/emotes/" + filename
        }));
      })
      .catch(err => {
        console.error("[reactions] erro ao carregar emotes.json:", err);
        return [];
      });
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
  return `reaction_${targetId}_${reactionId}`;
}

export async function mountReactions(container, opts = {}) {
  if (!container || !opts.targetId) {
    console.warn("[reactions] mountReactions chamado sem container ou targetId", container, opts);
    return null;
  }

  const targetId = escId(opts.targetId);
  console.log("[reactions] montando para targetId =", targetId);

  const imageReactions = await loadReactionImages();

  const optionsById = new Map();
  imageReactions.forEach(o => optionsById.set(o.id, o));

  const categories = {
    brilho: imageReactions,
    faces:    UNICODE_CATEGORIES.faces.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    hands:    UNICODE_CATEGORIES.hands.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    animals:  UNICODE_CATEGORIES.animals.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    food:     UNICODE_CATEGORIES.food.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    objects:  UNICODE_CATEGORIES.objects.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    symbols:  UNICODE_CATEGORIES.symbols.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    objects2: UNICODE_CATEGORIES.objects2.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e })),
    symbols2: UNICODE_CATEGORIES.symbols2.map(e => ({ id: "emoji_" + slug(e), name: e, emoji: e }))
  };

  Object.values(categories).forEach(list => {
    list.forEach(o => { if (!optionsById.has(o.id)) optionsById.set(o.id, o); });
  });

  const ADD_ICON = container.dataset.addIcon || "imgs/emotes/add-reaction.png";

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
  const listEl  = wrapper.querySelector(".reactions-list");
  const addBtn  = wrapper.querySelector(".reaction-add-btn");
  const picker  = wrapper.querySelector(".reaction-picker");
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
    if (!opt) return reactionId;
    if (opt.url) return `<img src="${opt.url}" alt="${opt.name || ""}" loading="lazy">`;
    if (opt.emoji) return opt.emoji;
    return reactionId;
  }

  let lastCounts = {};

  function renderList(counts) {
    lastCounts = counts || {};
    listEl.innerHTML = "";
    const entries = Object.entries(lastCounts).filter(([, n]) => n > 0);
    entries.sort((a, b) => b[1] - a[1]);
    entries.forEach(([reactionId, count]) => {
      const reacted = !!localStorage.getItem(likedKey(targetId, reactionId));
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "reaction-chip" + (reacted ? " reacted" : "");
      btn.dataset.reactionId = reactionId;
      btn.innerHTML =
        `<span class="reaction-icon">${iconHtml(reactionId)}</span>` +
        `<span class="reaction-count">${count}</span>` +
        `<button type="button" class="reaction-delete" title="delete reaction">×</button>`;

      btn.addEventListener("click", e => {
        if (e.target.classList.contains("reaction-delete")) return;
        e.stopPropagation();
        toggleReaction(reactionId);
      });

      const delBtn = btn.querySelector(".reaction-delete");
      delBtn.addEventListener("click", async e => {
        e.stopPropagation();
        e.preventDefault();
        if (!isAdmin) return;
        if (!confirm("Apagar essa reação para todo mundo?")) return;
        try {
          await setDoc(docRef, {}, { merge: true });
          await updateDoc(docRef, { [`counts.${reactionId}`]: deleteField() });
        } catch (err) {
          console.error("[reactions] erro ao apagar:", err);
          alert("erro ao apagar reação");
        }
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
    } catch (err) {
      console.error("[reactions] erro ao reagir:", err);
      already ? localStorage.setItem(key, "1") : localStorage.removeItem(key);
    }
  }

  onSnapshot(
    docRef,
    snap => {
      const data = snap.exists() ? snap.data() : {};
      console.log("[reactions] snapshot", targetId, data.counts || {});
      renderList(data.counts || {});
    },
    err => console.error("[reactions] erro no snapshot:", err)
  );

  wrapper._rerender = () => renderList(lastCounts);

  picker.innerHTML = `
    <div class="picker-header">
      <input type="text" class="picker-search" placeholder="Search">
      <span class="picker-handwave">👋</span>
    </div>
    <div class="picker-tabs">
      <button type="button" class="picker-tab-btn active" data-cat="brilho" title="brilho">✨</button>
      <button type="button" class="picker-tab-btn" data-cat="faces" title="faces">😀</button>
      <button type="button" class="picker-tab-btn" data-cat="hands" title="hands">👋</button>
      <button type="button" class="picker-tab-btn" data-cat="animals" title="animals">🐱</button>
      <button type="button" class="picker-tab-btn" data-cat="food" title="food">🍎</button>
      <button type="button" class="picker-tab-btn" data-cat="objects" title="objects">🏠</button>
      <button type="button" class="picker-tab-btn" data-cat="symbols" title="symbols">⚽</button>
      <button type="button" class="picker-tab-btn" data-cat="objects2" title="objects">💡</button>
      <button type="button" class="picker-tab-btn" data-cat="symbols2" title="symbols">❤️</button>
    </div>
    <div class="picker-body"><div class="picker-grid"></div></div>
    <div class="picker-footer">
      <span>powered by</span>
      <b>
        Widget
        <svg class="star-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l2.9 6.26 6.85.6-5.18 4.55 1.55 6.7L12 16.77 5.88 20.1l1.55-6.7L2.25 8.86l6.85-.6L12 2z"/>
        </svg>
        Star
      </b>
    </div>
  `;

  const searchEl = picker.querySelector(".picker-search");
  const gridEl   = picker.querySelector(".picker-grid");
  const tabBtns  = [...picker.querySelectorAll(".picker-tab-btn")];
  let currentCat = "brilho";

  function renderGrid() {
    const q = searchEl.value.trim().toLowerCase();
    let items = categories[currentCat] || [];
    if (q) {
      const all = [];
      Object.values(categories).forEach(list => all.push(...list));
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
      if (it.url) {
        btn.innerHTML = `<img src="${it.url}" alt="${it.name || ""}" loading="lazy">`;
      } else {
        btn.textContent = it.emoji || it.name || "";
      }
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
      if (topAbove > margin) top = topAbove;
      else top = margin;
    }

    picker.style.left = left + "px";
    picker.style.top  = top + "px";
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
    picker.classList.contains("open") ? closePicker() : openPicker();
  });

  document.addEventListener("click", e => {
    if (!wrapper.contains(e.target) && !picker.contains(e.target)) closePicker();
  });

  return { wrapper };
}

console.log("[reactions] módulo pronto");