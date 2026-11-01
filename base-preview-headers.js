(() => {
  function createHeaderCell(value, className) {
    const cell = document.createElement("div");
    cell.className = className;
    cell.textContent = String(value);
    cell.title = String(value);
    return cell;
  }

  function drawBasePreviewWithHeaders() {
    if (!image.src || !image.width || !image.height) return;

    const base = document.getElementById("basePreview");
    if (!base) return;

    base.innerHTML = "";

    const splitX = Math.max(1, parseInt(document.getElementById("splitX").value, 10) || 1);
    const splitY = Math.max(1, parseInt(document.getElementById("splitY").value, 10) || 1);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 200;
    canvas.height = Math.max(1, Math.round(image.height * (canvas.width / image.width)));
    canvas.className = "base-preview-canvas";
    canvas.title = "クリックで拡大";

    ctx.filter = buildFilterString();
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    applyTint(ctx, canvas.width, canvas.height);

    // 分割線だけを画像上に表示し、番号は画像には描画しない。
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1;

    for (let i = 1; i < splitX; i++) {
      const x = i * canvas.width / splitX;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let i = 1; i < splitY; i++) {
      const y = i * canvas.height / splitY;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const sheet = document.createElement("div");
    sheet.className = "base-preview-sheet";
    sheet.style.setProperty("--preview-width", `${canvas.width}px`);
    sheet.style.setProperty("--preview-height", `${canvas.height}px`);
    sheet.style.setProperty("--split-x", splitX);
    sheet.style.setProperty("--split-y", splitY);

    const corner = document.createElement("div");
    corner.className = "base-preview-corner";
    corner.setAttribute("aria-hidden", "true");

    const columnHeaders = document.createElement("div");
    columnHeaders.className = "base-preview-column-headers";
    columnHeaders.style.gridTemplateColumns = `repeat(${splitX}, minmax(0, 1fr))`;
    for (let x = 1; x <= splitX; x++) {
      columnHeaders.appendChild(createHeaderCell(x, "base-preview-header-cell column-header"));
    }

    const rowHeaders = document.createElement("div");
    rowHeaders.className = "base-preview-row-headers";
    rowHeaders.style.gridTemplateRows = `repeat(${splitY}, minmax(0, 1fr))`;
    for (let y = 1; y <= splitY; y++) {
      rowHeaders.appendChild(createHeaderCell(y, "base-preview-header-cell row-header"));
    }

    const canvasCell = document.createElement("div");
    canvasCell.className = "base-preview-canvas-cell";
    canvasCell.appendChild(canvas);

    sheet.appendChild(corner);
    sheet.appendChild(columnHeaders);
    sheet.appendChild(rowHeaders);
    sheet.appendChild(canvasCell);
    base.appendChild(sheet);
  }

  // script.js の既存描画を差し替える。既存の入力イベントや画像読み込み処理はそのまま利用する。
  drawBasePreview = drawBasePreviewWithHeaders;
})();