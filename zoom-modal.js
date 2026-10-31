(() => {
  const modal = document.getElementById("previewModal");
  const modalImage = document.getElementById("previewModalImage");
  const modalTitle = document.getElementById("previewModalTitle");
  const closeButton = document.getElementById("previewModalClose");
  const editorArea = document.getElementById("editorArea");

  if (!modal || !modalImage || !modalTitle || !closeButton) return;

  let lastFocusedElement = null;

  function getPreviewTitle(target) {
    if (target.id === "gifPreview") return "GIFプレビュー";
    if (target.id === "outputCanvas") return "出力画像プレビュー";
    if (target.closest("#basePreview")) return "元画像プレビュー";

    const frame = target.closest(".frame");
    if (frame) {
      const label = frame.querySelector(".label")?.textContent?.trim();
      return label ? `フレーム画像 - ${label}` : "フレーム画像プレビュー";
    }

    return "画像プレビュー";
  }

  function setDisplayScale(width, height) {
    modalImage.classList.toggle("pixel-preview", width <= 256 && height <= 256);

    if (width <= 320 && height <= 320) {
      const largestSide = Math.max(width, height, 1);
      const scale = Math.min(8, Math.max(2, 480 / largestSide));
      modalImage.style.width = `${Math.round(width * scale)}px`;
      modalImage.style.height = "auto";
    } else {
      modalImage.style.width = "auto";
      modalImage.style.height = "auto";
    }
  }

  function openPreview(src, title, width = 0, height = 0) {
    if (!src) return;

    lastFocusedElement = document.activeElement;
    modalTitle.textContent = title;
    modalImage.alt = title;
    modalImage.style.width = "auto";
    modalImage.style.height = "auto";
    modalImage.classList.remove("pixel-preview");

    modalImage.onload = () => {
      setDisplayScale(width || modalImage.naturalWidth, height || modalImage.naturalHeight);
    };
    modalImage.src = src;

    if (width && height) setDisplayScale(width, height);

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("preview-modal-open");
    closeButton.focus();
  }

  function closePreview() {
    if (!modal.classList.contains("open")) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("preview-modal-open");
    modalImage.removeAttribute("src");
    modalImage.onload = null;

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function tryOpenTarget(target) {
    if (!(target instanceof Element)) return;

    // 非表示モード中はフレームクリックを選択操作に譲る。
    if (editorArea?.classList.contains("hide-selection-mode") && target.closest("#editorArea .frame")) {
      return;
    }

    if (target.id === "gifPreview") {
      if (!target.getAttribute("src")) return;
      openPreview(target.src, getPreviewTitle(target), target.naturalWidth, target.naturalHeight);
      return;
    }

    if (target instanceof HTMLCanvasElement) {
      const isSupportedCanvas =
        target.id === "outputCanvas" ||
        !!target.closest("#basePreview") ||
        !!target.closest("#editorArea .frame");

      if (!isSupportedCanvas || target.width <= 0 || target.height <= 0) return;

      try {
        openPreview(target.toDataURL("image/png"), getPreviewTitle(target), target.width, target.height);
      } catch (error) {
        console.warn("プレビュー画像の拡大表示に失敗しました", error);
      }
    }
  }

  document.addEventListener("click", (event) => {
    if (modal.contains(event.target)) return;
    tryOpenTarget(event.target);
  });

  closeButton.addEventListener("click", closePreview);

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-preview-close]")) {
      closePreview();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      closePreview();
    }
  });
})();
