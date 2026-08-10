/*
  drawbox.js — minkurosu.site
  v2: salva no Firestore (sem Cloud Storage, que agora exige plano pago Blaze).
  o desenho vira base64 e fica direto no campo "imageUrl" do documento — cabe tranquilo
  no limite de 1MB por doc do Firestore, que continua 100% grátis no plano Spark.

  coleções usadas:
  - "drawings"      → pública (leitura), { imageUrl (base64), timestamp }. é o que a galeria do site lê.
  - "drawings_meta" → privada (leitura só admin), { imageUrl (base64), timestamp, ip, city, region,
                       country, cc, device, browser, os, page, referrer, lang }. aparece no /admin.

  IMPORTANTE: as regras de segurança do Firestore precisam permitir "create" público
  nessas coleções, mas só permitir "read" de drawings_meta pro seu email de admin.
*/

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, doc, setDoc, serverTimestamp,
  query, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
  authDomain: "minkurosu.firebaseapp.com",
  projectId: "minkurosu",
  storageBucket: "minkurosu.firebasestorage.app",
  messagingSenderId: "290821725607",
  appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
  measurementId: "G-M7PWC6DDRH"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const MAX_GALLERY_ITEMS = 60;
const MAX_IMAGE_BYTES = 700 * 1024; // margem de segurança abaixo do limite de 1MB por doc do Firestore

let canvas = document.getElementById("drawboxcanvas");
let context = canvas.getContext("2d");
context.fillStyle = "white";
context.fillRect(0, 0, canvas.width, canvas.height);

let restore_array = [];
let start_index = -1;
let stroke_color = "#610000";
let stroke_width = "2";
let is_drawing = false;

function change_color(hex) {
  stroke_color = hex;
  updateActiveSwatch(hex);
  updateBrushPreview();
}

// ---------- paleta de cores básicas/desaturadas ----------

const PALETTE = [
  "#610000", // vermelho escuro (assinatura do site)
  "#3A3330", // charcoal
  "#E6E0DD", // off-white
  "#B08A8A", // dusty rose
  "#8A9A8A", // sage
  "#8A96A8", // slate blue
  "#A89A7C", // khaki
  "#9A7C96", // mauve
  "#C4A47C", // dusty ochre
  "#7C8A96", // steel blue-gray
  "#A87C7C", // terracotta muted
  "#000000", // preto
];

function renderPalette() {
  const container = document.getElementById("palette");
  if (!container) return;
  container.innerHTML = "";
  PALETTE.forEach((hex, i) => {
    const swatch = document.createElement("div");
    swatch.className = "stroke-color";
    swatch.style.background = hex;
    swatch.dataset.hex = hex;
    swatch.title = hex;
    swatch.addEventListener("click", () => change_color(hex));
    if (i === 0) swatch.classList.add("active");
    container.appendChild(swatch);
  });
}

function updateActiveSwatch(hex) {
  document.querySelectorAll(".stroke-color").forEach(el => {
    el.classList.toggle("active", el.dataset.hex?.toLowerCase() === hex.toLowerCase());
  });
}

// ---------- tamanho do pincel ----------

function updateBrushPreview() {
  const dot = document.getElementById("brush-preview-dot");
  if (!dot) return;
  const size = Math.min(Number(stroke_width), 20); // limita visualmente, o traço real pode ser maior
  dot.style.width = `${size}px`;
  dot.style.height = `${size}px`;
  dot.style.background = stroke_color;
}

function setupBrushControl() {
  const slider = document.getElementById("brush-size");
  const label = document.getElementById("brush-size-label");
  if (!slider) return;
  slider.addEventListener("input", () => {
    stroke_width = slider.value;
    if (label) label.textContent = `${slider.value}px`;
    updateBrushPreview();
  });
  if (label) label.textContent = `${slider.value}px`;
  updateBrushPreview();
}

// ---------- roda cromática (hue = ângulo, saturação = distância do centro) ----------

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

let pickedHue = 0;
let pickedSat = 100;

