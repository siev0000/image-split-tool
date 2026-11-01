(() => {
  const ROW_HEADER_WIDTH = 34;
  const COLUMN_HEADER_HEIGHT = 26;
  const HEADER_GAP = 8;
  const PREVIEW_PADDING = 24;
  const MAX_PREVIEW_WIDTH = 960;
  const MAX_PREVIEW_HEIGHT = 520;
  let resizeTimer = null;

  function createHeaderCell(value, className) {
    const cell = document.createElement("div");
    cell.className = className;
    cell.textContent = String(value);
    cell.title = String(value);
    return cell;
  }

  function ensurePreviewLayout(base) {
    const stage = base.closest(".preview-stage");
    if (!stage) return null;

    let layout = stage.parentElement?.classList.contains("preview-guide-layout")
      ? stage.parentElement
      : null;

    if (!layout) {
      layout = document.createElement("div");
      layout.className = "preview-guide-layout";

      const parent = stage.parentElement;
      parent.insertBefore(layout, stage);
      layout.appendChild(stage);
    }

    let columnHeaders = layout.querySelector(".base-preview-column-headers");
    if (!columnHeaders) {
      columnHeaders = document.createElement("div");
      columnHeaders.className = "base-preview-column-headers";
      layout.appendChild(columnHeaders);
    }

    let rowHeaders = layout.querySelector(".base-preview-row-headers");
    if (!rowHeaders) {
      rowHeaders = document.createElement("div");
      rowHeaders.className = "base-preview-row-headers";
      layout.appendChild(rowHeaders);
    }

    return { layout, stage, columnHeaders, rowHeaders };
  }

  function getPreviewSize(base) {
    const sourcePanel = base.closest(".source-panel");
    const availableWidth = Math.max(
      240,
      (sourcePanel?.clientWidth || 640) - ROW_HEADER_WIDTH - HEADER_GAP - PREVIEW_PADDING
    );

    const maxWidth = Math.min(MAX_PREVIEW_WIDTH, availableWidth);
    const maxHeight = MAX_PREVIEW_HEIGHT;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

    return {
      width: Math.max(1, Math.round(image.width * scale)),
      height: Math.max(1, Math.round(image.height * scale)),
      scale
    };
  }

  function getHeaderFontSize(splitX) {
    if (splitX >= 28) return 9;
    if (splitX >= 20) return 10;
    if (splitX >= 14) return 11;
    return 12;
  }

  function drawBasePreviewWithHeaders() {
    if (!image.src || !image.width || !image.height) return;

    const base = document.getElementById("basePreview");
    if (!base) return;

    const previewLayout = ensurePreviewLayout(base);
    if (!previewLayout) return;

    const { layout, stage, columnHeaders, rowHeaders } = previewLayout;
    const splitX = Math.max(1, parseInt(document.getElementById("splitX").value, 10) || 1);
    const splitY = Math.max(1, parseInt(document.getElementById("splitY").value, 10) || 1);
    const previewSize = getPreviewSize(base);

    base.innerHTML = "";
    columnHeaders.innerHTML = "";
    rowHeaders.innerHTML = "";

    layout.style.setProperty("--preview-width", `${previewSize.width}px`);
    layout.style.setProperty("--preview-height", `${previewSize.height}px`);
    layout.style.setProperty("--row-header-width", `${ROW_HEADER_WIDTH}px`);
    layout.style.setProperty("--column-header-height", `${COLUMN_HEADER_HEIGHT}px`);
    layout.style.setProperty("--header-gap", `${HEADER_GAP}px`);
    layout.style.setProperty("--header-font-size", `${getHeaderFontSize(splitX)}px`);

    stage.style.setProperty("--preview-width", `${previewSize.width}px`);
    stage.style.setProperty("--preview-height", `${previewSize.height}px`);

    columnHeaders.style.gridTemplateColumns = `repeat(${splitX}, minmax(0, 1fr))`;
    for (let x = 1; x <= splitX; x++) {
      columnHeaders.appendChild(createHeaderCell(x, "base-preview-header-cell column-header"));
    }

    rowHeaders.style.gridTemplateRows = `repeat(${splitY}, minmax(0, 1fr))`;
    for (let y = 1; y <= splitY; y++) {
      rowHeaders.appendChild(createHeaderCell(y, "base-preview-header-cell row-header"));
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = previewSize.width;
    canvas.height = previewSize.height;
    canvas.className = "base-preview-canvas";
    canvas.title = "クリックで拡大";

    if (previewSize.scale > 1 && image.width <= 512 && image.height <= 512) {
      ctx.imageSmoothingEnabled = false;
    }

    ctx.filter = buildFilterString();
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    applyTint(ctx, canvas.width, canvas.height);

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

    base.appendChild(canvas);
  }

  // 元の分割処理には触れず、プレビュー描画だけ差し替える。
  drawBasePreview = drawBasePreviewWithHeaders;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (image.src && image.width && image.height) drawBasePreviewWithHeaders();
    }, 120);
  });
})();
