(() => {
  const editorArea = document.getElementById("editorArea");
  const toggleBtn = document.getElementById("toggleHideModeBtn");
  const applyBtn = document.getElementById("hideSelectedBtn");
  const showSelectedBtn = document.getElementById("showSelectedFramesBtn");
  const clearBtn = document.getElementById("clearHideSelectionBtn");
  const showAllBtn = document.getElementById("showAllFramesBtn");
  const countLabel = document.getElementById("hideSelectionCount");
  const helpText = document.getElementById("hideModeHelp");

  if (!editorArea || !toggleBtn || !applyBtn || !showSelectedBtn || !clearBtn || !showAllBtn || !countLabel || !helpText) {
    return;
  }

  let hideMode = false;
  const selectedFrames = new Set();

  let longPressTimer = null;
  let longPressActive = false;
  let longPressAnchor = null;
  let longPressBaseSelection = new Set();
  let suppressNextClick = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_PX = 8;

  function getFrames() {
    return Array.from(editorArea.querySelectorAll(".frame"));
  }

  function refreshHiddenAppearance(frame) {
    const checkbox = frame.querySelector(".remove");
    frame.classList.toggle("is-hidden", !!checkbox?.checked);
  }

  function injectHideAllButton() {
    if (document.getElementById("hideAllFramesBtn")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "hideAllFramesBtn";
    button.className = "secondary-button";
    button.textContent = "すべて非表示";
    showAllBtn.parentElement?.insertBefore(button, showAllBtn);
  }

  function injectRangeStyle() {
    if (document.getElementById("hideRangeStyle")) return;
    const style = document.createElement("style");
    style.id = "hideRangeStyle";
    style.textContent = `
      .hide-selection-mode.range-selecting {
        user-select: none;
        cursor: crosshair;
      }
      .hide-selection-mode.range-selecting .frame {
        touch-action: none;
      }
      .hide-selection-mode .frame.hide-range-anchor {
        outline: 3px solid rgba(47, 128, 237, 0.65);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
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
    showSelectedBtn.disabled = count === 0;
    clearBtn.disabled = count === 0;

    if (message) {
      helpText.textContent = message;
    } else if (longPressActive) {
      helpText.textContent = "長押し範囲選択中：そのまま別のフレームまで動かしてください。";
    } else if (hideMode) {
      helpText.textContent = "クリックで個別選択。長押ししてそのまま動かすと範囲を一括選択できます。";
    } else {
      helpText.textContent = "非表示モードをONにすると、フレームを選択して一括表示・非表示できます。";
    }
  }

  function setSortableDisabled(disabled) {
    try {
      const sortable = window.Sortable?.get?.(editorArea);
      sortable?.option("disabled", disabled);
    } catch (_) {}
  }

  function setHideMode(enabled) {
    hideMode = enabled;
    editorArea.classList.toggle("hide-selection-mode", hideMode);
    toggleBtn.classList.toggle("active", hideMode);
    toggleBtn.setAttribute("aria-pressed", String(hideMode));
    toggleBtn.textContent = hideMode ? "非表示モード ON" : "非表示モード";
    setSortableDisabled(hideMode);
    if (!hideMode) cancelLongPress();
    updateSelectionUI();
  }

  function setFrameSelected(frame, selected) {
    if (!frame) return;
    if (selected) {
      selectedFrames.add(frame);
      frame.classList.add("hide-selected");
    } else {
      selectedFrames.delete(frame);
      frame.classList.remove("hide-selected");
    }
  }

  function toggleFrameSelection(frame) {
    setFrameSelected(frame, !selectedFrames.has(frame));
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

  function notifyFrameStateChanged() {
    editorArea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyRangeSelection(targetFrame) {
    if (!longPressAnchor || !targetFrame) return;
    const frames = getFrames();
    const start = frames.indexOf(longPressAnchor);
    const end = frames.indexOf(targetFrame);
    if (start < 0 || end < 0) return;

    selectedFrames.forEach((frame) => frame.classList.remove("hide-selected"));
    selectedFrames.clear();

    longPressBaseSelection.forEach((frame) => {
      if (frame.isConnected) setFrameSelected(frame, true);
    });

    const from = Math.min(start, end);
    const to = Math.max(start, end);
    for (let i = from; i <= to; i++) {
      setFrameSelected(frames[i], true);
    }
    updateSelectionUI();
  }

  function beginLongPress(frame) {
    longPressActive = true;
    longPressAnchor = frame;
    longPressBaseSelection = new Set(selectedFrames);
    suppressNextClick = true;
    editorArea.classList.add("range-selecting");
    frame.classList.add("hide-range-anchor");
    applyRangeSelection(frame);
    updateSelectionUI();
  }

  function cancelLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function cancelLongPress() {
    cancelLongPressTimer();
    if (longPressAnchor) longPressAnchor.classList.remove("hide-range-anchor");
    longPressAnchor = null;
    longPressBaseSelection = new Set();
    longPressActive = false;
    editorArea.classList.remove("range-selecting");
  }

  injectHideAllButton();
  injectRangeStyle();
  const hideAllBtn = document.getElementById("hideAllFramesBtn");

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
    notifyFrameStateChanged();
    rerenderOutput();
  });

  showSelectedBtn.addEventListener("click", () => {
    if (selectedFrames.size === 0) return;

    const targets = Array.from(selectedFrames);
    targets.forEach((frame) => {
      const checkbox = frame.querySelector(".remove");
      if (!checkbox) return;
      checkbox.checked = false;
      refreshHiddenAppearance(frame);
    });

    clearSelection(`${targets.length}件を表示状態に戻しました。続けて選択できます。`);
    notifyFrameStateChanged();
    rerenderOutput();
  });

  clearBtn.addEventListener("click", () => {
    clearSelection();
  });

  hideAllBtn?.addEventListener("click", () => {
    const frames = getFrames();
    frames.forEach((frame) => {
      const checkbox = frame.querySelector(".remove");
      if (!checkbox) return;
      checkbox.checked = true;
      refreshHiddenAppearance(frame);
    });
    clearSelection(`${frames.length}件をすべて非表示にしました。`);
    notifyFrameStateChanged();
    rerenderOutput();
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
    notifyFrameStateChanged();
    rerenderOutput();
  });

  editorArea.addEventListener("pointerdown", (event) => {
    if (!hideMode || event.button > 0) return;
    const frame = event.target.closest(".frame");
    if (!frame || !editorArea.contains(frame)) return;

    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    cancelLongPressTimer();
    longPressTimer = setTimeout(() => beginLongPress(frame), LONG_PRESS_MS);
  }, true);

  editorArea.addEventListener("pointermove", (event) => {
    if (!hideMode) return;

    if (!longPressActive) {
      const distance = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
      if (distance > MOVE_CANCEL_PX) cancelLongPressTimer();
      return;
    }

    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const frame = element?.closest?.(".frame");
    if (frame && editorArea.contains(frame)) applyRangeSelection(frame);
  }, true);

  function finishPointerSelection() {
    cancelLongPressTimer();
    if (longPressActive) {
      if (longPressAnchor) longPressAnchor.classList.remove("hide-range-anchor");
      longPressAnchor = null;
      longPressBaseSelection = new Set();
      longPressActive = false;
      editorArea.classList.remove("range-selecting");
      updateSelectionUI("範囲を選択しました。『選択を非表示』『選択を表示』で反映できます。");
      setTimeout(() => { suppressNextClick = false; }, 50);
    }
  }

  editorArea.addEventListener("pointerup", finishPointerSelection, true);
  editorArea.addEventListener("pointercancel", finishPointerSelection, true);
  window.addEventListener("blur", finishPointerSelection);

  // 非表示モード中は、コピーや小さいチェック欄ではなくフレーム全体を選択領域にする。
  editorArea.addEventListener("click", (event) => {
    const frame = event.target.closest(".frame");
    if (!frame || !editorArea.contains(frame)) return;

    if (hideMode) {
      event.preventDefault();
      event.stopPropagation();
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      toggleFrameSelection(frame);
      return;
    }

    const hideToggle = event.target.closest(".hide-toggle");
    if (hideToggle && event.target.tagName !== "INPUT") {
      const checkbox = hideToggle.querySelector(".remove");
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, true);

  editorArea.addEventListener("change", (event) => {
    if (!event.target.classList?.contains("remove")) return;
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
