(() => {
  const STORAGE_KEY = "imageSplitTool.gifBackground";

  function ensureBackgroundControls() {
    const gifSettingBox = document.querySelector(".gif-setting-box");
    if (!gifSettingBox) return { modeInput: null, colorInput: null };

    let modeInput = document.getElementById("gifBackgroundMode");
    let colorInput = document.getElementById("gifBackgroundColor");

    if (!modeInput || !colorInput) {
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

      modeInput = document.getElementById("gifBackgroundMode");
      colorInput = document.getElementById("gifBackgroundColor");
    }

    return { modeInput, colorInput };
  }

  function clearOldPreviewBackground() {
    document.querySelector(".gif-preview-tools")?.remove();

    const wrap = document.querySelector(".gif-preview-wrap");
    if (wrap) {
      wrap.classList.remove("custom-bg");
      wrap.style.removeProperty("--gif-preview-bg");
      wrap.style.removeProperty("background");
      wrap.style.removeProperty("background-color");
    }

    const preview = document.getElementById("gifPreview");
    if (preview) preview.style.background = "transparent";
  }

  function patchGifJsBackgroundBug() {
    if (typeof GIF !== "function" || !GIF.prototype) return;
    if (GIF.prototype.__imageSplitBackgroundFixed) return;

    // 同梱gif.jsでは getImageData() 内が
    // ctx.setFill = this.options.background になっており、fillRect() が黒で実行される。
    // 正しい fillStyle を使う処理へ差し替える。
    GIF.prototype.getImageData = function(image) {
      if (this._canvas == null) {
        this._canvas = document.createElement("canvas");
        this._canvas.width = this.options.width;
        this._canvas.height = this.options.height;
      }

      const ctx = this._canvas.getContext("2d");
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, this.options.width, this.options.height);
      ctx.fillStyle = this.options.background || "#ffffff";
      ctx.fillRect(0, 0, this.options.width, this.options.height);
      ctx.drawImage(image, 0, 0);
      ctx.restore();

      return this.getContextData(ctx);
    };

    GIF.prototype.__imageSplitBackgroundFixed = true;
  }

  const { modeInput, colorInput } = ensureBackgroundControls();
  if (!modeInput || !colorInput) return;

  clearOldPreviewBackground();
  patchGifJsBackgroundBug();

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

  createGIF = function() {
    const frames = document.querySelectorAll("#editorArea .frame");
    const delay = parseInt(document.getElementById("gifDelay").value, 10) || 500;
    const hueStep = parseFloat(document.getElementById("gifHueStep").value) || 0;
    const backgroundMode = modeInput.value || "transparent";
    const backgroundColor = colorInput.value || "#ffffff";

    const gifStatus = document.getElementById("gifStatus");
    const gifPreview = document.getElementById("gifPreview");
    const downloadGifBtn = document.getElementById("downloadGifBtn");
    const applyAndGifBtn = document.getElementById("applyAndGifBtn");
    const applyFrameChangesBtn = document.getElementById("applyFrameChangesBtn");

    if (frames.length === 0) return alert("フレームがありません");

    const visibleFrames = Array.from(frames).filter(
      (frame) => !frame.querySelector(".remove")?.checked
    );
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

    const backgroundLabel =
      backgroundMode === "color" ? `背景 ${backgroundColor}` : "背景 透明";

    if (gifStatus) gifStatus.textContent = `GIF生成中... 0.0%（${backgroundLabel}）`;
    if (downloadGifBtn) downloadGifBtn.disabled = true;
    if (applyAndGifBtn) applyAndGifBtn.disabled = true;
    if (applyFrameChangesBtn) applyFrameChangesBtn.disabled = true;

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: resolveWorkerScriptUrl(),
      background: backgroundMode === "color" ? backgroundColor : "#ffffff"
    });
    activeGifRender = gif;

    let frameIndex = 0;

    visibleFrames.forEach((frame) => {
      const canvas = frame.querySelector("canvas");
      if (!canvas) return;

      let sourceCanvas = canvas;

      if (hueStep !== 0) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d", { alpha: true });
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.save();
        tempCtx.filter = `hue-rotate(${frameIndex * hueStep}deg)`;
        tempCtx.drawImage(canvas, 0, 0);
        tempCtx.restore();
        sourceCanvas = tempCanvas;
      }

      if (backgroundMode === "color") {
        // copy:false にすることで gif.js の getImageData() を通し、
        // background色を透明部分へ確実に合成する。
        gif.addFrame(sourceCanvas, { delay, copy: false });
      } else {
        // 透明設定は従来挙動を維持する。
        gif.addFrame(sourceCanvas, { delay, copy: true });
      }

      frameIndex++;
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
