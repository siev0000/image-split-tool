
let image = new Image();
let filename = "output";
let pieces = [];

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
  const base = document.getElementById("basePreview");
  base.innerHTML = "";
  const splitX = parseInt(document.getElementById("splitX").value);
  const splitY = parseInt(document.getElementById("splitY").value);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 200;
  canvas.height = image.height * (canvas.width / image.width);

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

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
  canvas.width = piece.w;
  canvas.height = piece.h;
  const ctx = canvas.getContext("2d");
  ctx.translate(piece.w / 2, piece.h / 2);
  ctx.rotate(piece.angle * Math.PI / 180);
  ctx.drawImage(image, piece.sx, piece.sy, piece.partW, piece.partH, -piece.w / 2, -piece.h / 2, piece.w, piece.h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

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
    ctx.save();
    ctx.translate(dx + w / 2, dy + h / 2);
    ctx.rotate(p.angle * Math.PI / 180);
    ctx.drawImage(image, p.sx, p.sy, p.partW, p.partH, -w / 2, -h / 2, w, h);
    ctx.restore();
  });
}

function download() {
  const link = document.createElement("a");
  link.download = filename + "_sorted_result.png";
  link.href = document.getElementById("outputCanvas").toDataURL();
  link.click();
}

function createGIF() {
  const frames = document.querySelectorAll("#editorArea .frame");
  const delay = parseInt(document.getElementById("gifDelay").value) || 500;
  if (frames.length === 0) return alert("フレームがありません");

  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js'
  });

  frames.forEach((frame) => {
    if (frame.querySelector(".remove")?.checked) return;
    const canvas = frame.querySelector("canvas");
    if (canvas) gif.addFrame(canvas, { delay });
  });

  gif.on('finished', function(blob) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'output.gif';
    link.click();
  });

  gif.render();
}

new Sortable(document.getElementById("editorArea"), {
  animation: 150,
  onEnd: updateOutputLabels
});
