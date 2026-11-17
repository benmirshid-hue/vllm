import { useEffect, useRef, useState } from "react";
import {
  canComment,
  canFollow,
  clock,
  creatorById,
  playCount,
  prerollFor,
  profileById,
  sharedWatchers,
  titleById,
} from "../domain.ts";
import { useStore } from "../store.tsx";

export function Theater() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);
  const title = titleById(state.titleId);
  const creator = creatorById(title.creatorId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cinema, setCinema] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const savedMark = useRef(-1);
  const ad = prerollFor(profile);
  const showAd = Boolean(ad) && !state.prerollSeen.includes(title.id);
  const liked = (state.likes[title.id] ?? []).includes(profile.id);
  const following = (state.followsCreators[profile.id] ?? []).includes(creator.id);
  const watchers = sharedWatchers(title.id, state.likes, profile.id);
  const comments = state.comments.filter((comment) => comment.titleId === title.id);
  const gate = canComment(profile, draft);
  const streamLabel =
    state.layers.video === "enterprise" ? "Cloudflare Stream · بث متكيف" : "أساس مفتوح · MP4 1080p";

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setError("");
    savedMark.current = -1;
  }, [title.id]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video || showAd) {
      return;
    }
    if (video.paused) {
      void video.play().then(() => {
        setPlaying(true);
        dispatch({ type: "play" });
      }).catch(() => setError("التشغيل ينتظر نقرة مباشرة على الشاشة."));
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function seek(next: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.currentTime = next;
    setTime(next);
    dispatch({ type: "position", titleId: title.id, seconds: next });
  }

  return (
    <section className={cinema ? "theater cinema" : "theater"}>
      <header className="page-head">
        <h1>الصالة</h1>
        <p>{streamLabel}. استئناف من آخر ثانية على هذا الجهاز.</p>
      </header>
      <figure className="matte" ref={stageRef}>
        <video
          ref={videoRef}
          key={title.id}
          src={title.src}
          poster=""
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(video.duration);
            const resume = state.positions[title.id] ?? 0;
            if (resume > 1 && resume < video.duration - 2) {
              video.currentTime = resume;
              setTime(resume);
            }
          }}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            setTime(video.currentTime);
            const mark = Math.floor(video.currentTime);
            if (mark % 2 === 0 && mark !== savedMark.current) {
              savedMark.current = mark;
              dispatch({ type: "position", titleId: title.id, seconds: video.currentTime });
            }
          }}
          onEnded={() => setPlaying(false)}
          onError={() => setError("تعذر فتح الملف. تحقق من الشبكة ثم أعد المحاولة.")}
        />
        {showAd && ad ? (
          <Preroll
            brand={ad.brand}
            line={ad.line}
            child={profile.role === "child"}
            onDone={(skipped) => {
              dispatch({
                type: "adComplete",
                adId: ad.id,
                creatorId: creator.id,
                skipped,
              });
              dispatch({ type: "prerollSeen", titleId: title.id });
            }}
            onOpenShop={
              profile.role === "child"
                ? undefined
                : () => dispatch({ type: "view", view: "market" })
            }
          />
        ) : null}
        <figcaption className="controls">
          <button type="button" onClick={togglePlay}>
            {playing ? "إيقاف" : "تشغيل"}
          </button>
          <input
            aria-label="موضع المشهد"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <span>
            {clock(time)} / {clock(duration)}
          </span>
          {time < title.introEndSec ? (
            <button type="button" onClick={() => seek(title.introEndSec)}>
              تخطي الشارة
            </button>
          ) : null}
          <button type="button" onClick={() => setCinema((value) => !value)}>
            {cinema ? "تصغير" : "وضع الصالة"}
          </button>
          <button
            type="button"
            onClick={() => {
              const node = stageRef.current;
              if (node && document.fullscreenElement !== node) {
                void node.requestFullscreen();
              } else {
                void document.exitFullscreen();
              }
            }}
          >
            ملء الشاشة
          </button>
        </figcaption>
      </figure>
      {error ? <p className="warn">{error}</p> : null}
      <div className="chapters">
        {title.chapters.map((chapter) => (
          <button key={chapter.label} type="button" onClick={() => seek(chapter.t)}>
            {chapter.label} · {clock(chapter.t)}
          </button>
        ))}
      </div>
      <div className="title-row">
        <div>
          <h2>{title.name}</h2>
          <p>{title.logline}</p>
          <p className="credit">{title.credit}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => dispatch({ type: "like" })}>
            {liked ? "أُعجب به" : "إعجاب"} · {(state.likes[title.id] ?? []).length}
          </button>
          <button type="button" onClick={() => dispatch({ type: "followCreator", creatorId: creator.id })}>
            {following ? "تتابع القناة" : "متابعة القناة"}
          </button>
          <button type="button" onClick={() => dispatch({ type: "channel", id: creator.id })}>
            {creator.name}
          </button>
          <span>{playCount(state, title.id)} تشغيل</span>
        </div>
      </div>
      <div className="split">
        <div>
          <h3>يشاهدون هذا أيضًا</h3>
          {watchers.length === 0 ? <p>كن أول من يفتح النقاش حول هذا العمل.</p> : null}
          <ul className="people">
            {watchers.map((person) => {
              const follows = (state.followsPeople[profile.id] ?? []).includes(person.id);
              const allowed = canFollow(profile, person);
              return (
                <li key={person.id}>
                  <span>{person.name}</span>
                  {allowed ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "followPerson", profileId: person.id })}
                    >
                      {follows ? "تتابعه" : "متابعة"}
                    </button>
                  ) : (
                    <span>{person.role === "child" ? "ملف طفل" : "خارج المتابعة"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3>التعليقات</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!gate.ok) {
                setNote(gate.reason);
                return;
              }
              dispatch({ type: "comment", text: draft });
              setDraft("");
              setNote("نُشر تعليقك.");
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={profile.role === "child" ? "التعليق مغلق في ملف الطفل" : "جملة عن المشهد"}
              maxLength={240}
            />
            <button type="submit">نشر</button>
          </form>
          {note ? <p className="note">{note}</p> : null}
          <ul className="comments">
            {comments.map((comment) => (
              <li key={comment.id}>
                <b>{profileById(comment.profileId).name}</b>
                <p>{comment.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Preroll({
  brand,
  line,
  child,
  onDone,
  onOpenShop,
}: {
  brand: string;
  line: string;
  child: boolean;
  onDone: (skipped: boolean) => void;
  onOpenShop?: () => void;
}) {
  const [left, setLeft] = useState(8);
  const [ready, setReady] = useState(false);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    const skipAt = window.setTimeout(() => setReady(true), child ? 5000 : 3000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(skipAt);
    };
  }, [child]);

  useEffect(() => {
    if (left === 0 && !done.current) {
      done.current = true;
      onDoneRef.current(false);
    }
  }, [left]);

  return (
    <div className="preroll">
      <p className="ad-flag">إعلان</p>
      <strong>{brand}</strong>
      <p>{line}</p>
      <p>{left} ث</p>
      <div className="actions">
        {ready ? (
          <button
            type="button"
            onClick={() => {
              if (!done.current) {
                done.current = true;
                onDone(true);
              }
            }}
          >
            تخطي
          </button>
        ) : (
          <span>التخطي بعد لحظات</span>
        )}
        {onOpenShop ? (
          <button type="button" onClick={onOpenShop}>
            في المتجر
          </button>
        ) : null}
      </div>
    </div>
  );
}
