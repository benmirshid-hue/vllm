import { useEffect, useRef, useState } from "react";
import { adById, buildFeed, profileById, titleById } from "../domain.ts";
import { useStore } from "../store.tsx";

export function AdFeed() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);
  const items = buildFeed(profile, state.catalog);

  return (
    <section>
      <header className="page-head">
        <h1>التغذية</h1>
        <p>مقطع كرتون، ثم إعلان موسوم. التخطي بعد ثلاث ثوانٍ للبالغ، وبعد خمس للطفل. الإعلان المكتمل يدخل حصة القناة.</p>
      </header>
      <div className="feed">
        {items.map((item, index) =>
          item.kind === "clip" ? (
            <Clip key={`${item.titleId}-${index}`} titleId={item.titleId} />
          ) : (
            <FeedAd
              key={`${item.adId}-${index}`}
              adId={item.adId}
              creatorId={item.creatorId}
              child={profile.role === "child"}
              onDone={(skipped) =>
                dispatch({
                  type: "adComplete",
                  adId: item.adId,
                  creatorId: item.creatorId,
                  skipped,
                })
              }
              onShop={profile.role === "child" ? undefined : () => dispatch({ type: "view", view: "market" })}
            />
          ),
        )}
      </div>
    </section>
  );
}

function Clip({ titleId }: { titleId: string }) {
  const { state } = useStore();
  const title = titleById(titleId, state.catalog);
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = wrap.current;
    const video = ref.current;
    if (!node || !video) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.7 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="reel" ref={wrap}>
      {title.playback === "board" ? (
        <div className="reel-board" style={{ background: title.hue }} />
      ) : (
        <video ref={ref} src={title.src} muted playsInline loop preload="metadata" />
      )}
      <div className="reel-copy">
        <p className="ad-flag">كرتون</p>
        <strong>{title.name}</strong>
        <p>{title.logline}</p>
      </div>
    </article>
  );
}

function FeedAd({
  adId,
  child,
  onDone,
  onShop,
}: {
  adId: string;
  creatorId: string;
  child: boolean;
  onDone: (skipped: boolean) => void;
  onShop?: () => void;
}) {
  const ad = adById(adId);
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
    <article className="reel ad-reel">
      <p className="ad-flag">إعلان</p>
      <strong>{ad.brand}</strong>
      <p>{ad.line}</p>
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
        {onShop ? (
          <button type="button" onClick={onShop}>
            في المتجر
          </button>
        ) : null}
      </div>
    </article>
  );
}
