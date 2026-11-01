(() => {
  const STORAGE_KEY = "imageSplitTool.splitSettings";
  const splitX = document.getElementById("splitX");
  const splitY = document.getElementById("splitY");

  if (!splitX || !splitY) return;

  function normalize(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;

      splitX.value = String(normalize(saved.x, normalize(splitX.value, 5)));
      splitY.value = String(normalize(saved.y, normalize(splitY.value, 3)));

      splitX.dispatchEvent(new Event("input", { bubbles: true }));
      splitY.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (error) {
      console.warn("分割数の復元に失敗しました", error);
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          x: normalize(splitX.value, 1),
          y: normalize(splitY.value, 1)
        })
      );
    } catch (error) {
      console.warn("分割数の保存に失敗しました", error);
    }
  }

  splitX.addEventListener("input", save);
  splitY.addEventListener("input", save);
  splitX.addEventListener("change", save);
  splitY.addEventListener("change", save);

  restore();
})();

(() => {
  const STORAGE_KEY = "imageSplitTool.gifBackground";
  const gifSettingBox = document.querySelector(".gif-setting-box");
  if (!gifSettingBox) return;

  // 旧実装の「プレビュー領域の背景色変更」が残っている場合は解除する。
  document.querySelector(".gif-preview-tools")?.remove();
  const gifPreviewWrap = document.querySelector(".gif-preview-wrap");
  if (gifPreviewWrap) {
    gifPreviewWrap.classList.remove("custom-bg");
    gifPreviewWrap.style.removeProperty("--gif-preview-bg");
    gifPreviewWrap.style.removeProperty("background");
    gifPreviewWrap.style.removeProperty("background-color");
  }

  // 二重追加防止。
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
  if (fpsInfo) {
    gifSettingBox.insertBefore(settingsRow, fpsInfo);
  } else {
    gifSettingBox.appendChild(settingsRow);
  }

  const modeInput = document.getElementById("gifBackgroundMode");
  const colorInput = document.getElementById("gifBackgroundColor");

  function updateColorState() {
    if (!modeInput || !colorInput) return;
    colorInput.disabled = modeInput.value !== "color";
  }

  function saveBackgroundSettings() {
    if (!modeInput || !colorInput) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: modeInput.value, color: colorInput.value })
      );
    } catch (error) {
      console.warn("GIF背景設定の保存に失敗しました", error);
    }
  }

  function restoreBackgroundSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.mode === "color" || saved?.mode === "transparent") {
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

  modeInput?.addEventListener("change", () => {
    updateColorState();
    saveBackgroundSettings();
  });
  colorInput?.addEventListener("input", saveBackgroundSettings);

  restoreBackgroundSettings();

  // GIF生成時に、透明部分の後ろへ指定色を実際に合成する。
  createGIF = function() {
    const frames = document.querySelectorAll("#editorArea .frame");
    const delay = parseInt(document.getElementById("gifDelay").value) || 500;
    const hueStep = parseFloat(document.getElementById("gifHueStep").value) || 0;
    const backgroundMode = modeInput?.value || "transparent";
    const backgroundColor = colorInput?.value || "#ffffff";
    const gifStatus = document.getElementById("gifStatus");
    const gifPreview = document.getElementById("gifPreview");
    const downloadGifBtn = document.getElementById("downloadGifBtn");
    const applyAndGifBtn = document.getElementById("applyAndGifBtn");

    if (frames.length === 0) return alert("フレームがありません");
    const visibleFrameCount = Array.from(frames).filter((frame) => !frame.querySelector(".remove")?.checked).length;
    if (visibleFrameCount === 0) return alert("表示中のフレームがありません");

    if (activeGifRender) {
      try {
        activeGifRender.abort();
      } catch (_) {
        // no-op
      }
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
    if (gifStatus) gifStatus.textContent = "GIF生成中... 0.0%";
    if (downloadGifBtn) downloadGifBtn.disabled = true;
    if (applyAndGifBtn) applyAndGifBtn.disabled = true;

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: resolveWorkerScriptUrl()
    });
    activeGifRender = gif;

    let frameIndex = 0;
    frames.forEach((frame) => {
      if (frame.querySelector(".remove")?.checked) return;
      const canvas = frame.querySelector("canvas");
      if (!canvas) return;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d", { alpha: true });
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      if (hueStep !== 0) {
        tempCtx.save();
        tempCtx.filter = `hue-rotate(${frameIndex * hueStep}deg)`;
        tempCtx.drawImage(canvas, 0, 0);
        tempCtx.restore();
      } else {
        tempCtx.drawImage(canvas, 0, 0);
      }

      // 画像を描いた後、その透明部分の背面にだけ色を入れる。
      if (backgroundMode === "color") {
        tempCtx.save();
        tempCtx.globalCompositeOperation = "destination-over";
        tempCtx.globalAlpha = 1;
        tempCtx.fillStyle = backgroundColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
      }

      gif.addFrame(tempCanvas, { delay, copy: true });
      frameIndex++;
    });

    gif.on("progress", function(progress) {
      if (currentToken !== gifRenderToken) return;
      if (!gifStatus) return;
      const percent = Math.max(0, Math.min(100, progress * 100));
      gifStatus.textContent = `GIF生成中... ${percent.toFixed(1)}%`;
    });

    gif.on("finished", function(blob) {
      if (currentToken !== gifRenderToken) return;
      activeGifRender = null;
      generatedGifUrl = URL.createObjectURL(blob);
      if (gifPreview) {
        gifPreview.src = generatedGifUrl;
        gifPreview.style.display = "block";
      }
      if (gifStatus) gifStatus.textContent = "GIF生成完了 100.0%（下で再生中）";
      if (downloadGifBtn) downloadGifBtn.disabled = false;
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
    });

    gif.on("abort", function() {
      if (currentToken !== gifRenderToken) return;
      activeGifRender = null;
      if (gifStatus) gifStatus.textContent = "GIF生成を中断しました。再度「変更を反映」を押してください。";
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
    });

    gif.on("error", function(err) {
      if (currentToken !== gifRenderToken) return;
      activeGifRender = null;
      const message = err?.message || err?.filename || "workerの読み込みに失敗しました";
      if (gifStatus) gifStatus.textContent = `GIF生成エラー: ${buildGifErrorMessage(message)}`;
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (downloadGifBtn) downloadGifBtn.disabled = true;
    });

    const stallCheckToken = currentToken;
    setTimeout(() => {
      if (stallCheckToken !== gifRenderToken) return;
      if (!activeGifRender) return;
      if (!gifStatus) return;
      if (!gifStatus.textContent?.includes("100.0%")) {
        gifStatus.textContent += "（時間がかかっています）";
      }
    }, 10000);

    try {
      gif.render();
    } catch (err) {
      activeGifRender = null;
      const message = err?.message || "不明なエラー";
      if (gifStatus) gifStatus.textContent = `GIF生成エラー: ${buildGifErrorMessage(message)}`;
      if (applyAndGifBtn) applyAndGifBtn.disabled = false;
      if (downloadGifBtn) downloadGifBtn.disabled = true;
    }
  };
})();