function drawColorWheel() {
  const wheelCanvas = document.getElementById("cp-wheel");
  if (!wheelCanvas) return;
  const wCtx = wheelCanvas.getContext("2d");
  const size = wheelCanvas.width;
  const radius = size / 2;
  const lightness = Number(document.getElementById("cp-lightness")?.value || 45);

  const imageData = wCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (dist <= radius) {
        const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const sat = Math.min(100, (dist / radius) * 100);
        const hex = hslToHex(angle, sat, lightness);
        imageData.data[idx]     = parseInt(hex.slice(1, 3), 16);
        imageData.data[idx + 1] = parseInt(hex.slice(3, 5), 16);
        imageData.data[idx + 2] = parseInt(hex.slice(5, 7), 16);
        imageData.data[idx + 3] = 255;
      }
    }
  }
  wCtx.putImageData(imageData, 0, 0);
}

function pickFromWheelEvent(event) {
  const wheelCanvas = document.getElementById("cp-wheel");
  const rect = wheelCanvas.getBoundingClientRect();
  const scaleX = wheelCanvas.width / rect.width;
  const scaleY = wheelCanvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const radius = wheelCanvas.width / 2;
  const dx = x - radius;
  const dy = y - radius;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > radius) return;

  pickedHue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  pickedSat = Math.min(100, (dist / radius) * 100);
  applyPickedColor();
}

function applyPickedColor() {
  const lightness = Number(document.getElementById("cp-lightness")?.value || 45);
  const hex = hslToHex(pickedHue, pickedSat, lightness);
  const preview = document.getElementById("cp-preview");
  const hexInput = document.getElementById("cp-hex");
  if (preview) preview.style.background = hex;
  if (hexInput) hexInput.value = hex;
  change_color(hex);
}

function setupColorPicker() {
  const modal = document.getElementById("color-picker-modal");
  const openBtn = document.getElementById("open-picker-btn");
  const closeBtn = document.getElementById("cp-close");
  const wheelCanvas = document.getElementById("cp-wheel");
  const lightnessSlider = document.getElementById("cp-lightness");
  const hexInput = document.getElementById("cp-hex");
  if (!modal || !openBtn || !wheelCanvas) return;

  openBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    drawColorWheel();
  });

  closeBtn?.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  let dragging = false;
  wheelCanvas.addEventListener("mousedown", e => { dragging = true; pickFromWheelEvent(e); });
  window.addEventListener("mousemove", e => { if (dragging) pickFromWheelEvent(e); });
  window.addEventListener("mouseup", () => { dragging = false; });
  wheelCanvas.addEventListener("touchstart", e => { pickFromWheelEvent(e.touches[0]); e.preventDefault(); }, { passive: false });
  wheelCanvas.addEventListener("touchmove", e => { pickFromWheelEvent(e.touches[0]); e.preventDefault(); }, { passive: false });

  lightnessSlider?.addEventListener("input", () => {
    drawColorWheel();
    applyPickedColor();
  });

  hexInput?.addEventListener("change", () => {
    let hex = hexInput.value.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return;
    if (!hex.startsWith("#")) hex = `#${hex}`;
    hexInput.value = hex;
    const preview = document.getElementById("cp-preview");
    if (preview) preview.style.background = hex;
    change_color(hex);
  });
}

renderPalette();
setupBrushControl();
setupColorPicker();


function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = (event.touches && event.touches[0]) || (event.targetTouches && event.targetTouches[0]);
  const clientX = touch ? touch.clientX : event.clientX;
  const clientY = touch ? touch.clientY : event.clientY;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function getX(event) { return getCanvasPoint(event).x; }
function getY(event) { return getCanvasPoint(event).y; }

function start(event) {
  is_drawing = true;
  context.beginPath();
  context.moveTo(getX(event), getY(event));
  event.preventDefault();
}

function draw(event) {
  if (!is_drawing) return;
  context.lineTo(getX(event), getY(event));
  context.strokeStyle = stroke_color;
  context.lineWidth = stroke_width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
  event.preventDefault();
}

function stop(event) {
  if (!is_drawing) return;
  context.stroke();
  context.closePath();
  is_drawing = false;
  restore_array.push(context.getImageData(0, 0, canvas.width, canvas.height));
  start_index++;
  event.preventDefault();
}

canvas.addEventListener("touchstart", start, false);
canvas.addEventListener("touchmove", draw, false);
canvas.addEventListener("touchend", stop, false);
canvas.addEventListener("mousedown", start, false);
canvas.addEventListener("mousemove", draw, false);
canvas.addEventListener("mouseup", stop, false);
canvas.addEventListener("mouseout", stop, false);

window.change_color = change_color;

