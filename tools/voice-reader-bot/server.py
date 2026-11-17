#!/usr/bin/env python3
"""Arabic female neural TTS + scoped service control for this bot only."""

from __future__ import annotations

import asyncio
import io
import time
from pathlib import Path
from typing import Any

import edge_tts
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

ROOT = Path(__file__).resolve().parent
DEFAULT_VOICE = "Noura"
MALE_MARKERS = (
    "Hamed",
    "Hamdan",
    "Abdullah",
    "Ali",
    "Omar",
    "Fahid",
    "Shakir",
    "Male",
)

DELIVERY_PRESETS = {
    "soft": {"rate": "-8%", "pitch": "+0Hz", "label": "ناعم"},
    "warm": {"rate": "-6%", "pitch": "+0Hz", "label": "واضح دافئ"},
    "close": {"rate": "-14%", "pitch": "+0Hz", "label": "بطيء واضح"},
    "lively": {"rate": "+5%", "pitch": "+0Hz", "label": "سريع قليلاً"},
    "calm": {"rate": "-12%", "pitch": "-1Hz", "label": "هادئ"},
}

FALLBACK_VOICES = [
    {"name": "Fatima", "id": "ar-AE-FatimaNeural", "locale": "ar-AE", "locale_name": "Arabic (United Arab Emirates)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Fatima"},
    {"name": "Laila", "id": "ar-BH-LailaNeural", "locale": "ar-BH", "locale_name": "Arabic (Bahrain)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Laila"},
    {"name": "Amina", "id": "ar-DZ-AminaNeural", "locale": "ar-DZ", "locale_name": "Arabic (Algeria)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Amina"},
    {"name": "Salma", "id": "ar-EG-SalmaNeural", "locale": "ar-EG", "locale_name": "Arabic (Egypt)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Salma"},
    {"name": "Rana", "id": "ar-IQ-RanaNeural", "locale": "ar-IQ", "locale_name": "Arabic (Iraq)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Rana"},
    {"name": "Sana", "id": "ar-JO-SanaNeural", "locale": "ar-JO", "locale_name": "Arabic (Jordan)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Sana"},
    {"name": "Noura", "id": "ar-KW-NouraNeural", "locale": "ar-KW", "locale_name": "Arabic (Kuwait)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Noura"},
    {"name": "Layla", "id": "ar-LB-LaylaNeural", "locale": "ar-LB", "locale_name": "Arabic (Lebanon)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Layla"},
    {"name": "Iman", "id": "ar-LY-ImanNeural", "locale": "ar-LY", "locale_name": "Arabic (Libya)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Iman"},
    {"name": "Mouna", "id": "ar-MA-MounaNeural", "locale": "ar-MA", "locale_name": "Arabic (Morocco)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Mouna"},
    {"name": "Aysha", "id": "ar-OM-AyshaNeural", "locale": "ar-OM", "locale_name": "Arabic (Oman)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Aysha"},
    {"name": "Amal", "id": "ar-QA-AmalNeural", "locale": "ar-QA", "locale_name": "Arabic (Qatar)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Amal"},
    {"name": "Zariyah", "id": "ar-SA-ZariyahNeural", "locale": "ar-SA", "locale_name": "Arabic (Saudi Arabia)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Zariyah"},
    {"name": "Amany", "id": "ar-SY-AmanyNeural", "locale": "ar-SY", "locale_name": "Arabic (Syria)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Amany"},
    {"name": "Reem", "id": "ar-TN-ReemNeural", "locale": "ar-TN", "locale_name": "Arabic (Tunisia)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Reem"},
    {"name": "Maryam", "id": "ar-YE-MaryamNeural", "locale": "ar-YE", "locale_name": "Arabic (Yemen)", "gender": "Female", "engine": "Microsoft Edge Neural TTS", "friendly": "Maryam"},
]

_voice_cache: dict[str, Any] = {"ts": 0.0, "voices": list(FALLBACK_VOICES)}
_voice_lock = asyncio.Lock()
_started_at = time.time()

app = FastAPI(title="Arabic Female Voice Call Bot")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def load_arabic_female_voices(force: bool = False) -> list[dict[str, str]]:
    now = time.time()
    if not force and _voice_cache["voices"] and now - _voice_cache["ts"] < 3600:
        return _voice_cache["voices"]

    async with _voice_lock:
        now = time.time()
        if not force and _voice_cache["voices"] and now - _voice_cache["ts"] < 3600:
            return _voice_cache["voices"]
        try:
            raw = await edge_tts.list_voices()
        except Exception:
            # Keep serving the known 16 Arabic female voices if catalog fetch fails.
            _voice_cache["voices"] = list(FALLBACK_VOICES)
            _voice_cache["ts"] = now
            return _voice_cache["voices"]
        voices: list[dict[str, str]] = []
        for item in raw:
            short = item.get("ShortName", "")
            locale = item.get("Locale", "")
            gender = str(item.get("Gender", "")).lower()
            if not locale.startswith("ar-") or gender != "female":
                continue
            if any(marker in short for marker in MALE_MARKERS):
                continue
            name = short.split("-")[-1].replace("Neural", "")
            voices.append(
                {
                    "name": name,
                    "id": short,
                    "locale": locale,
                    "locale_name": item.get("LocaleName", locale),
                    "gender": "Female",
                    "engine": "Microsoft Edge Neural TTS",
                    "friendly": item.get("FriendlyName", short),
                }
            )
        if not voices:
            voices = list(FALLBACK_VOICES)
        voices.sort(key=lambda v: (v["locale"], v["name"]))
        _voice_cache["voices"] = voices
        _voice_cache["ts"] = now
        return voices


