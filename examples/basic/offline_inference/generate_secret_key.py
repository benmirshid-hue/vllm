# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""دليل: توليد مفتاح واجهة محلي.

يُطبع المفتاح مرة واحدة، أو يُكتب في ملف جديد خارج المستودع بصلاحية 0600.
لا يُرسل إلى أي مكان، ولا يُضاف إلى المستودع.
"""

import argparse
import os
import secrets
import stat
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIN_NBYTES = 16


def generate_key(nbytes: int = 32) -> str:
    """يُعيد مفتاحاً بطول عشوائي لا يقل عن 128 بتاً."""
    if nbytes < MIN_NBYTES:
        raise ValueError(f"nbytes يجب أن يكون {MIN_NBYTES} على الأقل")
    return secrets.token_urlsafe(nbytes)


def assert_outside_repo(path: Path) -> Path:
    """يرفض الكتابة داخل المستودع."""
    dest = path.expanduser().resolve()
    if dest == REPO_ROOT or REPO_ROOT in dest.parents:
        raise ValueError(f"رفض كتابة سر داخل {REPO_ROOT}")
    return dest


def write_private(path: Path, key: str) -> None:
    """ينشئ ملفاً جديداً بصلاحية 0600. لا يستبدل ملفاً موجوداً."""
    dest = assert_outside_repo(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(dest, flags, 0o600)
    try:
        os.write(fd, (key + "\n").encode())
    finally:
        os.close(fd)
    mode = stat.S_IMODE(dest.stat().st_mode)
    if mode != 0o600:
        dest.unlink()
        raise RuntimeError(f"الصلاحية المتوقعة 0600، والناتج {mode:o}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="توليد مفتاح واجهة محلي")
    parser.add_argument("--nbytes", type=int, default=32, help="عدد البايتات العشوائية")
    parser.add_argument(
        "--out",
        type=Path,
        help="كتابة المفتاح في ملف جديد خارج المستودع",
    )
    parser.add_argument(
        "--shell",
        action="store_true",
        help="طباعة سطر export لمتغير VLLM_API_KEY",
    )
    args = parser.parse_args(argv)
    try:
        key = generate_key(args.nbytes)
        if args.out is not None:
            write_private(args.out, key)
            print(f"كُتب {args.out.expanduser().resolve()} بصلاحية 0600.")
            return 0
    except (ValueError, FileExistsError, RuntimeError) as exc:
        print(exc, file=sys.stderr)
        return 1
    if args.shell:
        print(f"export VLLM_API_KEY={key}")
    else:
        print(key)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
