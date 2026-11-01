(() => {
  const splitXInput = document.getElementById("splitX");
  const splitYInput = document.getElementById("splitY");
  const resizeWidthInput = document.getElementById("resizeWidth");
  const resizeHeightInput = document.getElementById("resizeHeight");
  const gifDelayInput = document.getElementById("gifDelay");
  const directionInput = document.getElementById("direction");
  const editorArea = document.getElementById("editorArea");
  const outputCanvas = document.getElementById("outputCanvas");
  const emptyFramesMessage = document.getElementById("emptyFramesMessage");

  const originalImageInfo = document.getElementById("originalImageInfo");
  const splitSizeInfo = document.getElementById("splitSizeInfo");
  const splitCountInfo = document.getElementById("splitCountInfo");
  const frameTotalInfo = document.getElementById("frameTotalInfo");
  const gifFpsInfo = document.getElementById("gifFpsInfo");
  const visibleFrameInfo = document.getElementById("visibleFrameInfo");

  function getSplitValues() {
    return {
      x: Math.max(1, parseInt(splitXInput?.value, 10) || 1),
      y: Math.max(1, parseInt(splitYInput?.value, 10) || 1)
    };
  }

  function formatSize(value) {
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value - Math.round(value)) < 0.01) return String(Math.round(value));
    return value.toFixed(1);
  }

  function updateImageInfo() {
    const { x, y } = getSplitValues();
    const total = x * y;

    if (splitCountInfo) splitCountInfo.textContent = `${x} × ${y}`;
    if (frameTotalInfo) frameTotalInfo.textContent = `${x} × ${y} = ${total}フレーム`;

    if (!image?.src || !image.width || !image.height) {
      if (originalImageInfo) originalImageInfo.textContent = "未選択";
      if (splitSizeInfo) splitSizeInfo.textContent = "-";
      return;
    }

    if (originalImageInfo) originalImageInfo.textContent = `${image.width} × ${image.height}px`;

    const sourceW = image.width / x;
    const sourceH = image.height / y;
    const requestedW = parseFloat(resizeWidthInput?.value);
    const requestedH = parseFloat(resizeHeightInput?.value);

    let outputW = sourceW;
    let outputH = sourceH;
    const aspect = sourceW / sourceH;

    if (Number.isFinite(requestedW) && requestedW > 0) {
      outputW = requestedW;
      outputH = Number.isFinite(requestedH) && requestedH > 0 ? requestedH : requestedW / aspect;
    } else if (Number.isFinite(requestedH) && requestedH > 0) {
      outputH = requestedH;
      outputW = requestedH * aspect;
    }

    if (splitSizeInfo) splitSizeInfo.textContent = `${formatSize(outputW)} × ${formatSize(outputH)}px`;
  }

  function updateGifFps() {
    const delay = Math.max(1, parseFloat(gifDelayInput?.value) || 60);
    const fps = 1000 / delay;
    if (gifFpsInfo) gifFpsInfo.textContent = `${formatSize(delay)}ms ≒ ${fps.toFixed(1)}fps`;
  }

  function updateFrameUi() {
    if (!editorArea) return;
    const frames = Array.from(editorArea.querySelectorAll(".frame"));
    const visible = frames.filter((frame) => !frame.querySelector(".remove")?.checked).length;

    if (visibleFrameInfo) visibleFrameInfo.textContent = `${visible} / ${frames.length} 表示`;
    if (emptyFramesMessage) emptyFramesMessage.style.display = frames.length ? "none" : "block";
  }

  function initializeGifPreviewBackground() {
    const panel = document.querySelector(".gif-preview-panel");
    const wrap = panel?.querySelector(".gif-preview-wrap");
    const header = panel?.querySelector(".preview-card-header");
    if (!panel || !wrap || !header || panel.querySelector("#gifPreviewBgTools")) return;

    const style = document.createElement("style");
    style.textContent = `
      #gifPreviewBgTools {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 9px 12px;
        border-bottom: 1px solid var(--line);
        background: #fbfcfd;
      }
      #gifPreviewBgTools .gif-bg-label {
        color: #344451;
        font-size: 0.8rem;
        font-weight: 700;
      }
      #gifPreviewBgTools input[type="color"] {
        width: 42px;
        height: 32px;
      }
      #gifPreviewBgTools button {
        padding: 0.42rem 0.65rem;
        font-size: 0.78rem;
      }
      .gif-preview-wrap.gif-bg-custom {
        background: var(--gif-preview-bg, #ffffff) !important;
      }
      .gif-preview-wrap.gif-bg-checker {
        background:
          linear-gradient(45deg, #eef1f4 25%, transparent 25%),
          linear-gradient(-45deg, #eef1f4 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #eef1f4 75%),
          linear-gradient(-45deg, transparent 75%, #eef1f4 75%) !important;
        background-size: 20px 20px !important;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0 !important;
        background-color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);

    const tools = document.createElement("div");
    tools.id = "gifPreviewBgTools";

    const label = document.createElement("span");
    label.className = "gif-bg-label";
    label.textContent = "背景";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.id = "gifPreviewBgColor";
    colorInput.title = "GIFプレビュー背景色";

    const checkerButton = document.createElement("button");
    checkerButton.type = "button";
    checkerButton.className = "secondary-button";
    checkerButton.textContent = "市松";

    tools.appendChild(label);
    tools.appendChild(colorInput);
    tools.appendChild(checkerButton);
    header.insertAdjacentElement("afterend", tools);

    const STORAGE_COLOR = "imageSplitTool.gifPreviewBgColor";
    const STORAGE_MODE = "imageSplitTool.gifPreviewBgMode";

    function setColorBackground(color, save = true) {
      wrap.classList.remove("gif-bg-checker");
      wrap.classList.add("gif-bg-custom");
      wrap.style.setProperty("--gif-preview-bg", color);
      colorInput.value = color;
      if (save) {
        localStorage.setItem(STORAGE_COLOR, color);
        localStorage.setItem(STORAGE_MODE, "color");
      }
    }

    function setCheckerBackground(save = true) {
      wrap.classList.remove("gif-bg-custom");
      wrap.classList.add("gif-bg-checker");
      wrap.style.removeProperty("--gif-preview-bg");
      if (save) localStorage.setItem(STORAGE_MODE, "checker");
    }

    colorInput.addEventListener("input", () => setColorBackground(colorInput.value));
    checkerButton.addEventListener("click", () => setCheckerBackground());

    const savedColor = localStorage.getItem(STORAGE_COLOR) || "#ffffff";
    const savedMode = localStorage.getItem(STORAGE_MODE) || "checker";
    colorInput.value = savedColor;
    if (savedMode === "color") setColorBackground(savedColor, false);
    else setCheckerBackground(false);
  }

  [splitXInput, splitYInput, resizeWidthInput, resizeHeightInput].forEach((input) => {
    input?.addEventListener("input", updateImageInfo);
  });

  gifDelayInput?.addEventListener("input", updateGifFps);

  directionInput?.addEventListener("change", () => {
    if (typeof window.renderOutput === "function") window.renderOutput();
  });

  document.getElementById("imageInput")?.addEventListener("change", () => {
    requestAnimationFrame(() => {
      const checkLoaded = () => {
        updateImageInfo();
        if (image?.complete && image.width) return;
        requestAnimationFrame(checkLoaded);
      };
      checkLoaded();
    });
  });

  editorArea?.addEventListener("change", updateFrameUi);

  if (editorArea) {
    const observer = new MutationObserver(updateFrameUi);
    observer.observe(editorArea, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  // 新UIでは旧タブ表示を使わないため、画面の表示状態だけ切り替えない。
  // 分割・PNG/GIF生成そのものは script.js の元の処理をそのまま利用する。
  switchTab = function() {};

  // UI名称だけ新レイアウトに合わせる。
  toggleEffectPanel = function() {
    const body = document.getElementById("effectBody");
    const btn = document.getElementById("effectToggleBtn");
    if (!body || !btn) return;
    const isHidden = body.classList.toggle("collapsed");
    btn.textContent = isHidden ? "詳細設定 ▶" : "詳細設定 ▼";
  };

  // 初期状態では空canvasを非表示に近い状態にしておく。
  if (outputCanvas && !editorArea?.querySelector(".frame")) {
    outputCanvas.width = 0;
    outputCanvas.height = 0;
  }

  updateImageInfo();
  updateGifFps();
  updateFrameUi();
  initializeGifPreviewBackground();
})();