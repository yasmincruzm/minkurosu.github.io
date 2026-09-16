
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

  const grid = el.closest("[data-expand-grid]") || el.parentElement;
  if (grid) {
    grid.querySelectorAll(".expanded").forEach(other => {
      if (other !== el) collapseCell(other);
    });
  }

  const img = el.querySelector(".full-img-wrap img");
  if (img && src) img.src = src;

  el.classList.add("expanded");


}

window.expandCell = expandCell;
window.collapseCell = collapseCell;
