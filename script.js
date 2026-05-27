
let image = new Image();
let filename = "output";
let pieces = [];
let generatedGifUrl = null;
let activeGifRender = null;
let gifRenderToken = 0;
const EFFECT_INPUT_IDS = [
  "effectPreset",
  "effectBrightness",
  "effectContrast",
  "effectSaturate",
  "effectHue",
  "effectHueRange",
  "effectBlur",
  "effectTintColor",
  "effectTintStrength"
];

function resolveWorkerScriptUrl() {
  try {
    return new URL("gif.worker.js", window.location.href).href;
  } catch (_) {
    return "gif.worker.js";
  }
}

function buildGifErrorMessage(baseMessage) {
  if (window.location.protocol === "file:") {
    return `${baseMessage}（file:// ではWorker制限で失敗する場合があります。ローカルサーバー経由で開いてください）`;
  }
  return baseMessage;
}

function bindInputEvent(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", handler);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getNumberValue(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const parsed = parseFloat(el.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function syncHueInputs(fromId) {
  const hueInput = document.getElementById("effectHue");
  const hueRange = document.getElementById("effectHueRange");
  if (!hueInput || !hueRange) return;

  if (fromId === "effectHueRange") {
    hueInput.value = hueRange.value;
    return;
  }
  const hue = clamp(getNumberValue("effectHue", 0), -180, 180);
  hueInput.value = String(hue);
  hueRange.value = String(hue);
}

function applyPresetToInputs(preset) {
  const presets = {
    none: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, tintStrength: 0 },
    grayscale: { brightness: 100, contrast: 100, saturate: 0, hue: 0, blur: 0, tintStrength: 0 },
    sepia: { brightness: 105, contrast: 100, saturate: 80, hue: -15, blur: 0, tintStrength: 0 },
    invert: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, tintStrength: 0 },
    vivid: { brightness: 115, contrast: 120, saturate: 160, hue: 0, blur: 0, tintStrength: 0 },
    dreamy: { brightness: 110, contrast: 92, saturate: 125, hue: 12, blur: 1, tintStrength: 18 }
  };
  const selected = presets[preset] || presets.none;
  document.getElementById("effectBrightness").value = String(selected.brightness);
  document.getElementById("effectContrast").value = String(selected.contrast);
  document.getElementById("effectSaturate").value = String(selected.saturate);
  document.getElementById("effectHue").value = String(selected.hue);
  document.getElementById("effectBlur").value = String(selected.blur);
  document.getElementById("effectTintStrength").value = String(selected.tintStrength);
  syncHueInputs("effectHue");
}

function getCurrentEffect() {
  const preset = (document.getElementById("effectPreset")?.value || "none").toLowerCase();
  return {
    preset,
    brightness: clamp(getNumberValue("effectBrightness", 100), 0, 300),
    contrast: clamp(getNumberValue("effectContrast", 100), 0, 300),
    saturate: clamp(getNumberValue("effectSaturate", 100), 0, 300),
    hue: clamp(getNumberValue("effectHue", 0), -180, 180),
    blur: clamp(getNumberValue("effectBlur", 0), 0, 20),
    tintColor: document.getElementById("effectTintColor")?.value || "#ff6600",
    tintStrength: clamp(getNumberValue("effectTintStrength", 0), 0, 100)
  };
}

function buildFilterString(extraHue = 0) {
  const effect = getCurrentEffect();
  const filters = [];

  if (effect.preset === "grayscale") filters.push("grayscale(100%)");
  if (effect.preset === "sepia") filters.push("sepia(80%)");
  if (effect.preset === "invert") filters.push("invert(100%)");

  filters.push(`brightness(${effect.brightness}%)`);
  filters.push(`contrast(${effect.contrast}%)`);
  filters.push(`saturate(${effect.saturate}%)`);
  filters.push(`hue-rotate(${effect.hue + extraHue}deg)`);
  filters.push(`blur(${effect.blur}px)`);

  return filters.join(" ");
}

