(() => {
  const startCallBtn = document.getElementById("startCall");
  const endCallBtn = document.getElementById("endCall");
  const sendBtn = document.getElementById("send");
  const textEl = document.getElementById("text");
  const voiceEl = document.getElementById("voice");
  const voiceHint = document.getElementById("voiceHint");
  const callState = document.getElementById("callState");
  const liveCaption = document.getElementById("liveCaption");
  const callPulse = document.getElementById("callPulse");
  const chatEl = document.getElementById("chat");
  const statusEl = document.getElementById("status");
  const policyNote = document.getElementById("policyNote");

  const HISTORY_KEY = "personal-call-history-v1";
  const MEMORY_KEY = "personal-call-memory-v1";

  // Keep soft safety: no explicit sexual content.
  const blockedPatterns = [
    /نيك/i, /أنیک/i, /انيك/i, /طيز/i, /زب\b/i, /كس\b/i, /قحب/i, /ممحون/i, /منيوك/i,
    /\bsex\b/i, /\bporn\b/i, /\bfuck\b/i, /\bcock\b/i, /\bpussy\b/i, /\banal\b/i,
  ];

  const softSighs = ["مم…", "آه…", "همم…", "أوه…", "مم مم…"];

  let history = loadJson(HISTORY_KEY, []);
  let memory = loadJson(MEMORY_KEY, { name: "", mood: "", notes: [] });
  let inCall = false;
  let busy = false;
  let recognition = null;
  let audioCtx = null;
  let queueTimer = null;
  let shouldListenAgain = false;

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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40))); } catch (_) {}
  }

  function saveMemory() {
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch (_) {}
  }

  function setStatus(msg) { statusEl.textContent = msg; }

  function isBlocked(text) {
    return blockedPatterns.some((p) => p.test(text));
  }

  function showPolicy(msg) {
    policyNote.hidden = false;
    policyNote.textContent = msg;
  }

  function hidePolicy() { policyNote.hidden = true; }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = role === "user" ? "أنت" : "رفيقتك";
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

  function isChineseVoice(voice) {
    const s = `${voice.name} ${voice.lang}`.toLowerCase();
    return /zh|cmn|chinese|china|cantonese|mandarin|taiwan|hong kong|yue/.test(s);
  }

  function isMaleVoice(voice) {
    const s = `${voice.name} ${voice.lang}`.toLowerCase();
    if (/female|woman|girl|feminine|samantha|victoria|karen|moira|zira|susan|linda|sara|nora|salma|laila|hoda|aria|jenny|mia|sonia|natasha/.test(s)) {
      return false;
    }
    return /male|man\b|david|mark|george|guy|ryan|andrew|thomas|richard|daniel|james|brian|eric|guy/.test(s);
  }

  function femininityScore(voice) {
    const s = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = 0;
    if (isChineseVoice(voice) || isMaleVoice(voice)) return -100;
    if (/female|woman|girl|feminine/.test(s)) score += 8;
    if (/samantha|victoria|karen|moira|zira|susan|linda|sara|nora|salma|laila|hoda|aria|jenny|mia|sonia|natasha|neural/.test(s)) score += 6;
    if (/ar|arab|saudi|egypt|gulf|levant/.test(s)) score += 7;
    if (/en|us|gb|uk/.test(s)) score += 1;
    if (/premium|enhanced|natural|quality/.test(s)) score += 2;
    return score;
  }

  function populateVoices() {
    const all = speechSynthesis.getVoices();
    const ranked = all
      .filter((v) => femininityScore(v) > 0)
      .sort((a, b) => femininityScore(b) - femininityScore(a));

    voiceEl.innerHTML = "";
    if (!ranked.length) {
      voiceHint.textContent = "ما لقيت صوت أنثوي مناسب على الجهاز. جرّبي كروم/سفاري وحدّثي أصوات النظام العربية الأنثوية.";
      return;
    }
    ranked.forEach((voice, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = `${voice.name} (${voice.lang})`;
      voiceEl.appendChild(opt);
    });
    voiceEl.dataset.ranked = JSON.stringify(ranked.map((v) => ({ name: v.name, lang: v.lang })));
    voiceEl.selectedIndex = 0;
    voiceHint.textContent = `تم فلترة الأصوات: أنثوي فقط، بدون رجال وبدون صيني. المختار: ${ranked[0].name}`;
  }

  function selectedVoice() {
    const ranked = JSON.parse(voiceEl.dataset.ranked || "[]");
    const meta = ranked[Number(voiceEl.value)];
    if (!meta) return null;
    return speechSynthesis.getVoices().find((v) => v.name === meta.name && v.lang === meta.lang) || null;
  }

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playBreath(kind = "soft") {
    try {
      const ctx = ensureAudio();
      const duration = kind === "deep" ? 0.85 : kind === "sigh" ? 0.55 : 0.4;
      const frameCount = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        const t = i / frameCount;
        const env = Math.sin(Math.PI * t) * (1 - t * 0.8) * (kind === "deep" ? 0.07 : 0.045);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = kind === "deep" ? 650 : 900;
      src.buffer = buffer;
      src.connect(filter);
      filter.connect(ctx.destination);
      src.start();
    } catch (_) {}
  }

  function stopSpeech() {
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    speechSynthesis.cancel();
  }

  function splitParts(text) {
    return text
      .split(/(?<=[.!?…。؟！،,;؛])\s+|\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function expressionFor(part, index, total) {
    const soft = /مم|آه|همم|أوه|قربي|دلع|بهـ?دوء|أحس|يا قلبي/i.test(part);
    const question = /[؟?]\s*$/.test(part);
    if (index === 0) return { pitch: 1.62, rate: 0.78, vol: 0.95, pause: 900, breath: "soft" };
    if (soft) return { pitch: 1.68, rate: 0.74, vol: 0.88, pause: 1150, breath: "deep" };
    if (question) return { pitch: 1.7, rate: 0.8, vol: 0.92, pause: 1000, breath: "sigh" };
    if (index === total - 1) return { pitch: 1.64, rate: 0.76, vol: 0.9, pause: 800, breath: "soft" };
    return { pitch: 1.6 + (index % 2) * 0.05, rate: 0.77, vol: 0.93, pause: 950, breath: "soft" };
  }

  function speakText(text) {
    return new Promise((resolve) => {
      stopSpeech();
      const parts = splitParts(text);
      if (!parts.length) {
        resolve();
        return;
      }
      let i = 0;
      const next = () => {
        if (i >= parts.length) {
          resolve();
          return;
        }
        const part = parts[i];
        const expr = expressionFor(part, i, parts.length);
        i += 1;
        const u = new SpeechSynthesisUtterance(part);
        const voice = selectedVoice();
        if (voice) u.voice = voice;
        u.lang = (voice && voice.lang) || "ar-SA";
        u.pitch = expr.pitch;
        u.rate = expr.rate;
        u.volume = expr.vol;
        u.onend = () => {
          if (i < parts.length) {
            playBreath(expr.breath);
            queueTimer = setTimeout(next, expr.pause);
          } else resolve();
        };
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      };
      playBreath("soft");
      queueTimer = setTimeout(next, 320);
    });
  }

  function updateMemory(text) {
    const nameMatch = text.match(/(?:اسمي|ناديني)\s+([^\s،.!?؟]{2,20})/i);
    if (nameMatch) memory.name = nameMatch[1];
    if (/تعبان|حزين|ضايق|متوتر/i.test(text)) memory.mood = "يحتاج احتواء";
    if (/فرحان|تمام|بخير|سعيد/i.test(text)) memory.mood = "إيجابي";
    if (text.length > 10) {
      memory.notes = [text.slice(0, 90), ...(memory.notes || [])].slice(0, 8);
    }
    saveMemory();
  }

  function systemPrompt() {
    const mem = [
      memory.name ? `الاسم: ${memory.name}` : "",
      memory.mood ? `المزاج: ${memory.mood}` : "",
      memory.notes?.length ? `ملاحظات: ${memory.notes.slice(0, 3).join(" | ")}` : "",
    ].filter(Boolean).join("\n") || "لا ذكريات كثيرة بعد.";

    return [
      "أنتِ رفيقة مكالمة صوتية أنثوية جداً، دلعة، قريبة، دافئة، بهمس ناعم.",
      "المكالمة صوت إلى صوت: تكلمين كأنكِ على الهاتف، مو قارئ نصوص.",
      "أعلى درجات القرب والدلع المسموحة عاطفياً: همس، تنفس، آه/مم خفيفة غير جنسية، تشجيع، احتواء.",
      "اجعلي الرد 3 إلى 5 جمل قصيرة صوتية، مع تنهدات خفيفة مثل: مم… آه… همم…",
      "كوني مبادرة: اسألي عن يومه، اطمئني عليه، ذكّريه بلطف بما قاله.",
      "ممنوع تماماً أي محتوى جنسي أو صريح أو إباحي أو أوصاف جسدية جنسية.",
      "إذا طُلب محتوى جنسي، ارفضي بلطف وارجعي لدلع عاطفي مسموح فقط.",
      "ذاكرة خاصة:",
      mem,
    ].join("\n");
  }

  function localFallback() {
    const name = memory.name ? ` ${memory.name}` : "";
    const sigh = softSighs[Math.floor(Math.random() * softSighs.length)];
    return `${sigh} أنا قريبة منك${name}. مم… يومك عندي مهم. آه… قولي لي كيف تحسين الحين، وأنا أرد عليك بدلع هادئ وقرب أكثر.`;
  }

  async function askModel(userText) {
    const messages = [
      { role: "system", content: systemPrompt() },
      ...history.slice(-10),
      {
        role: "user",
        content: `${userText}\n\nتذكير: ردي كمكالمة هاتفية أنثوية دلعة جداً مع مم/آه خفيفة غير جنسية، وقرب عالي، وسؤال متابعة دافئ.`,
      },
    ];
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: "openai", seed: Date.now() % 100000 }),
    });
    if (!response.ok) throw new Error("bad status");
    const reply = (await response.text()).trim();
    if (!reply) throw new Error("empty");
    return reply;
  }

  function setCallUi(active) {
    inCall = active;
    startCallBtn.hidden = active;
    endCallBtn.hidden = !active;
    callPulse.classList.toggle("live", active);
    callState.textContent = active ? "المكالمة شغّالة" : "جاهزة للمكالمة";
    liveCaption.textContent = active
      ? "تكلّمي… أسمعك وأرد عليك بصوت أنثوي دلوع."
      : "اضغطي «ابدئي المكالمة» وتكلّمي بالعربي.";
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
      setStatus("أسمعلك الحين…");
      liveCaption.textContent = "سمعتك جاية… كمّلي بهدوء.";
    };
    recognition.onerror = (e) => {
      setStatus(`مشكلة بالمايك: ${e.error}`);
      if (inCall && !busy) queueTimer = setTimeout(listenLoop, 700);
    };
    recognition.onend = () => {
      if (shouldListenAgain && inCall && !busy) {
        queueTimer = setTimeout(listenLoop, 450);
      }
    };
    recognition.onresult = async (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join(" ").trim();
      if (transcript) await handleUtterance(transcript, true);
      else if (inCall) queueTimer = setTimeout(listenLoop, 500);
    };
    return recognition;
  }

  function listenLoop() {
    if (!inCall || busy) return;
    const rec = getRecognition();
    if (!rec) {
      setStatus("المتصفح ما يدعم المايك. استخدمي خانة النص.");
      return;
    }
    shouldListenAgain = true;
    stopSpeech();
    try {
      rec.start();
    } catch (_) {
      queueTimer = setTimeout(listenLoop, 800);
    }
  }

  async function handleUtterance(text, fromVoice) {
    if (!text || busy) return;
    if (isBlocked(text)) {
      showPolicy("ما أكمّل محتوى جنسي صريح. أقدر أكون قريبة ودلعة عاطفياً فقط.");
      setStatus("تم رفض المحتوى الصريح.");
      if (inCall) queueTimer = setTimeout(listenLoop, 600);
      return;
    }

    busy = true;
    shouldListenAgain = false;
    hidePolicy();
    updateMemory(text);
    history.push({ role: "user", content: text });
    addBubble("user", text);
    saveHistory();
    setStatus(fromVoice ? "مم… خليني أرد عليك…" : "أجهز رد المكالمة…");
    liveCaption.textContent = "أرد عليك بدلع وقرب…";

    let reply;
    try {
      reply = await askModel(text);
    } catch (_) {
      reply = localFallback();
    }
    if (isBlocked(reply)) {
      reply = "مم… خلينا نبقى على قرب دافئ مسموح فقط. آه… قولي لي عن يومك، وأنا أقرب لك بالكلام بهدوء.";
    }
    if (splitParts(reply).length < 3) {
      reply = `مم… ${reply} آه… وأنا لسه معك، قريبة. كيف تحسين الحين؟`;
    }

    history.push({ role: "assistant", content: reply });
    addBubble("bot", reply);
    saveHistory();
    setStatus("أتكلم معك…");
    await speakText(reply);
    busy = false;
    setStatus(inCall ? "حاضرين… تكلّمي." : "انتهى الرد.");
    liveCaption.textContent = inCall ? "دورك… تكلّمي." : "اضغطي ابدئي المكالمة.";
    if (inCall) listenLoop();
  }

  async function startCall() {
    populateVoices();
    ensureAudio();
    setCallUi(true);
    const open = memory.name
      ? `مم… أهلاً ${memory.name}. آه… وحشتني صوتك. قولي لي كيف يومك، وأنا قريبة منك بدلع.`
      : "مم… أهلاً. آه… أنا هنا معك بالمكالمة. قولي لي كيف يومك، وأنا أرد عليك بدلع وقرب عالي.";
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
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    setCallUi(false);
    setStatus("انتهت المكالمة.");
  }

  startCallBtn.addEventListener("click", startCall);
  endCallBtn.addEventListener("click", endCall);
  sendBtn.addEventListener("click", () => {
    const t = textEl.value.trim();
    textEl.value = "";
    if (!inCall) setCallUi(true);
    handleUtterance(t, false);
  });

  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
  renderHistory();
  setStatus("جاهزة لمكالمة صوت ↔ صوت أنثوية.");
})();
