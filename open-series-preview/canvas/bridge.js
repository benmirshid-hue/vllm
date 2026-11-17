/**
 * Excalidraw → pipeline bridge (scaffold).
 * Exports a canvas payload for ImageAssetsAgent / CharacterArtistAgent.
 * Konva is NOT loaded here — note-only alternative in README.
 */
(function () {
  const API = window.SERIES_PIPELINE_API || "http://127.0.0.1:8787";

  async function postExport(target) {
    const payload = {
      format: "excalidraw+png",
      license: "MIT",
      target, // ImageAssetsAgent | CharacterArtistAgent
      episode_id: window.__episodeId || "ep001",
      // Real embed would include excalidraw JSON + PNG blob
      elements_stub: [],
      png_path_hint: "data/uploads/canvas/latest.png",
      note: "Replace iframe with @excalidraw/excalidraw for offline/OSS-vendored embed",
      konva: false,
    };
    try {
      const res = await fetch(`${API}/api/canvas/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      alert(`أُرسل إلى ${target}: ${data.path || "ok"}`);
    } catch (e) {
      // offline scaffold: stash on window for agents
      window.__lastCanvasExport = payload;
      alert(`محلياً: حُفظ التصدير في الذاكرة لـ ${target} (API غير متصل)`);
    }
  }

  document.getElementById("btnExport").onclick = () => postExport("ImageAssetsAgent");
  document.getElementById("btnToArtist").onclick = () => postExport("CharacterArtistAgent");
})();
