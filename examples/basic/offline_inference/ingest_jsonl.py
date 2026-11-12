# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""استيعاب JSONL إلى بيان تدريب: نص ومصدر فقط.

يقرأ ملفاً سطراً بسطر، ويقبل أشكال التدريب الشائعة، ويتجاوز السجلات
الفارغة. لا يرسل المحتوى إلى أي مضيف.
"""

import argparse
import json
import sys
from pathlib import Path


class IngestError(ValueError):
    """فشل الاستيعاب قبل استبدال ملف المخرج."""


def _plain_or_parts(value: object) -> str | None:
    """يعيد نصاً من سلسلة أو من قائمة أجزاء تحتوي مفتاح text."""
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    if not isinstance(value, list):
        return None
    bits: list[str] = []
    for part in value:
        if isinstance(part, str) and part.strip():
            bits.append(part.strip())
        elif isinstance(part, dict):
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                bits.append(text.strip())
    if not bits:
        return None
    return "\n".join(bits)


def _dialogue(value: object) -> str | None:
    """يجمع أدوار المحادثة في أسطر role: text."""
    if not isinstance(value, list):
        return None
    lines: list[str] = []
    for turn in value:
        if not isinstance(turn, dict):
            continue
        body = _plain_or_parts(turn.get("content"))
        if body is None:
            body = _plain_or_parts(turn.get("value"))
        if body is None:
            continue
        role = turn.get("role", turn.get("from", "user"))
        if not isinstance(role, str) or not role.strip():
            role = "user"
        lines.append(f"{role.strip()}: {body}")
    if not lines:
        return None
    return "\n".join(lines)


def _joined(item: dict, keys: tuple[str, ...]) -> str | None:
    parts = []
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    if not parts:
        return None
    return "\n\n".join(parts)


def render_text(item: dict) -> str | None:
    """يستخرج نصاً واحداً. الحقل text يسبق بقية الأشكال.

    Args:
        item: سجل JSON.

    Returns:
        النص بعد حذف الفراغ الطرفي، أو None إن لم يوجد نص.

    """
    for key in ("text", "content"):
        rendered = _plain_or_parts(item.get(key))
        if rendered:
            return rendered
    for key in ("messages", "conversations"):
        rendered = _dialogue(item.get(key))
        if rendered:
            return rendered
    for keys in (
        ("instruction", "input", "output"),
        ("prompt", "completion", "response"),
        ("question", "answer"),
    ):
        rendered = _joined(item, keys)
        if rendered:
            return rendered
    return None


def render_source(item: dict) -> str:
    """يعيد source أو dataset، وإلا unknown."""
    for key in ("source", "dataset"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "unknown"


def render_meta(item: dict) -> dict:
    """يبقي id وlang وsplit عندما تكون قيماً بسيطة."""
    meta: dict = {}
    identifier = item.get("id")
    if isinstance(identifier, str) and identifier.strip():
        meta["id"] = identifier.strip()
    elif isinstance(identifier, int) and not isinstance(identifier, bool):
        meta["id"] = identifier
    lang = item.get("lang", item.get("language"))
    if isinstance(lang, str) and lang.strip():
        meta["lang"] = lang.strip()
    split = item.get("split")
    if isinstance(split, str) and split.strip():
        meta["split"] = split.strip()
    return meta


def ingest(
    source: Path,
    output: Path,
    *,
    dedupe: bool = False,
    min_chars: int = 1,
    max_chars: int = 0,
    strict: bool = False,
    keep_meta: bool = False,
) -> dict:
    """يكتب بيان التدريب ويستبدل المخرج فقط بعد نجاح القراءة.

    Args:
        source: ملف JSONL.
        output: مسار البيان. لا يكون المجلد نفسه ولا مسار المدخل.
        dedupe: إسقاط النص المكرر بعد التنظيف.
        min_chars: أقل طول مقبول.
        max_chars: أعلى طول. الصفر يعني بلا حد.
        strict: إيقاف الكتابة عند أول سطر JSON تالف.
        keep_meta: إلحاق id وlang وsplit إن وُجدت.

    Returns:
        عدّادات تتضمن written وoutput.

    Raises:
        IngestError: مسار غير صالح، أو JSON تالف في الوضع الصارم.

    """
    if min_chars < 1:
        raise IngestError("min_chars يجب أن يكون 1 على الأقل")
    if max_chars < 0 or (max_chars and max_chars < min_chars):
        raise IngestError("max_chars غير صالح")
    src_path = source.expanduser().resolve()
    dst_path = output.expanduser().resolve()
    if not src_path.is_file():
        raise IngestError(f"المدخل ليس ملفاً: {source}")
    if dst_path == src_path or dst_path.is_dir():
        raise IngestError("المخرج يجب أن يكون ملفاً مختلفاً عن المدخل")

    counts = {
        "read": 0,
        "skipped_empty": 0,
        "skipped_invalid": 0,
        "skipped_shape": 0,
        "skipped_short": 0,
        "skipped_long": 0,
        "duplicates": 0,
        "written": 0,
    }
    sources: dict[str, int] = {}
    seen: set[str] = set()
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    partial = dst_path.with_name(dst_path.name + ".partial")
    try:
        with (
            src_path.open(encoding="utf-8-sig") as src,
            partial.open("w", encoding="utf-8") as dst,
        ):
            for lineno, line in enumerate(src, 1):
                if not line.strip():
                    counts["skipped_empty"] += 1
                    continue
                counts["read"] += 1
                try:
                    item = json.loads(line)
                except json.JSONDecodeError as exc:
                    counts["skipped_invalid"] += 1
                    if strict:
                        raise IngestError(f"سطر {lineno}: JSON غير صالح") from exc
                    continue
                if not isinstance(item, dict):
                    counts["skipped_shape"] += 1
                    continue
                text = render_text(item)
                if text is None:
                    counts["skipped_shape"] += 1
                    continue
                if len(text) < min_chars:
                    counts["skipped_short"] += 1
                    continue
                if max_chars and len(text) > max_chars:
                    counts["skipped_long"] += 1
                    continue
                if dedupe and text in seen:
                    counts["duplicates"] += 1
                    continue
                if dedupe:
                    seen.add(text)
                row = {"text": text, "source": render_source(item)}
                if keep_meta:
                    row.update(render_meta(item))
                dst.write(json.dumps(row, ensure_ascii=False) + "\n")
                counts["written"] += 1
                origin = row["source"]
                sources[origin] = sources.get(origin, 0) + 1
        partial.replace(dst_path)
    except Exception:
        partial.unlink(missing_ok=True)
        raise
    return {
        "written": counts["written"],
        "output": str(output),
        "read": counts["read"],
        "skipped_empty": counts["skipped_empty"],
        "skipped_invalid": counts["skipped_invalid"],
        "skipped_shape": counts["skipped_shape"],
        "skipped_short": counts["skipped_short"],
        "skipped_long": counts["skipped_long"],
        "duplicates": counts["duplicates"],
        "sources": sources,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="استيعاب JSONL إلى بيان تدريب")
    parser.allow_abbrev = False
    parser.add_argument("--input", required=True, type=Path, help="ملف JSONL")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/training-manifest.jsonl"),
        help="بيان التدريب",
    )
    parser.add_argument("--dedupe", action="store_true", help="إسقاط النص المكرر")
    parser.add_argument("--min-chars", type=int, default=1, help="أقل طول للنص")
    parser.add_argument(
        "--max-chars",
        type=int,
        default=0,
        help="أعلى طول. 0 بلا حد",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="التوقف عند أول سطر JSON تالف",
    )
    parser.add_argument(
        "--keep-meta",
        action="store_true",
        help="إبقاء id وlang وsplit",
    )
    args = parser.parse_args(argv)
    try:
        stats = ingest(
            args.input,
            args.output,
            dedupe=args.dedupe,
            min_chars=args.min_chars,
            max_chars=args.max_chars,
            strict=args.strict,
            keep_meta=args.keep_meta,
        )
    except (OSError, IngestError) as exc:
        print(exc, file=sys.stderr)
        return 1
    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
