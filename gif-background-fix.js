(() => {
  const STORAGE_KEY = "imageSplitTool.gifBackground";

  function removeLegacyPreviewControls() {
    document.querySelector(".gif-preview-tools")?.remove();
    document.getElementById("gifPreviewBgColor")?.closest("label")?.remove();
    document.getElementById("resetGifPreviewBgBtn")?.remove();

    document.querySelectorAll(".gif-preview-panel input[type='color']").forEach((input) => {
      input.closest("label")?.remove();
    });

    document.querySelectorAll(".gif-preview-panel button").forEach((button) => {
      const text = (button.textContent || "").trim();
      if (text.includes("市松") || text.includes("背景")) button.remove();
    });
  }

  function lockPreviewSurface() {
    const wrap = document.querySelector(".gif-preview-wrap");
    if (wrap) {
      wrap.classList.remove("custom-bg");
      wrap.style.removeProperty("--gif-preview-bg");
      wrap.style.setProperty("background", "#f2f4f6", "important");
      wrap.style.removeProperty("background-color");
    }

    const preview = document.getElementById("gifPreview");
    if (preview) {
      preview.style.setProperty("background", "transparent", "important");
    }
  }

  function ensureBackgroundControl() {
    const gifSettingBox = document.querySelector(".gif-setting-box");
    if (!gifSettingBox) return null;

    removeLegacyPreviewControls();
    document.querySelector(".gif-background-settings")?.remove();

    const row = document.createElement("div");
    row.className = "gif-background-settings";
    row.innerHTML = `
      <label style="display:grid;gap:6px;margin-top:10px;">
        GIF映像の背景色
        <input type="color" id="gifBackgroundColor" value="#ffffff">
      </label>
    `;

    const fpsInfo = document.getElementById("gifFpsInfo");
    if (fpsInfo) gifSettingBox.insertBefore(row, fpsInfo);
    else gifSettingBox.appendChild(row);

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

    // alpha:false で不透明Canvasを作り、GIFへ渡す前に背景色を確定させる。
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

    removeLegacyPreviewControls();
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

  colorInput.addEventListener("input", saveColor);
  colorInput.addEventListener("change", () => {
    saveColor();
    removeLegacyPreviewControls();
    lockPreviewSurface();

    if (document.querySelector("#editorArea .frame")) {
      createGIF();
    }
  });

  // 旧UIがキャッシュ済みスクリプトから後挿入されても消す。
  const observer = new MutationObserver(() => {
    removeLegacyPreviewControls();
    lockPreviewSurface();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
