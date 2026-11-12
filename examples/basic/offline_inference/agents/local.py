# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""تنفيذ محلي لوكلاء أقطار. لا يفتح شبكة ولا يحفظ سراً داخل المستودع."""

import html
import json
import os
import re
import stat
from pathlib import Path

from catalog import StudioError

REPO_ROOT = Path(__file__).resolve().parents[4]
SECRET_FIELDS = {"pkey", "client_key", "profile-key", "profile_key"}

PALETTES = {
    "modern": ("#0f172a", "#f8fafc", "#2563eb"),
    "luxury": ("#1c1917", "#faf7f2", "#a16207"),
    "minimal": ("#111111", "#ffffff", "#444444"),
    "bold": ("#111827", "#fff7ed", "#ea580c"),
    "playful": ("#312e81", "#fdf4ff", "#db2777"),
}


def redact(value: object) -> object:
    """يخفي حقول المفاتيح في الناتج."""
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if key.casefold() in SECRET_FIELDS:
                cleaned[key] = "***"
            else:
                cleaned[key] = redact(item)
        return cleaned
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def assert_outside_repo(path: Path) -> Path:
    dest = path.expanduser().resolve()
    if dest == REPO_ROOT or REPO_ROOT in dest.parents:
        raise StudioError(f"رفض كتابة سر داخل {REPO_ROOT}")
    return dest


