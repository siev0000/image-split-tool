(() => {
  const saveMethod = document.getElementById("saveMethod");

  function getMethod() {
    return saveMethod?.value || "download";
  }

  function triggerDownload(blobOrUrl, saveName) {
    const link = document.createElement("a");
    let objectUrl = null;

    if (blobOrUrl instanceof Blob) {
      objectUrl = URL.createObjectURL(blobOrUrl);
      link.href = objectUrl;
    } else {
      link.href = blobOrUrl;
    }

    link.download = saveName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  }

  async function saveWithPicker(blob, saveName, description, mimeType, extension) {
    if (typeof window.showSaveFilePicker !== "function") {
      alert("このブラウザでは『名前を付けて保存』に対応していないため、通常のダウンロードで保存します。");
      triggerDownload(blob, saveName);
      return;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: saveName,
        types: [
          {
            description,
            accept: {
              [mimeType]: [extension]
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("名前を付けて保存に失敗しました", error);
      alert("保存に失敗しました。通常のダウンロードで保存します。");
      triggerDownload(blob, saveName);
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNGの作成に失敗しました"));
      }, "image/png");
    });
  }

  async function savePng() {
    const canvas = document.getElementById("outputCanvas");
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      alert("保存する出力画像がありません");
      return;
    }

    const saveName = `${filename}_sorted_result.png`;

    try {
      const blob = await canvasToBlob(canvas);
      if (getMethod() === "saveAs") {
        await saveWithPicker(blob, saveName, "PNG画像", "image/png", ".png");
      } else {
        triggerDownload(blob, saveName);
      }
    } catch (error) {
      console.error(error);
      alert("PNGの保存に失敗しました");
    }
  }

  async function saveGif() {
    if (!generatedGifUrl) {
      alert("先にGIFを生成してください");
      return;
    }

    const saveName = `${filename}_result.gif`;

    if (getMethod() === "download") {
      triggerDownload(generatedGifUrl, saveName);
      return;
    }

    try {
      const response = await fetch(generatedGifUrl);
      const blob = await response.blob();
      await saveWithPicker(blob, saveName, "GIF画像", "image/gif", ".gif");
    } catch (error) {
      console.error(error);
      alert("GIFの保存に失敗しました。通常のダウンロードで保存します。");
      triggerDownload(generatedGifUrl, saveName);
    }
  }

  // 既存のonclickから呼ばれる関数を保存方法対応版に差し替える。
  window.download = savePng;
  window.downloadGIF = saveGif;
})();