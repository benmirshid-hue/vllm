import { harasSeries } from "../data.ts";

export function Studio() {
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
      <h2>الشخصيات</h2>
      <ul className="people cards">
        {harasSeries.characters.map((character) => (
          <li key={character.name}>
            <b>{character.name}</b>
            <span>{character.detail}</span>
          </li>
        ))}
      </ul>
      <h2>الحلقات</h2>
      <ul className="queue">
        {harasSeries.episodes.map((episode) => (
          <li key={episode.number}>
            <div>
              <b>الحلقة {episode.number}</b>
              <p>نحو {episode.minutes} دقيقة. {episode.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
