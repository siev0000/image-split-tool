(() => {
  const STORAGE_KEY = "imageSplitTool.gifBackground";

  function ensureBackgroundControls() {
    const gifSettingBox = document.querySelector(".gif-setting-box");
    if (!gifSettingBox) return { modeInput: null, colorInput: null };

    document.querySelector(".gif-preview-tools")?.remove();
    document.querySelector(".gif-background-settings")?.remove();

    const settingsRow = document.createElement("div");
    settingsRow.className = "two-fields compact-fields gif-background-settings";
    settingsRow.innerHTML = `
      <label>GIF映像の背景
        <select id="gifBackgroundMode">
          <option value="transparent">透明</option>
          <option value="color">色を付ける</option>
        </select>
      </label>
      <label>背景色
        <input type="color" id="gifBackgroundColor" value="#ffffff">
      </label>
    `;

    const fpsInfo = document.getElementById("gifFpsInfo");
    if (fpsInfo) gifSettingBox.insertBefore(settingsRow, fpsInfo);
    else gifSettingBox.appendChild(settingsRow);

    return {
      modeInput: document.getElementById("gifBackgroundMode"),
      colorInput: document.getElementById("gifBackgroundColor")
    };
  }

  function resetPreviewOnlyBackground() {
    const wrap = document.querySelector(".gif-preview-wrap");
    if (wrap) {
      wrap.classList.remove("custom-bg");
      wrap.style.removeProperty("--gif-preview-bg");
      wrap.style.removeProperty("background");
      wrap.style.removeProperty("background-color");
    }

    const preview = document.getElementById("gifPreview");
    if (preview) {
      preview.style.background = "transparent";
    }
  }

  const { modeInput, colorInput } = ensureBackgroundControls();
  if (!modeInput || !colorInput) return;

  resetPreviewOnlyBackground();

  function updateColorState() {
    colorInput.disabled = modeInput.value !== "color";
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: modeInput.value, color: colorInput.value })
      );
    } catch (error) {
      console.warn("GIF背景設定の保存に失敗しました", error);
    }
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.mode === "transparent" || saved?.mode === "color") {
        modeInput.value = saved.mode;
      }
      if (typeof saved?.color === "string" && /^#[0-9a-f]{6}$/i.test(saved.color)) {
        colorInput.value = saved.color;
      }
    } catch (error) {
      console.warn("GIF背景設定の復元に失敗しました", error);
    }
    updateColorState();
  }

  modeInput.addEventListener("change", () => {
    updateColorState();
    saveSettings();
  });
  colorInput.addEventListener("input", saveSettings);

  restoreSettings();

  function buildGifFrame(sourceCanvas, frameIndex, hueStep, backgroundMode, backgroundColor) {
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = sourceCanvas.width;
    frameCanvas.height = sourceCanvas.height;

    const ctx = frameCanvas.getContext("2d", { alpha: true });
    ctx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);

    // 背景色は「プレビュー領域」ではなく、GIFへ渡す各フレームそのものへ描画する。
    if (backgroundMode === "color") {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
      ctx.restore();
    }

    ctx.save();
    if (hueStep !== 0) {
      ctx.filter = `hue-rotate(${frameIndex * hueStep}deg)`;
    }
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return frameCanvas;
  }

  createGIF = function() {
    const frames = Array.from(document.querySelectorAll("#editorArea .frame"));
    const delay = parseInt(document.getElementById("gifDelay").value, 10) || 500;
    const hueStep = parseFloat(document.getElementById("gifHueStep").value) || 0;
    const backgroundMode = modeInput.value || "transparent";
    const backgroundColor = colorInput.value || "#ffffff";

    const gifStatus = document.getElementById("gifStatus");
    const gifPreview = document.getElementById("gifPreview");
    const downloadGifBtn = document.getElementById("downloadGifBtn");
    const applyAndGifBtn = document.getElementById("applyAndGifBtn");
    const applyFrameChangesBtn = document.getElementById("applyFrameChangesBtn");

    const visibleFrames = frames.filter((frame) => !frame.querySelector(".remove")?.checked);
    if (visibleFrames.length === 0) return alert("表示中のフレームがありません");

    if (activeGifRender) {
      try {
        activeGifRender.abort();
      } catch (_) {}
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
      gifPreview.style.background = "transparent";
    }
    resetPreviewOnlyBackground();

    const backgroundLabel =
      backgroundMode === "color" ? `背景 ${backgroundColor}` : "背景 透明";

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

    visibleFrames.forEach((frame, index) => {
      const sourceCanvas = frame.querySelector("canvas");
      if (!sourceCanvas) return;

      const encodedCanvas = buildGifFrame(
        sourceCanvas,
        index,
        hueStep,
        backgroundMode,
        backgroundColor
      );

      // CanvasRenderingContext2D を渡すことで gif.js 側の壊れた背景塗り処理を通さず、
      // 上で完成させたピクセルをそのままGIFへ渡す。
      const encodedContext = encodedCanvas.getContext("2d", { alpha: true });
      gif.addFrame(encodedContext, { delay, copy: true });
    });

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
})();
