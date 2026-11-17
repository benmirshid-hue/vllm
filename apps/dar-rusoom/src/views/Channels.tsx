import { creators, titles } from "../data.ts";
import { creatorAdEarnings, creatorById, merchantEarnings, sar } from "../domain.ts";
import { useStore } from "../store.tsx";

export function Channels() {
  const { state, dispatch } = useStore();
  if (state.channelId) {
    return <ChannelDetail id={state.channelId} />;
  }

  return (
    <section>
      <header className="page-head">
        <h1>القنوات</h1>
        <p>كل استوديو يملك قناته. حصة الإعلان المكتمل تظهر هنا، ومعها صافي متجره إن وُجد.</p>
      </header>
      <div className="poster-grid">
        {creators.map((creator) => {
          const adsEarned = creatorAdEarnings(state.adEvents, creator.id, creator.adShare);
          const shop = creator.merchantId ? merchantEarnings(state.orders, creator.merchantId).merchant : 0;
          return (
            <button
              key={creator.id}
              className="channel-card"
              type="button"
              onClick={() => dispatch({ type: "channel", id: creator.id })}
            >
              <b>{creator.name}</b>
              <p>{creator.bio}</p>
              <span>
                الإعلانات {sar(adsEarned)} · المتجر {sar(shop)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ChannelDetail({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const creator = creatorById(id);
  const ownTitles = [...titles, ...state.catalog].filter((title) => title.creatorId === creator.id);
  const adsEarned = creatorAdEarnings(state.adEvents, creator.id, creator.adShare);
  const shop = creator.merchantId ? merchantEarnings(state.orders, creator.merchantId) : null;
  const following = (state.followsCreators[state.profileId] ?? []).includes(creator.id);
  const ownAds = state.adEvents.filter((event) => event.creatorId === creator.id);
  const completed = ownAds.filter((event) => !event.skipped).length;
  const skipped = ownAds.length - completed;

  return (
    <section>
      <header className="page-head">
        <h1>{creator.name}</h1>
        <p>{creator.bio}</p>
      </header>
      <div className="actions">
        <button type="button" onClick={() => dispatch({ type: "followCreator", creatorId: creator.id })}>
          {following ? "تتابع القناة" : "متابعة القناة"}
        </button>
        <button type="button" onClick={() => dispatch({ type: "view", view: "channels" })}>
          كل القنوات
        </button>
      </div>
      <div className="stats">
        <article>
          <span>حصة الإعلان</span>
          <strong>{Math.round(creator.adShare * 100)}%</strong>
        </article>
        <article>
          <span>إعلانات مكتملة</span>
          <strong>{completed}</strong>
        </article>
        <article>
          <span>عائد الإعلان</span>
          <strong>{sar(adsEarned)}</strong>
        </article>
        <article>
          <span>إعلانات متجاوزة</span>
          <strong>{skipped}</strong>
        </article>
        <article>
          <span>صافي المتجر</span>
          <strong>{sar(shop?.merchant ?? 0)}</strong>
        </article>
      </div>
      <p className="note">
        الإعلان المتجاوز عائده صفر. المكتمل يُقسَّم: القناة تأخذ حصتها والباقي يبقى للمنصة.
      </p>
      {shop ? (
        <p className="note">
          مبيعات التاجر {sar(shop.gross)}، عمولة المنصة {sar(shop.platform)}، صافي التاجر {sar(shop.merchant)}.
        </p>
      ) : null}
      <div className="poster-grid">
        {ownTitles.map((title) => (
          <button key={title.id} className="poster-card" type="button" onClick={() => dispatch({ type: "open", titleId: title.id })}>
            <span className="poster" style={{ background: title.hue }}>
              <strong>{title.name}</strong>
              <em>+{title.rating}</em>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
