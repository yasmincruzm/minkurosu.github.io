// expand-cells.js
// Define window.expandCell / window.collapseCell, usadas pelos onclick="" inline
// espalhados por feed.html, twt.html e posts.html. Elas nunca existiam em lugar
// nenhum do site, por isso clicar nas fotos não fazia nada.
//
// Também cuida de montar a caixa de reações logo abaixo da legenda quando uma
// foto do feed.html é expandida.

import { mountReactions } from "./reactions.js";

function slugFromSrc(src) {
  return (src || "")
    .split("/")
    .pop()
    .split("?")[0]
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 80);
}

function collapseCell(el) {
  if (!el) return;
  el.classList.remove("expanded");
  const img = el.querySelector(".full-img-wrap img");
  if (img) img.removeAttribute("src");
}

function expandCell(el, thumbSrc, fullSrc) {
  if (!el) return;
  const src = fullSrc || thumbSrc;

  // só deixa uma célula expandida por vez dentro da mesma grade
  const grid = el.closest("[data-expand-grid]") || el.parentElement;
  if (grid) {
    grid.querySelectorAll(".expanded").forEach(other => {
      if (other !== el) collapseCell(other);
    });
  }

  const img = el.querySelector(".full-img-wrap img");
  if (img && src) img.src = src;

  el.classList.add("expanded");

  // reações só fazem sentido nas fotos do feed (que têm legenda) —
  // a galeria lateral de gifs em twt.html/posts.html não precisa disso.
  const caption = el.querySelector(".caption-text");
  if (caption) {
    let reactBox = el.querySelector(".feed-reactions-box");
    if (!reactBox) {
      reactBox = document.createElement("div");
      reactBox.className = "feed-reactions-box";
      reactBox.style.cssText = "margin-top: 10px; width: 100%;";
      caption.insertAdjacentElement("afterend", reactBox);
    }
    if (!reactBox._mounted) {
      reactBox._mounted = mountReactions(reactBox, {
        targetId: "feed_" + slugFromSrc(src),
        theme: "pill"
      });
    }
  }
}

window.expandCell = expandCell;
window.collapseCell = collapseCell;
