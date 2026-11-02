(() => {
  const STORAGE_KEY = "imageSplitTool.frameTransform";
  const originalDrawPieceOnCanvas = window.drawPieceOnCanvas;

  if (typeof originalDrawPieceOnCanvas !== "function") {
    console.warn("フレーム位置調整を初期化できませんでした");
    return;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function injectStyle() {
    if (document.getElementById("frameTransformStyle")) return;
    const style = document.createElement("style");
    style.id = "frameTransformStyle";
    style.textContent = `
      .frame-transform-block {
        padding: 13px 0;
        border-top: 1px solid #edf1f4;
      }
      .frame-transform-grid {
        display: grid;
        gap: 10px;
        margin-top: 8px;
      }
      .frame-transform-row {
        display: grid;
        grid-template-columns: 82px minmax(0, 1fr) 72px;
        align-items: center;
        gap: 8px;
      }
      .frame-transform-row label {
        color: #344451;
        font-size: 0.8rem;
        font-weight: 650;
      }
      .frame-transform-row input[type="range"] {
        min-width: 0;
      }
      .frame-transform-row input[type="number"] {
        width: 72px;
        min-height: 34px;
        padding: 0.35rem 0.45rem;
      }
      .frame-transform-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
      }
      .frame-transform-actions button {
        padding: 0.5rem 0.75rem;
        font-size: 0.78rem;
      }
      #applyFrameTransform {
        background: var(--primary, #2f80ed);
      }
      #resetFrameTransform {
        background: #7c8c98;
      }
      .frame-transform-note {
        margin-top: 7px;
        color: var(--muted, #667784);
        font-size: 0.75rem;
        line-height: 1.45;
      }
    `;
    document.head.appendChild(style);
  }

  function injectControls() {
    if (document.getElementById("frameZoom")) return;

    const rotation = document.getElementById("rotation");
    const rotationBlock = rotation?.closest(".field-block");
    if (!rotationBlock) return;

    const block = document.createElement("div");
    block.className = "frame-transform-block";
    block.innerHTML = `
      <span class="field-label">全体の位置・拡大</span>
      <div class="frame-transform-grid">
        <div class="frame-transform-row">
          <label for="frameZoom">拡大率</label>
          <input type="range" id="frameZoomRange" min="25" max="400" step="1" value="100">
          <input type="number" id="frameZoom" min="25" max="400" step="1" value="100" title="拡大率（%）">
        </div>
        <div class="frame-transform-row">
          <label for="frameOffsetX">X位置</label>
          <input type="range" id="frameOffsetXRange" min="-100" max="100" step="1" value="0">
          <input type="number" id="frameOffsetX" min="-100" max="100" step="1" value="0" title="横位置（%）">
        </div>
        <div class="frame-transform-row">
          <label for="frameOffsetY">Y位置</label>
          <input type="range" id="frameOffsetYRange" min="-100" max="100" step="1" value="0">
          <input type="number" id="frameOffsetY" min="-100" max="100" step="1" value="0" title="縦位置（%）">
        </div>
      </div>
      <div class="frame-transform-actions">
        <button type="button" id="resetFrameTransform">リセット</button>
        <button type="button" id="applyFrameTransform">位置・拡大を反映</button>
      </div>
      <div class="frame-transform-note">入力中は再描画しません。数値を決めて「位置・拡大を反映」を押すと、全フレームへまとめて反映します。</div>
    `;

    rotationBlock.insertAdjacentElement("afterend", block);
  }

  injectStyle();
  injectControls();

  const zoomInput = document.getElementById("frameZoom");
  const zoomRange = document.getElementById("frameZoomRange");
  const xInput = document.getElementById("frameOffsetX");
  const xRange = document.getElementById("frameOffsetXRange");
  const yInput = document.getElementById("frameOffsetY");
  const yRange = document.getElementById("frameOffsetYRange");
  const applyBtn = document.getElementById("applyFrameTransform");
  const resetBtn = document.getElementById("resetFrameTransform");

  if (!zoomInput || !zoomRange || !xInput || !xRange || !yInput || !yRange || !applyBtn || !resetBtn) return;

  let appliedSettings = { zoom: 100, x: 0, y: 0 };

  function getInputSettings() {
    return {
      zoom: clamp(parseFloat(zoomInput.value) || 100, 25, 400),
      x: clamp(parseFloat(xInput.value) || 0, -100, 100),
      y: clamp(parseFloat(yInput.value) || 0, -100, 100)
    };
  }

  function syncPair(numberInput, rangeInput, min, max, fallback = 0) {
    const raw = parseFloat(numberInput.value);
    const value = clamp(Number.isFinite(raw) ? raw : fallback, min, max);
    numberInput.value = String(value);
    rangeInput.value = String(value);
    return value;
  }

  function syncAllInputs() {
    const zoom = syncPair(zoomInput, zoomRange, 25, 400, 100);
    const x = syncPair(xInput, xRange, -100, 100, 0);
    const y = syncPair(yInput, yRange, -100, 100, 0);
    return { zoom, x, y };
  }

  function saveAppliedSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appliedSettings));
    } catch (error) {
      console.warn("位置・拡大設定の保存に失敗しました", error);
    }
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        appliedSettings = {
          zoom: clamp(parseFloat(saved.zoom) || 100, 25, 400),
          x: clamp(parseFloat(saved.x) || 0, -100, 100),
          y: clamp(parseFloat(saved.y) || 0, -100, 100)
        };
      }
    } catch (error) {
      console.warn("位置・拡大設定の復元に失敗しました", error);
    }

    zoomInput.value = String(appliedSettings.zoom);
    xInput.value = String(appliedSettings.x);
    yInput.value = String(appliedSettings.y);
    syncAllInputs();
  }

  function redraw() {
    if (typeof window.redrawEditorFrames === "function") {
      window.redrawEditorFrames();
    }
    if (typeof window.renderOutput === "function") {
      window.renderOutput();
    }
  }

  function bindPair(numberInput, rangeInput, min, max, fallback) {
    rangeInput.addEventListener("input", () => {
      numberInput.value = rangeInput.value;
    });

    numberInput.addEventListener("input", () => {
      if (numberInput.value === "" || numberInput.value === "-") return;
      const raw = parseFloat(numberInput.value);
      if (!Number.isFinite(raw)) return;
      rangeInput.value = String(clamp(raw, min, max));
    });

    numberInput.addEventListener("change", () => {
      syncPair(numberInput, rangeInput, min, max, fallback);
    });
  }

  // 実際の描画では「入力中の値」ではなく「反映済みの値」だけを使う。
  window.drawPieceOnCanvas = function(canvas, piece, extraHue = 0) {
    const ctx = canvas.getContext("2d");
    canvas.width = piece.w;
    canvas.height = piece.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = appliedSettings.zoom / 100;
    const offsetX = piece.w * (appliedSettings.x / 100);
    const offsetY = piece.h * (appliedSettings.y / 100);
    const drawW = piece.w * scale;
    const drawH = piece.h * scale;

    ctx.save();
    ctx.filter = typeof window.buildFilterString === "function"
      ? window.buildFilterString(extraHue)
      : "none";
    ctx.translate(piece.w / 2 + offsetX, piece.h / 2 + offsetY);
    ctx.rotate(piece.angle * Math.PI / 180);
    ctx.drawImage(
      image,
      piece.sx,
      piece.sy,
      piece.partW,
      piece.partH,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );
    ctx.restore();

    if (typeof window.applyTint === "function") {
      window.applyTint(ctx, piece.w, piece.h);
    }
  };

  bindPair(zoomInput, zoomRange, 25, 400, 100);
  bindPair(xInput, xRange, -100, 100, 0);
  bindPair(yInput, yRange, -100, 100, 0);

  applyBtn.addEventListener("click", () => {
    appliedSettings = syncAllInputs();
    saveAppliedSettings();
    redraw();
  });

  resetBtn.addEventListener("click", () => {
    zoomInput.value = "100";
    xInput.value = "0";
    yInput.value = "0";
    appliedSettings = syncAllInputs();
    saveAppliedSettings();
    redraw();
  });

  restoreSettings();
  redraw();
})();