function applyTint(ctx, width, height) {
  const effect = getCurrentEffect();
  if (effect.tintStrength <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = effect.tintStrength / 100;
  ctx.fillStyle = effect.tintColor;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawPieceOnCanvas(canvas, piece, extraHue = 0) {
  const ctx = canvas.getContext("2d");
  canvas.width = piece.w;
  canvas.height = piece.h;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.filter = buildFilterString(extraHue);
  ctx.translate(piece.w / 2, piece.h / 2);
  ctx.rotate(piece.angle * Math.PI / 180);
  ctx.drawImage(image, piece.sx, piece.sy, piece.partW, piece.partH, -piece.w / 2, -piece.h / 2, piece.w, piece.h);
  ctx.restore();
  applyTint(ctx, piece.w, piece.h);
}

function redrawEditorFrames() {
  if (!image.src || !pieces.length) return;
  const frames = document.querySelectorAll("#editorArea .frame");
  frames.forEach((frame) => {
    const piece = pieces[parseInt(frame.dataset.id, 10)];
    const canvas = frame.querySelector("canvas");
    if (!piece || !canvas) return;
    drawPieceOnCanvas(canvas, piece);
  });
}

function applyEffectsRealtime() {
  if (!image.src || !image.width || !image.height) return;
  drawBasePreview();
  redrawEditorFrames();
  renderOutput();
}

function initializeEffectInputs() {
  const preset = document.getElementById("effectPreset");
  if (preset) {
    preset.addEventListener("change", () => {
      applyPresetToInputs(preset.value);
      applyEffectsRealtime();
    });
  }

  EFFECT_INPUT_IDS.forEach((id) => {
    bindInputEvent(id, () => {
      if (id === "effectHueRange" || id === "effectHue") syncHueInputs(id);
      applyEffectsRealtime();
    });
  });

  applyPresetToInputs(document.getElementById("effectPreset")?.value || "none");
}

["splitX", "splitY"].forEach((id) => {
  bindInputEvent(id, () => {
    if (!image.src || !image.width || !image.height) return;
    drawBasePreview();
  });
});

initializeEffectInputs();

document.getElementById('imageInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  filename = file.name.replace(/\.[^/.]+$/, "");
  const reader = new FileReader();
  reader.onload = function(ev) {
    image.onload = () => {
      drawBasePreview();
    };
    image.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function copyFrame(id) {
  const original = pieces[id];
  const newId = pieces.length;
  const copy = { ...original, id: newId };
  createFrameElement(copy);
}

function drawBasePreview() {
  if (!image.src || !image.width || !image.height) return;

  const base = document.getElementById("basePreview");
  base.innerHTML = "";
  const splitX = Math.max(1, parseInt(document.getElementById("splitX").value) || 1);
  const splitY = Math.max(1, parseInt(document.getElementById("splitY").value) || 1);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 200;
  canvas.height = image.height * (canvas.width / image.width);

  ctx.filter = buildFilterString();
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  applyTint(ctx, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  for (let i = 1; i < splitX; i++) {
    const x = i * canvas.width / splitX;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let i = 1; i < splitY; i++) {
    const y = i * canvas.height / splitY;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "white";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  let count = 1;
  for (let y = 0; y < splitY; y++) {
    for (let x = 0; x < splitX; x++) {
      const cellW = canvas.width / splitX;
      const cellH = canvas.height / splitY;
      const cx = x * cellW + cellW / 2;
      const cy = y * cellH + 4;
      ctx.fillStyle = "black";
      ctx.fillText(count++, cx, cy);
    }
  }

  base.appendChild(canvas);
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
  document.querySelector(`[onclick*="${tabName}"]`).classList.add("active");
  document.getElementById(tabName + "Tab").classList.add("active");
}

function splitImage() {
  const splitX = parseInt(document.getElementById("splitX").value);
  const splitY = parseInt(document.getElementById("splitY").value);
  const resizeW = parseInt(document.getElementById("resizeWidth").value);
  const resizeH = parseInt(document.getElementById("resizeHeight").value);
  const rotation = parseFloat(document.getElementById("rotation").value) || 0;
  const editorArea = document.getElementById("editorArea");

  const partW = image.width / splitX;
  const partH = image.height / splitY;
  const aspect = partW / partH;
  const drawW = resizeW || (resizeH ? resizeH * aspect : partW);
  const drawH = resizeH || (resizeW ? resizeW / aspect : partH);

  pieces = [];
  editorArea.innerHTML = "";

  for (let y = 0; y < splitY; y++) {
    for (let x = 0; x < splitX; x++) {
      const id = pieces.length;
      const sx = x * partW;
      const sy = y * partH;
      const piece = { sx, sy, partW, partH, w: drawW, h: drawH, angle: rotation, id };
      createFrameElement(piece);
    }
  }
}

function createFrameElement(piece) {
  pieces.push(piece);

  const frame = document.createElement("div");
  frame.className = "frame";
  frame.dataset.id = piece.id;

  const controlRow = document.createElement("div");
  controlRow.className = "info-row";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = `出力順: ${piece.id}`;
  controlRow.appendChild(label);

  const checkContainer = document.createElement("div");
  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "remove";
  const checkText = document.createElement("span");
  checkText.textContent = "非表示";
  checkContainer.appendChild(check);
  checkContainer.appendChild(checkText);
  controlRow.appendChild(checkContainer);

  const copyButton = document.createElement("button");
  copyButton.textContent = "コピー";
  copyButton.className = "copy";
  copyButton.onclick = () => copyFrame(piece.id);
  controlRow.appendChild(copyButton);

  const canvas = document.createElement("canvas");
  drawPieceOnCanvas(canvas, piece);

  frame.appendChild(controlRow);
  frame.appendChild(canvas);
  document.getElementById("editorArea").appendChild(frame);
}

function updateOutputLabels() {
  const frames = document.querySelectorAll("#editorArea .frame");
  frames.forEach((frame, index) => {
    const label = frame.querySelector(".label");
    if (label) label.textContent = `出力順: ${index + 1}`;
  });
}

function renderOutput() {
  const direction = document.getElementById("direction").value;
  const outputCanvas = document.getElementById("outputCanvas");
  const ctx = outputCanvas.getContext("2d");

  const all = Array.from(document.querySelectorAll("#editorArea .frame"))
    .filter(f => !f.querySelector(".remove").checked)
    .map(f => pieces[parseInt(f.dataset.id)]);

  if (all.length === 0) return;
  const w = all[0].w;
  const h = all[0].h;
  outputCanvas.width = direction === "horizontal" ? w * all.length : w;
  outputCanvas.height = direction === "vertical" ? h * all.length : h;
  ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

  all.forEach((p, i) => {
    const dx = direction === "horizontal" ? i * w : 0;
    const dy = direction === "vertical" ? i * h : 0;
    const tempCanvas = document.createElement("canvas");
    drawPieceOnCanvas(tempCanvas, p);
    ctx.drawImage(tempCanvas, dx, dy);
  });
}

function renderOutputAndGIF() {
  renderOutput();
  createGIF();
}

function download() {
  const link = document.createElement("a");
  link.download = filename + "_sorted_result.png";
  link.href = document.getElementById("outputCanvas").toDataURL();
  link.click();
}

function downloadGIF() {
  if (!generatedGifUrl) return;
  const link = document.createElement("a");
  link.href = generatedGifUrl;
  link.download = filename + "_result.gif";
  link.click();
}

function createGIF() {
  const frames = document.querySelectorAll("#editorArea .frame");
  const delay = parseInt(document.getElementById("gifDelay").value) || 500;
  const hueStep = parseFloat(document.getElementById("gifHueStep").value) || 0;
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

    if (hueStep !== 0) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.filter = `hue-rotate(${frameIndex * hueStep}deg)`;
      tempCtx.drawImage(canvas, 0, 0);
      tempCtx.filter = "none";
      gif.addFrame(tempCanvas, { delay, copy: true });
    } else {
      gif.addFrame(canvas, { delay, copy: true });
    }
    frameIndex++;
  });

  gif.on("progress", function(progress) {
    if (currentToken !== gifRenderToken) return;
    if (!gifStatus) return;
    const percent = Math.max(0, Math.min(100, progress * 100));
    gifStatus.textContent = `GIF生成中... ${percent.toFixed(1)}%`;
  });

  gif.on('finished', function(blob) {
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
}

new Sortable(document.getElementById("editorArea"), {
  animation: 150,
  onEnd: updateOutputLabels
});
