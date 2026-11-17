/* Runnable preview logic — consolidates chat, trial, timeline, admin, player */
const STAGES = [
  "StoryWriter","Screenplay","PerSecondEvents","SceneBreakdown","CharacterArtist",
  "Bestiary","ImageAssets","ArabicVoice","OnScreenText","SceneVideo",
  "EpisodeStitch","PosterTrailer","QualityEval","SafetyQA"
];
const stageState = Object.fromEntries(STAGES.map((s) => [s, "wait"]));
const versions = [
  { v: "0.1.0", note: "سقالة أولية + وكلاء" },
  { v: "0.2.0", note: "Chat ثنائي + المدير" },
  { v: "0.3.0", note: "Admin فوق الجميع + معاينة كاملة" },
];

function $(id){ return document.getElementById(id); }

function renderTimeline(){
  const ol = $("stageTimeline");
  ol.innerHTML = "";
  STAGES.forEach((s,i)=>{
    const li = document.createElement("li");
    li.className = stageState[s];
    li.innerHTML = `<div>${i+1}. ${s}</div>`;
    ol.appendChild(li);
  });
}
function setStage(id, st){ if(stageState[id]!==undefined) stageState[id]=st; renderTimeline(); }

function addMsg(role, who, text){
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="who">${who}</div><div>${text}</div>`;
  $("chatLog").appendChild(div);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}

function renderVersions(){
  $("versions").innerHTML = versions.map(x=>`<div><strong>${x.v}</strong> — ${x.note}</div>`).join("");
}

const chars = [
  {name:"البطل", age:"12", costume:"رداء أزرق وحدود فضية", tags:["hero"]},
  {name:"المرشد", age:"60", costume:"عباءة خضراء وعصا", tags:["mentor"]},
  {name:"شبح الرمال", age:"n/a", costume:"عباءة رملية شفافة", tags:["creature"]},
];
function renderChars(){
  $("charCards").innerHTML = chars.map(c=>`
    <article class="card">
      <img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23333' width='48' height='48'/%3E%3C/svg%3E" />
      <div><h4>${c.name} · ${c.age}</h4><p>${c.costume}</p><p>${c.tags.join(", ")}</p></div>
    </article>`).join("");
}

const skills = [
  ["اقفل السيناريو","أكمل السيناريو أولاً ثم اقفل screenplay.json"],
  ["استيراد كتالوج","استورد قالب ________0df4"],
  ["صوت عربي XTTS","ولّد حواراً بـ Coqui XTTS-v2 محلياً"],
  ["جودة","شغّل QualityEval"],
];
$("skills").innerHTML = "";
skills.forEach(([label,text])=>{
  const b=document.createElement("button");
  b.type="button"; b.textContent=label;
  b.onclick=()=>{ addMsg("user","أنت",text); bossReply(text); };
  $("skills").appendChild(b);
});

function bossReply(text){
  addMsg("agent","المدير (Director)", `تفكير: 1) فهم الطلب 2) توجيه عبر المايسترو 3) تسجيل في الدفتر.\n«${text.slice(0,120)}»`);
  if(/تجرب|trial|دقيقت/i.test(text)) runTrial(false);
  if(/كتالوج|0df4/i.test(text)) {
    setStage("CharacterArtist","run");
    addMsg("agent","دفتر","سجّلت استيراد كتالوج → بطاقات + موسوعة + مشاهد موقوتة");
    setStage("CharacterArtist","done");
  }
  if(/سيناريو|screenplay/i.test(text)) {
    setStage("StoryWriter","done");
    setStage("Screenplay","run");
    addMsg("agent","كاتب السيناريو","السيناريو يُقفَل أولاً قبل الأحداث/المشاهد.");
    setTimeout(()=>setStage("Screenplay","done"), 500);
  }
}

function runTrial(fromButton){
  if(fromButton) addMsg("user","أنت","▶ تجربة دقيقتين");
  addMsg("agent","المدير","وضع التجربة: ~120 ثانية، ١–٢ مشهد. الفيديو OSS فقط (Wan2.1).");
  addMsg("agent","المايسترو","وزّعت المهام مع مهلة زمنية لكل مرحلة.");
  STAGES.forEach(s=>stageState[s]="wait");
  let i=0;
  const t=setInterval(()=>{
    if(i>0) setStage(STAGES[i-1],"done");
    if(i<STAGES.length){ setStage(STAGES[i],"run"); addMsg("agent","المراقب",`مراقبة: ${STAGES[i]}`); }
    i++;
    if(i>STAGES.length){
      clearInterval(t);
      addMsg("agent","المدير","انتهت محاكاة التجربة — عاين المشغّل قبل النشر.");
      addMsg("agent","دفتر","سجلّ القرار: trial complete (mock)");
    }
  }, 350);
}

$("chatForm").onsubmit=(e)=>{
  e.preventDefault();
  const v=$("chatInput").value.trim();
  if(!v) return;
  $("chatInput").value="";
  if(/^admin[:：]/i.test(v) || v.startsWith("!")) {
    addMsg("admin","المشرف الأعلى", "أمر Admin: "+v.replace(/^admin[:：]\s*|^!/i,""));
    return;
  }
  addMsg("user","أنت",v);
  bossReply(v);
};

$("btnTrial").onclick=()=>runTrial(true);
$("btnHold").onmousedown=()=>{
  $("phonePanel").classList.add("recording");
  $("phoneStatus").textContent="تسجيل… (mock STT)";
};
$("btnHold").onmouseup=()=>{
  $("phonePanel").classList.remove("recording");
  $("phoneStatus").textContent="تفريغ: «شغّل تجربة قصيرة»";
  addMsg("user","هاتف/STT","شغّل تجربة قصيرة");
  bossReply("شغّل تجربة قصيرة");
};
$("btnConfirmChars").onclick=()=>{
  addMsg("agent","فنّان الشخصيات","تم تأكيد البطاقات (عمر/زي/وسوم/مراجع) قبل التوليد.");
  setStage("CharacterArtist","done"); setStage("ImageAssets","run");
};
$("btnZip").onclick=()=>addMsg("admin","المشرف الأعلى","تنزيل مخرجات الحلقة (zip stub).");
$("btnModels").onclick=()=>addMsg("admin","المشرف الأعلى","نماذج OSS: SDXL, InstantID, Wan2.1, CogVideoX, XTTS-v2, MMS-TTS-ara — سحب محلي.");
$("btnOpenPlayer").onclick=()=>window.open("../player/index.html","_blank");
$("btnUploadCatalog").onclick=()=>bossReply("استورد كتالوج ________0df4");
$("btnHotModel").onclick=()=>addMsg("admin","المشرف الأعلى","Hot-add: سجّلت facebook/mms-tts-ara كـ TTS بديل.");
$("btnExtend").onclick=()=>addMsg("admin","المشرف الأعلى","توسيع المنصة: مسار جديد لكتب مصوّرة تفاعلية خارج مسلسل الكوميك الحالي.");
$("btnToggleAgent").onclick=()=>addMsg("admin","المشرف الأعلى","بدّلت تفعيل SceneVideoAgent (تحكم غير مقيّد).");
$("bgSelect").onchange=(e)=>{
  const map={
    "default-dark":"radial-gradient(900px 500px at 80% -10%, #2a1f3d, #0e1016)",
    "desert-dusk":"radial-gradient(900px 500px at 20% 0%, #7c2d12, #0c1220)",
    "ink-wash":"radial-gradient(900px 500px at 50% -10%, #1e293b, #020617)",
  };
  document.body.style.background = map[e.target.value]||map["default-dark"];
  addMsg("admin","المشرف الأعلى","خلفية الواجهة ← "+e.target.value);
};

// video.js player stub (no real mp4 required)
const player = videojs("player", { controls:true, fluid:true });
$("playerMeta").textContent = "معاينة قبل النشر · هدف الحلقة 25:00 · تجربة 02:00";

renderTimeline();
renderChars();
renderVersions();
addMsg("admin","المشرف الأعلى","أنت داخل طبقة Admin. المدير تحت أمرك.");
addMsg("agent","المدير","مرحباً — قل «تجربة دقيقتين» أو أكّد بطاقات الشخصيات قبل التوليد.");
