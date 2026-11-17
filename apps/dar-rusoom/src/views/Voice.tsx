import { useRef, useState } from "react";
import { assist, profileById, titleById } from "../domain.ts";
import { useStore } from "../store.tsx";

type Line = { from: "viewer" | "assistant"; text: string };

type SpeechResultList = {
  length: number;
  [index: number]: { 0: { transcript: string } };
};

type SpeechResultEvent = { results: SpeechResultList };

type BrowserRecognition = {
  lang: string;
  start: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
};

type RecognitionCtor = new () => BrowserRecognition;

export function Voice() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [hearing, setHearing] = useState(false);
  const [earNote, setEarNote] = useState("");
  const offers = useRef<string[]>([]);

  function reply(text: string) {
    const clean = text.trim();
    if (!clean) {
      return;
    }
    const result = assist(profile, clean, offers.current);
    offers.current = result.offerIds;
    setLines((current) => [
      ...current,
      { from: "viewer", text: clean },
      { from: "assistant", text: result.say },
    ]);
    setDraft("");
    speak(result.say);
    if (result.openId) {
      dispatch({ type: "open", titleId: result.openId });
    }
  }

  function listen() {
    const ctor = recognitionCtor();
    if (!ctor) {
      setEarNote("هذا المتصفح لا يسمع. اكتب الجملة.");
      return;
    }
    const ear = new ctor();
    ear.lang = "ar-SA";
    ear.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const heard = last?.[0]?.transcript ?? "";
      setHearing(false);
      if (heard) {
        reply(heard);
      }
    };
    ear.onerror = () => {
      setHearing(false);
      setEarNote("ما التقطت الصوت. اكتب الجملة.");
    };
    setHearing(true);
    setEarNote("");
    ear.start();
  }

  return (
    <section>
      <header className="page-head">
        <h1>الصوت</h1>
        <p>الأذن عربية. يطوي التشكيل ثم يقترح حتى ترتاح للاختيار، وبعدها يفتح الصالة.</p>
      </header>
      <div className="chat">
        {lines.length === 0 ? <p className="note">قول وش تبي تشوف.</p> : null}
        {lines.map((line, index) => (
          <p key={`${line.from}-${index}`} className={line.from === "assistant" ? "bubble" : "bubble viewer"}>
            {line.text}
          </p>
        ))}
      </div>
      <form
        className="voice-form"
        onSubmit={(event) => {
          event.preventDefault();
          reply(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="اكتب المزاج أو قول شغّله"
          aria-label="جملة للمساعد"
        />
        <button type="submit">إرسال</button>
        <button type="button" onClick={listen}>
          {hearing ? "يسمع" : "تكلم"}
        </button>
      </form>
      {earNote ? <p className="note">{earNote}</p> : null}
      {offers.current.length > 0 ? (
        <div className="actions">
          {offers.current.map((id) => (
            <button key={id} type="button" onClick={() => reply(`شغّل ${titleById(id).name}`)}>
              {titleById(id).name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-SA";
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("ar"));
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function recognitionCtor(): RecognitionCtor | null {
  const host = window as Window & { webkitSpeechRecognition?: RecognitionCtor; SpeechRecognition?: RecognitionCtor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}
