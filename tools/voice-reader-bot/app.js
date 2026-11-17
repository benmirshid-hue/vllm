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
  const policyNote = document.getElementById("policyNote");

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

  // Default Saudi female Neural voice.
  const DEFAULT_VOICE = "Zariyah";
  const API_BASE = "";
  const HISTORY_KEY = "voice-bot-history-v7";
  const MEMORY_KEY = "voice-bot-memory-v7";
  const VOICE_KEY = "voice-bot-voice-v7";
  const DELIVERY_KEY = "voice-bot-delivery-v7";
  const MODE_KEY = "voice-bot-mode-v7";

  // ONLY explicit sexual content — all other topics are allowed.
  const blockedPatterns = [
    /نيك/i, /أنيك/i, /انيك/i, /طيز/i, /\bزب\b/i, /\bكس\b/i, /قحب/i, /ممحون/i, /منيوك/i,
    /سكس/i, /إباحي/i, /اباحي/i,
    /\bsex\b/i, /\bporn\b/i, /\bfuck\b/i, /\bcock\b/i, /\bpussy\b/i, /\banal\b/i,
  ];

  // Boilerplate / filler the model sometimes emits — strip completely.
  const fillerPatterns = [
    /مرحبا[ًا]?\s*أنا،?\s*أنا\s*أود\s*أن\s*أتحدث\s*معك\s*الآن/gi,
    /إن\s*المكالمة\s*جاهزة\s*الآن/gi,
    /هيا،?\s*هيا\s*لنكمل\s*ما\s*نقول\s*الآن/gi,
    /المكالمة\s*جاهزة\.?/gi,
    /هل تريد تفاصيل أكثر\؟?/gi,
    /ما النقطة الأهم بالنسبة لك الآن\؟?/gi,
    /هل نكمل على نفس الموضوع أم نغيّر\؟?/gi,
    /ما الذي تريد أن أوضحه أكثر\؟?/gi,
  ];

  let catalog = FALLBACK_VOICES.slice();
  let history = loadJson(HISTORY_KEY, []);
  let memory = loadJson(MEMORY_KEY, { name: "", topic: "", notes: [] });
  let inCall = false;
  let busy = false;
  let recognition = null;
  let queueTimer = null;
  let shouldListenAgain = false;
  let currentAudio = null;
  let sharedAudio = null;
  let audioUnlocked = false;
  let audioCtx = null;
  let activeVoiceName = DEFAULT_VOICE;
  let micStream = null;

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
  function isBlocked(text) { return blockedPatterns.some((p) => p.test(text)); }
  function showPolicy(msg) { policyNote.hidden = false; policyNote.textContent = msg; }
  function hidePolicy() { policyNote.hidden = true; }

  function localeLabel(v) {
    return v.locale_name || LOCALE_AR[v.locale] || v.locale || "";
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = role === "user" ? "أنت" : `البوت (${activeVoiceName})`;
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
      `${catalog.length}/16 صوت | المختار: ${meta.name} (${meta.id}) | لهجة سعودية`;
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

  function selectedMode() {
    return replyModeEl.value || "balanced";
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
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return micStream;
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

  function waitMs(ms) {
    return new Promise((resolve) => {
      queueTimer = setTimeout(resolve, ms);
    });
  }

  function splitSentences(text) {
    return text
      .split(/(?<=[.!?…。؟！])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function buildSpeechPlan(text) {
    const plan = [];
    const sentences = splitSentences(text.replace(/\n+/g, " ").trim());
    sentences.forEach((sentence, idx) => {
      const chunks = [];
      if (sentence.length <= 220) chunks.push(sentence);
      else {
        for (let i = 0; i < sentence.length; i += 220) chunks.push(sentence.slice(i, i + 220));
      }
      chunks.forEach((chunk, cIdx, arr) => {
        plan.push({
          type: "speech",
          text: chunk,
          pauseAfterMs: cIdx < arr.length - 1 ? 160 : (idx < sentences.length - 1 ? 380 : 0),
        });
      });
    });
    if (!plan.length && text.trim()) {
      plan.push({ type: "speech", text: text.trim().slice(0, 220), pauseAfterMs: 0 });
    }
    return plan;
  }

  async function fetchFemaleTtsBlob(text, voiceName, delivery) {
    const url =
      `${API_BASE}/api/tts?voice=${encodeURIComponent(voiceName)}` +
      `&delivery=${encodeURIComponent(delivery)}` +
      `&text=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.text()) || `TTS HTTP ${res.status}`);
    const gender = res.headers.get("X-Voice-Gender");
    if (gender && gender.toLowerCase() !== "female") {
      throw new Error("Rejected non-female voice response");
    }
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error("TTS empty audio");
    return new Blob([buf], { type: "audio/mpeg" });
  }

  async function playBlob(blob) {
    const audio = getSharedAudio();
    const objectUrl = URL.createObjectURL(blob);
    stopSpeech();
    currentAudio = audio;
    audio.src = objectUrl;
    audio.muted = false;
    audio.volume = 1;
    const finished = new Promise((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
    });
    try {
      await audio.play();
    } catch (_) {
      await unlockAudioPlayback();
      audio.muted = false;
      await audio.play();
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

  async function speakText(text) {
    if (!audioUnlocked) await unlockAudioPlayback();
    ensureAudio();
    activeVoiceName = selectedVoiceName();
    const delivery = selectedDelivery();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    localStorage.setItem(DELIVERY_KEY, delivery);
    const plan = buildSpeechPlan(text);
    for (let i = 0; i < plan.length; i += 1) {
      const step = plan[i];
      const blob = await fetchFemaleTtsBlob(step.text, activeVoiceName, delivery);
      await playBlob(blob);
      if (i < plan.length - 1 && step.pauseAfterMs) {
        await waitMs(Math.min(step.pauseAfterMs, 450));
      }
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

  function stripFiller(text) {
    let out = text.trim();
    fillerPatterns.forEach((p) => { out = out.replace(p, " "); });
    out = out
      .replace(/^(مرحبا[ًا]?[،.]?\s*)+/gi, "")
      .replace(/\b(مم+|آه+|همم+)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return out;
  }

  function cleanReply(reply) {
    let out = stripFiller(reply.replace(/\s+/g, " "));
    if (!out) out = "تمام يا قلبي، وضّحي لي أكثر عشان أقدر أساعدك.";
    return out;
  }

  function systemPrompt() {
    const mode = selectedMode();
    const modeLine = {
      helpful: "جاوبي بوضوح وبشكل عملي.",
      thoughtful: "فكّري شوي وقدّمي جواب مرتب.",
      curious: "جاوبي وبعدين اسألي سؤال واحد بس إذا احتجتي توضيح.",
      concise: "جاوبي بجملتين إلى ثلاث بالأكثر.",
      balanced: "جاوبي بشكل طبيعي ومفيد.",
    }[mode] || "جاوبي بشكل طبيعي ومفيد.";

    const mem = [
      memory.name ? `الاسم: ${memory.name}` : "",
      memory.topic ? `آخر موضوع: ${memory.topic}` : "",
      memory.notes?.length ? `ملاحظات: ${memory.notes.slice(0, 3).join(" | ")}` : "",
    ].filter(Boolean).join("\n") || "ما في ذاكرة سابقة.";

    return [
      `أنتِ مساعدة مكالمة صوتية. صوتك الحالي: ${activeVoiceName}.`,
      "تكلمي باللهجة السعودية البيضاء (نجد/الرياض)، مو فصحى أبد.",
      "أسلوبك: حنونة، عاطفية، ودلعة خفيفة دافية — مو روبوتية.",
      "أمثلة نبرة: يا قلبي، تمام يا بعدي، لا تشيلين هم، أنا معك، وش تحسين الحين؟",
      "الدلع والعاطفة والحنية مطلوبة في الرد، بدون إباحية وبدون محتوى جنسي صريح.",
      "افهمي كلامه وردّي مباشرة على طلبه؛ لا تسردين مقدمات فارغة.",
      "ممنوع الجمل الفاضية مثل: المكالمة جاهزة، هيا لنكمل، مرحبا أنا أود أن أتحدث معك الآن، هيا هيا لنكمل ما نقول.",
      "لا تكرري الترحيب في كل رد.",
      modeLine,
      "كل المواضيع مسموحة إلا المحتوى الجنسي الصريح فقط.",
      "ذاكرة:",
      mem,
    ].join("\n");
  }

  async function askModel(userText) {
    const messages = [
      { role: "system", content: systemPrompt() },
      ...history.slice(-16),
      { role: "user", content: userText },
    ];
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: "openai", seed: Date.now() % 100000 }),
    });
    if (!response.ok) throw new Error(`smart reply HTTP ${response.status}`);
    const reply = (await response.text()).trim();
    if (!reply) throw new Error("empty smart reply");
    return reply;
  }

  function localFallback(userText) {
    const name = memory.name ? ` ${memory.name}` : "";
    return cleanReply(
      `تمام يا قلبي${name}، فهمت كلامك. قولي لي وش تبي بالضبط وأنا معك.`
    );
  }

  function setCallUi(active) {
    inCall = active;
    startCallBtn.hidden = active;
    endCallBtn.hidden = !active;
    callPulse.classList.toggle("live", active);
    callState.textContent = active ? `المكالمة نشطة — ${activeVoiceName}` : "جاهز للمكالمة";
    liveCaption.textContent = active
      ? `${activeVoiceName} تسمعك وترد باللهجة السعودية.`
      : "اختاري الصوت ثم ابدئي.";
  }

  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (recognition) return recognition;
    recognition = new SR();
    recognition.lang = "ar-SA";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => {
      setStatus("اسمعي… تكلّمي الحين");
      liveCaption.textContent = "تكلّمي بوضوح.";
    };
    recognition.onerror = (e) => {
      const err = e.error || "unknown";
      if (err === "not-allowed" || err === "service-not-allowed") {
        setStatus("اسمحي للمايك من إعدادات المتصفح، أو اكتبي بالخانة.");
        shouldListenAgain = false;
        return;
      }
      if (err === "no-speech" || err === "aborted") {
        if (inCall && !busy) queueTimer = setTimeout(listenLoop, 500);
        return;
      }
      setStatus(`مشكلة بالمايك: ${err}`);
      if (inCall && !busy) queueTimer = setTimeout(listenLoop, 800);
    };
    recognition.onend = () => {
      if (shouldListenAgain && inCall && !busy) {
        queueTimer = setTimeout(listenLoop, 350);
      }
    };
    recognition.onresult = async (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) finalText += `${piece} `;
        else interimText += `${piece} `;
      }
      if (interimText) liveCaption.textContent = `سمعتك: ${interimText.trim()}`;
      const transcript = finalText.trim() || (
        event.results[event.results.length - 1].isFinal
          ? event.results[event.results.length - 1][0].transcript.trim()
          : ""
      );
      if (transcript) {
        shouldListenAgain = false;
        try { recognition.stop(); } catch (_) {}
        liveCaption.textContent = `فهمت: ${transcript}`;
        await handleUtterance(transcript);
      }
    };
    return recognition;
  }

  function listenLoop() {
    if (!inCall || busy) return;
    const rec = getRecognition();
    if (!rec) {
      setStatus("المتصفح ما يدعم المايك. اكتبي بالخانة.");
      return;
    }
    shouldListenAgain = true;
    stopSpeech();
    try {
      rec.start();
    } catch (_) {
      queueTimer = setTimeout(listenLoop, 700);
    }
  }

  async function handleUtterance(text) {
    if (!text || busy) return;
    if (isBlocked(text)) {
      showPolicy("أي موضوع تمام؛ الممنوع فقط المحتوى الجنسي الصريح.");
      if (inCall) queueTimer = setTimeout(listenLoop, 600);
      return;
    }
    busy = true;
    shouldListenAgain = false;
    hidePolicy();
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(MODE_KEY, selectedMode());
    updateMemory(text);
    history.push({ role: "user", content: text });
    addBubble("user", text);
    saveHistory();
    setStatus("أفكر في رد…");

    let reply;
    try {
      reply = cleanReply(await askModel(text));
    } catch (_) {
      reply = localFallback(text);
      setStatus("الرد السحابي تعثر؛ استخدمت رد محلي.");
    }
    if (isBlocked(reply)) {
      reply = cleanReply("يا قلبي خلّنا نكمّل بدون كلام جنسي صريح. وش تبي نتكلم عنه؟");
    }

    history.push({ role: "assistant", content: reply });
    addBubble("bot", reply);
    saveHistory();
    setStatus(`${activeVoiceName} تتكلم…`);
    try {
      await speakText(reply);
      setStatus(inCall ? "جاهزة. تكلّمي." : "انتهى الرد.");
    } catch (err) {
      setStatus(`فشل الصوت: ${err.message}`);
    }
    busy = false;
    if (inCall) listenLoop();
  }

  async function startCall() {
    await unlockAudioPlayback();
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    localStorage.setItem(DELIVERY_KEY, selectedDelivery());
    localStorage.setItem(MODE_KEY, selectedMode());
    setCallUi(true);
    setStatus("أجهّز الصوت والمايك…");

    try {
      const health = await fetch(`${API_BASE}/api/health`).then((r) => r.json());
      if (!health.ok) throw new Error("health failed");
    } catch (err) {
      setStatus(`خدمة الصوت مو جاهزة: ${err.message}`);
      setCallUi(false);
      return;
    }

    try {
      await ensureMicPermission();
    } catch (err) {
      setStatus(`ما قدرت أفتح المايك (${err.message}). تقدرين تكتبين بالخانة والصوت يشتغل.`);
    }

    // Short warm Saudi opener — no boilerplate loops. Real TTS check.
    const open = `هلا والله، معك ${activeVoiceName}. تكلّمي يا قلبي وش تبي.`;
    history.push({ role: "assistant", content: open });
    addBubble("bot", open);
    saveHistory();
    try {
      setStatus(`${activeVoiceName} تتكلم…`);
      await speakText(open);
      setStatus("جاهزة. تكلّمي أو اكتبي.");
    } catch (err) {
      setStatus(`فشل الصوت: ${err.message}. ارفعي صوت الجهاز واضغطي بدء مرة ثانية.`);
    }
    listenLoop();
  }

  function endCall() {
    shouldListenAgain = false;
    busy = false;
    stopSpeech();
    if (recognition) { try { recognition.stop(); } catch (_) {} }
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
  replyModeEl.addEventListener("change", () => {
    localStorage.setItem(MODE_KEY, selectedMode());
  });
  startCallBtn.addEventListener("click", () => { startCall(); });
  endCallBtn.addEventListener("click", endCall);
  sendBtn.addEventListener("click", async () => {
    await unlockAudioPlayback();
    const t = textEl.value.trim();
    textEl.value = "";
    if (!inCall) setCallUi(true);
    handleUtterance(t);
  });
  document.querySelector(".call-card")?.addEventListener(
    "pointerdown",
    () => { unlockAudioPlayback(); },
    { once: true }
  );

  populateVoices(FALLBACK_VOICES);
  const savedDelivery = localStorage.getItem(DELIVERY_KEY);
  if (savedDelivery) deliveryEl.value = savedDelivery;
  const savedMode = localStorage.getItem(MODE_KEY);
  if (savedMode) replyModeEl.value = savedMode;
  renderHistory();

  fetch(`${API_BASE}/api/voices`)
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data.voices) && data.voices.length) populateVoices(data.voices);
      setStatus(`جاهزة: ${data.count} صوت | لهجة سعودية | الفلتر للصريح فقط`);
    })
    .catch(() => {
      populateVoices(FALLBACK_VOICES);
      setStatus("شغّلي السيرفر: ./manage.sh start");
    });
})();
