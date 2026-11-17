(() => {
  const startCallBtn = document.getElementById("startCall");
  const endCallBtn = document.getElementById("endCall");
  const sendBtn = document.getElementById("send");
  const textEl = document.getElementById("text");
  const voiceEl = document.getElementById("voice");
  const deliveryEl = document.getElementById("delivery");
  const replyModeEl = document.getElementById("replyMode");
  const voiceHint = document.getElementById("voiceHint");
  const callState = document.getElementById("callState");
  const liveCaption = document.getElementById("liveCaption");
  const callPulse = document.getElementById("callPulse");
  const chatEl = document.getElementById("chat");
  const statusEl = document.getElementById("status");
  const FALLBACK_VOICES = [
    { name: "Fatima", id: "ar-AE-FatimaNeural", locale: "ar-AE", locale_name: "الإمارات" },
    { name: "Laila", id: "ar-BH-LailaNeural", locale: "ar-BH", locale_name: "البحرين" },
    { name: "Amina", id: "ar-DZ-AminaNeural", locale: "ar-DZ", locale_name: "الجزائر" },
    { name: "Salma", id: "ar-EG-SalmaNeural", locale: "ar-EG", locale_name: "مصر" },
    { name: "Rana", id: "ar-IQ-RanaNeural", locale: "ar-IQ", locale_name: "العراق" },
    { name: "Sana", id: "ar-JO-SanaNeural", locale: "ar-JO", locale_name: "الأردن" },
    { name: "Noura", id: "ar-KW-NouraNeural", locale: "ar-KW", locale_name: "الكويت" },
    { name: "Layla", id: "ar-LB-LaylaNeural", locale: "ar-LB", locale_name: "لبنان" },
    { name: "Iman", id: "ar-LY-ImanNeural", locale: "ar-LY", locale_name: "ليبيا" },
    { name: "Mouna", id: "ar-MA-MounaNeural", locale: "ar-MA", locale_name: "المغرب" },
    { name: "Aysha", id: "ar-OM-AyshaNeural", locale: "ar-OM", locale_name: "عُمان" },
    { name: "Amal", id: "ar-QA-AmalNeural", locale: "ar-QA", locale_name: "قطر" },
    { name: "Zariyah", id: "ar-SA-ZariyahNeural", locale: "ar-SA", locale_name: "السعودية" },
    { name: "Amany", id: "ar-SY-AmanyNeural", locale: "ar-SY", locale_name: "سوريا" },
    { name: "Reem", id: "ar-TN-ReemNeural", locale: "ar-TN", locale_name: "تونس" },
    { name: "Maryam", id: "ar-YE-MaryamNeural", locale: "ar-YE", locale_name: "اليمن" },
  ];

  const LOCALE_AR = {
    "ar-AE": "الإمارات", "ar-BH": "البحرين", "ar-DZ": "الجزائر", "ar-EG": "مصر",
    "ar-IQ": "العراق", "ar-JO": "الأردن", "ar-KW": "الكويت", "ar-LB": "لبنان",
    "ar-LY": "ليبيا", "ar-MA": "المغرب", "ar-OM": "عُمان", "ar-QA": "قطر",
    "ar-SA": "السعودية", "ar-SY": "سوريا", "ar-TN": "تونس", "ar-YE": "اليمن",
  };

  const DEFAULT_VOICE = "Zariyah";
  const API_BASE = "";
  const HISTORY_KEY = "voice-bot-history-v16";
  const MEMORY_KEY = "voice-bot-memory-v16";
  const VOICE_KEY = "voice-bot-voice-v16";
  const DELIVERY_KEY = "voice-bot-delivery-v16";
  const CALL_OPENER = "هلا، معك على المكالمة. تكلّمي.";

  // Sensitive VAD — catch whispers; do not require clear words.
  const WHISPER_RMS = 0.0035;
  const SILENCE_MS = 900;
  const MIN_SPEECH_MS = 280;
  const MAX_UTTERANCE_MS = 25000;

  let catalog = FALLBACK_VOICES.slice();
  let history = loadJson(HISTORY_KEY, []);
  let memory = loadJson(MEMORY_KEY, { name: "", topic: "", notes: [] });
  let inCall = false;
  let busy = false;
  let isSpeaking = false;
  let queueTimer = null;
  let currentAudio = null;
  let sharedAudio = null;
  let audioUnlocked = false;
  let audioCtx = null;
  let activeVoiceName = DEFAULT_VOICE;
  let micStream = null;
  let lastBotText = "";
  let listenGeneration = 0;
  let vadAnalyser = null;
  let vadSource = null;
  let vadProcessor = null;
  let vadRaf = 0;
  let capturing = false;
  let pcmChunks = [];
  let pcmSampleRate = 48000;

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
      return { ...fallback, ...parsed };
    } catch (_) {
      return fallback;
    }
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-60))); } catch (_) {}
  }
  function saveMemory() {
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch (_) {}
  }
  function setStatus(msg) { statusEl.textContent = msg; }
  function waitMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function localeLabel(v) {
    return v.locale_name || LOCALE_AR[v.locale] || v.locale || "";
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = role === "user" ? "أنت (صوت)" : `البوت (${activeVoiceName})`;
    const body = document.createElement("div");
    body.textContent = text;
    bubble.appendChild(who);
    bubble.appendChild(body);
    chatEl.appendChild(bubble);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderHistory() {
    chatEl.innerHTML = "";
    history.forEach((item) => {
      if (item.role === "user") addBubble("user", item.content);
      if (item.role === "assistant") addBubble("bot", item.content);
    });
  }

  function populateVoices(voices) {
    catalog = (voices && voices.length) ? voices : FALLBACK_VOICES;
    voiceEl.innerHTML = "";
    catalog.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      const place = localeLabel(v);
      opt.textContent = place ? `${v.name} — ${place}` : `${v.name} — ${v.id}`;
      voiceEl.appendChild(opt);
    });
    const saved = localStorage.getItem(VOICE_KEY);
    const names = catalog.map((v) => v.name);
    activeVoiceName = names.includes(saved)
      ? saved
      : (names.includes(DEFAULT_VOICE) ? DEFAULT_VOICE : names[0]);
    voiceEl.value = activeVoiceName;
    updateVoiceHint();
  }

  function updateVoiceHint() {
    const meta = catalog.find((v) => v.name === activeVoiceName) || catalog[0];
    voiceHint.textContent =
      `${catalog.length}/16 صوت | ${meta.name} | صوت↔صوت مباشر | كل المهارات | بلا فلاتر`;
  }

  function selectedVoiceName() {
    const name = voiceEl.value;
    if (catalog.some((v) => v.name === name)) return name;
    const fallback = catalog.find((v) => v.name === DEFAULT_VOICE) || catalog[0];
    voiceEl.value = fallback.name;
    return fallback.name;
  }

  function selectedDelivery() {
    return deliveryEl.value || "warm";
  }

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function getSharedAudio() {
    if (!sharedAudio) {
      sharedAudio = new Audio();
      sharedAudio.preload = "auto";
      sharedAudio.setAttribute("playsinline", "true");
      sharedAudio.setAttribute("webkit-playsinline", "true");
      sharedAudio.playsInline = true;
      sharedAudio.muted = false;
      sharedAudio.volume = 1;
    }
    return sharedAudio;
  }

  async function unlockAudioPlayback() {
    try {
      ensureAudio();
      const audio = getSharedAudio();
      audio.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
      audio.muted = true;
      await audio.play().catch(() => {});
      audio.pause();
      audio.muted = false;
      audio.currentTime = 0;
      audioUnlocked = true;
    } catch (_) {
      audioUnlocked = false;
    }
  }

  async function ensureMicPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("المتصفح ما يدعم المايك");
    }
    if (micStream) {
      const live = micStream.getTracks().some((t) => t.readyState === "live");
      if (live) return micStream;
    }
    // Keep whispers: no noise suppression (it deletes quiet speech).
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    return micStream;
  }

  function setMicEnabled(enabled) {
    if (!micStream) return;
    micStream.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  function stopSpeech() {
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    if (currentAudio) {
      try {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.pause();
      } catch (_) {}
      currentAudio = null;
    }
  }

  function stopCapturePipeline() {
    listenGeneration += 1;
    if (vadRaf) {
      cancelAnimationFrame(vadRaf);
      vadRaf = 0;
    }
    capturing = false;
    pcmChunks = [];
    if (vadProcessor) {
      try { vadProcessor.disconnect(); } catch (_) {}
      vadProcessor.onaudioprocess = null;
      vadProcessor = null;
    }
    if (vadSource) {
      try { vadSource.disconnect(); } catch (_) {}
      vadSource = null;
    }
    vadAnalyser = null;
  }

  function encodeWavBlob(floatChunks, sampleRate) {
    let length = 0;
    for (const c of floatChunks) length += c.length;
    const samples = new Float32Array(length);
    let off = 0;
    for (const c of floatChunks) {
      samples.set(c, off);
      off += c.length;
    }
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => {
      for (let i = 0; i < s.length; i += 1) view.setUint8(o + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let idx = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      idx += 2;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function fetchFemaleTtsBlob(text, voiceName, delivery) {
    const url =
      `${API_BASE}/api/tts?voice=${encodeURIComponent(voiceName)}` +
      `&delivery=${encodeURIComponent(delivery)}` +
      `&text=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.text()) || `TTS HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error("TTS empty audio");
    return new Blob([buf], { type: "audio/mpeg" });
  }

  async function playBlob(blob) {
    const audio = getSharedAudio();
    const objectUrl = URL.createObjectURL(blob);
    stopSpeech();
    currentAudio = audio;
    try { audio.pause(); } catch (_) {}
    audio.src = objectUrl;
    audio.muted = false;
    audio.volume = 1;
    try { audio.load(); } catch (_) {}

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        audio.removeEventListener("canplaythrough", finish);
        audio.removeEventListener("loadeddata", finish);
        resolve();
      };
      audio.addEventListener("canplaythrough", finish, { once: true });
      audio.addEventListener("loadeddata", finish, { once: true });
      setTimeout(finish, 2500);
    });

    const finished = new Promise((resolve) => {
      const done = () => {
        clearTimeout(watchdog);
        resolve();
      };
      const ms = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(90000, (audio.duration + 2) * 1000)
        : 20000;
      const watchdog = setTimeout(done, ms);
      audio.onended = done;
      audio.onerror = done;
    });

    try {
      await audio.play();
    } catch (_) {
      await unlockAudioPlayback();
      audio.muted = false;
      audio.volume = 1;
      try {
        await audio.play();
      } catch (err2) {
        throw new Error(`playback blocked: ${err2 && err2.message ? err2.message : err2}`);
      }
    }
    try {
      await finished;
    } finally {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      audio.onended = null;
      audio.onerror = null;
      if (currentAudio === audio) currentAudio = null;
    }
  }

  function updateMemory(text) {
    const nameMatch = text.match(/(?:اسمي|نادني)\s+([^\s،.!?؟]{2,20})/i);
    if (nameMatch) memory.name = nameMatch[1];
    if (text.length > 8) {
      memory.topic = text.slice(0, 80);
      memory.notes = [text.slice(0, 100), ...(memory.notes || [])].slice(0, 10);
    }
    saveMemory();
  }

  function setCallUi(active) {
    inCall = active;
    startCallBtn.hidden = active;
    endCallBtn.hidden = !active;
    callPulse.classList.toggle("live", active);
    callState.textContent = active ? `صوت↔صوت نشط — ${activeVoiceName}` : "جاهز للمكالمة";
    liveCaption.textContent = active
      ? "المايك يلتقط كل شيء بما فيه الهمس — بدون حجب."
      : "اختاري الصوت ثم ابدئي.";
  }

  function pickRecorderMime() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const type of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  }

  function rmsFromAnalyser(analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  function historyPayload() {
    return JSON.stringify(
      history.slice(-8).map((item) => ({
        role: item.role === "bot" ? "assistant" : item.role,
        content: String(item.content || "").slice(0, 500),
      }))
    );
  }

  async function sendVoiceTurn(blob) {
    const form = new FormData();
    const mime = blob.type || "audio/wav";
    const ext = mime.includes("wav") ? "wav" : mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    form.append("audio", blob, `utterance.${ext}`);
    form.append("voice", activeVoiceName);
    form.append("delivery", selectedDelivery());
    form.append("history", historyPayload());
    const res = await fetch(`${API_BASE}/api/voice-turn`, { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.text()) || `voice-turn HTTP ${res.status}`);
    const heard = decodeURIComponent(res.headers.get("X-Heard") || "");
    const reply = decodeURIComponent(res.headers.get("X-Reply") || "");
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error("empty voice reply");
    return {
      blob: new Blob([buf], { type: "audio/mpeg" }),
      heard,
      reply,
    };
  }

  async function sendTextTurn(userText) {
    const form = new FormData();
    form.append("text", userText);
    form.append("voice", activeVoiceName);
    form.append("delivery", selectedDelivery());
    form.append("history", historyPayload());
    const res = await fetch(`${API_BASE}/api/text-turn`, { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.text()) || `text-turn HTTP ${res.status}`);
    const reply = decodeURIComponent(res.headers.get("X-Reply") || "");
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error("empty spoken reply");
    return {
      blob: new Blob([buf], { type: "audio/mpeg" }),
      reply: reply || "تم.",
    };
  }

  async function handleVoiceBlob(blob) {
    if (!blob || !blob.size || busy || isSpeaking || !inCall) {
      if (inCall && !busy && !isSpeaking) queueTimer = setTimeout(listenLoop, 200);
      return;
    }
    busy = true;
    setMicEnabled(false);
    activeVoiceName = selectedVoiceName();
    setStatus("أسمع وأرد بالصوت…");
    liveCaption.textContent = "أفهمك وأرد بالصوت…";

    try {
      const turn = await sendVoiceTurn(blob);
      if (turn.heard) {
        updateMemory(turn.heard);
        history.push({ role: "user", content: turn.heard });
        addBubble("user", turn.heard);
      } else {
        history.push({ role: "user", content: "[صوت / همس]" });
        addBubble("user", "[صوت / همس]");
      }
      if (turn.reply) {
        lastBotText = turn.reply;
        history.push({ role: "assistant", content: turn.reply });
        addBubble("bot", turn.reply);
      }
      saveHistory();
      setStatus(`${activeVoiceName} تتكلم…`);
      isSpeaking = true;
      await playBlob(turn.blob);
      await waitMs(450);
      setStatus("جاهزة. تكلّمي أو اهمسي.");
    } catch (err) {
      setStatus(`فشل مسار الصوت: ${err.message}`);
    } finally {
      isSpeaking = false;
      busy = false;
      setMicEnabled(true);
      if (inCall) listenLoop();
    }
  }

  async function listenLoop() {
    if (!inCall || busy || isSpeaking) return;
    if (!micStream) {
      setStatus("افتحي المايك أول.");
      return;
    }
    const gen = ++listenGeneration;
    setMicEnabled(true);
    setStatus("أسمعك… زي مكالمة حية");
    liveCaption.textContent = "مكالمة صوت↔صوت — تكلمين وأرد عليك.";

    const ctx = ensureAudio();
    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch (_) {}
    pcmSampleRate = ctx.sampleRate || 48000;

    if (vadProcessor) {
      try { vadProcessor.disconnect(); } catch (_) {}
      vadProcessor.onaudioprocess = null;
      vadProcessor = null;
    }
    if (vadSource) {
      try { vadSource.disconnect(); } catch (_) {}
      vadSource = null;
    }

    vadSource = ctx.createMediaStreamSource(micStream);
    vadAnalyser = ctx.createAnalyser();
    vadAnalyser.fftSize = 2048;
    // ScriptProcessor keeps raw PCM for a reliable WAV upload (no broken webm).
    const frame = 4096;
    vadProcessor = ctx.createScriptProcessor(frame, 1, 1);
    pcmChunks = [];
    capturing = false;
    let speechStartedAt = 0;
    let lastLoudAt = 0;
    let utteranceStartedAt = 0;
    let finishing = false;

    vadSource.connect(vadAnalyser);
    vadSource.connect(vadProcessor);
    // Keep processor alive without audible monitor feedback.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    vadProcessor.connect(mute);
    mute.connect(ctx.destination);

    const finishUtterance = async () => {
      if (finishing || gen !== listenGeneration) return;
      finishing = true;
      const chunks = pcmChunks;
      pcmChunks = [];
      capturing = false;
      if (!chunks.length) {
        finishing = false;
        if (inCall && !busy && !isSpeaking) queueTimer = setTimeout(() => { listenLoop(); }, 200);
        return;
      }
      const blob = encodeWavBlob(chunks, pcmSampleRate);
      // Disconnect outside the audio callback to avoid glitches.
      setTimeout(async () => {
        stopCapturePipeline();
        await handleVoiceBlob(blob);
      }, 0);
    };

    vadProcessor.onaudioprocess = (ev) => {
      if (gen !== listenGeneration || !inCall || busy || isSpeaking || finishing) return;
      const input = ev.inputBuffer.getChannelData(0);
      // RMS on this frame
      let sum = 0;
      for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      const now = performance.now();
      const loud = rms >= WHISPER_RMS;

      if (loud) {
        lastLoudAt = now;
        if (!capturing) {
          capturing = true;
          speechStartedAt = now;
          utteranceStartedAt = now;
          pcmChunks = [];
          liveCaption.textContent = `ألتقط… (${rms.toFixed(3)})`;
          setStatus("ألتقط صوتك…");
        }
      }

      if (capturing) {
        pcmChunks.push(new Float32Array(input));
        const spokenFor = now - speechStartedAt;
        const silentFor = now - lastLoudAt;
        const tooLong = now - utteranceStartedAt > MAX_UTTERANCE_MS;
        if ((spokenFor >= MIN_SPEECH_MS && silentFor >= SILENCE_MS) || tooLong) {
          finishUtterance();
        }
      }
    };

    // Safety tick for AudioContext resume + UI heartbeat
    const tick = () => {
      if (gen !== listenGeneration || !inCall) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      if (!busy && !isSpeaking && !capturing) {
        liveCaption.textContent = "أسمعك — جاهزة";
      }
      vadRaf = requestAnimationFrame(tick);
    };
    vadRaf = requestAnimationFrame(tick);
  }

  async function handleTextFallback(text) {
    // Accessibility only when mic fails — still a real model reply, never an echo.
    const userText = String(text || "").trim();
    if (!userText || busy || isSpeaking) return;
    busy = true;
    setMicEnabled(false);
    activeVoiceName = selectedVoiceName();
    updateMemory(userText);
    history.push({ role: "user", content: userText });
    addBubble("user", userText);
    saveHistory();
    setStatus("أفهم وأرد بصوت…");
    try {
      const turn = await sendTextTurn(userText);
      lastBotText = turn.reply;
      history.push({ role: "assistant", content: turn.reply });
      addBubble("bot", turn.reply);
      saveHistory();
      isSpeaking = true;
      await playBlob(turn.blob);
      setStatus(inCall ? "جاهزة. تكلّمي." : "انتهى.");
    } catch (err) {
      setStatus(`فشل الرد: ${err.message}`);
    } finally {
      isSpeaking = false;
      busy = false;
      setMicEnabled(true);
      if (inCall) listenLoop();
    }
  }

  async function startCall() {
    await unlockAudioPlayback();
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    localStorage.setItem(DELIVERY_KEY, selectedDelivery());
    setCallUi(true);
    setStatus("أجهّز مسار الصوت↔صوت…");
    lastBotText = "";

    let readyBlob = null;
    try {
      readyBlob = await fetchFemaleTtsBlob(CALL_OPENER, activeVoiceName, selectedDelivery());
    } catch (err) {
      setStatus(`خدمة الصوت مو جاهزة: ${err.message}`);
      setCallUi(false);
      return;
    }

    try {
      await ensureMicPermission();
      setMicEnabled(true);
    } catch (err) {
      setStatus(`ما قدرت أفتح المايك (${err.message}). تقدرين تكتبين.`);
    }

    history.push({ role: "assistant", content: CALL_OPENER });
    addBubble("bot", CALL_OPENER);
    saveHistory();
    setStatus(`${activeVoiceName} تتكلم…`);
    try {
      isSpeaking = true;
      setMicEnabled(false);
      await Promise.race([
        playBlob(readyBlob),
        waitMs(15000),
      ]);
      await waitMs(250);
    } catch (err) {
      setStatus(`فشل التشغيل: ${err.message}`);
    } finally {
      isSpeaking = false;
      busy = false;
      setMicEnabled(true);
    }

    setStatus("جاهزة. تكلّمي أو اهمسي — بدون فلاتر.");
    liveCaption.textContent = "صوت↔صوت مباشر.";
    listenLoop();
  }

  function endCall() {
    busy = false;
    isSpeaking = false;
    stopSpeech();
    stopCapturePipeline();
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    setCallUi(false);
    setStatus("انتهت المكالمة.");
  }

  voiceEl.addEventListener("change", () => {
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    updateVoiceHint();
    setStatus(`تم اختيار ${activeVoiceName}`);
  });
  deliveryEl.addEventListener("change", () => {
    localStorage.setItem(DELIVERY_KEY, selectedDelivery());
  });
  if (replyModeEl) {
    replyModeEl.disabled = true;
    replyModeEl.title = "كل المهارات مفعّلة معًا";
  }
  callPulse?.addEventListener("click", () => {
    if (!inCall) return;
    if (isSpeaking || busy) {
      stopSpeech();
      isSpeaking = false;
      busy = false;
      setMicEnabled(true);
      setStatus("قاطعتِ — تكلّمي.");
      listenLoop();
    }
  });
  startCallBtn.addEventListener("click", () => { startCall(); });
  endCallBtn.addEventListener("click", endCall);
  sendBtn.addEventListener("click", async () => {
    await unlockAudioPlayback();
    const t = textEl.value.trim();
    textEl.value = "";
    if (!inCall) setCallUi(true);
    handleTextFallback(t);
  });
  document.querySelector(".call-card")?.addEventListener(
    "pointerdown",
    () => { unlockAudioPlayback(); },
    { once: true }
  );

  populateVoices(FALLBACK_VOICES);
  const savedDelivery = localStorage.getItem(DELIVERY_KEY);
  if (savedDelivery) deliveryEl.value = savedDelivery;
  renderHistory();

  Promise.all([
    fetch(`${API_BASE}/api/voices`).then((r) => r.json()),
    fetch(`${API_BASE}/api/skills`).then((r) => r.json()).catch(() => null),
  ])
    .then(([voices, skills]) => {
      if (Array.isArray(voices.voices) && voices.voices.length) populateVoices(voices.voices);
      const skillN = skills?.count || "كل";
      setStatus(`جاهزة: صوت↔صوت فقط | مهارات ${skillN} | بدون فلاتر محتوى`);
    })
    .catch(() => {
      populateVoices(FALLBACK_VOICES);
      setStatus("شغّلي السيرفر: ./manage.sh start");
    });
})();
