(() => {
  const STORAGE_KEY = "imageSplitTool.gifBackground";

  function lockPreviewSurface() {
    const wrap = document.querySelector(".gif-preview-wrap");
    if (wrap) {
      wrap.classList.remove("custom-bg");
      wrap.style.removeProperty("--gif-preview-bg");
      wrap.style.setProperty("background", "#f2f4f6", "important");
      wrap.style.setProperty("background-color", "#f2f4f6", "important");
    }

    const preview = document.getElementById("gifPreview");
    if (preview) {
      preview.style.setProperty("background", "transparent", "important");
    }
  }

  function ensureBackgroundControl() {
    const panel = document.querySelector(".gif-preview-panel");
    if (!panel) return null;

    // 以前の実装で作られたカラーピッカーが画面上に残っている場合は、
    // そのピッカー自体をGIF映像の背景色入力として再利用する。
    const legacyInput = document.getElementById("gifPreviewBgColor");
    if (legacyInput) {
      legacyInput.dataset.gifBackgroundSource = "true";
      const label = legacyInput.closest("label");
      if (label) {
        const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.textContent = "GIF映像の背景色 ";
      }
      document.getElementById("resetGifPreviewBgBtn")?.remove();
      document.querySelectorAll(".gif-preview-panel button").forEach((button) => {
        if ((button.textContent || "").includes("市松")) button.remove();
      });
      return legacyInput;
    }

    // 新UI用。GIFプレビュー直下に1つだけ置く。
    document.querySelector(".gif-background-settings")?.remove();

    let row = document.querySelector(".gif-encoded-background-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "gif-encoded-background-row";
      row.style.cssText = "padding:8px 12px;border-bottom:1px solid #d9e1e8;background:#fff;display:flex;align-items:center;gap:10px;";
      row.innerHTML = `
        <label style="display:flex;align-items:center;gap:10px;font-size:.85rem;font-weight:650;">
          GIF映像の背景色
          <input type="color" id="gifBackgroundColor" value="#ffffff">
        </label>
      `;
      const wrap = panel.querySelector(".gif-preview-wrap");
      if (wrap) panel.insertBefore(row, wrap);
      else panel.appendChild(row);
    }

    return document.getElementById("gifBackgroundColor");
  }

  const colorInput = ensureBackgroundControl();
  if (!colorInput) return;

  function restoreColor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const color = typeof saved === "string" ? saved : saved?.color;
      if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) {
        colorInput.value = color;
      }
    } catch (error) {
      console.warn("GIF背景色の復元に失敗しました", error);
    }
  }

  function saveColor() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ color: colorInput.value }));
    } catch (error) {
      console.warn("GIF背景色の保存に失敗しました", error);
    }
  }

  function buildGifFrame(sourceCanvas, frameIndex, hueStep, backgroundColor) {
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = sourceCanvas.width;
    frameCanvas.height = sourceCanvas.height;

    // ここが実際にGIFの四角い映像領域になる。
    // 白固定ではなく、画面の背景色ピッカーの値で全面を塗る。
    const ctx = frameCanvas.getContext("2d", { alpha: false });
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);

    ctx.save();
    if (hueStep !== 0) {
      ctx.filter = `hue-rotate(${frameIndex * hueStep}deg)`;
    }
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return frameCanvas;
  }

  restoreColor();
  lockPreviewSurface();

  createGIF = function() {
    const frames = Array.from(document.querySelectorAll("#editorArea .frame"));
    const delay = parseInt(document.getElementById("gifDelay")?.value, 10) || 500;
    const hueStep = parseFloat(document.getElementById("gifHueStep")?.value) || 0;
    const backgroundColor = colorInput.value || "#ffffff";

    const gifStatus = document.getElementById("gifStatus");
    const gifPreview = document.getElementById("gifPreview");
    const downloadGifBtn = document.getElementById("downloadGifBtn");
    const applyAndGifBtn = document.getElementById("applyAndGifBtn");
    const applyFrameChangesBtn = document.getElementById("applyFrameChangesBtn");

    const visibleFrames = frames.filter((frame) => !frame.querySelector(".remove")?.checked);
    if (visibleFrames.length === 0) return alert("表示中のフレームがありません");

    if (activeGifRender) {
      try { activeGifRender.abort(); } catch (_) {}
      activeGifRender = null;
    }

    const currentToken = ++gifRenderToken;

    if (generatedGifUrl) {
      URL.revokeObjectURL(generatedGifUrl);
      generatedGifUrl = null;
    }

    if (gifPreview) {
      gifPreview.removeAttribute("src");
      gifPreview.style.display = "none";
    }
    lockPreviewSurface();

    const backgroundLabel = `背景 ${backgroundColor}`;
    if (gifStatus) gifStatus.textContent = `GIF生成中... 0.0%（${backgroundLabel}）`;
    if (downloadGifBtn) downloadGifBtn.disabled = true;
    if (applyAndGifBtn) applyAndGifBtn.disabled = true;
    if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = true;

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: resolveWorkerScriptUrl()
    });
    activeGifRender = gif;

    let addedFrames = 0;
    visibleFrames.forEach((frame, index) => {
      const sourceCanvas = frame.querySelector("canvas");
      if (!sourceCanvas) return;

      const encodedCanvas = buildGifFrame(
        sourceCanvas,
        index,
        hueStep,
        backgroundColor
      );

      gif.addFrame(encodedCanvas, { delay, copy: true });
      addedFrames++;
    });

    if (addedFrames === 0) {
      activeGifRender = null;
      if (gifStatus) gifStatus.textContent = "GIF生成エラー: 有効なフレームがありません";
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = false;
      return;
    }

    gif.on("progress", function(progress) {
      if (currentToken !== gifRenderToken || !gifStatus) return;
      const percent = Math.max(0, Math.min(100, progress * 100));
      gifStatus.textContent = `GIF生成中... ${percent.toFixed(1)}%（${backgroundLabel}）`;
    });

    gif.on("finished", function(blob) {
      if (currentToken !== gifRenderToken) return;
      activeGifRender = null;
      generatedGifUrl = URL.createObjectURL(blob);

      if (gifPreview) {
        gifPreview.src = generatedGifUrl;
        gifPreview.style.display = "block";
      }
      lockPreviewSurface();

      if (gifStatus) {
        gifStatus.textContent = `GIF生成完了 100.0%（${backgroundLabel}・下で再生中）`;
      }
      if (downloadGifBtn) downloadGifBtn.disabled = false;
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = false;
    });

    gif.on("abort", function() {
      if (currentToken !== gifRenderToken) return;
      activeGifRender = null;
      if (gifStatus) gifStatus.textContent = "GIF生成を中断しました。";
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = false;
    });

    gif.on("error", function(err) {
      if (currentToken !== gifRenderToken) return;
      activeGifRender = null;
      const message = err?.message || err?.filename || "workerの読み込みに失敗しました";
      if (gifStatus) gifStatus.textContent = `GIF生成エラー: ${buildGifErrorMessage(message)}`;
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = false;
      if (downloadGifBtn) downloadGifBtn.disabled = true;
    });

    try {
      gif.render();
    } catch (err) {
      activeGifRender = null;
      const message = err?.message || "不明なエラー";
      if (gifStatus) gifStatus.textContent = `GIF生成エラー: ${buildGifErrorMessage(message)}`;
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = false;
      if (downloadGifBtn) downloadGifBtn.disabled = true;
    }
  };

  colorInput.addEventListener("input", () => {
    saveColor();
    lockPreviewSurface();
  });

  colorInput.addEventListener("change", () => {
    saveColor();
    lockPreviewSurface();
    if (document.querySelector("#editorArea .frame")) createGIF();
  });
})();
