<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>drawbox</title>
    <link rel="stylesheet" href="emo.css">
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            padding: 20px;
        }

        #jspaint-wrap {
            max-width: 900px;
            margin: 0 auto 30px;
            border: 0.2rem solid #310000;
            border-radius: 3px;
            overflow: hidden;
        }

        #jspaint-iframe {
            display: block;
            width: 100%;
            height: 640px;
            border: none;
            background: white;
        }

        #jspaint-note {
            text-align: center;
            font-size: 0.8em;
            color: #5a5a5a;
            max-width: 900px;
            margin: 0 auto 20px;
        }

        h2 {
            text-align: center;
        }

        #gallery-static,
        #gallery-dynamic {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 8px;
            width: 100%;
            max-width: 800px;
            margin: 0 auto 30px;
        }

        .image-container {
            border: 1px solid #310000;
            border-radius: 2px;
            overflow: hidden;
        }

        .image-container img {
            width: 100%;
            aspect-ratio: 1 / 1;
            object-fit: cover;
            display: block;
        }

        .image-container p {
            font-size: 0.7em;
            color: #5a5a5a;
            text-align: center;
            margin: 4px 0;
        }
    </style>
</head>

<body>


    <div id="jspaint-wrap">
        <iframe id="jspaint-iframe" data-src="jspaint/index.html?theme=retro-dark.css&autosave=off" title="jsPaint"></iframe>
    </div>

    <h2>art by you &lt;3</h2>
    <div id="gallery-static">
        <div class="image-container">
            <img src="imgs/artbyyou/byAllanHiker.jpg" alt="by @allanhiker" loading="lazy">
        </div>
        <div class="image-container">
            <img src="imgs/artbyyou/gatoemo.webp" alt="sent by straw.page" loading="lazy">
        </div>
        <div class="image-container">
            <img src="imgs/artbyyou/h_wallacepires.jpg" alt="by @h_wallacepires" loading="lazy">
        </div>
        <div class="image-container">
            <img src="imgs/artbyyou/brasilsilsil.webp" alt="straw.page" loading="lazy">
        </div>
        <div class="image-container">
            <img src="imgs/artbyyou/Screenshot_20250718_175121_Gallery.jpg" alt="sent by instagram" loading="lazy">
        </div>
        <div class="image-container">
            <img src="imgs/artbyyou/Screenshot_20250718_175137_Gallery.jpg" alt="sent by instagram" loading="lazy">
        </div>
        <div class="image-container">
            <img src="imgs/artbyyou/a.jpg" alt="sent by instagram" loading="lazy">
        </div>
    </div>

    <h2>enviados recentemente</h2>
    <div id="gallery-dynamic">loading...</div>

    <script type="module">

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
const MAX_IMAGE_BYTES = 700 * 1024; 


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
      ip = data.query; city = data.city; region = data.regionName;
      country = data.country; cc = data.countryCode;
    }
  } catch {  }

  return {
    ip, city, region, country, cc,
    device: detectDevice(),
    browser: detectBrowser(),
    os: detectOS(),
    page: location.pathname,
    referrer: document.referrer || "direct",
    lang: navigator.language || null,
  };
}


function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function blobToStoredImage(blob) {
  let dataUrl = await blobToDataURL(blob);
  if (dataUrl.length <= MAX_IMAGE_BYTES) return dataUrl;

  const bitmap = await createImageBitmap(blob);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = bitmap.width;
  tempCanvas.height = bitmap.height;
  const tctx = tempCanvas.getContext("2d");
  tctx.fillStyle = "white"; 
  tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tctx.drawImage(bitmap, 0, 0);

  for (const quality of [0.85, 0.7, 0.5, 0.35]) {
    dataUrl = tempCanvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_IMAGE_BYTES) return dataUrl;
  }
  return null;
}

async function submitDrawing(blob) {
  const imageData = await blobToStoredImage(blob);
  if (!imageData) {
    alert("file too big.");
    return false;
  }

  try {
    const publicDoc = await addDoc(collection(db, "drawings"), {
      imageUrl: imageData,
      timestamp: serverTimestamp(),
    });

    const meta = await collectVisitorMeta();
    await setDoc(doc(db, "drawings_meta", publicDoc.id), {
      imageUrl: imageData,
      timestamp: serverTimestamp(),
      ...meta,
    });

    alert("sent");
    return true;
  } catch (error) {
    console.error(error);
    alert("error");
    return false;
  }
}


