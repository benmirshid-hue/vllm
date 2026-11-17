import { profiles } from "../data.ts";
import { canFollow, profileById, titleById, visibleTitles } from "../domain.ts";
import { useStore } from "../store.tsx";

export function Community() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);
  const allowed = new Set(visibleTitles(profile).map((title) => title.id));
  const people = profiles.filter((person) => person.id !== profile.id && person.role !== "child");
  const comments = state.comments.filter((comment) => allowed.has(comment.titleId));

  return (
    <section>
      <header className="page-head">
        <h1>الناس</h1>
        <p>تابع من يشاهد الكرتون نفسه. حساب الطفل يتابع ولي أمره فقط، ولا يظهر لأحد.</p>
      </header>
      <ul className="people cards">
        {people.map((person) => {
          const allowedFollow = canFollow(profile, person);
          const follows = (state.followsPeople[profile.id] ?? []).includes(person.id);
          const shared = sharedTitles(profile.id, person.id, state.likes).filter((id) => allowed.has(id));
          return (
            <li key={person.id}>
              <div>
                <b>{person.name}</b>
                <p>
                  {person.ageYears} سنة
                  {shared.length > 0 ? ` · مشترك معك في ${shared.map((id) => titleById(id).name).join("، ")}` : ""}
                </p>
              </div>
              {allowedFollow ? (
                <button type="button" onClick={() => dispatch({ type: "followPerson", profileId: person.id })}>
                  {follows ? "تتابعه" : "متابعة"}
                </button>
              ) : (
                <span>خارج نطاق هذا الملف</span>
              )}
            </li>
          );
        })}
      </ul>
      <h2>آخر التعليقات</h2>
      <ul className="comments">
        {comments.map((comment) => (
          <li key={comment.id}>
            <b>{profileById(comment.profileId).name}</b>
            <p>
              على {titleById(comment.titleId).name}: {comment.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function sharedTitles(
  actorId: string,
  otherId: string,
  likes: Record<string, string[]>,
): string[] {
  return Object.entries(likes)
    .filter(([, ids]) => ids.includes(actorId) && ids.includes(otherId))
    .map(([titleId]) => titleId);
}
