(() => {
  const editorArea = document.getElementById("editorArea");
  const toggleBtn = document.getElementById("toggleHideModeBtn");
  const applyBtn = document.getElementById("hideSelectedBtn");
  const clearBtn = document.getElementById("clearHideSelectionBtn");
  const showAllBtn = document.getElementById("showAllFramesBtn");
  const countLabel = document.getElementById("hideSelectionCount");
  const helpText = document.getElementById("hideModeHelp");

  if (!editorArea || !toggleBtn || !applyBtn || !clearBtn || !showAllBtn || !countLabel || !helpText) {
    return;
  }

  let hideMode = false;
  const selectedFrames = new Set();

  function getFrames() {
    return Array.from(editorArea.querySelectorAll(".frame"));
  }

  function refreshHiddenAppearance(frame) {
    const checkbox = frame.querySelector(".remove");
    frame.classList.toggle("is-hidden", !!checkbox?.checked);
  }

  function enhanceFrame(frame) {
    if (!frame || frame.dataset.hideModeReady === "1") return;
    frame.dataset.hideModeReady = "1";

    const checkbox = frame.querySelector(".remove");
    if (checkbox) {
      const container = checkbox.parentElement;
      if (container) {
        container.classList.add("hide-toggle");
        container.setAttribute("title", "クリックして表示 / 非表示を切り替え");
      }
      refreshHiddenAppearance(frame);
    }
  }

  function enhanceAllFrames() {
    getFrames().forEach(enhanceFrame);
    for (const frame of Array.from(selectedFrames)) {
      if (!frame.isConnected) selectedFrames.delete(frame);
    }
    updateSelectionUI();
  }

  function updateSelectionUI(message = "") {
    const count = selectedFrames.size;
    countLabel.textContent = `${count}件選択`;
    applyBtn.disabled = count === 0;
    clearBtn.disabled = count === 0;

    if (message) {
      helpText.textContent = message;
    } else if (hideMode) {
      helpText.textContent = "非表示にしたいフレームをクリックしてください。画像部分もクリックできます。";
    } else {
      helpText.textContent = "非表示モードをONにすると、フレーム全体をクリックして複数選択できます。";
    }
  }

  function setHideMode(enabled) {
    hideMode = enabled;
    editorArea.classList.toggle("hide-selection-mode", hideMode);
    toggleBtn.classList.toggle("active", hideMode);
    toggleBtn.setAttribute("aria-pressed", String(hideMode));
    toggleBtn.textContent = hideMode ? "非表示モード ON" : "非表示モード";
    updateSelectionUI();
  }

  function toggleFrameSelection(frame) {
    if (selectedFrames.has(frame)) {
      selectedFrames.delete(frame);
      frame.classList.remove("hide-selected");
    } else {
      selectedFrames.add(frame);
      frame.classList.add("hide-selected");
    }
    updateSelectionUI();
  }

  function clearSelection(message = "") {
    selectedFrames.forEach((frame) => frame.classList.remove("hide-selected"));
    selectedFrames.clear();
    updateSelectionUI(message);
  }

  function rerenderOutput() {
    if (typeof window.renderOutput === "function") {
      window.renderOutput();
    }
  }

  toggleBtn.addEventListener("click", () => {
    setHideMode(!hideMode);
  });

  applyBtn.addEventListener("click", () => {
    if (selectedFrames.size === 0) return;

    const targets = Array.from(selectedFrames);
    targets.forEach((frame) => {
      const checkbox = frame.querySelector(".remove");
      if (!checkbox) return;
      checkbox.checked = true;
      refreshHiddenAppearance(frame);
    });

    clearSelection(`${targets.length}件を非表示にしました。続けて選択できます。`);
    rerenderOutput();
  });

  clearBtn.addEventListener("click", () => {
    clearSelection();
  });

  showAllBtn.addEventListener("click", () => {
    const frames = getFrames();
    frames.forEach((frame) => {
      const checkbox = frame.querySelector(".remove");
      if (!checkbox) return;
      checkbox.checked = false;
      refreshHiddenAppearance(frame);
    });
    clearSelection(`${frames.length}件を表示状態に戻しました。`);
    rerenderOutput();
  });

  // 非表示モード中は、コピーや小さいチェック欄ではなくフレーム全体を選択領域にする。
  editorArea.addEventListener("click", (event) => {
    const frame = event.target.closest(".frame");
    if (!frame || !editorArea.contains(frame)) return;

    if (hideMode) {
      event.preventDefault();
      event.stopPropagation();
      toggleFrameSelection(frame);
      return;
    }

    // 通常モードでも「非表示」の文字周辺までクリック可能にする。
    const hideToggle = event.target.closest(".hide-toggle");
    if (hideToggle && event.target.tagName !== "INPUT") {
      const checkbox = hideToggle.querySelector(".remove");
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  editorArea.addEventListener("change", (event) => {
    if (!event.target.classList.contains("remove")) return;
    const frame = event.target.closest(".frame");
    if (!frame) return;
    refreshHiddenAppearance(frame);
    rerenderOutput();
  });

  const observer = new MutationObserver(() => {
    enhanceAllFrames();
  });
  observer.observe(editorArea, { childList: true, subtree: true });

  enhanceAllFrames();
  setHideMode(false);
})();
