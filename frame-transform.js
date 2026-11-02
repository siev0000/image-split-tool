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
        margin-top: 8px;
      }
      .frame-transform-actions button {
        padding: 0.45rem 0.7rem;
        background: #7c8c98;
        font-size: 0.78rem;
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
        <button type="button" id="resetFrameTransform">位置・拡大をリセット</button>
      </div>
      <div class="frame-transform-note">全フレーム共通。拡大後にX/Yを動かすと、ズーム位置を左右・上下へずらせます。</div>
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
  const resetBtn = document.getElementById("resetFrameTransform");

  if (!zoomInput || !zoomRange || !xInput || !xRange || !yInput || !yRange || !resetBtn) return;

  function getSettings() {
    return {
      zoom: clamp(parseFloat(zoomInput.value) || 100, 25, 400),
      x: clamp(parseFloat(xInput.value) || 0, -100, 100),
      y: clamp(parseFloat(yInput.value) || 0, -100, 100)
    };
  }

  function syncPair(numberInput, rangeInput, min, max) {
    const value = clamp(parseFloat(numberInput.value) || 0, min, max);
    numberInput.value = String(value);
    rangeInput.value = String(value);
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getSettings()));
    } catch (error) {
      console.warn("位置・拡大設定の保存に失敗しました", error);
    }
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        zoomInput.value = String(clamp(parseFloat(saved.zoom) || 100, 25, 400));
        xInput.value = String(clamp(parseFloat(saved.x) || 0, -100, 100));
        yInput.value = String(clamp(parseFloat(saved.y) || 0, -100, 100));
      }
    } catch (error) {
      console.warn("位置・拡大設定の復元に失敗しました", error);
    }

    syncPair(zoomInput, zoomRange, 25, 400);
    syncPair(xInput, xRange, -100, 100);
    syncPair(yInput, yRange, -100, 100);
  }

  function redraw() {
    if (typeof window.redrawEditorFrames === "function") {
      window.redrawEditorFrames();
    }
    if (typeof window.renderOutput === "function") {
      window.renderOutput();
    }
  }

  function bindPair(numberInput, rangeInput, min, max) {
    rangeInput.addEventListener("input", () => {
      numberInput.value = rangeInput.value;
      saveSettings();
      redraw();
    });

    numberInput.addEventListener("input", () => {
      if (numberInput.value === "" || numberInput.value === "-") return;
      syncPair(numberInput, rangeInput, min, max);
      saveSettings();
      redraw();
    });

    numberInput.addEventListener("change", () => {
      syncPair(numberInput, rangeInput, min, max);
      saveSettings();
      redraw();
    });
  }

  // script.js の描画処理を、元のエフェクトを保ったまま全フレーム共通のズーム/位置調整対応にする。
  window.drawPieceOnCanvas = function(canvas, piece, extraHue = 0) {
    const ctx = canvas.getContext("2d");
    canvas.width = piece.w;
    canvas.height = piece.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const settings = getSettings();
    const scale = settings.zoom / 100;
    const offsetX = piece.w * (settings.x / 100);
    const offsetY = piece.h * (settings.y / 100);
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

  bindPair(zoomInput, zoomRange, 25, 400);
  bindPair(xInput, xRange, -100, 100);
  bindPair(yInput, yRange, -100, 100);

  resetBtn.addEventListener("click", () => {
    zoomInput.value = "100";
    xInput.value = "0";
    yInput.value = "0";
    syncPair(zoomInput, zoomRange, 25, 400);
    syncPair(xInput, xRange, -100, 100);
    syncPair(yInput, yRange, -100, 100);
    saveSettings();
    redraw();
  });

  restoreSettings();
  redraw();
})();
