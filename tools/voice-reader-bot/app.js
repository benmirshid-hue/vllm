(() => {
  const textEl = document.getElementById("text");
  const voiceEl = document.getElementById("voice");
  const pitchEl = document.getElementById("pitch");
  const rateEl = document.getElementById("rate");
  const statusEl = document.getElementById("status");
  const policyNote = document.getElementById("policyNote");

  const speakBtn = document.getElementById("speak");
  const demoBtn = document.getElementById("demo");
  const pauseBtn = document.getElementById("pause");
  const resumeBtn = document.getElementById("resume");
  const stopBtn = document.getElementById("stop");

  // Soft blocklist for explicit sexual content. This bot is intentionally
  // not an unrestricted reader.
  const blockedPatterns = [
    /نيك/i,
    /أنیک/i,
    /انيك/i,
    /طيز/i,
    /زب\b/i,
    /كس\b/i,
    /قحب/i,
    /ممحون/i,
    /منيوك/i,
    /\bsex\b/i,
    /\bporn\b/i,
    /\bfuck\b/i,
    /\bcock\b/i,
    /\bpussy\b/i,
    /\banal\b/i,
  ];

  const DEMO_TEXT = [
    "مرحباً… أنا هنا معك بهدوء.",
    "صوتي أقرب، وأدفأ، وأهدى مما تسمعه عادة.",
    "خذ نفساً معي… ثم أكمل الاستماع.",
    "أقرأ الكلمات ببطء، مع توقفات صغيرة بين الجمل.",
    "إذا أعجبك الإحساس، استخدم المربع لتكتب أي نص عام وأقرأه لك.",
  ].join(" ");

  let queueTimer = null;
  let audioCtx = null;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function isBlocked(text) {
    return blockedPatterns.some((pattern) => pattern.test(text));
  }

  function scoreFeminineVoice(voice) {
    const name = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = 0;
    if (/female|woman|girl|feminine|samantha|victoria|karen|moira|zira|susan|linda|sara|nora|salma|laila|hoda|aria|jenny|neural/.test(name)) {
      score += 5;
    }
    if (/male|man|david|mark|george|guy|ryan|andrew/.test(name)) {
      score -= 5;
    }
    if (/ar|arab/.test(name)) {
      score += 2;
    }
    return score;
  }

  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    const ranked = [...voices].sort((a, b) => scoreFeminineVoice(b) - scoreFeminineVoice(a));
    voiceEl.innerHTML = "";
    ranked.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceEl.appendChild(option);
    });
    voiceEl.dataset.ranked = JSON.stringify(
      ranked.map((voice) => ({ name: voice.name, lang: voice.lang }))
    );
    if (ranked.length) {
      voiceEl.selectedIndex = 0;
      setStatus(`تم اختيار صوت أنثوي مفضّل: ${ranked[0].name}`);
    } else {
      setStatus("لم يتم العثور على أصوات بعد. افتحي الصفحة في كروم أو إيدج.");
    }
  }

  function selectedVoice() {
    const rankedMeta = JSON.parse(voiceEl.dataset.ranked || "[]");
    const meta = rankedMeta[Number(voiceEl.value)];
    if (!meta) return null;
    return speechSynthesis.getVoices().find((v) => v.name === meta.name && v.lang === meta.lang) || null;
  }

  function splitSentences(text) {
    return text
      .split(/(?<=[.!?…。؟！])\s+|\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Soft breath-like exhale between sentences (not speech, just atmosphere).
  function playBreath() {
    try {
      const ctx = ensureAudio();
      const duration = 0.45;
      const sampleRate = ctx.sampleRate;
      const frameCount = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        const t = i / frameCount;
        const envelope = Math.sin(Math.PI * t) * (1 - t) * 0.045;
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(ctx.destination);
      source.start();
    } catch (_) {
      // Breath is optional; reading still works without it.
    }
  }

  function stopQueue() {
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    speechSynthesis.cancel();
  }

  function speakSentence(sentence, onDone) {
    const utterance = new SpeechSynthesisUtterance(sentence);
    const voice = selectedVoice();
    if (voice) utterance.voice = voice;
    utterance.pitch = Number(pitchEl.value);
    utterance.rate = Number(rateEl.value);
    utterance.volume = 1;
    utterance.onend = () => onDone();
    utterance.onerror = () => onDone();
    speechSynthesis.speak(utterance);
  }

  function speakText(text, { demo = false } = {}) {
    if (!text) {
      setStatus("اكتبي نصاً أولاً.");
      return;
    }
    if (isBlocked(text)) {
      policyNote.hidden = false;
      policyNote.textContent =
        "هذا القارئ لا يقرأ المحتوى الجنسي أو الصريح. احذفي العبارات الصريحة وجرّبي نصاً عاماً.";
      setStatus("تم رفض القراءة بسبب محتوى صريح.");
      return;
    }
    policyNote.hidden = true;
    stopQueue();

    const sentences = splitSentences(text);
    let index = 0;
    setStatus(demo ? "عرض تجريبي أنثوي هادئ…" : "تقرأ الآن بصوت أنثوي هادئ…");

    const next = () => {
      if (index >= sentences.length) {
        setStatus(demo ? "انتهى العرض التجريبي." : "انتهت القراءة.");
        return;
      }
      const sentence = sentences[index];
      index += 1;
      speakSentence(sentence, () => {
        if (index < sentences.length) {
          playBreath();
          // Pause + breath gap between sentences for a close, calm delivery.
          queueTimer = setTimeout(next, 700);
        } else {
          setStatus(demo ? "انتهى العرض التجريبي." : "انتهت القراءة.");
        }
      });
    };

    next();
  }

  function speak() {
    speakText(textEl.value.trim(), { demo: false });
  }

  function runDemo() {
    textEl.value = DEMO_TEXT;
    // Strongly feminine demo defaults.
    pitchEl.value = "1.55";
    rateEl.value = "0.84";
    speakText(DEMO_TEXT, { demo: true });
  }

  speakBtn.addEventListener("click", speak);
  demoBtn.addEventListener("click", runDemo);
  pauseBtn.addEventListener("click", () => {
    speechSynthesis.pause();
    setStatus("إيقاف مؤقت.");
  });
  resumeBtn.addEventListener("click", () => {
    speechSynthesis.resume();
    setStatus("متابعة القراءة.");
  });
  stopBtn.addEventListener("click", () => {
    stopQueue();
    setStatus("توقفت القراءة.");
  });

  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
})();