def resolve_female_voice(voice: str, catalog: list[dict[str, str]]) -> dict[str, str]:
    by_name = {v["name"]: v for v in catalog}
    by_id = {v["id"]: v for v in catalog}
    chosen = by_name.get(voice) or by_id.get(voice)
    if not chosen:
        raise HTTPException(
            status_code=400,
            detail="Only Arabic female Edge Neural voices from /api/voices are allowed.",
        )
    if any(marker in chosen["id"] for marker in MALE_MARKERS):
        raise HTTPException(status_code=400, detail="Male voices are blocked.")
    return chosen


@app.on_event("startup")
async def warmup_voices() -> None:
    await load_arabic_female_voices(force=True)


@app.get("/api/health")
async def health() -> dict:
    voices = await load_arabic_female_voices()
    return {
        "ok": True,
        "engine": "edge-tts",
        "arabic_female_voice_count": len(voices),
        "default": DEFAULT_VOICE,
        "delivery_presets": list(DELIVERY_PRESETS.keys()),
        "device_voices_required": False,
        "uptime_sec": int(time.time() - _started_at),
        "scope": "tools/voice-reader-bot only",
    }


@app.get("/api/voices")
async def list_voices() -> dict:
    voices = await load_arabic_female_voices()
    return {
        "default": DEFAULT_VOICE,
        "engine": "Microsoft Edge Neural TTS via edge-tts",
        "count": len(voices),
        "device_independent": True,
        "delivery_presets": [
            {
                "id": key,
                "label": value["label"],
                "rate": value["rate"],
                "pitch": value["pitch"],
            }
            for key, value in DELIVERY_PRESETS.items()
        ],
        "voices": voices,
    }


@app.get("/api/tts")
async def tts(
    text: str = Query(..., min_length=1, max_length=1200),
    voice: str = Query(DEFAULT_VOICE),
    delivery: str = Query("warm"),
) -> Response:
    catalog = await load_arabic_female_voices()
    chosen = resolve_female_voice(voice, catalog)
    preset = DELIVERY_PRESETS.get(delivery, DELIVERY_PRESETS["warm"])
    communicate = edge_tts.Communicate(
        text=text,
        voice=chosen["id"],
        rate=preset["rate"],
        pitch=preset["pitch"],
    )
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    data = buf.getvalue()
    if not data:
        raise HTTPException(status_code=502, detail="TTS produced no audio")
    return Response(
        content=data,
        media_type="audio/mpeg",
        headers={
            "X-Voice-Id": chosen["id"],
            "X-Voice-Name": chosen["name"],
            "X-Voice-Gender": "Female",
            "X-Delivery": delivery if delivery in DELIVERY_PRESETS else "warm",
            "X-Engine": "edge-tts",
            "Access-Control-Expose-Headers": (
                "X-Voice-Id, X-Voice-Name, X-Voice-Gender, X-Delivery, X-Engine"
            ),
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/services")
async def services_status() -> dict:
    """Scoped service manager: this bot's processes/APIs only."""
    voices = await load_arabic_female_voices()
    return {
        "scope": "tools/voice-reader-bot",
        "touches_user_personal_apps": False,
        "services": [
            {
                "id": "voice-api",
                "name": "Edge TTS API",
                "status": "running",
                "engine": "edge-tts",
                "endpoint": "/api/tts",
            },
            {
                "id": "voice-catalog",
                "name": "Arabic female voice catalog",
                "status": "ready" if voices else "empty",
                "count": len(voices),
                "endpoint": "/api/voices",
            },
            {
                "id": "smart-reply",
                "name": "Smart reply (client → pollinations)",
                "status": "enabled",
                "note": "Handled in browser app.js; no local LLM process",
            },
            {
                "id": "static-ui",
                "name": "Bot UI",
                "status": "running",
                "endpoint": "/",
            },
        ],
        "uptime_sec": int(time.time() - _started_at),
    }


@app.post("/api/services/reload-voices")
async def reload_voices() -> dict:
    voices = await load_arabic_female_voices(force=True)
    return {
        "ok": True,
        "reloaded": True,
        "count": len(voices),
        "scope": "tools/voice-reader-bot voice catalog only",
    }


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/app.js")
async def app_js() -> FileResponse:
    return FileResponse(ROOT / "app.js", media_type="application/javascript")


@app.get("/styles.css")
async def styles_css() -> FileResponse:
    return FileResponse(ROOT / "styles.css", media_type="text/css")


@app.get("/public.html")
async def public_html() -> FileResponse:
    return FileResponse(ROOT / "public.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8765)
