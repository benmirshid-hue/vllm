/**
 * EpisodePlayer — large OSS HTML5 / video.js module
 * Features: play/pause/seek, episode list, ~25-min stitched episodes,
 * softsubs + chapters, preview-before-publish, settings hook.
 */
(function () {
  const API_BASE = window.SERIES_PIPELINE_API || "http://127.0.0.1:8787";

  const SAMPLE_EPISODES = [
    {
      episode_id: "ep001",
      title: "الحلقة 1 (عيّنة)",
      duration_sec: 1500,
      video: "../data/runs/ep001/episode.mp4",
      subtitles_vtt: "../data/runs/ep001/subs.vtt",
      chapters: [
        { label: "[00:00-01:30] افتتاح", start_sec: 0 },
        { label: "[01:30-03:00] تحذير المرشد", start_sec: 90 },
        { label: "[23:00-25:00] خاتمة", start_sec: 1380 },
      ],
      publish_ready: false,
      trial: false,
    },
    {
      episode_id: "ep001-trial",
      title: "تجربة دقيقتين",
      duration_sec: 120,
      video: "../data/runs/ep001-trial/episode.mp4",
      chapters: [
        { label: "[00:00-01:30] مشهد 1", start_sec: 0 },
        { label: "[01:30-02:00] مشهد 2", start_sec: 90 },
      ],
      publish_ready: false,
      trial: true,
    },
  ];

  const state = {
    episodes: [],
    current: null,
    previewMode: true,
  };

  const els = {
    list: document.getElementById("episodeList"),
    title: document.getElementById("title"),
    meta: document.getElementById("meta"),
    chapters: document.getElementById("chapters"),
    subs: document.getElementById("subsPreview"),
    badge: document.getElementById("publishBadge"),
    btnPreview: document.getElementById("btnPreview"),
    btnPublish: document.getElementById("btnPublish"),
    btnRefresh: document.getElementById("btnRefresh"),
  };

  const player = videojs("player", {
    controls: true,
    fluid: true,
    playbackRates: [0.75, 1, 1.25, 1.5],
    controlBar: {
      pictureInPictureToggle: false,
    },
  });

  function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderList() {
    els.list.innerHTML = "";
    state.episodes.forEach((ep) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${ep.title} (${fmtDuration(ep.duration_sec || 0)})`;
      btn.className = state.current && state.current.episode_id === ep.episode_id ? "active" : "";
      btn.onclick = () => selectEpisode(ep.episode_id);
      li.appendChild(btn);
      els.list.appendChild(li);
    });
  }

  function renderChapters(ep) {
    els.chapters.innerHTML = "";
    (ep.chapters || []).forEach((ch) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = ch.label || `[${fmtDuration(ch.start_sec)}]`;
      btn.onclick = () => {
        player.currentTime(ch.start_sec || 0);
        player.play();
      };
      li.appendChild(btn);
      els.chapters.appendChild(li);
    });
  }

  function selectEpisode(id) {
    const ep = state.episodes.find((e) => e.episode_id === id);
    if (!ep) return;
    state.current = ep;
    els.title.textContent = ep.title || id;
    els.meta.textContent = [
      `id=${ep.episode_id}`,
      `المدة ~${fmtDuration(ep.duration_sec || 1500)}`,
      ep.trial ? "وضع تجربة" : "حلقة كاملة ~25د",
      state.previewMode ? "معاينة قبل النشر" : "وضع نشر",
    ].join(" · ");
    els.badge.textContent = ep.publish_ready ? "جاهز للنشر" : "مسودة / Draft";
    els.badge.className = "badge" + (ep.publish_ready ? " ready" : "");
    els.btnPublish.disabled = !ep.publish_ready || state.previewMode;

    player.src({ type: "video/mp4", src: ep.video });
    // softsubs track if present
    Array.from(player.remoteTextTracks() || []).forEach(() => {});
    if (ep.subtitles_vtt) {
      player.addRemoteTextTrack(
        { kind: "subtitles", src: ep.subtitles_vtt, srclang: "ar", label: "العربية", default: true },
        false
      );
    }
    els.subs.textContent = ep.subtitles_json
      ? JSON.stringify(ep.subtitles_json, null, 2)
      : "Softsubs from on_screen_text.json (load via API pack).";
    renderChapters(ep);
    renderList();
  }

  async function loadEpisodes() {
    try {
      const res = await fetch(`${API_BASE}/api/player/list`);
      if (res.ok) {
        const data = await res.json();
        state.episodes = data.episodes || SAMPLE_EPISODES;
      } else {
        state.episodes = SAMPLE_EPISODES;
      }
    } catch (_) {
      state.episodes = SAMPLE_EPISODES;
    }
    renderList();
    if (state.episodes[0]) selectEpisode(state.episodes[0].episode_id);
  }

  els.btnRefresh.onclick = loadEpisodes;
  els.btnPreview.onclick = () => {
    state.previewMode = true;
    if (state.current) selectEpisode(state.current.episode_id);
    alert("وضع المعاينة قبل النشر مفعّل — Preview before publish.");
  };
  els.btnPublish.onclick = () => {
    alert("النشر غير مفعّل في السقالة — اربط لاحقاً بحزمة التصدير.");
  };

  // Public API for right-settings pane / iframe embed
  window.EpisodePlayer = {
    player,
    loadEpisodes,
    selectEpisode,
    play: () => player.play(),
    pause: () => player.pause(),
    seek: (sec) => {
      player.currentTime(sec);
    },
    getCurrent: () => state.current,
    openFromSettings: (episodeId) => {
      state.previewMode = true;
      loadEpisodes().then(() => selectEpisode(episodeId || (state.episodes[0] && state.episodes[0].episode_id)));
    },
  };

  loadEpisodes();
})();
