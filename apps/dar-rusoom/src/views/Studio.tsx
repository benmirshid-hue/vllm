import { useRef, useState } from "react";
import type { Series } from "../data.ts";
import {
  assembleEpisode,
  episodeNumbers,
  episodeTitle,
  mouthCues,
  type Mouth,
} from "../domain.ts";
import { speakArabic } from "../speech.ts";
import { useStore } from "../store.tsx";

export function Studio() {
  const { state, dispatch } = useStore();
  const [seriesId, setSeriesId] = useState(state.series[0]?.id ?? "");
  const series = state.series.find((item) => item.id === seriesId) ?? state.series[0];
  const [name, setName] = useState("");
  const [rating, setRating] = useState<3 | 7 | 13>(3);
  const [castName, setCastName] = useState("");
  const [castDetail, setCastDetail] = useState("");
  const [castLine, setCastLine] = useState("");
  const [episode, setEpisode] = useState(1);
  const [speakerId, setSpeakerId] = useState("");
  const [shotLine, setShotLine] = useState("");
  const [faces, setFaces] = useState<string[]>([]);
  const [mouth, setMouth] = useState<Mouth>("closed");
  const [notice, setNotice] = useState("");
  const timer = useRef(0);

  function playLine(line: string, pitch: number, rate: number) {
    window.clearInterval(timer.current);
    const cues = mouthCues(line);
    let index = 0;
    setMouth(cues[0] ?? "closed");
    timer.current = window.setInterval(() => {
      index += 1;
      const next = cues[index];
      if (!next) {
        window.clearInterval(timer.current);
        setMouth("closed");
        return;
      }
      setMouth(next);
    }, 180);
    speakArabic(line, pitch, rate);
  }

  if (!series) {
    return null;
  }

  const speaker = series.cast.find((member) => member.id === speakerId) ?? series.cast[0];

  return (
    <section>
      <header className="page-head">
        <h1>استوديو المسلسلات</h1>
        <p>بطاقة لكل شخصية، لقطة بوجوه من نفس البطاقة، ثم نشر الحلقة في المكتبة. المسلسل الجديد يمر من نفس الأداة.</p>
      </header>
      <div className="actions">
        {state.series.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === series.id ? "on" : ""}
            onClick={() => {
              setSeriesId(item.id);
              setSpeakerId("");
              setFaces([]);
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      <form
        className="mod-form"
        onSubmit={(event) => {
          event.preventDefault();
          const before = state.series.length;
          dispatch({ type: "createSeries", name, rating });
          setName("");
          setNotice(name.trim().length < 2 ? "اسم المسلسل قصير." : "أضف البطاقات ثم اللقطات.");
          if (name.trim().length >= 2) {
            setSeriesId(`series-${before + 1}`);
          }
        }}
      >
        <label>
          مسلسل جديد
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          التصنيف
          <select
            value={rating}
            onChange={(event) => setRating(Number(event.target.value) as 3 | 7 | 13)}
          >
            <option value={3}>+3</option>
            <option value={7}>+7</option>
            <option value={13}>+13</option>
          </select>
        </label>
        <button type="submit">أنشئ المسلسل</button>
      </form>
      {notice ? <p className="note">{notice}</p> : null}
      <h2>{series.name}</h2>
      <p className="note">
        {series.cast.length} بطاقات · {series.shots.length} لقطات · حتى +{series.rating}
      </p>
      <span className={`mouth ${mouth}`} aria-label="فم" />
      <ul className="people cards">
        {series.cast.map((member) => (
          <li key={member.id}>
            <b>{member.name}</b>
            <span>
              {member.detail} · طبقة {member.pitch}
            </span>
            <button type="button" onClick={() => playLine(member.line, member.pitch, member.rate)}>
              انطق
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mod-form"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({
            type: "addCast",
            seriesId: series.id,
            name: castName,
            detail: castDetail,
            line: castLine,
          });
          setCastName("");
          setCastDetail("");
          setCastLine("");
        }}
      >
        <label>
          شخصية
          <input value={castName} onChange={(event) => setCastName(event.target.value)} />
        </label>
        <label>
          وصفها
          <input value={castDetail} onChange={(event) => setCastDetail(event.target.value)} />
        </label>
        <label>
          جملة الصوت
          <input value={castLine} onChange={(event) => setCastLine(event.target.value)} />
        </label>
        <button type="submit">أضف البطاقة</button>
      </form>
      <form
        className="mod-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!speaker) {
            setNotice("أضف بطاقة قبل اللقطة.");
            return;
          }
          const faceIds = [...new Set([speaker.id, ...faces])];
          dispatch({
            type: "addShot",
            seriesId: series.id,
            episode,
            speakerId: speaker.id,
            line: shotLine || speaker.line,
            faceIds,
          });
          setShotLine("");
          setFaces([]);
        }}
      >
        <label>
          رقم الحلقة
          <input
            type="number"
            min={1}
            value={episode}
            onChange={(event) => setEpisode(Number(event.target.value))}
          />
        </label>
        <label>
          المتحدث
          <select value={speaker?.id ?? ""} onChange={(event) => setSpeakerId(event.target.value)}>
            {series.cast.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          جملة اللقطة
          <input value={shotLine} onChange={(event) => setShotLine(event.target.value)} />
        </label>
        <fieldset className="faces">
          <legend>وجوه في اللقطة</legend>
          {series.cast.map((member) => (
            <label key={member.id} className="check">
              <input
                type="checkbox"
                checked={faces.includes(member.id) || member.id === speaker?.id}
                onChange={(event) => {
                  setFaces((current) =>
                    event.target.checked
                      ? [...current, member.id]
                      : current.filter((id) => id !== member.id),
                  );
                }}
              />
              {member.name}
            </label>
          ))}
        </fieldset>
        <button type="submit">أضف لقطة 90 ثانية</button>
      </form>
      <h2>الحلقات</h2>
      <EpisodeList series={series} catalogIds={state.catalog.map((title) => title.id)} />
    </section>
  );
}

function EpisodeList({ series, catalogIds }: { series: Series; catalogIds: string[] }) {
  const { dispatch } = useStore();
  const numbers = episodeNumbers(series);
  if (numbers.length === 0) {
    return <p className="note">لا حلقة قبل أول لقطة.</p>;
  }
  const locked = series.cast.map((member) => member.id);
  return (
    <ul className="queue">
      {numbers.map((number) => {
        const cut = assembleEpisode(number, series.shots, locked);
        const title = episodeTitle(series, number);
        const published = title ? catalogIds.includes(title.id) : false;
        return (
          <li key={number}>
            <div>
              <b>{title?.name ?? `${series.name} — ${number}`}</b>
              <p>
                {cut.ok
                  ? `${cut.shotIds.length === 1 ? "لقطة" : `${cut.shotIds.length} لقطات`} · ${cut.seconds} ثانية`
                  : cut.reason}
              </p>
            </div>
            {title && published ? (
              <button type="button" onClick={() => dispatch({ type: "open", titleId: title.id })}>
                افتح في الصالة
              </button>
            ) : (
              <button
                type="button"
                disabled={!cut.ok}
                onClick={() => dispatch({ type: "release", seriesId: series.id, episode: number })}
              >
                انشر في المكتبة
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
