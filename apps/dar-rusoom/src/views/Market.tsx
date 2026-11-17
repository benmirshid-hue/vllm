import { useState } from "react";
import { categories, merchants, products, profiles, type ProductCategory } from "../data.ts";
import {
  basketFitsChild,
  guardianCanPay,
  merchantById,
  productById,
  profileById,
  sar,
  splitSale,
} from "../domain.ts";
import { useStore } from "../store.tsx";

export function Market() {
  const { state, dispatch } = useStore();
  const profile = profileById(state.profileId);
  const [category, setCategory] = useState<ProductCategory | "الكل">("الكل");
  const [age, setAge] = useState<number | "الكل">("الكل");
  const [notice, setNotice] = useState("");
  const [forId, setForId] = useState(profile.role === "child" ? profile.id : "mishaal");
  const family = profiles.filter((item) => item.familyId === profile.familyId);
  const beneficiary = profileById(forId);
  const visible = products.filter((product) => {
    const categoryOk = category === "الكل" || product.category === category;
    const ageOk = age === "الكل" || (age >= product.ageMin && age <= product.ageMax);
    return categoryOk && ageOk;
  });
  const lines = Object.entries(state.cart).filter(([, qty]) => qty > 0);
  const payer = guardianCanPay(profile, beneficiary);
  const agesOk = basketFitsChild(
    beneficiary,
    lines.map(([productId]) => productId),
  );
  const provider = state.layers.payments === "enterprise" ? "ميسر" : "سجل داخلي";

  return (
    <section>
      <header className="page-head">
        <h1>المتجر</h1>
        <p>ملابس، حقائب مدرسية، أدوات مدرسية، ومستلزمات بنات. الدفع من ولي الأمر أو البالغ لنفس الأسرة، والقطعة تناسب عمر الطفل.</p>
      </header>
      <div className="filters">
        <button type="button" className={category === "الكل" ? "on" : ""} onClick={() => setCategory("الكل")}>
          الكل
        </button>
        {categories.map((item) => (
          <button key={item} type="button" className={category === item ? "on" : ""} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
        <label>
          عمر الطفل
          <select
            value={age === "الكل" ? "all" : String(age)}
            onChange={(event) => setAge(event.target.value === "all" ? "الكل" : Number(event.target.value))}
          >
            <option value="all">كل الأعمار</option>
            {[3, 6, 8, 11, 15].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="market-layout">
        <div className="product-grid">
          {visible.map((product) => {
            const merchant = merchantById(product.merchantId);
            return (
              <article key={product.id} className="product">
                <p>{product.category}</p>
                <h2>{product.name}</h2>
                <p>{product.note}</p>
                <p>
                  {product.ageLabel} سنة · {merchant.name}
                </p>
                <strong>{sar(product.priceSar)}</strong>
                <button type="button" onClick={() => dispatch({ type: "addCart", productId: product.id })}>
                  أضف لسلة الأسرة
                </button>
              </article>
            );
          })}
        </div>
        <aside className="cart">
          <h2>سلة الأسرة</h2>
          <label>
            السلة لـ
            <select value={forId} onChange={(event) => setForId(event.target.value)}>
              {family.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {lines.length === 0 ? <p>السلة فارغة.</p> : null}
          <ul>
            {lines.map(([productId, qty]) => {
              const product = productById(productId);
              const split = splitSale(product.priceSar, qty, product.commissionRate);
              return (
                <li key={productId}>
                  <b>{product.name}</b>
                  <p>
                    {qty} × {sar(product.priceSar)} = {sar(split.gross)}
                  </p>
                  <p>
                    عمولة المنصة {sar(split.platform)} · صافي {merchants.find((item) => item.id === product.merchantId)?.name}{" "}
                    {sar(split.merchant)}
                  </p>
                  <button type="button" onClick={() => dispatch({ type: "setQty", productId, qty: qty - 1 })}>
                    أنقص
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              if (!payer) {
                setNotice("الدفع من ملف ولي الأمر أو البالغ داخل الأسرة.");
                return;
              }
              if (!agesOk) {
                setNotice("قطعة خارج عمر الطفل. غيّر السلة أو اختر ملفًا أكبر.");
                return;
              }
              if (lines.length === 0) {
                setNotice("أضف قطعة أولًا.");
                return;
              }
              dispatch({ type: "checkout", forProfileId: beneficiary.id });
              setNotice(`تم تسجيل الطلب عبر ${provider}. لا توجد عملية بنكية.`);
            }}
          >
            ادفع عبر {provider}
          </button>
          {notice ? <p className="note">{notice}</p> : null}
          {state.orders[0] ? (
            <p className="note">آخر طلب: {productById(state.orders[0].productId).name} · {state.orders[0].provider}</p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
