import { creators } from "../data.ts";
import { playCount, profileById, visibleTitles } from "../domain.ts";
import { useStore } from "../store.tsx";

export function Library() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);
  const library = visibleTitles(profile, state.catalog);

  return (
    <section>
      <header className="page-head">
        <h1>المكتبة</h1>
        <p>أفلام رسوم ومقاطعها. ملف {profile.name} يرى حتى +{profile.maxRating}.</p>
      </header>
      <div className="poster-grid">
        {library.map((title) => {
          const creator = creators.find((item) => item.id === title.creatorId);
          return (
            <button
              key={title.id}
              className="poster-card"
              type="button"
              onClick={() => dispatch({ type: "open", titleId: title.id })}
            >
              <span className="poster" style={{ background: title.hue }}>
                <small>{title.style}</small>
                <strong>{title.name}</strong>
                <em>+{title.rating}</em>
              </span>
              <span className="poster-meta">
                <b>{title.name}</b>
                <span>
                  {title.lengthLabel} · {creator?.name} · {playCount(state, title.id)} مشاهدة
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
