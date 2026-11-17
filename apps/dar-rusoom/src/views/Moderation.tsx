import { useState } from "react";
import { assessSubmission, type Medium, type SubmissionInput } from "../domain.ts";
import { useStore } from "../store.tsx";

const media: Medium[] = ["animation", "anime", "hybrid", "live-action"];

export function Moderation() {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState<SubmissionInput>({
    title: "",
    medium: "animation",
    rights: true,
    rating: 7,
    notes: "",
  });
  const preview = assessSubmission(form);
  const engine =
    state.layers.moderation === "enterprise"
      ? "Hive على طبقة المراجعة التجارية، والقاعدة المحلية تبقى الحاجز الأخير."
      : "محرك القواعد المحلي: رسوم فقط، وحقوق، وتصنيف.";

  return (
    <section>
      <header className="page-head">
        <h1>المراجعة</h1>
        <p>{engine} الصورة الحية تُرفض، ولا يملك المراجع نشرها.</p>
      </header>
      <form
        className="mod-form"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: "submit", submission: form });
          setForm({ ...form, title: "", notes: "" });
        }}
      >
        <label>
          العنوان
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
        </label>
        <label>
          الوسيط
          <select
            value={form.medium}
            onChange={(event) => setForm({ ...form, medium: event.target.value as Medium })}
          >
            {media.map((item) => (
              <option key={item} value={item}>
                {mediumLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          التصنيف
          <select
            value={form.rating}
            onChange={(event) =>
              setForm({ ...form, rating: Number(event.target.value) as SubmissionInput["rating"] })
            }
          >
            {[3, 7, 13, 18].map((rating) => (
              <option key={rating} value={rating}>
                +{rating}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.rights}
            onChange={(event) => setForm({ ...form, rights: event.target.checked })}
          />
          الحقوق مثبتة
        </label>
        <label>
          وصف
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </label>
        <p className={preview.decision === "reject" ? "warn" : "note"}>
          القرار الآلي: {decisionLabel(preview.decision)}. {preview.reasons.join(" ")}
        </p>
        <button type="submit">أدخل الطابور</button>
      </form>
      <ul className="queue">
        {state.queue.map((item) => (
          <li key={item.id}>
            <div>
              <b>{item.title}</b>
              <p>
                {mediumLabel(item.medium)} · +{item.rating} · {decisionLabel(item.decision)}
              </p>
              <p>{item.reasons.join(" ")}</p>
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={item.medium === "live-action" || !item.rights}
                onClick={() => dispatch({ type: "resolve", id: item.id, decision: "approve" })}
              >
                موافقة
              </button>
              <button type="button" onClick={() => dispatch({ type: "resolve", id: item.id, decision: "reject" })}>
                رفض
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function mediumLabel(medium: Medium): string {
  switch (medium) {
    case "animation":
      return "رسوم";
    case "anime":
      return "أنمي";
    case "hybrid":
      return "مزيج";
    case "live-action":
      return "صورة حية";
    default: {
      const unreachable: never = medium;
      return unreachable;
    }
  }
}

function decisionLabel(decision: "approve" | "reject" | "review"): string {
  switch (decision) {
    case "approve":
      return "مقبول";
    case "reject":
      return "مرفوض";
    case "review":
      return "بانتظار مراجع";
    default: {
      const unreachable: never = decision;
      return unreachable;
    }
  }
}