window.Restore = function () {
  if (start_index <= 0) {
    window.Clear();
  } else {
    start_index--;
    restore_array.pop();
    context.putImageData(restore_array[start_index], 0, 0);
  }
};

window.Clear = function () {
  context.fillStyle = "white";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillRect(0, 0, canvas.width, canvas.height);
  restore_array = [];
  start_index = -1;
};

// impede que alguém injete uma imagem externa no canvas via devtools
context.drawImage = function () {
  console.warn("noo >:(");
};

// ---------- coleta de info de quem tá desenhando (mesmo padrão do visitor tracker) ----------

function detectDevice() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Unknown";
}

function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

async function collectVisitorMeta() {
  let ip = null, city = null, region = null, country = null, cc = null;
  try {
    const res = await fetch("https://ip-api.com/json/?fields=status,country,countryCode,regionName,city,query");
    const data = await res.json();
    if (data.status === "success") {
      ip = data.query;
      city = data.city;
      region = data.regionName;
      country = data.country;
      cc = data.countryCode;
    }
  } catch { /* sem sorte, segue sem geo */ }

  return {
    ip,
    city,
    region,
    country,
    cc,
    device: detectDevice(),
    browser: detectBrowser(),
    os: detectOS(),
    page: location.pathname,
    referrer: document.referrer || "direct",
    lang: navigator.language || null,
  };
}

// ---------- envio ----------

// converte o canvas pra uma dataURL que caiba no limite de 1MB por doc do Firestore.
// tenta PNG primeiro (melhor pra traços simples); se ficar grande demais, cai pra JPEG comprimido.
function canvasToStoredImage() {
  let dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length <= MAX_IMAGE_BYTES) return dataUrl;

  for (const quality of [0.8, 0.6, 0.4]) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_IMAGE_BYTES) return dataUrl;
  }
  return null; // nem comprimindo coube
}

document.getElementById("submit").addEventListener("click", async function () {
  const submitButton = document.getElementById("submit");
  const statusText = document.getElementById("status");

  const imageData = canvasToStoredImage();
  if (!imageData) {
    statusText.textContent = "desenho grande demais, simplifica um pouco e tenta de novo.";
    alert("esse desenho ficou grande demais pra salvar. tenta usar menos áreas preenchidas ou menos cores.");
    return;
  }

  submitButton.disabled = true;
  statusText.textContent = "enviando...";

  try {
    // doc público (é o que a galeria do site vai ler)
    const publicDoc = await addDoc(collection(db, "drawings"), {
      imageUrl: imageData,
      timestamp: serverTimestamp(),
    });

    // doc privado com a info de quem desenhou, mesmo id do doc público
    const meta = await collectVisitorMeta();
    await setDoc(doc(db, "drawings_meta", publicDoc.id), {
      imageUrl: imageData,
      timestamp: serverTimestamp(),
      ...meta,
    });

    statusText.textContent = "enviado com sucesso!";
    alert("desenho enviado com sucesso ☻");
    window.Clear();
  } catch (error) {
    console.error(error);
    statusText.textContent = "erro ao enviar o desenho.";
    alert("erro ao enviar o desenho, tenta de novo.");
  } finally {
    submitButton.disabled = false;
  }
});

// ---------- galeria dinâmica (tempo real, só toca em #gallery-dynamic) ----------

function renderGallery(snapshot) {
  const gallery = document.getElementById("gallery-dynamic");
  if (!gallery) return;

  if (snapshot.empty) {
    gallery.innerHTML = `<p style="text-align:center;color:#b5aca5;">nenhum desenho ainda, seja a primeira pessoa! ☻</p>`;
    return;
  }

  gallery.innerHTML = snapshot.docs.map(docSnap => {
    const d = docSnap.data();
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
    const dateStr = ts ? ts.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
    return `
      <div class="image-container">
        <img src="${d.imageUrl}" alt="desenho enviado" loading="lazy">
        <p>${dateStr}</p>
      </div>`;
  }).join("");
}

const galleryQuery = query(collection(db, "drawings"), orderBy("timestamp", "desc"), limit(MAX_GALLERY_ITEMS));
onSnapshot(galleryQuery, renderGallery, err => {
  console.error("erro ao carregar galeria:", err);
  const gallery = document.getElementById("gallery-dynamic");
  if (gallery) gallery.textContent = "não consegui carregar os desenhos agora ;;";
});