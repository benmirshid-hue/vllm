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
  const svcStatusBtn = document.getElementById("svcStatus");
  const svcRestartBtn = document.getElementById("svcRestartTts");
  const svcLog = document.getElementById("svcLog");

  const FALLBACK_VOICES = [
    { name: "Fatima", id: "ar-AE-FatimaNeural", locale: "ar-AE" },
    { name: "Laila", id: "ar-BH-LailaNeural", locale: "ar-BH" },
    { name: "Amina", id: "ar-DZ-AminaNeural", locale: "ar-DZ" },
    { name: "Salma", id: "ar-EG-SalmaNeural", locale: "ar-EG" },
    { name: "Rana", id: "ar-IQ-RanaNeural", locale: "ar-IQ" },
    { name: "Sana", id: "ar-JO-SanaNeural", locale: "ar-JO" },
    { name: "Noura", id: "ar-KW-NouraNeural", locale: "ar-KW" },
    { name: "Layla", id: "ar-LB-LaylaNeural", locale: "ar-LB" },
    { name: "Iman", id: "ar-LY-ImanNeural", locale: "ar-LY" },
    { name: "Mouna", id: "ar-MA-MounaNeural", locale: "ar-MA" },
    { name: "Aysha", id: "ar-OM-AyshaNeural", locale: "ar-OM" },
    { name: "Amal", id: "ar-QA-AmalNeural", locale: "ar-QA" },
    { name: "Zariyah", id: "ar-SA-ZariyahNeural", locale: "ar-SA" },
    { name: "Amany", id: "ar-SY-AmanyNeural", locale: "ar-SY" },
    { name: "Reem", id: "ar-TN-ReemNeural", locale: "ar-TN" },
    { name: "Maryam", id: "ar-YE-MaryamNeural", locale: "ar-YE" },
  ];

  const DEFAULT_VOICE = "Noura";
  const API_BASE = "";
  const HISTORY_KEY = "voice-bot-history-v5";
  const MEMORY_KEY = "voice-bot-memory-v5";
  const VOICE_KEY = "voice-bot-voice-v5";
  const DELIVERY_KEY = "voice-bot-delivery-v5";
  const MODE_KEY = "voice-bot-mode-v5";

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
    catalog = voices.length ? voices : FALLBACK_VOICES;
    voiceEl.innerHTML = "";
    catalog.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      const locale = v.locale_name || v.locale || "";
      opt.textContent = `${v.name} — ${v.id}${locale ? ` · ${locale}` : ""}`;
      voiceEl.appendChild(opt);
    });
    const saved = localStorage.getItem(VOICE_KEY);
    const names = catalog.map((v) => v.name);
    activeVoiceName = names.includes(saved)
      ? saved
      : (names.includes(DEFAULT_VOICE) ? DEFAULT_VOICE : names[0]);
    voiceEl.value = activeVoiceName;
    const meta = catalog.find((v) => v.name === activeVoiceName) || catalog[0];
    voiceHint.textContent =
      `${catalog.length} صوت عربي أنثوي عبر edge-tts | الحالي ${meta.name} (${meta.id})`;
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

  function splitParts(text) {
    return text
      .split(/(?<=[.!?…。؟！،,;؛])\s+|\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function chunkForTts(text, maxLen = 220) {
    const parts = [];
    let buf = "";
    splitParts(text).forEach((sentence) => {
      if ((`${buf} ${sentence}`).trim().length <= maxLen) {
        buf = `${buf} ${sentence}`.trim();
        return;
      }
      if (buf) parts.push(buf);
      if (sentence.length <= maxLen) buf = sentence;
      else {
        for (let i = 0; i < sentence.length; i += maxLen) {
          parts.push(sentence.slice(i, i + maxLen));
        }
        buf = "";
      }
    });
    if (buf) parts.push(buf);
    return parts.length ? parts : [text.slice(0, maxLen)];
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
    activeVoiceName = selectedVoiceName();
    const delivery = selectedDelivery();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    localStorage.setItem(DELIVERY_KEY, delivery);
    const parts = chunkForTts(text);
    for (let i = 0; i < parts.length; i += 1) {
      const blob = await fetchFemaleTtsBlob(parts[i], activeVoiceName, delivery);
      await playBlob(blob);
      if (i < parts.length - 1) {
        await new Promise((r) => { queueTimer = setTimeout(r, 350); });
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
    // Strip flirt/dalaa phrasing if the model inserts it.
    out = out
      .replace(/\b(مم+|آه+|همم+)\b/gi, "")
      .replace(/يا قلبي|يا بعدي|دلوع|دلع|همس|تنهد|قريبة منك/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!out) out = "حسناً، وضّح لي أكثر لأساعدك بشكل أدق.";
    if (selectedMode() !== "concise" && !/[؟?]\s*$/.test(out)) {
      out += ` ${pick(followUps)}`;
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
      showPolicy("المحتوى الجنسي والدلع والإغراء غير مسموح.");
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
    setStatus(`${activeVoiceName} يتكلم عبر edge-tts…`);
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

  async function refreshServiceStatus() {
    try {
      const data = await fetch(`${API_BASE}/api/services`).then((r) => r.json());
      const lines = data.services.map(
        (s) => `${s.id}: ${s.status}${s.count != null ? ` (${s.count})` : ""}`
      );
      svcLog.textContent =
        `نطاق: ${data.scope}\nلا يلمس برامجك الشخصية: ${!data.touches_user_personal_apps}\n` +
        lines.join("\n");
    } catch (err) {
      svcLog.textContent = `تعذر قراءة حالة الخدمات: ${err.message}`;
    }
  }

  async function reloadVoicesService() {
    try {
      const data = await fetch(`${API_BASE}/api/services/reload-voices`, {
        method: "POST",
      }).then((r) => r.json());
      const voices = await fetch(`${API_BASE}/api/voices`).then((r) => r.json());
      if (voices.voices) populateVoices(voices.voices);
      svcLog.textContent = `أُعيد تحميل كتالوج الأصوات فقط: ${data.count} صوت.\nالنطاق: ${data.scope}`;
      setStatus(`تم إعادة تحميل ${data.count} صوت.`);
    } catch (err) {
      svcLog.textContent = `فشل إعادة التحميل: ${err.message}`;
    }
  }

  voiceEl.addEventListener("change", () => {
    activeVoiceName = selectedVoiceName();
    localStorage.setItem(VOICE_KEY, activeVoiceName);
    setStatus(`الصوت: ${activeVoiceName}`);
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
  svcStatusBtn.addEventListener("click", refreshServiceStatus);
  svcRestartBtn.addEventListener("click", reloadVoicesService);

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
      setStatus(`جاهز: ${data.count} صوت + رد ذكي + إدارة خدمات البوت فقط.`);
      refreshServiceStatus();
    })
    .catch(() => {
      populateVoices(FALLBACK_VOICES);
      setStatus("شغّل: python3 server.py");
      svcLog.textContent = "الخدمة متوقفة. شغّل server.py داخل tools/voice-reader-bot فقط.";
    });
})();
