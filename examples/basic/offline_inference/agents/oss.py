# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""جرد موزيلا وHeyGen، واتصال llamafile على الجهاز فقط."""

import http.client
import json
import os
from pathlib import Path

from catalog import StudioError

LOOPBACK = "127.0.0.1"
DEFAULT_PORT = 8080
WINDOWS_SERVE = (
    r'"%USERPROFILE%\mozilla\ai\bin\llamafile.exe" '
    r'-m "%USERPROFILE%\mozilla\ai\models\model.gguf" '
    r"--server --port 8080"
)

HEYGEN_OPEN = (
    {
        "name": "HyperFrames",
        "license": "Apache-2.0",
        "url": "https://github.com/heygen-com/hyperframes",
    },
    {
        "name": "HeyGen Skills",
        "license": "MIT",
        "url": "https://github.com/heygen-com/skills",
    },
    {
        "name": "auto-model-optim",
        "license": None,
        "url": "https://github.com/heygen-com/auto-model-optim",
    },
    {
        "name": "hyperframes-launches",
        "license": "Apache-2.0",
        "url": "https://github.com/heygen-com/hyperframes-launches",
    },
    {
        "name": "LiveAvatar Web SDK",
        "license": "MIT",
        "url": "https://github.com/heygen-com/liveavatar-web-sdk",
    },
    {
        "name": "LiveAvatar Agent Skills",
        "license": "MIT",
        "url": "https://github.com/heygen-com/liveavatar-agent-skills",
    },
)

HEYGEN_CLOSED = (
    "MCP",
    "API",
    "Video Agent",
    "Avatar V",
    "Voice",
)


def loopback_host() -> str:
    """المضيف الوحيد المسموح. متغيرات البيئة لا تغيّره."""
    return LOOPBACK


def _home_ai() -> Path:
    return Path.home() / "mozilla" / "ai"


def llamafile_binary() -> Path:
    override = os.environ.get("LLAMAFILE_BIN")
    if override:
        return Path(override).expanduser()
    name = "llamafile.exe" if os.name == "nt" else "llamafile"
    return _home_ai() / "bin" / name


def llamafile_model() -> Path:
    override = os.environ.get("LLAMAFILE_MODEL")
    if override:
        return Path(override).expanduser()
    return _home_ai() / "models" / "model.gguf"


def llamafile_port() -> int:
    raw = os.environ.get("LLAMAFILE_PORT", str(DEFAULT_PORT))
    try:
        port = int(raw)
    except ValueError as exc:
        raise StudioError("منفذ llamafile غير صالح") from exc
    if port < 1 or port > 65535:
        raise StudioError("منفذ llamafile غير صالح")
    return port


def serve_argv(port: int | None = None) -> list[str]:
    """الأمر نفسه الذي في ملف bat: الملف، -m، النموذج، --server، --port."""
    chosen = llamafile_port() if port is None else port
    return [
        str(llamafile_binary()),
        "-m",
        str(llamafile_model()),
        "--server",
        "--port",
        str(chosen),
    ]


def _mozilla() -> list[dict]:
    binary = llamafile_binary()
    model = llamafile_model()
    whisper_name = "whisperfile.exe" if os.name == "nt" else "whisperfile"
    whisper = _home_ai() / "bin" / whisper_name
    ready = binary.is_file() and model.is_file()
    return [
        {
            "modality": "text",
            "tool": "llamafile",
            "status": "local",
            "ready": ready,
            "license": "Apache-2.0",
            "note": (
                "الخادم محلي. أصغر ملف جاهز Qwen3.5 0.8B وليس نموذجاً عربياً من موزيلا."
            ),
        },
        {
            "modality": "speech-to-text",
            "tool": "whisperfile",
            "status": "local",
            "ready": whisper.is_file(),
            "license": "MIT",
            "note": "كلام إلى نص. Common Voice العربي مجموعة بيانات CC0 وليس نموذجاً.",
        },
        {
            "modality": "image-understanding",
            "tool": "llamafile --image",
            "status": "local",
            "ready": False,
            "license": "Apache-2.0",
            "note": "وصف صورة محلية عند وجود نموذج رؤية. لا يولّد صورة.",
        },
        {
            "modality": "image-generation",
            "tool": None,
            "status": "unavailable",
            "ready": False,
            "note": "llamafile عند موزيلا لا يولّد صوراً.",
        },
        {
            "modality": "video-generation",
            "tool": None,
            "status": "unavailable",
            "ready": False,
            "note": "لا مولّد فيديو محلي من موزيلا. خدمات الفيديو المستضافة لا تُستدعى.",
        },
    ]


def inventory() -> dict:
    """ما يعمل محلياً، وما هو مفتوح عند HeyGen، وما يبقى مغلقاً."""
    return {
        "mozilla": _mozilla(),
        "llamafile": {
            "command": serve_argv(),
            "windows": WINDOWS_SERVE,
            "host": loopback_host(),
        },
        "heygen_open": [
            {**item, "status": "open", "called": False} for item in HEYGEN_OPEN
        ],
        "heygen_closed": [
            {"name": name, "status": "closed", "called": False}
            for name in HEYGEN_CLOSED
        ],
    }


def complete(text: str, port: int | None = None) -> dict:
    """يرسل النص إلى خادم llamafile على 127.0.0.1 فقط."""
    chosen = llamafile_port() if port is None else port
    if chosen < 1 or chosen > 65535:
        raise StudioError("منفذ llamafile غير صالح")
    payload = json.dumps(
        {
            "model": llamafile_model().name,
            "messages": [{"role": "user", "content": text}],
        }
    ).encode()
    connection = http.client.HTTPConnection(loopback_host(), chosen, timeout=5)
    try:
        connection.request(
            "POST",
            "/v1/chat/completions",
            body=payload,
            headers={"Content-Type": "application/json"},
        )
        response = connection.getresponse()
        raw = response.read()
        status = response.status
    except OSError as exc:
        raise StudioError("خادم llamafile غير شغّال على 127.0.0.1") from exc
    finally:
        connection.close()
    if status != 200:
        raise StudioError(f"llamafile أعاد {status}")
    try:
        body = json.loads(raw.decode())
        answer = body["choices"][0]["message"]["content"]
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        raise StudioError("رد llamafile غير مفهوم") from exc
    return {"text": answer, "host": loopback_host(), "port": chosen}
