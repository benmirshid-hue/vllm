(() => {
  const textEl = document.getElementById("text");
  const statusEl = document.getElementById("status");
  const policyNote = document.getElementById("policyNote");
  const chatEl = document.getElementById("chat");
  const sendBtn = document.getElementById("send");
  const clearBtn = document.getElementById("clear");

  const STORAGE_KEY = "personal-arabic-chat-v1";

  // Soft blocklist for explicit sexual content. Personal bot, not unrestricted.
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

  const SYSTEM_PROMPT = [
    "أنتِ مساعدة محادثة نصية شخصية بالعربية، بأسلوب قريب من مساعد Cursor:",
    "مفيدة، مباشرة، واضحة، ومتعاونة.",
    "ردي بالعربية الفصحى المبسطة أو بلهجة مفهومة حسب أسلوب المستخدم.",
    "افهمي الطلب جيداً، واسألي سؤال توضيح واحد فقط إذا لزم.",
    "ممنوع تماماً أي محتوى جنسي أو صريح أو إباحي.",
    "إذا طُلب محتوى ممنوع، ارفضي بلطف واقترحي بديلاً مفيداً.",
    "لا تدّعي أنكِ صوت أو اتصال هاتفي؛ هذه محادثة نصية فقط.",
  ].join(" ");

  let history = [];
  let busy = false;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function isBlocked(text) {
    return blockedPatterns.some((pattern) => pattern.test(text));
  }

  function showPolicy(message) {
    policyNote.hidden = false;
    policyNote.textContent = message;
  }

  function hidePolicy() {
    policyNote.hidden = true;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (_) {
      // private local storage may be unavailable
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = role === "user" ? "أنت" : "بوتك";
    const body = document.createElement("div");
    body.textContent = text;
    bubble.appendChild(who);
    bubble.appendChild(body);
    chatEl.appendChild(bubble);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderAll() {
    chatEl.innerHTML = "";
    if (!history.length) {
      const welcome =
        "مرحباً. أنا بوتك الشخصي النصي. اكتب لي مثل ما تكتب لـ Cursor، وأرد عليك بالعربية.";
      addBubble("bot", welcome);
      return;
    }
    history.forEach((item) => {
      if (item.role === "user") addBubble("user", item.content);
      if (item.role === "assistant") addBubble("bot", item.content);
    });
  }

  function localFallback(userText) {
    const t = userText.trim();
    if (/^(مرحبا|السلام|هلا|أهلا|اهلا)/i.test(t)) {
      return "أهلاً. كيف أقدر أساعدك اليوم؟";
    }
    if (/من أنت|من انتي|وش تسوين/i.test(t)) {
      return "أنا بوتك الشخصي النصي على هذا الجهاز. اكتب طلبك وأرد عليك خطوة بخطوة.";
    }
    return "فهمت طلبك بشكل عام. اكتب لي تفاصيل أوضح (الهدف + أي قيود)، وأعطيك رداً مباشراً.";
  }

  async function askModel(userText) {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-12),
      { role: "user", content: userText },
    ];

    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: "openai",
        seed: Date.now() % 100000,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reply = (await response.text()).trim();
    if (!reply) throw new Error("empty");
    return reply;
  }

  async function handleUserMessage(raw) {
    const text = raw.trim();
    if (!text || busy) return;

    if (isBlocked(text)) {
      showPolicy("هذا البوت الشخصي لا يكمل المحتوى الجنسي أو الصريح.");
      setStatus("تم رفض الرسالة.");
      return;
    }

    busy = true;
    sendBtn.disabled = true;
    hidePolicy();
    history.push({ role: "user", content: text });
    addBubble("user", text);
    textEl.value = "";
    save();
    setStatus("يفكر في الرد…");

    let reply;
    try {
      reply = await askModel(text);
    } catch (_) {
      reply = localFallback(text);
      setStatus("الخدمة الذكية غير متاحة مؤقتاً؛ استخدمت رداً محلياً.");
    }

    if (isBlocked(reply)) {
      reply = "أفضل نبتعد عن هذا الموضوع. قل لي طلباً عاماً أو عملياً أقدر أساعدك فيه.";
    }

    history.push({ role: "assistant", content: reply });
    addBubble("bot", reply);
    save();
    setStatus("جاهز. اكتب رسالتك التالية.");
    busy = false;
    sendBtn.disabled = false;
    textEl.focus();
  }

  function clearChat() {
    history = [];
    save();
    renderAll();
    hidePolicy();
    setStatus("تم مسح المحادثة المحلية.");
  }

  sendBtn.addEventListener("click", () => handleUserMessage(textEl.value));
  clearBtn.addEventListener("click", clearChat);
  textEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleUserMessage(textEl.value);
    }
  });

  history = load();
  renderAll();
  setStatus("بوت محادثة نصية شخصية جاهز على هذا الجهاز.");
  textEl.focus();
})();
