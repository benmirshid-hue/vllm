(() => {
  const startCallBtn = document.getElementById("startCall");
  const endCallBtn = document.getElementById("endCall");
  const sendBtn = document.getElementById("send");
  const textEl = document.getElementById("text");
  const voiceEl = document.getElementById("voice");
  const voiceHint = document.getElementById("voiceHint");
  const dalaaEl = document.getElementById("dalaa");
  const closenessEl = document.getElementById("closeness");
  const callState = document.getElementById("callState");
  const liveCaption = document.getElementById("liveCaption");
  const callPulse = document.getElementById("callPulse");
  const chatEl = document.getElementById("chat");
  const statusEl = document.getElementById("status");
  const policyNote = document.getElementById("policyNote");

  const HISTORY_KEY = "personal-call-history-v2";
  const MEMORY_KEY = "personal-call-memory-v2";

  const blockedPatterns = [
    /نيك/i, /أنیک/i, /انيك/i, /طيز/i, /زب\b/i, /كس\b/i, /قحب/i, /ممحون/i, /منيوك/i,
    /\bsex\b/i, /\bporn\b/i, /\bfuck\b/i, /\bcock\b/i, /\bpussy\b/i, /\banal\b/i,
  ];

  const softSighs = ["مم…", "آه…", "همم…", "أوه…", "مم مم…", "آه ياه…", "همممم…"];
  const closePhrases = [
    "أنا قريبة منك الحين",
    "صوتي أقرب لك",
    "خلك معي بهالدلع",
    "ودي أسمعك أكثر",
    "أحس فيك وأنا أرد",
  ];

  let history = loadJson(HISTORY_KEY, []);
  let memory = loadJson(MEMORY_KEY, { name: "", mood: "", likes: [], notes: [] });
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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-50))); } catch (_) {}
  }

  function saveMemory() {
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch (_) {}
  }

  function level(el) {
    return Number(el.value) / 100;
  }

  function setStatus(msg) { statusEl.textContent = msg; }
  function isBlocked(text) { return blockedPatterns.some((p) => p.test(text)); }
  function showPolicy(msg) { policyNote.hidden = false; policyNote.textContent = msg; }
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
    return /male|man\b|david|mark|george|guy|ryan|andrew|thomas|richard|daniel|james|brian|eric/.test(s);
  }

  function femininityScore(voice) {
    const s = `${voice.name} ${voice.lang}`.toLowerCase();
    if (isChineseVoice(voice) || isMaleVoice(voice)) return -100;
    let score = 0;
    if (/female|woman|girl|feminine/.test(s)) score += 10;
    if (/samantha|victoria|karen|moira|zira|susan|linda|sara|nora|salma|laila|hoda|aria|jenny|mia|sonia|natasha|neural/.test(s)) score += 8;
    if (/ar|arab|saudi|egypt|gulf|levant/.test(s)) score += 9;
    if (/en|us|gb|uk/.test(s)) score += 1;
    if (/premium|enhanced|natural|quality/.test(s)) score += 3;
    return score;
  }

  function populateVoices() {
    const ranked = speechSynthesis.getVoices()
      .filter((v) => femininityScore(v) > 0)
      .sort((a, b) => femininityScore(b) - femininityScore(a));
    voiceEl.innerHTML = "";
    if (!ranked.length) {
      voiceHint.textContent = "ما لقيت صوت أنثوي مناسب. جرّبي Chrome/Safari مع صوت نسائي عربي.";
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
    voiceHint.textContent = `أنثوي فقط ✓ | المختار: ${ranked[0].name}`;
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
      const closeness = level(closenessEl);
      const ctx = ensureAudio();
      const duration = (kind === "deep" ? 0.95 : kind === "sigh" ? 0.62 : 0.45) * (0.85 + closeness * 0.35);
      const frameCount = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      const amp = (kind === "deep" ? 0.08 : 0.05) * (0.7 + closeness * 0.6);
      for (let i = 0; i < frameCount; i += 1) {
        const t = i / frameCount;
        const env = Math.sin(Math.PI * t) * (1 - t * 0.75) * amp;
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = kind === "deep" ? 620 : 880;
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
    const dalaa = level(dalaaEl);
    const closeness = level(closenessEl);
    const soft = /مم|آه|همم|أوه|قربي|دلع|بهـ?دوء|أحس|يا قلبي|قريبة/i.test(part);
    const question = /[؟?]\s*$/.test(part);
    const basePitch = 1.55 + dalaa * 0.22;
    const baseRate = 0.86 - closeness * 0.14;
    if (soft) return { pitch: basePitch + 0.08, rate: baseRate - 0.05, vol: 0.86, pause: 1100 + closeness * 350, breath: "deep" };
    if (question) return { pitch: basePitch + 0.1, rate: baseRate, vol: 0.92, pause: 980 + closeness * 220, breath: "sigh" };
    if (index === 0) return { pitch: basePitch, rate: baseRate - 0.02, vol: 0.95, pause: 880 + closeness * 200, breath: "soft" };
    if (index === total - 1) return { pitch: basePitch + 0.03, rate: baseRate - 0.03, vol: 0.9, pause: 820, breath: "soft" };
    return { pitch: basePitch + (index % 2) * 0.04, rate: baseRate, vol: 0.93, pause: 920 + closeness * 180, breath: "soft" };
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
        u.pitch = Math.min(1.85, expr.pitch);
        u.rate = Math.max(0.68, expr.rate);
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
      queueTimer = setTimeout(next, 280);
    });
  }

  function updateMemory(text) {
    const nameMatch = text.match(/(?:اسمي|ناديني)\s+([^\s،.!?؟]{2,20})/i);
    if (nameMatch) memory.name = nameMatch[1];
    if (/تعبان|حزين|ضايق|متوتر|وحشني|اشتقت/i.test(text)) memory.mood = "يحتاج احتواء";
    if (/فرحان|تمام|بخير|سعيد|مرتاح/i.test(text)) memory.mood = "إيجابي";
    const like = text.match(/(?:أحب|يعجبني|ودي)\s+(.{3,40})/i);
    if (like) memory.likes = [like[1], ...(memory.likes || [])].slice(0, 6);
    if (text.length > 8) memory.notes = [text.slice(0, 90), ...(memory.notes || [])].slice(0, 10);
    saveMemory();
  }

  function stylizeReply(reply) {
    const dalaa = level(dalaaEl);
    let out = reply.trim();
    if (!/^(مم|آه|همم|أوه)/i.test(out)) {
      out = `${softSighs[Math.floor(Math.random() * softSighs.length)]} ${out}`;
    }
    if (dalaa > 0.85 && !/قريبة|دلع|أقرب/i.test(out)) {
      out += ` ${softSighs[1]} ${closePhrases[Math.floor(Math.random() * closePhrases.length)]}.`;
    }
    if (!/[؟?]\s*$/.test(out)) {
      out += " كيف تحسين معي الحين؟";
    }
    // Ensure enough spoken beats for breathy delivery.
    while (splitParts(out).length < 4) {
      out += ` ${softSighs[Math.floor(Math.random() * softSighs.length)]} خلك معي شوي، أبي أسمعك أكثر.`;
    }
    return out;
  }

  function systemPrompt() {
    const dalaa = Math.round(level(dalaaEl) * 100);
    const closeness = Math.round(level(closenessEl) * 100);
    const mem = [
      memory.name ? `الاسم: ${memory.name}` : "",
      memory.mood ? `المزاج: ${memory.mood}` : "",
      memory.likes?.length ? `يحب: ${memory.likes.slice(0, 3).join("؛ ")}` : "",
      memory.notes?.length ? `ملاحظات: ${memory.notes.slice(0, 3).join(" | ")}` : "",
    ].filter(Boolean).join("\n") || "لا ذكريات كثيرة بعد.";

    return [
      "أنتِ رفيقة مكالمة صوتية أنثوية جداً، دلعة، قريبة، همس ناعم، كأنكِ على الهاتف ملتصقة بالأذن.",
      `مستوى الدلع المطلوب: ${dalaa}/100. مستوى القرب والتنفس: ${closeness}/100.`,
      "زيدي مم… آه… همم… والتنهدات الخفيفة غير الجنسية، والجمل القصيرة الدافئة.",
      "كوني مبادرة: اسألي عن اليوم، اطمئني، ذكّري بلطف بأشياء قالها، وقدّمي تشجيعاً قريباً.",
      "اجعلي الرد 4 إلى 6 جمل صوتية قصيرة.",
      "ممنوع تماماً المحتوى الجنسي أو الصريح أو أوصاف جسدية جنسية.",
      "إذا طُلب محتوى جنسي، ارفضي بلطف وارجعي لدلع عاطفي مسموح فقط.",
      "ذاكرة خاصة:",
      mem,
    ].join("\n");
  }

  function localFallback() {
    const name = memory.name ? ` ${memory.name}` : "";
    return stylizeReply(`أنا معك${name}. يومك عندي مهم، وأبي أكون قريبة منك بهالدلع الهادئ.`);
  }

  async function askModel(userText) {
    const messages = [
      { role: "system", content: systemPrompt() },
      ...history.slice(-12),
      {
        role: "user",
        content: `${userText}\n\nتذكير: مكالمة هاتفية أنثوية دلعة جداً، قرب عالي، تنهدات خفيفة غير جنسية، ومتابعة دافئة.`,
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
    callState.textContent = active ? "المكالمة شغّالة… قريبة منك" : "جاهزة للمكالمة";
    liveCaption.textContent = active
      ? "تكلّمي… أسمعك وأرد بدلع وتنفس وقرب."
      : "اضغطي «ابدئي المكالمة» وتكلّمي بالعربي.";
  }

  async function softAck() {
    if (level(dalaaEl) < 0.8) return;
    const ack = softSighs[Math.floor(Math.random() * 3)];
    const u = new SpeechSynthesisUtterance(ack);
    const voice = selectedVoice();
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || "ar-SA";
    u.pitch = 1.7;
    u.rate = 0.72;
    u.volume = 0.75;
    await new Promise((resolve) => {
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
    });
    playBreath("sigh");
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
      setStatus("أسمعلك… مم");
      liveCaption.textContent = "سمّعني صوتك… أنا قريبة.";
      softAck();
    };
    recognition.onerror = (e) => {
      setStatus(`مشكلة بالمايك: ${e.error}`);
      if (inCall && !busy) queueTimer = setTimeout(listenLoop, 700);
    };
    recognition.onend = () => {
      if (shouldListenAgain && inCall && !busy) {
        queueTimer = setTimeout(listenLoop, 420);
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
      showPolicy("ما أكمّل محتوى جنسي صريح. أقدر أزيد الدلع والقرب العاطفي فقط.");
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
    setStatus("مم… خليني أقرب منك بالرد…");
    liveCaption.textContent = "أرد عليك بدلع أعلى وتنفس أقرب…";

    let reply;
    try {
      reply = stylizeReply(await askModel(text));
    } catch (_) {
      reply = localFallback();
    }
    if (isBlocked(reply)) {
      reply = stylizeReply("خلينا نبقى على قرب دافئ مسموح. قولي لي عن يومك وأنا أقرب لك بالكلام.");
    }

    history.push({ role: "assistant", content: reply });
    addBubble("bot", reply);
    saveHistory();
    setStatus("أتكلم معك بهمس…");
    await speakText(reply);
    busy = false;
    setStatus(inCall ? "حاضرة… تكلّمي يا قلبي." : "انتهى الرد.");
    liveCaption.textContent = inCall ? "دورك… أنا أسمعك." : "اضغطي ابدئي المكالمة.";
    if (inCall) listenLoop();
  }

  async function startCall() {
    populateVoices();
    ensureAudio();
    setCallUi(true);
    const open = stylizeReply(
      memory.name
        ? `أهلاً ${memory.name}. وحشتني نبرتك. أنا أقرب لك الحين، وودي أسمع يومك كامل.`
        : "أهلاً. أنا هنا بالمكالمة، قريبة ودلعة بهدوء. ودي أسمع يومك وصوتك."
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
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    setCallUi(false);
    setStatus("انتهت المكالمة… لين ترجع.");
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
  setStatus("جاهزة لمكالمة بأنوثة ودلع وقرب أعلى.");
})();
