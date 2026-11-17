import { useState } from "react";
import { harasCharacters, harasSeries, harasShots } from "../data.ts";
import { assembleEpisode, mouthCues, type Mouth } from "../domain.ts";

export function Studio() {
  const locked = harasCharacters.map((character) => character.id);
  const cut = assembleEpisode(1, harasShots, locked);
  const [speakerId, setSpeakerId] = useState(harasCharacters[0]?.id ?? "");
  const [mouth, setMouth] = useState<Mouth>("closed");
  const [shotId, setShotId] = useState<string | null>(null);
  const speaker = harasCharacters.find((character) => character.id === speakerId) ?? harasCharacters[0];

  function playLine(line: string, pitch: number, rate: number, id: string | null) {
    setShotId(id);
    const cues = mouthCues(line);
    let index = 0;
    setMouth(cues[0] ?? "closed");
    const timer = window.setInterval(() => {
      index += 1;
      const next = cues[index];
      if (!next) {
        window.clearInterval(timer);
        setMouth("closed");
        return;
      }
      setMouth(next);
    }, 180);
    speakLine(line, pitch, rate);
  }

  return (
    <section>
      <header className="page-head">
        <h1>{harasSeries.name}</h1>
        <p>{harasSeries.note}</p>
      </header>
      <ol className="stages">
        {harasSeries.stages.map((stage) => (
          <li key={stage}>{stage}</li>
        ))}
      </ol>
      <h2>الأصوات المقفلة</h2>
      <ul className="people cards">
        {harasCharacters.map((character) => (
          <li key={character.id}>
            <b>{character.name}</b>
            <span>
              {character.detail} · طبقة {character.pitch}
            </span>
            <button
              type="button"
              onClick={() => {
                setSpeakerId(character.id);
                playLine(character.line, character.pitch, character.rate, null);
              }}
            >
              انطق
            </button>
          </li>
        ))}
      </ul>
      {speaker ? (
        <p className="note">
          {speaker.name}: {speaker.line}
        </p>
      ) : null}
      <span className={`mouth ${mouth}`} aria-label="فم" />
      <h2>الحلقة الأولى مجمّعة</h2>
      {cut.ok ? (
        <p className="note">
          {cut.shotIds.length} لقطات · {cut.seconds} ثانية · الوجوه من البطاقات فقط.
        </p>
      ) : (
        <p className="warn">{cut.reason}</p>
      )}
      <ol className="queue">
        {harasShots.map((shot) => (
          <li key={shot.id}>
            <div>
              <b>{shot.line}</b>
              <p>
                {shot.seconds} ثانية · {shot.faceIds.join(" ، ")}
              </p>
            </div>
            <button
              type="button"
              className={shotId === shot.id ? "on" : ""}
              onClick={() => {
                const who = harasCharacters.find((character) => character.id === shot.speakerId);
                if (who) {
                  playLine(shot.line, who.pitch, who.rate, shot.id);
                }
              }}
            >
              شغّل اللقطة
            </button>
          </li>
        ))}
      </ol>
      <h2>باقي الحلقات</h2>
      <ul className="queue">
        {harasSeries.episodes
          .filter((episode) => episode.number > 1)
          .map((episode) => (
            <li key={episode.number}>
              <div>
                <b>الحلقة {episode.number}</b>
                <p>
                  نحو {episode.minutes} دقيقة. {episode.status}
                </p>
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}

function speakLine(text: string, pitch: number, rate: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-SA";
  utterance.pitch = pitch;
  utterance.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("ar"));
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
