/*
  jspaint-integration.js — minkurosu.site

  VERSÃO COMPAT (sem "import"/type=module) — de propósito, pra funcionar
  mesmo se o seu router client-side reinjeta a página via innerHTML, o
  que impede scripts type="module" de rodar em alguns casos.

  Requer, ANTES desta tag, os scripts compat do Firebase carregados como
  scripts normais (veja o HTML de exemplo em drawbox-jspaint-block.html):
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
    <script src="jspaint-integration.js"></script>

  espera o jsPaint (iframe #jspaint-iframe, same-origin) carregar e
  sobrescreve o hook systemHooks.showSaveFileDialog: em vez de abrir
  "salvar como" do sistema, manda o desenho pro Firestore (coleção
  pública "drawings" + coleção privada "drawings_meta" com info de quem
  enviou, lida pelo admin-tracker.js no /admin). Também injeta tema
  escuro + botão SAVE dentro do próprio jsPaint, e alimenta a galeria
  dinâmica (#gallery-dynamic) com os desenhos mais recentes.
*/

console.log("[drawbox] script jspaint-integration.js iniciado.");

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
    console.error("[drawbox] `firebase` não existe — os scripts compat (firebase-app-compat.js / firebase-firestore-compat.js) não foram carregados antes deste arquivo.");
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore(app);

  const MAX_IMAGE_BYTES = 700 * 1024; // margem abaixo do limite de 1MB por doc do Firestore

  // ---------- info de quem tá desenhando ----------

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
    } catch { /* segue sem geo */ }

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

  // ---------- blob -> base64, com fallback pra JPEG comprimido ----------

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

  // ---------- envio pro Firestore ----------

  async function submitDrawing(blob) {
    console.log("[drawbox] submitDrawing chamado, blob:", blob);
    const imageData = await blobToStoredImage(blob);
    if (!imageData) {
      alert("esse desenho ficou grande demais pra salvar. tenta uma tela menor ou menos áreas preenchidas.");
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

      console.log("[drawbox] desenho enviado com sucesso, doc id:", publicDoc.id);
      alert("desenho enviado com sucesso ☻");
      return true;
    } catch (error) {
      console.error("[drawbox] erro ao enviar desenho:", error);
      alert("erro ao enviar o desenho, tenta de novo. (" + error.message + ")");
      return false;
    }
  }

  // ---------- espera uma condição ficar verdadeira ----------

  function waitUntil(conditionFn, intervalMs = 50, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        const value = conditionFn();
        if (value) return resolve(value);
        if (Date.now() - startedAt > timeoutMs) {
          return reject(new Error("timeout esperando condição"));
        }
        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  // ---------- controle de tamanho do pincel (usa o atalho nativo +/- do
  // numpad que o jsPaint já escuta pra "Brush Scaling") ----------

  const BRUSH_MIN_LEVEL = 0;
  const BRUSH_MAX_LEVEL = 15;
  const BRUSH_INITIAL_LEVEL = 5; // começa mais grossinho, tipo caneta, em vez do 1px padrão

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
    let currentLevel = 0; // nível relativo ao tamanho padrão do jsPaint no load (1px)

    function setLevel(target) {
      target = Math.max(BRUSH_MIN_LEVEL, Math.min(BRUSH_MAX_LEVEL, target));
      const diff = target - currentLevel;
      const isPlus = diff > 0;
      for (let i = 0; i < Math.abs(diff); i++) {
        dispatchBrushKey(doc, jspaintWindow, isPlus);
      }
      currentLevel = target;
      console.log("[drawbox] brush level ajustado pra", currentLevel);
    }

    return { setLevel, getLevel: () => currentLevel };
  }

  // ---------- color picker universal + slider de brush size + SAVE,
  // injetados na barra de cores do topo, ao lado da paleta nativa de tons
  // básicos/dessaturados (que continua visível), em vez do rodapé
  // (.status-area) ----------

  // nomes de classe "conhecidos" da estrutura padrão do jsPaint. Se a versão
  // usada aqui tiver marcação diferente, ajusta esses seletores olhando o
  // DOM real pelo devtools (clique direito dentro do iframe > inspecionar).
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
      if (doc.getElementById("drawbox-controls")) return; // já existe, não duplica

      const brush = makeBrushSizeController(jspaintWindow);

      // a UI (colors-component) pode ainda não ter montado no exato momento
      // em que systemHooks aparece — espera de verdade em vez de checar só
      // uma vez, senão a busca falha silenciosamente e nada é injetado.
      let colorsComponent = null;
      let statusArea = null;
      try {
        await waitUntil(() => {
          colorsComponent = findFirst(doc, COLORS_COMPONENT_SELECTORS);
          statusArea = doc.querySelector(".status-area");
          return colorsComponent || statusArea;
        }, 100, 8000);
      } catch (err) {
        console.warn("[drawbox] nem .colors-component nem .status-area apareceram depois de 8s — controles não injetados.", err);
        return;
      }

      const host = colorsComponent || statusArea;
      if (!colorsComponent) {
        console.warn("[drawbox] .colors-component não encontrado, caindo pro rodapé (.status-area) como antes.");
      }
      console.log("[drawbox] host encontrado pra injeção:", colorsComponent ? "colors-component" : "status-area", host);

      const wrap = doc.createElement("div");
      wrap.id = "drawbox-controls";
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = "6px";
      wrap.style.overflow = "visible";
      if (colorsComponent) {
        // não fica preso dentro da caixa de tamanho fixo da colors-component;
        // ocupa o espaço que sobrar do lado dela.
        wrap.style.flex = "1 1 auto";
        wrap.style.minWidth = "80px";
      } else {
        wrap.className = "status-field inset-shallow";
      }

      // --- color picker universal, no lugar do quadrado de paleta ---
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

      // a paleta nativa (tons básicos/dessaturados) fica intocada e visível;
      // não precisamos mais referenciá-la aqui.

      // --- slider de brush, "na linha", ocupando o espaço que sobrar ---
      const slider = doc.createElement("input");
      slider.type = "range";
      slider.id = "drawbox-brush-slider";
      slider.min = String(BRUSH_MIN_LEVEL);
      slider.max = String(BRUSH_MAX_LEVEL);
      slider.value = String(BRUSH_INITIAL_LEVEL);
      slider.title = "Tamanho do pincel";
      slider.style.flex = "1 1 auto";
      slider.style.minWidth = "40px";
      slider.addEventListener("input", () => brush.setLevel(Number(slider.value)));

      // --- SAVE, do lado ---
      const btn = doc.createElement("button");
      btn.id = "drawbox-save-btn";
      btn.textContent = "save";
      btn.style.flex = "0 0 auto";
      btn.addEventListener("click", () => {
        console.log("[drawbox] botão SAVE clicado, disparando Ctrl+S no jsPaint.");
        const evt = new jspaintWindow.KeyboardEvent("keydown", {
          key: "s", code: "KeyS", keyCode: 83, ctrlKey: true, metaKey: true, bubbles: true,
        });
        doc.dispatchEvent(evt);
      });

      wrap.appendChild(colorPicker);
      wrap.appendChild(slider);
      wrap.appendChild(btn);

      if (colorsComponent && colorsComponent.parentElement) {
        // insere DEPOIS da colors-component inteira, como irmã dela — não
        // dentro da caixa (que tem tamanho fixo / overflow e cortava os
        // controles antes).
        colorsComponent.insertAdjacentElement("afterend", wrap);
      } else if (colorsComponent) {
        // sem pai acessível por algum motivo — melhor dentro do que sumir
        colorsComponent.appendChild(wrap);
      } else {
        statusArea.appendChild(wrap);
      }
      console.log("[drawbox] wrap inserido, ainda no DOM?", doc.getElementById("drawbox-controls") === wrap, "pai:", wrap.parentElement);

      // aplica o tamanho inicial mais grosso assim que os controles entram
      brush.setLevel(BRUSH_INITIAL_LEVEL);

      console.log("[drawbox] controles (color picker + brush size + save) injetados no jsPaint.");
    } catch (err) {
      console.warn("[drawbox] não consegui injetar os controles:", err);
    }
  }

  // ---------- hook principal ----------

  function hookJsPaintSave() {
    const iframe = document.getElementById("jspaint-iframe");
    if (!iframe) {
      console.error("[drawbox] #jspaint-iframe não encontrado no DOM. Verifique se o HTML do drawbox foi realmente inserido na página.");
      return;
    }
    console.log("[drawbox] #jspaint-iframe encontrado.");

    const setup = async () => {
      console.log("[drawbox] iframe carregado (readyState:", iframe.contentDocument?.readyState, "). Esperando systemHooks do jsPaint...");
      const jspaintWindow = iframe.contentWindow;

      let hooks;
      try {
        hooks = await waitUntil(() => jspaintWindow.systemHooks);
      } catch (err) {
        console.error("[drawbox] systemHooks nunca apareceu depois de 15s. Isso normalmente significa que o jsPaint carregado nesse iframe não expõe window.systemHooks (versão diferente, ou o iframe não carregou o jsPaint de verdade — confira visualmente se o Paint aparece dentro da caixa).", err);
        return;
      }

      console.log("[drawbox] systemHooks encontrado:", hooks);
      await injectControls(jspaintWindow);

      const originalShowSaveFileDialog = hooks.showSaveFileDialog;

      jspaintWindow.systemHooks.showSaveFileDialog = async ({ getBlob }) => {
        console.log("[drawbox] showSaveFileDialog interceptado.");
        try {
          const blob = await getBlob("image/png");
          const ok = await submitDrawing(blob);
          return ok ? { newFileName: "desenho.png", newFileFormatID: "image/png" } : undefined;
        } catch (err) {
          console.error("[drawbox] erro ao capturar desenho do jsPaint:", err);
          return originalShowSaveFileDialog?.({ getBlob });
        }
      };

      console.log("[drawbox] hook de salvar instalado com sucesso.");
    };

    try {
      if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
        console.log("[drawbox] iframe já estava carregado, rodando setup imediatamente.");
        setup();
      } else {
        console.log("[drawbox] iframe ainda carregando, aguardando evento load.");
        iframe.addEventListener("load", setup);
      }
    } catch (err) {
      console.warn("[drawbox] erro checando estado do iframe (possível cross-origin), usando fallback de load:", err);
      iframe.addEventListener("load", setup);
    }
  }

  // ---------- galeria dinâmica ----------

  function renderDynamicGallery(snapshot) {
    const container = document.getElementById("gallery-dynamic");
    if (!container) {
      console.warn('[drawbox] #gallery-dynamic não encontrado — adicione <div id="gallery-dynamic"></div> dentro do seu #gallery.');
      return;
    }
    console.log("[drawbox] galeria atualizada, docs:", snapshot.size);

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
        console.error("[drawbox] erro ao carregar galeria:", err);
      });
  }

  hookJsPaintSave();
  watchGallery();
})();