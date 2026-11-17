import { profiles } from "./data.ts";
import { profileById, type View } from "./domain.ts";
import { useStore } from "./store.tsx";
import { AdFeed } from "./views/AdFeed.tsx";
import { Channels } from "./views/Channels.tsx";
import { Community } from "./views/Community.tsx";
import { Library } from "./views/Library.tsx";
import { Market } from "./views/Market.tsx";
import { Moderation } from "./views/Moderation.tsx";
import { Stack } from "./views/Stack.tsx";
import { Studio } from "./views/Studio.tsx";
import { Theater } from "./views/Theater.tsx";
import { Voice } from "./views/Voice.tsx";

const nav: { view: View; label: string }[] = [
  { view: "library", label: "المكتبة" },
  { view: "theater", label: "الصالة" },
  { view: "voice", label: "الصوت" },
  { view: "studio", label: "الاستوديو" },
  { view: "community", label: "الناس" },
  { view: "ads", label: "الإعلانات" },
  { view: "channels", label: "القنوات" },
  { view: "market", label: "المتجر" },
  { view: "moderation", label: "المراجعة" },
  { view: "stack", label: "التقنية" },
];

export function App() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="mark">دار الرسوم</p>
          <p className="mark-sub">كرتون فقط. المشاهدة مجانية.</p>
        </div>
        <label className="who">
          <span>الملف</span>
          <select
            value={profile.id}
            onChange={(event) => dispatch({ type: "profile", id: event.target.value })}
          >
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {roleLabel(item.role)}
              </option>
            ))}
          </select>
        </label>
      </header>
      <nav className="nav">
        {nav.map((item) => (
          <button
            key={item.view}
            className={state.view === item.view ? "nav-btn on" : "nav-btn"}
            onClick={() => dispatch({ type: "view", view: item.view })}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="stage">
        <Screen view={state.view} />
      </main>
    </div>
  );
}

function Screen({ view }: { view: View }) {
  switch (view) {
    case "library":
      return <Library />;
    case "theater":
      return <Theater />;
    case "voice":
      return <Voice />;
    case "studio":
      return <Studio />;
    case "community":
      return <Community />;
    case "ads":
      return <AdFeed />;
    case "channels":
      return <Channels />;
    case "market":
      return <Market />;
    case "moderation":
      return <Moderation />;
    case "stack":
      return <Stack />;
    default: {
      const unreachable: never = view;
      return unreachable;
    }
  }
}

function roleLabel(role: (typeof profiles)[number]["role"]): string {
  switch (role) {
    case "guardian":
      return "ولي أمر";
    case "adult":
      return "بالغ";
    case "teen":
      return "يافع";
    case "child":
      return "طفل";
    default: {
      const unreachable: never = role;
      return unreachable;
    }
  }
}