def _read_keys(path: Path) -> dict:
    dest = assert_outside_repo(path)
    if not dest.is_file():
        return {}
    data = json.loads(dest.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise StudioError("ملف المفاتيح تالف")
    return data


def _write_keys(path: Path, data: dict) -> None:
    dest = assert_outside_repo(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(data, ensure_ascii=False) + "\n").encode()
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    fd = os.open(dest, flags, 0o600)
    try:
        os.write(fd, payload)
        os.fchmod(fd, 0o600)
    finally:
        os.close(fd)
    mode = stat.S_IMODE(dest.stat().st_mode)
    if mode != 0o600:
        dest.unlink()
        raise StudioError(f"الصلاحية المتوقعة 0600، والناتج {mode:o}")


def _esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def _arabic(lang: object) -> bool:
    text = str(lang or "").casefold()
    return text in {"arabic", "ar", "العربية"}


def _whatsapp(contact: str) -> str:
    match = re.search(r"\+?\d[\d\s\-()]{7,}\d", contact)
    if not match:
        return ""
    digits = re.sub(r"\D", "", match.group(0))
    return digits if len(digits) >= 8 else ""


def _email(contact: str) -> str:
    match = re.search(r"[\w.+\-]+@[\w.\-]+\.\w{2,}", contact)
    return match.group(0) if match else ""


def _palette(style: object) -> tuple[str, str, str]:
    return PALETTES.get(str(style or "modern"), PALETTES["modern"])


def render_page(fields: dict) -> tuple[str, str]:
    """يبني صفحة واحدة بلا صور خارجية وبلا أرقام أو شهادات مخترعة."""
    lang = str(fields.get("lang") or "Arabic")
    rtl = _arabic(lang)
    business = str(fields.get("business") or fields.get("idea") or "المشروع")
    goal = str(fields.get("goal") or "تواصل")
    contact = str(fields.get("contact") or "")
    kind = str(fields.get("kind") or "landing_page")
    ink, paper, accent = _palette(fields.get("style"))
    title = business.split("\n", 1)[0][:80] or "صفحة"
    direction = "rtl" if rtl else "ltr"
    language = "ar" if rtl else "en"
    phone = _whatsapp(contact)
    mail = _email(contact)
    tel = f'<a href="tel:{_esc(phone)}">{_esc(phone)}</a>' if phone else ""
    mail_link = f'<a href="mailto:{_esc(mail)}">{_esc(mail)}</a>' if mail else ""
    float_wa = ""
    if phone:
        float_wa = f'<a class="wa" href="https://wa.me/{_esc(phone)}">واتساب</a>'
    store = ""
    if kind == "online_store":
        store = (
            '<section id="shop"><h2>المنتجات</h2>'
            "<p>أضف الاسم والسعر لاحقاً. لا تُعرض أسعار مخترعة.</p>"
            '<button type="button" id="cart">السلة: <span>0</span></button>'
            "</section>"
        )
    page = f"""<!DOCTYPE html>
<html lang="{language}" dir="{direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_esc(title)}</title>
<meta name="description" content="{_esc(goal)}">
<style>
:root {{ color-scheme: light; }}
body {{ margin:0; font-family:sans-serif; background:{paper}; color:{ink}; }}
header, main, footer {{ padding:1rem; max-width:48rem; margin:auto; }}
header {{ position:sticky; top:0; background:{paper}; display:flex;
  justify-content:space-between; align-items:center; }}
nav a, button, .wa {{ min-height:44px; min-width:44px; }}
a {{ color:{accent}; }}
.wa {{ position:fixed; bottom:1rem; inset-inline-end:1rem;
  background:{accent}; color:#fff; padding:.75rem; text-decoration:none; }}
#menu {{ display:none; }}
#menu.open {{ display:block; }}
</style>
</head>
<body>
<header>
  <strong>{_esc(title)}</strong>
  <button type="button" id="burger" aria-expanded="false">القائمة</button>
</header>
<nav id="menu">
  <a href="#hero">البداية</a>
  <a href="#benefits">الفائدة</a>
  <a href="#steps">الخطوات</a>
  <a href="#trust">الثقة</a>
  <a href="#faq">الأسئلة</a>
  <a href="#form">تواصل</a>
</nav>
<main>
<section id="hero"><h1>{_esc(business)}</h1><p>{_esc(goal)}</p></section>
<section id="benefits"><h2>ماذا يقدّم</h2><p>{_esc(business)}</p></section>
<section id="steps"><h2>كيف يعمل</h2>
  <ol><li>توضّح الطلب</li><li>نراجع التفاصيل</li><li>نتواصل معك</li></ol>
</section>
{store}
<section id="trust"><h2>التزام</h2>
  <p>نعرض فقط ما ورد في وصف النشاط، بلا أرقام أو أسماء مخترعة.</p>
</section>
<section id="faq"><h2>أسئلة</h2>
  <details><summary>كيف أتواصل؟</summary><p>{tel} {mail_link}</p></details>
</section>
<section id="form"><h2>طلب</h2>
  <form id="lead">
    <label>الاسم <input name="name" required></label>
    <label>الجوال <input name="phone" required></label>
    <label>الرسالة <textarea name="message" required></textarea></label>
    <button type="submit">إرسال</button>
  </form>
  <p id="thanks" hidden>وصلت رسالتك.</p>
</section>
</main>
<footer>© <span id="y"></span> {_esc(title)} {tel} {mail_link}</footer>
{float_wa}
<script>
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
burger.addEventListener("click", () => {{
  const open = menu.classList.toggle("open");
  burger.setAttribute("aria-expanded", open ? "true" : "false");
}});
document.getElementById("y").textContent = new Date().getFullYear();
const cart = document.getElementById("cart");
if (cart) {{
  let count = 0;
  cart.addEventListener("click", () => {{
    count += 1;
    cart.querySelector("span").textContent = String(count);
  }});
}}
document.getElementById("lead").addEventListener("submit", (event) => {{
  event.preventDefault();
  const data = new FormData(event.target);
  const text = ["الاسم","الجوال","الرسالة"].map((label, index) => {{
    const key = ["name","phone","message"][index];
    return label + ": " + data.get(key);
  }}).join("\\n");
  const phone = {json.dumps(phone)};
  const mail = {json.dumps(mail)};
  if (phone) {{
    location.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
  }} else if (mail) {{
    location.href = "mailto:" + mail + "?body=" + encodeURIComponent(text);
  }} else {{
    document.getElementById("thanks").hidden = false;
  }}
}});
</script>
</body>
</html>
"""
    return title, page


def page_generator(fields: dict, _keys: Path | None) -> dict:
    title, page = render_page(fields)
    return {"title": title, "html": page}


def build_studio(fields: dict, keys: Path | None) -> dict:
    idea = str(fields.get("idea") or "")
    kind = str(fields.get("kind") or "website")
    style = str(fields.get("style") or "modern")
    lang = str(fields.get("lang") or "Arabic")
    contact = str(fields.get("contact") or "")
    plan = "\n".join(
        [
            f"# خطة {kind}",
            "- الجمهور: من وصف الفكرة",
            f"- اللغة: {lang}",
            f"- الأسلوب: {style}",
            f"- التواصل: {contact}",
            "## الصفحات",
            "- البداية، الفائدة، الخطوات، الثقة، الأسئلة، نموذج التواصل",
            "## الفكرة",
            idea,
        ]
    )
    page_fields = {
        "business": idea,
        "goal": kind,
        "style": style,
        "contact": contact,
        "lang": lang,
        "kind": kind,
    }
    title, page = render_page(page_fields)
    result = page_generator(page_fields, keys)
    result["title"] = title
    result["html"] = page
    result["project_plan"] = plan
    return result


def _clamp_seconds(value: object) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = 10
    return min(30, max(5, number))


def _scenes(idea: str, seconds: int) -> list[str]:
    beats = (
        "opening",
        "meeting",
        "rising action",
        "turn",
        "climax",
        "ending",
    )
    scenes = []
    for index, beat in enumerate(beats, 1):
        scenes.append(
            f"Scene {index}, {seconds}s, {beat}. Same characters and light. {idea}"
        )
    return scenes


def video_plan(fields: dict, label: str) -> dict:
    idea = str(
        fields.get("prompt") or fields.get("site_text") or fields.get("extra") or ""
    )
    seconds = _clamp_seconds(fields.get("scene_seconds", 10))
    return {
        "video": None,
        "total_seconds": seconds * 6,
        "scenes": _scenes(idea, seconds),
        "aspect_ratio": fields.get("aspect_ratio") or "16:9",
        "resolution": fields.get("resolution") or "720p",
        "generate_audio": bool(fields.get("generate_audio", True)),
        "note": f"{label}: الخطة جاهزة ولم يُرسل طلب توليد.",
    }


def video_studio(fields: dict, _keys: Path | None) -> dict:
    return video_plan(fields, "استوديو الفيديو")


def site_to_video(fields: dict, _keys: Path | None) -> dict:
    return video_plan(fields, "موقع إلى فيديو")


def image_to_video(fields: dict, _keys: Path | None) -> dict:
    plan = video_plan(fields, "صورة إلى فيديو")
    plan["image"] = None
    return plan


def edit_video(fields: dict, _keys: Path | None) -> dict:
    return video_plan(fields, "تعديل فيديو")


def edit_image(fields: dict, _keys: Path | None) -> dict:
    return {
        "image": None,
        "prompt": str(fields.get("prompt") or ""),
        "note": "تعديل الصورة جاهز كوصف ولم تُرفع الصورة.",
    }


def _captions(fields: dict) -> dict:
    client = str(fields.get("client") or "Client")
    brief = str(fields.get("brief") or "").strip()
    words = re.findall(r"\w+", client, flags=re.UNICODE)[:3]
    tags = [f"#{word}" for word in words]
    tags.append("#نشر")
    hashtags = " ".join(tags[:5])
    short = (brief or client)[:250]
    long_caption = f"{brief}\n{hashtags}".strip()
    return {
        "sent": False,
        "x_result": {"platforms": ["twitter"], "post": short, "mediaUrls": []},
        "instagram_facebook_result": {
            "platforms": ["instagram", "facebook"],
            "post": long_caption,
            "mediaUrls": [],
        },
        "video_platforms_result": {
            "platforms": ["tiktok", "youtube", "snapchat"],
            "post": long_caption,
            "youTubeOptions": {"title": short[:90]},
            "mediaUrls": [],
        },
        "image_prompt": f"Square social image, no text, for {client}: {brief}",
        "video_prompt": (
            f"8 second vertical video, motion and mood, for {client}: {brief}"
        ),
    }


def auto_publisher(fields: dict, _keys: Path | None) -> dict:
    return _captions(fields)


def key_issuer(fields: dict, keys: Path | None) -> dict:
    if keys is None:
        raise StudioError("يلزم --keys خارج المستودع")
    client_key = str(fields.get("client_key") or "").strip()
    pkey = str(fields.get("pkey") or "").strip()
    if not client_key or not pkey:
        raise StudioError("يلزم مفتاح العميل ومفتاح الملف الشخصي")
    data = _read_keys(keys)
    data[f"client:{client_key}"] = pkey
    _write_keys(keys, data)
    return {"registered": client_key}


def service_maestro(fields: dict, keys: Path | None) -> dict:
    if keys is None:
        raise StudioError("يلزم --keys خارج المستودع")
    client_key = str(fields.get("client_key") or "")
    service = str(fields.get("service") or "publisher")
    stored = _read_keys(keys).get(f"client:{client_key}", "")
    if stored == "":
        return {
            "x_result": None,
            "instagram_facebook_result": None,
            "video_platforms_result": None,
            "error": "Invalid or inactive service key",
        }
    if service != "publisher":
        return {
            "x_result": None,
            "instagram_facebook_result": None,
            "video_platforms_result": None,
            "error": "Unknown service name",
        }
    published = _captions(
        {
            "client": fields.get("client") or "Client",
            "brief": fields.get("brief") or "",
            "lang": fields.get("lang") or "Arabic",
        }
    )
    published["error"] = ""
    return published


def contract_drafter(fields: dict, _keys: Path | None) -> dict:
    party_a = str(fields.get("party_a") or "الطرف الأول")
    party_b = str(fields.get("party_b") or "الطرف الثاني")
    kind = str(fields.get("contract_type") or "service")
    terms = str(fields.get("terms") or "")
    text = "\n".join(
        [
            f"مسودة عقد {kind}",
            f"الطرف الأول: {party_a}",
            f"الطرف الثاني: {party_b}",
            "البنود:",
            terms or "تُستكمل البنود من الطرفين.",
            "التوقيع: ________",
        ]
    )
    return {
        "contract_text": text,
        "notes": "مسودة فقط وتحتاج مراجعة محامٍ قبل التوقيع.",
    }


def ledger(fields: dict, _keys: Path | None) -> dict:
    entry = str(fields.get("entry") or "")
    owner = str(fields.get("owner") or "")
    match = re.search(r"\d+(?:[.,]\d+)?", entry)
    amount = match.group(0) if match else ""
    category = "عام"
    for word, label in (("إيجار", "إيجار"), ("راتب", "راتب"), ("بيع", "بيع")):
        if word in entry:
            category = label
    note = "المبلغ غير واضح" if not amount else "راجع التصنيف قبل الاعتماد"
    return {
        "title": owner or "قيد",
        "amount": amount,
        "category": category,
        "summary": entry,
        "review_note": note,
    }


def notebook(fields: dict, _keys: Path | None) -> dict:
    source = str(fields.get("source") or "").strip()
    task = str(fields.get("task") or "summary")
    sentences = [part.strip() for part in re.split(r"[.!\n؟]+", source) if part.strip()]
    head = sentences[:3] or [source]
    if task == "quiz":
        body = "\n".join(f"- سؤال عن: {line}" for line in head)
    elif task == "key_ideas":
        body = "\n".join(f"- {line}" for line in head)
    elif task == "marketing_post":
        body = (head[0] if head else source)[:250]
    else:
        body = "\n".join(head)
    return {"result": body, "task": task}


HANDLERS = {
    "build-studio": build_studio,
    "page-generator": page_generator,
    "service-maestro": service_maestro,
    "auto-publisher": auto_publisher,
    "auto-publisher-v7": auto_publisher,
    "site-to-video": site_to_video,
    "video-studio": video_studio,
    "key-issuer": key_issuer,
    "image-to-video": image_to_video,
    "edit-video": edit_video,
    "edit-image": edit_image,
    "contract-drafter": contract_drafter,
    "ledger": ledger,
    "notebook": notebook,
}
