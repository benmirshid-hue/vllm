import { type LayerKey } from "../domain.ts";
import { useStore } from "../store.tsx";

const rows: {
  key: LayerKey | "frontend" | "backend" | "mobile";
  area: string;
  foundation: string;
  enterprise: string;
  paid: string;
}[] = [
  {
    key: "frontend",
    area: "الواجهة",
    foundation: "React 19 و TypeScript و Vite، وهي التي تعمل الآن.",
    enterprise: "Vercel للواجهة على الحافة، مع Cloudflare أمام الأصول.",
    paid: "تجاري",
  },
  {
    key: "backend",
    area: "الخادم",
    foundation: "قواعد الحساب والمتابعة والسلة داخل التطبيق، جاهزة لـ Postgres.",
    enterprise: "Neon Postgres، و Clerk للحسابات.",
    paid: "تجاري",
  },
  {
    key: "video",
    area: "البث",
    foundation: "مشغّل HTML5 مخصص، وملف MP4 مفتوح مع استئناف وفصول.",
    enterprise: "Cloudflare Stream لـ HLS وجودة تتكيف وحماية الملف.",
    paid: "تجاري",
  },
  {
    key: "payments",
    area: "الدفع والمتجر",
    foundation: "سجل طلبات يقسم عمولة المنصة وصافي التاجر.",
    enterprise: "ميسر لمدى وأبل باي. النسخة هنا لا تخصم مبلغًا.",
    paid: "تجاري",
  },
  {
    key: "moderation",
    area: "مراجعة الكرتون",
    foundation: "قواعد ترفض الصورة الحية ونقص الحقوق.",
    enterprise: "Hive لفحص الإطارات، والقاعدة المحلية تبقى الحاجز الأخير.",
    paid: "تجاري",
  },
  {
    key: "analytics",
    area: "القياس",
    foundation: "سجل تشغيل وإعلان وطلب على الجهاز.",
    enterprise: "PostHog للمنتج، مع إخفاء ملفات الأطفال.",
    paid: "تجاري",
  },
  {
    key: "mobile",
    area: "الجوال",
    foundation: "الواجهة نفسها تتكيف مع عرض الجوال.",
    enterprise: "Expo يغلف الواجهة نفسها كتطبيق متجر.",
    paid: "مجاني حتى النشر",
  },
];

export function Stack() {
  const { state, dispatch } = useStore();
  const completedAds = state.adEvents.filter((event) => !event.skipped).length;

  return (
    <section>
      <header className="page-head">
        <h1>التقنية</h1>
        <p>الأساس مفتوح المصدر ويعمل الآن. الطبقة التجارية مفتاح جاهز فوقه للأداء والحماية، بلا مفاتيح سرية في هذه النسخة.</p>
      </header>
      <div className="stats">
        <article>
          <span>تشغيل</span>
          <strong>{state.plays.length}</strong>
        </article>
        <article>
          <span>إعلان مكتمل</span>
          <strong>{completedAds}</strong>
        </article>
        <article>
          <span>طلب</span>
          <strong>{state.orders.length}</strong>
        </article>
        <article>
          <span>في الطابور</span>
          <strong>{state.queue.length}</strong>
        </article>
      </div>
      <ul className="stack-list">
        {rows.map((row) => {
          const toggle = isLayer(row.key) ? state.layers[row.key] : null;
          return (
            <li key={row.area}>
              <div>
                <b>{row.area}</b>
                <p>الأساس: {row.foundation}</p>
                <p>الأعلى: {row.enterprise}</p>
              </div>
              <div className="stack-side">
                <span>{row.paid}</span>
                {toggle && isLayer(row.key) ? (
                  <LayerToggle layer={row.key} />
                ) : (
                  <span>الواجهة الحالية هي الأساس</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="credit">
        خدمة الإعلان هنا خادم المنصة نفسه: وسم «إعلان»، وسقف تخطي، وحصة قناة. مدير إعلانات غوغل يبقى لاحقًا خارج ملفات الأطفال.
      </p>
      <button type="button" onClick={() => dispatch({ type: "reset" })}>
        أعد البيانات التجريبية
      </button>
    </section>
  );
}

function LayerToggle({ layer }: { layer: LayerKey }) {
  const { state, dispatch } = useStore();
  const mode = state.layers[layer];
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "layer",
          key: layer,
          mode: mode === "foundation" ? "enterprise" : "foundation",
        })
      }
    >
      {mode === "foundation" ? "فعّل الطبقة التجارية" : "ارجع للأساس"}
    </button>
  );
}

function isLayer(key: string): key is LayerKey {
  return key === "video" || key === "payments" || key === "moderation" || key === "analytics";
}
