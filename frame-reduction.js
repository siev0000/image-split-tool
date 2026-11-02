(() => {
  const STORAGE_KEY = "imageSplitTool.frameReduction";
  const originalRenderOutput = window.renderOutput;
  const originalCreateGIF = window.createGIF;

  if (typeof originalRenderOutput !== "function" || typeof originalCreateGIF !== "function") {
    console.warn("フレーム間引き機能を初期化できませんでした");
    return;
  }

  function injectStyle() {
    if (document.getElementById("frameReductionStyle")) return;
    const style = document.createElement("style");
    style.id = "frameReductionStyle";
    style.textContent = `
      .frame-reduction-controls {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 6px 8px;
        border: 1px solid var(--line, #d9e1e8);
        border-radius: 8px;
        background: #fff;
      }
      .frame-reduction-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .frame-reduction-rate {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.8rem;
        font-weight: 650;
        white-space: nowrap;
      }
      .frame-reduction-rate input {
        width: 70px;
        min-height: 32px;
        padding: 0.3rem 0.45rem;
      }
      .frame-reduction-info {
        color: var(--muted, #667784);
        font-size: 0.78rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .frame-reduction-note {
        width: 100%;
        margin-top: 2px;
        color: var(--muted, #667784);
        font-size: 0.74rem;
      }
    `;
    document.head.appendChild(style);
  }

  function injectControls() {
    const actionsRow = document.querySelector(".frame-actions-row");
    if (!actionsRow || document.getElementById("frameReductionEnabled")) return;

    const wrap = document.createElement("div");
    wrap.className = "frame-reduction-controls";
    wrap.innerHTML = `
      <label class="frame-reduction-toggle">
        <input type="checkbox" id="frameReductionEnabled">
        自動間引き
      </label>
      <label class="frame-reduction-rate">
        削減率
        <input type="number" id="frameReductionPercent" min="0" max="99" step="1" value="0">
        %
      </label>
      <span id="frameReductionInfo" class="frame-reduction-info">出力 0 / 0</span>
      <div class="frame-reduction-note">フレーム編集には残したまま、表示ONのフレームだけを均等に間引きます。</div>
    `;

    const applyButton = document.getElementById("applyFrameChangesBtn");
    if (applyButton) actionsRow.insertBefore(wrap, applyButton);
    else actionsRow.appendChild(wrap);
  }

  injectStyle();
  injectControls();

  const enabledInput = document.getElementById("frameReductionEnabled");
  const percentInput = document.getElementById("frameReductionPercent");
  const info = document.getElementById("frameReductionInfo");
  const editorArea = document.getElementById("editorArea");

  if (!enabledInput || !percentInput || !info || !editorArea) return;

  function clampPercent(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(99, parsed));
  }

  function getVisibleFrames() {
    return Array.from(editorArea.querySelectorAll(".frame")).filter(
      (frame) => !frame.querySelector(".remove")?.checked
    );
  }

  function selectEvenly(frames, keepCount) {
    if (keepCount >= frames.length) return frames.slice();
    if (keepCount <= 1) return frames.length ? [frames[0]] : [];

    const selected = [];
    const used = new Set();
    const lastIndex = frames.length - 1;

    for (let i = 0; i < keepCount; i++) {
      let index = Math.round((i * lastIndex) / (keepCount - 1));
      while (used.has(index) && index < lastIndex) index++;
      while (used.has(index) && index > 0) index--;
      used.add(index);
      selected.push(frames[index]);
    }

    return selected;
  }

  function getReductionPlan() {
    const visibleFrames = getVisibleFrames();
    const enabled = enabledInput.checked;
    const percent = clampPercent(percentInput.value);

    if (!enabled || percent <= 0 || visibleFrames.length <= 1) {
      return {
        visibleFrames,
        keptFrames: visibleFrames.slice(),
        excludedFrames: [],
        percent
      };
    }

    const removeCount = Math.min(
      visibleFrames.length - 1,
      Math.round((visibleFrames.length * percent) / 100)
    );
    const keepCount = Math.max(1, visibleFrames.length - removeCount);
    const keptFrames = selectEvenly(visibleFrames, keepCount);
    const keptSet = new Set(keptFrames);
    const excludedFrames = visibleFrames.filter((frame) => !keptSet.has(frame));

    return { visibleFrames, keptFrames, excludedFrames, percent };
  }

  function updateInfo() {
    const plan = getReductionPlan();
    info.textContent = enabledInput.checked
      ? `出力 ${plan.keptFrames.length} / ${plan.visibleFrames.length}`
      : `出力 ${plan.visibleFrames.length} / ${plan.visibleFrames.length}`;
    percentInput.disabled = !enabledInput.checked;
  }

  function saveSettings() {
    const percent = clampPercent(percentInput.value);
    percentInput.value = String(percent);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ enabled: enabledInput.checked, percent })
      );
    } catch (error) {
      console.warn("自動間引き設定の保存に失敗しました", error);
    }
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        enabledInput.checked = !!saved.enabled;
        percentInput.value = String(clampPercent(saved.percent));
      }
    } catch (error) {
      console.warn("自動間引き設定の復元に失敗しました", error);
    }
    updateInfo();
  }

  function withTemporaryReduction(callback, thisArg, args) {
    const plan = getReductionPlan();
    if (!enabledInput.checked || plan.excludedFrames.length === 0) {
      return callback.apply(thisArg, args);
    }

    const states = plan.excludedFrames.map((frame) => {
      const checkbox = frame.querySelector(".remove");
      return { checkbox, checked: checkbox?.checked };
    });

    states.forEach(({ checkbox }) => {
      if (checkbox) checkbox.checked = true;
    });

    try {
      return callback.apply(thisArg, args);
    } finally {
      states.forEach(({ checkbox, checked }) => {
        if (checkbox) checkbox.checked = !!checked;
      });
      updateInfo();
    }
  }

  window.renderOutput = function(...args) {
    return withTemporaryReduction(originalRenderOutput, this, args);
  };

  window.createGIF = function(...args) {
    return withTemporaryReduction(originalCreateGIF, this, args);
  };

  enabledInput.addEventListener("change", () => {
    saveSettings();
    updateInfo();
    window.renderOutput();
  });

  percentInput.addEventListener("input", () => {
    const value = clampPercent(percentInput.value);
    if (String(value) !== percentInput.value && percentInput.value !== "") {
      percentInput.value = String(value);
    }
    updateInfo();
    if (enabledInput.checked) window.renderOutput();
  });

  percentInput.addEventListener("change", () => {
    saveSettings();
    updateInfo();
    if (enabledInput.checked) window.renderOutput();
  });

  editorArea.addEventListener("change", updateInfo);
  document.getElementById("hideSelectedBtn")?.addEventListener("click", () => requestAnimationFrame(updateInfo));
  document.getElementById("showAllFramesBtn")?.addEventListener("click", () => requestAnimationFrame(updateInfo));

  const observer = new MutationObserver(updateInfo);
  observer.observe(editorArea, { childList: true });

  restoreSettings();
})();
