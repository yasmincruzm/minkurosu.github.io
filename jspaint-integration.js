console.log("[drawbox] started");

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
  };

  if (typeof firebase === "undefined") {
    console.error("[drawbox] Missing");
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore(app);

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
    } catch { }

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
    console.log("[drawbox] submitDrawing", blob);
    const imageData = await blobToStoredImage(blob);
    if (!imageData) {
      alert("TooLarge");
      return false;
    }

    try {
      const publicDoc = await db.collection("drawings").add({
        imageUrl: imageData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const meta = await collectVisitorMeta();
      await db.collection("drawings_meta").doc(publicDoc.id).set({
        imageUrl: imageData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ...meta,
      });

      console.log("[drawbox] submitted", publicDoc.id);
      alert("Sent");
      return true;
    } catch (error) {
      console.error("[drawbox] Failed", error);
      alert("Failed");
      return false;
    }
  }

  function waitUntil(conditionFn, intervalMs = 50, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        const value = conditionFn();
        if (value) return resolve(value);
        if (Date.now() - startedAt > timeoutMs) {
          return reject(new Error("Timeout"));
        }
        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  const BRUSH_MIN_LEVEL = 0;
  const BRUSH_MAX_LEVEL = 15;

  function dispatchBrushKey(doc, jspaintWindow, isPlus) {
    const evt = new jspaintWindow.KeyboardEvent("keydown", {
      key: isPlus ? "+" : "-",
      code: isPlus ? "NumpadAdd" : "NumpadSubtract",
      keyCode: isPlus ? 107 : 109,
      which: isPlus ? 107 : 109,
      bubbles: true,
    });
    doc.dispatchEvent(evt);
  }

  function makeBrushSizeController(jspaintWindow) {
    const doc = jspaintWindow.document;
    let currentLevel = 0;

    function setLevel(target) {
      target = Math.max(BRUSH_MIN_LEVEL, Math.min(BRUSH_MAX_LEVEL, target));
      const diff = target - currentLevel;
      const isPlus = diff > 0;
      for (let i = 0; i < Math.abs(diff); i++) {
        dispatchBrushKey(doc, jspaintWindow, isPlus);
      }
      currentLevel = target;
      console.log("[drawbox] brush", currentLevel);
    }

    return { setLevel, getLevel: () => currentLevel };
  }

  const COLORS_COMPONENT_SELECTORS = [".colors-component.wide", ".colors-component"];

  function findFirst(doc, selectors) {
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  async function injectControls(jspaintWindow) {
    try {
      const doc = jspaintWindow.document;
      if (doc.getElementById("drawbox-controls")) return;

      const brush = makeBrushSizeController(jspaintWindow);

      let colorsComponent = null;
      let statusArea = null;
      try {
        await waitUntil(() => {
          colorsComponent = findFirst(doc, COLORS_COMPONENT_SELECTORS);
          statusArea = doc.querySelector(".status-area");
          return colorsComponent || statusArea;
        }, 100, 8000);
      } catch (err) {
        console.warn("[drawbox] Timeout", err);
        return;
      }

      const host = colorsComponent || statusArea;
      if (!colorsComponent) {
        console.warn("[drawbox] Missing");
      }
      console.log("[drawbox] host", colorsComponent ? "colors-component" : "status-area", host);

      const wrap = doc.createElement("div");
      wrap.id = "drawbox-controls";
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = "6px";
      wrap.style.overflow = "visible";
      if (colorsComponent) {
        wrap.style.flex = "1 1 auto";
        wrap.style.minWidth = "80px";
      } else {
        wrap.className = "status-field inset-shallow";
      }

      const colorPicker = doc.createElement("input");
      colorPicker.type = "color";
      colorPicker.id = "drawbox-color-picker";
      colorPicker.value = "#000000";
      colorPicker.title = "Escolher cor";
      colorPicker.style.flex = "0 0 auto";
      colorPicker.style.width = "34px";
      colorPicker.style.height = "26px";
      colorPicker.style.padding = "0";
      colorPicker.style.border = "none";
      colorPicker.style.cursor = "pointer";
      colorPicker.addEventListener("input", () => {
        const paintApi = jspaintWindow.api_for_cypress_tests;
        if (!paintApi) return;
        paintApi.selected_colors.foreground = colorPicker.value;
        jspaintWindow.$G?.trigger("option-changed");
      });

      const slider = doc.createElement("input");
      slider.type = "range";
      slider.id = "drawbox-brush-slider";
      slider.min = String(BRUSH_MIN_LEVEL);
      slider.max = String(BRUSH_MAX_LEVEL);
      slider.value = "0";
      slider.title = "Tamanho do pincel";
      slider.style.flex = "1 1 auto";
      slider.style.minWidth = "40px";
      slider.addEventListener("input", () => brush.setLevel(Number(slider.value)));

      const btn = doc.createElement("button");
      btn.id = "drawbox-save-btn";
      btn.textContent = "save";
      btn.style.flex = "0 0 auto";
      btn.addEventListener("click", () => {
        console.log("[drawbox] save");
        const evt = new jspaintWindow.KeyboardEvent("keydown", {
          key: "s", code: "KeyS", keyCode: 83, ctrlKey: true, metaKey: true, bubbles: true,
        });
        doc.dispatchEvent(evt);
      });

      wrap.appendChild(colorPicker);
      wrap.appendChild(slider);
      wrap.appendChild(btn);

      if (colorsComponent && colorsComponent.parentElement) {
        colorsComponent.insertAdjacentElement("afterend", wrap);
      } else if (colorsComponent) {
        colorsComponent.appendChild(wrap);
      } else {
        statusArea.appendChild(wrap);
      }
      console.log("[drawbox] inserted", doc.getElementById("drawbox-controls") === wrap, wrap.parentElement);

      console.log("[drawbox] ready");
    } catch (err) {
      console.warn("[drawbox] Failed", err);
    }
  }

  function suppressRecoverDialog(jspaintWindow) {
    const doc = jspaintWindow.document;
    const observer = new jspaintWindow.MutationObserver(() => {
      const dialogs = doc.querySelectorAll(".window");
      dialogs.forEach(win => {
        const text = win.textContent || "";
        if (!text.includes("canvas became empty")) return;
        const buttons = win.querySelectorAll("button");
        let closed = false;
        buttons.forEach(btn => {
          if (closed) return;
          if (/fechar|close/i.test(btn.textContent || "")) {
            btn.click();
            closed = true;
          }
        });
        if (!closed) win.remove();
        console.log("[drawbox] dismissed");
      });
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  function hookJsPaintSave() {
    const iframe = document.getElementById("jspaint-iframe");
    if (!iframe) {
      console.error("[drawbox] Missing");
      return;
    }
    console.log("[drawbox] iframe");

    const setup = async () => {
      console.log("[drawbox] loaded", iframe.contentDocument?.readyState);
      const jspaintWindow = iframe.contentWindow;

      let hooks;
      try {
        hooks = await waitUntil(() => jspaintWindow.systemHooks);
      } catch (err) {
        console.error("[drawbox] Timeout", err);
        return;
      }

      console.log("[drawbox] hooks", hooks);
      await injectControls(jspaintWindow);
      suppressRecoverDialog(jspaintWindow);

      const originalShowSaveFileDialog = hooks.showSaveFileDialog;

      jspaintWindow.systemHooks.showSaveFileDialog = async ({ getBlob }) => {
        console.log("[drawbox] intercepted");
        try {
          const blob = await getBlob("image/png");
          const ok = await submitDrawing(blob);
          return ok ? { newFileName: "desenho.png", newFileFormatID: "image/png" } : undefined;
        } catch (err) {
          console.error("[drawbox] Failed", err);
          return originalShowSaveFileDialog?.({ getBlob });
        }
      };

      console.log("[drawbox] hooked");
    };

    try {
      if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
        console.log("[drawbox] ready");
        setup();
      } else {
        console.log("[drawbox] loading");
        iframe.addEventListener("load", setup);
      }
    } catch (err) {
      console.warn("[drawbox] Failed", err);
      iframe.addEventListener("load", setup);
    }
  }

  function renderDynamicGallery(snapshot) {
    const container = document.getElementById("gallery-dynamic");
    if (!container) {
      console.warn("[drawbox] Missing");
      return;
    }
    console.log("[drawbox] gallery", snapshot.size);

    if (snapshot.empty) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return `<div class="image-container"><img src="${d.imageUrl}" alt="desenho enviado" loading="lazy"></div>`;
    }).join("");
  }

  function watchGallery() {
    db.collection("drawings").orderBy("timestamp", "desc").limit(60)
      .onSnapshot(renderDynamicGallery, err => {
        console.error("[drawbox] Failed", err);
      });
  }

  hookJsPaintSave();
  watchGallery();
})();