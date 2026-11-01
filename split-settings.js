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