async function clearJsPaintCache() {
  try {
    Object.keys(localStorage).forEach(key => {
      if (!/firebase/i.test(key)) {
        try { localStorage.removeItem(key); } catch { }
      }
    });
  } catch (err) {
    console.warn("error:", err);
  }

  // jsPaint keeps an autosave of the in-progress drawing in sessionStorage too,
  // which is what makes the canvas come back gray/broken after closing. Clear it.
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn("erro ao limpar sessionStorage:", err);
  }

  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map(({ name }) => {
        if (!name || /firebase/i.test(name)) return Promise.resolve();
        return new Promise(resolve => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }));
    }
  } catch (err) {
    console.warn("erro ao limpar indexedDB:", err);
  }
}

function waitUntil(conditionFn, intervalMs = 50) {
  return new Promise(resolve => {
    const check = () => {
      const value = conditionFn();
      if (value) resolve(value);
      else setTimeout(check, intervalMs);
    };
    check();
  });
}

function injectBrushSizeSlider(jspaintWindow) {
  const doc = jspaintWindow.document;
  if (doc.getElementById("drawbox-controls")) return;

  const colorsComponent = doc.querySelector(".colors-component.wide");
  if (!colorsComponent) return;

  let currentLevel = 0;
  const slider = doc.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "15";
  slider.value = "5";
  slider.setAttribute("aria-label", "brush size");
  slider.addEventListener("input", () => {
    const targetLevel = Number(slider.value);
    const isPlus = targetLevel > currentLevel;
    for (let i = 0; i < Math.abs(targetLevel - currentLevel); i++) {
      doc.dispatchEvent(new jspaintWindow.KeyboardEvent("keydown", {
        key: isPlus ? "+" : "-",
        code: isPlus ? "NumpadAdd" : "NumpadSubtract",
        keyCode: isPlus ? 107 : 109,
        which: isPlus ? 107 : 109,
        bubbles: true,
      }));
    }
    currentLevel = targetLevel;
  });

  const colorPicker = doc.createElement("input");
  colorPicker.type = "color";
  colorPicker.value = "#000000";
  colorPicker.setAttribute("aria-label", "Escolher cor");
  colorPicker.title = "color";
  colorPicker.addEventListener("input", () => {
    const paintApi = jspaintWindow.api_for_cypress_tests;
    if (!paintApi) return;
    paintApi.selected_colors.foreground = colorPicker.value;
    jspaintWindow.$G?.trigger("option-changed");
  });

  const wrap = doc.createElement("div");
  wrap.id = "drawbox-controls";
  wrap.appendChild(slider);
  wrap.appendChild(colorPicker);
  colorsComponent.appendChild(wrap);

  slider.dispatchEvent(new jspaintWindow.Event("input"));
}

function hookJsPaintSave() {
  const iframe = document.getElementById("jspaint-iframe");
  if (!iframe) return;

  const targetSrc = iframe.dataset.src || iframe.getAttribute("src");

  iframe.addEventListener("load", async () => {
    const jspaintWindow = iframe.contentWindow;
    await waitUntil(() => jspaintWindow.systemHooks);
    injectBrushSizeSlider(jspaintWindow);

  
    const originalShowSaveFileDialog = jspaintWindow.systemHooks.showSaveFileDialog;

    jspaintWindow.systemHooks.showSaveFileDialog = async ({ getBlob }) => {
      try {
        const blob = await getBlob("image/png");
        const ok = await submitDrawing(blob);
        return ok ? { newFileName: "desenho.png", newFileFormatID: "image/png" } : undefined;
      } catch (err) {
        console.error("error jsPaint:", err);
        return originalShowSaveFileDialog?.({ getBlob });
      }
    };
  });

  if (targetSrc) {
    clearJsPaintCache().finally(() => {
      iframe.src = targetSrc;
    });
  }
}


function renderGallery(snapshot) {
  const gallery = document.getElementById("gallery-dynamic");
  if (!gallery) return;

  if (snapshot.empty) {
    gallery.innerHTML = `<p style="text-align:center;color:#5a5a5a;">nenhum desenho ainda, seja a primeira pessoa! ☻</p>`;
    return;
  }

  gallery.innerHTML = snapshot.docs.map(docSnap => {
    const d = docSnap.data();
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
    const dateStr = ts ? ts.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
    return `
      <div class="image-container">
        <img src="${d.imageUrl}" alt="sent" loading="lazy">
        <p>${dateStr}</p>
      </div>`;
  }).join("");
}

hookJsPaintSave();

if (typeof window.__drawboxUnsubscribe === "function") {
  window.__drawboxUnsubscribe();
}

const galleryQuery = query(collection(db, "drawings"), orderBy("timestamp", "desc"), limit(MAX_GALLERY_ITEMS));
window.__drawboxUnsubscribe = onSnapshot(galleryQuery, renderGallery, err => {
  console.error("erro ao carregar galeria:", err);
  const gallery = document.getElementById("gallery-dynamic");
  if (gallery) gallery.textContent = "error";
});

    </script>

</body>

</html>