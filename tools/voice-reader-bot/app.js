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

  const DEFAULT_VOICE = "Noura";
  const API_BASE = "";
  const HISTORY_KEY = "voice-bot-history-v6";
  const MEMORY_KEY = "voice-bot-memory-v6";
  const VOICE_KEY = "voice-bot-voice-v6";
  const DELIVERY_KEY = "voice-bot-delivery-v6";
  const MODE_KEY = "voice-bot-mode-v6";

  const blockedPatterns = [
    /نيك/i, /أنيك/i, /انيك/i, /طيز/i, /زب\b/i, /كس\b/i, /قحب/i, /ممحون/i, /منيوك/i,
    /دلع/i, /مغري/i, /إغراء/i, /اغراء/i, /همس ساخن/i, /تنهد/i,
    /\bsex\b/i, /\bporn\b/i, /\bfuck\b/i, /\bcock\b/i, /\bpussy\b/i, /\banal\b/i,
    /\bseduce\b/i, /\bflirt\b/i,
  ];

  const followUps = [
    "هل تريد تفاصيل أكثر؟",
    "ما النقطة الأهم بالنسبة لك الآن؟",
    "هل نكمل على نفس الموضوع أم نغيّر؟",
    "ما الذي تريد أن أوضحه أكثر؟",
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
  let audioCtx = null;
  let activeVoiceName = DEFAULT_VOICE;

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
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

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
      `${catalog.length}/16 صوت مفعّل | المختار: ${meta.name} (${meta.id}) | رد ذكي جاهز`;
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

  function stopSpeech() {
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.src = ""; } catch (_) {}
      currentAudio = null;
    }
  }

  function waitMs(ms) {
    return new Promise((resolve) => {
      queueTimer = setTimeout(resolve, ms);
    });
  }

  /** Soft neutral breath (not emotional/seductive) — used between paragraphs only. */
  function playSoftBreath() {
    try {
      const ctx = ensureAudio();
      const duration = 0.28;
      const frames = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        const t = i / frames;
        // Quiet filtered noise with gentle fade — like a short inhale pause.
        data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) * 0.028 * (1 - t * 0.35);
      }
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 780;
      const gain = ctx.createGain();
      gain.gain.value = 0.55;
      src.buffer = buffer;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (_) {}
  }

  function splitSentences(text) {
    return text
      .split(/(?<=[.!?…。؟！])\s+|،\s+|;|؛/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function splitParagraphs(text) {
    return text
      .split(/\n\s*\n|\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function chunkSentence(sentence, maxLen = 200) {
    if (sentence.length <= maxLen) return [sentence];
    const chunks = [];
    for (let i = 0; i < sentence.length; i += maxLen) {
      chunks.push(sentence.slice(i, i + maxLen));
    }
    return chunks;
  }

  /**
   * Build speak units: sentence chunks with natural gaps, and paragraph breaks
   * that trigger a light breath + longer pause.
   */
  function buildSpeechPlan(text) {
    const plan = [];
    const paragraphs = splitParagraphs(text);
    paragraphs.forEach((para, pIdx) => {
      const sentences = splitSentences(para);
      sentences.forEach((sentence, sIdx) => {
        chunkSentence(sentence).forEach((chunk, cIdx, arr) => {
          plan.push({
            type: "speech",
            text: chunk,
            // Longer pause after a full sentence; short gap inside a long split sentence.
            pauseAfterMs: cIdx < arr.length - 1 ? 180 : 420,
          });
        });
        if (sIdx < sentences.length - 1) {
          plan[plan.length - 1].pauseAfterMs = Math.max(
            plan[plan.length - 1].pauseAfterMs,
            480
          );
        }
      });
      if (pIdx < paragraphs.length - 1) {
        plan.push({ type: "paragraph_break", pauseAfterMs: 720 });
      }
    });
    if (!plan.length && text.trim()) {
      plan.push({ type: "speech", text: text.trim().slice(0, 200), pauseAfterMs: 0 });
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
    return res.blob();
  }

  function playBlob(blob) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(URL.createObjectURL(blob));
      currentAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        if (currentAudio === audio) currentAudio = null;
        reject(new Error("audio playback failed"));
      };
      audio.play().catch(reject);
    });
  }

  async function speakText(text) {
    stopSpeech();
    ensureAudio();
    activeVoiceName = selectedVoiceName();
    const delivery = selectedDelivery();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    localStorage.setItem(DELIVERY_KEY, delivery);
    const plan = buildSpeechPlan(text);
    for (let i = 0; i < plan.length; i += 1) {
      const step = plan[i];
      if (step.type === "paragraph_break") {
        playSoftBreath();
        await waitMs(step.pauseAfterMs || 720);
        continue;
      }
      const blob = await fetchFemaleTtsBlob(step.text, activeVoiceName, delivery);
      await playBlob(blob);
      if (i < plan.length - 1 && step.pauseAfterMs) {
        await waitMs(step.pauseAfterMs);
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

  function modeInstructions(mode) {
    const map = {
      helpful: "أجب بوضوح وبشكل عملي ومفيد.",
      thoughtful: "حلّل باختصار وقدّم تفكيراً مرتباً.",
      curious: "أجب ثم اطرح سؤالاً متابعة واحداً مفيداً.",
      concise: "أجب بجملتين إلى ثلاث جمل فقط.",
      balanced: "امزج الوضوح والفائدة مع سؤال متابعة قصير.",
    };
    return map[mode] || map.balanced;
  }

  function stylizeReply(reply) {
    let out = reply.trim().replace(/\s+/g, " ");
    out = out
      .replace(/\b(مم+|آه+|همم+)\b/gi, "")
      .replace(/يا قلبي|يا بعدي|دلوع|دلع|همس|تنهد|قريبة منك/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!out) out = "حسناً، وضّح لي أكثر لأساعدك بشكل أدق.";
    if (selectedMode() !== "concise" && !/[؟?]\s*$/.test(out)) {
      out += ` ${pick(followUps)}`;
    }
    // Break long answers into two paragraphs so breath + longer pause can play.
    const sentences = splitSentences(out);
    if (sentences.length >= 3) {
      const mid = Math.ceil(sentences.length / 2);
      out = `${sentences.slice(0, mid).join(" ")}\n\n${sentences.slice(mid).join(" ")}`;
    }
    return out;
  }

  function systemPrompt() {
    const mode = selectedMode();
    const mem = [
      memory.name ? `الاسم: ${memory.name}` : "",
      memory.topic ? `آخر موضوع: ${memory.topic}` : "",
      memory.notes?.length ? `ملاحظات: ${memory.notes.slice(0, 3).join(" | ")}` : "",
    ].filter(Boolean).join("\n") || "لا ذاكرة سابقة.";
    return [
      `أنت مساعد مكالمة صوتية. الصوت الحالي: ${activeVoiceName}.`,
      "افهم السياق ورد برد ذكي طبيعي ومفيد.",
      modeInstructions(mode),
      "ممنوع الدلع والإغراء والإيحاء الجنسي والتنهدات العاطفية.",
      "ممنوع المحتوى الجنسي الصريح.",
      "اللغة العربية الفصحى أو البيضاء الواضحة.",
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

  function localFallback() {
    const name = memory.name ? ` ${memory.name}` : "";
    return stylizeReply(
      `أنا ${activeVoiceName}.${name} فهمت طلبك. لنكمل بشكل واضح ومفيد.`
    );
  }

  function setCallUi(active) {
    inCall = active;
    startCallBtn.hidden = active;
    endCallBtn.hidden = !active;
    callPulse.classList.toggle("live", active);
    callState.textContent = active ? `المكالمة نشطة — ${activeVoiceName}` : "جاهز للمكالمة";
    liveCaption.textContent = active
      ? `${activeVoiceName} يستمع ويرد بذكاء.`
      : "اختر الصوت ثم ابدأ.";
  }

  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (recognition) return recognition;
    recognition = new SR();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setStatus(`${activeVoiceName} يستمع…`);
      liveCaption.textContent = "تكلم الآن.";
    };
    recognition.onerror = (e) => {
      setStatus(`مشكلة بالمايك: ${e.error}`);
      if (inCall && !busy) queueTimer = setTimeout(listenLoop, 700);
    };
    recognition.onend = () => {
      if (shouldListenAgain && inCall && !busy) queueTimer = setTimeout(listenLoop, 420);
    };
    recognition.onresult = async (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) await handleUtterance(transcript);
      else if (inCall) queueTimer = setTimeout(listenLoop, 500);
    };
    return recognition;
  }

  function listenLoop() {
    if (!inCall || busy) return;
    const rec = getRecognition();
    if (!rec) {
      setStatus("المتصفح لا يدعم المايك. استخدم إدخال النص.");
      return;
    }
    shouldListenAgain = true;
    stopSpeech();
    try { rec.start(); }
    catch (_) { queueTimer = setTimeout(listenLoop, 800); }
  }

  async function handleUtterance(text) {
    if (!text || busy) return;
    if (isBlocked(text)) {
      showPolicy("المحتوى الجنسي والدلع غير مسموح.");
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
    setStatus("الرد الذكي يفكر…");

    let reply;
    try {
      reply = stylizeReply(await askModel(text));
    } catch (_) {
      reply = localFallback();
      setStatus("تعذر الرد السحابي؛ استُخدم رد محلي.");
    }
    if (isBlocked(reply)) {
      reply = stylizeReply("دعنا نبقى على حديث واضح ومفيد.");
    }

    history.push({ role: "assistant", content: reply });
    addBubble("bot", reply);
    saveHistory();
    setStatus(`${activeVoiceName} يتكلم…`);
    try {
      await speakText(reply);
    } catch (err) {
      setStatus(`فشل الصوت: ${err.message}`);
    }
    busy = false;
    setStatus(inCall ? "جاهز. تكلم." : "انتهى الرد.");
    if (inCall) listenLoop();
  }

  async function startCall() {
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    localStorage.setItem(DELIVERY_KEY, selectedDelivery());
    localStorage.setItem(MODE_KEY, selectedMode());
    setCallUi(true);
    try {
      const health = await fetch(`${API_BASE}/api/health`).then((r) => r.json());
      if (!health.ok) throw new Error("health failed");
      await fetchFemaleTtsBlob("مرحبا", activeVoiceName, selectedDelivery());
    } catch (err) {
      setStatus(`الخدمة الصوتية غير جاهزة: ${err.message}`);
      setCallUi(false);
      return;
    }
    const open = stylizeReply(
      `مرحباً. أنا ${activeVoiceName}. المكالمة جاهزة والرد الذكي مفعّل.`
    );
    history.push({ role: "assistant", content: open });
    addBubble("bot", open);
    saveHistory();
    await speakText(open);
    listenLoop();
  }

  function endCall() {
    shouldListenAgain = false;
    busy = false;
    stopSpeech();
    if (recognition) { try { recognition.stop(); } catch (_) {} }
    setCallUi(false);
    setStatus("انتهت المكالمة.");
  }

  voiceEl.addEventListener("change", () => {
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    updateVoiceHint();
    setStatus(`تم اختيار ${activeVoiceName}`);
    if (inCall) {
      callState.textContent = `المكالمة نشطة — ${activeVoiceName}`;
      liveCaption.textContent = `${activeVoiceName} جاهز للرد التالي.`;
    }
  });
  deliveryEl.addEventListener("change", () => {
    localStorage.setItem(DELIVERY_KEY, selectedDelivery());
  });
  replyModeEl.addEventListener("change", () => {
    localStorage.setItem(MODE_KEY, selectedMode());
  });
  startCallBtn.addEventListener("click", startCall);
  endCallBtn.addEventListener("click", endCall);
  sendBtn.addEventListener("click", () => {
    const t = textEl.value.trim();
    textEl.value = "";
    if (!inCall) setCallUi(true);
    handleUtterance(t);
  });

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
      setStatus(`جاهز: ${data.count} صوت مفعّل + اختيار الصوت + رد ذكي.`);
    })
    .catch(() => {
      populateVoices(FALLBACK_VOICES);
      setStatus("شغّل السيرفر: ./manage.sh start");
    });
})();
