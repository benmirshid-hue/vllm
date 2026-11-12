# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""الوكيل الكامل: استيعاب JSONL، ثم إعادة الإنتاج والبناء، ومفتاح محلي.

مهام النموذج تُمرَّر إلى dalil.py. المفتاح يُولَّد محلياً ولا يُرسل.
"""

import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]


def _load(name: str):
    path = HERE / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_ingest(args: argparse.Namespace) -> int:
    ingest_mod = _load("ingest_jsonl")
    try:
        stats = ingest_mod.ingest(
            args.input,
            args.output,
            dedupe=args.dedupe,
            min_chars=args.min_chars,
            max_chars=args.max_chars,
            strict=args.strict,
            keep_meta=args.keep_meta,
        )
    except (OSError, ingest_mod.IngestError) as exc:
        print(exc, file=sys.stderr)
        return 1
    print(json.dumps(stats, ensure_ascii=False))
    return 0


def _run_model(task: str, args: argparse.Namespace, extra: list[str], runner) -> int:
    cmd = [sys.executable, str(HERE / "dalil.py"), "--task", task, *extra]
    for flag, value in (
        ("--image-url", args.image_url),
        ("--audio-url", args.audio_url),
        ("--video-url", args.video_url),
    ):
        if value:
            cmd.extend([flag, value])
    return runner(cmd, cwd=REPO_ROOT)


def main(argv: list[str] | None = None, model_runner=subprocess.call) -> int:
    parser = argparse.ArgumentParser(description="الوكيل الكامل")
    parser.allow_abbrev = False
    parser.add_argument(
        "--task",
        choices=("ingest", "reproduce", "construct", "key", "all"),
        default="all",
        help="ingest للاستيعاب، all يبتلع الملف ثم يشغّل النموذج",
    )
    parser.add_argument("--input", type=Path, help="JSONL. مطلوب مع ingest")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/training-manifest.jsonl"),
        help="بيان التدريب",
    )
    parser.add_argument("--dedupe", action="store_true")
    parser.add_argument("--min-chars", type=int, default=1)
    parser.add_argument("--max-chars", type=int, default=0)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--keep-meta", action="store_true")
    parser.add_argument("--image-url", default=None)
    parser.add_argument("--audio-url", default=None)
    parser.add_argument("--video-url", default=None)
    args, extra = parser.parse_known_args(argv)

    if args.task == "key":
        return _load("generate_secret_key").main(extra)
    if extra and args.task == "ingest":
        print("وسيطات غير معروفة: " + " ".join(extra), file=sys.stderr)
        return 1
    if args.task in ("ingest", "all") and args.input is not None:
        code = _run_ingest(args)
        if code != 0 or args.task == "ingest":
            return code
    elif args.task == "ingest":
        print("يلزم --input", file=sys.stderr)
        return 1
    if args.task in ("reproduce", "construct", "all"):
        model_task = "all" if args.task == "all" else args.task
        return _run_model(model_task, args, extra, model_runner)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
