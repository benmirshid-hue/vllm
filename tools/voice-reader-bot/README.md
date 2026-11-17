# Voice Reader Bot

Local browser voice reader with a **noticeably feminine**, warm, calm delivery.

## Limits

- Reads user-provided text aloud.
- **Does not** support unrestricted or sexual/explicit content.
- Explicit sexual phrases are blocked in `app.js`.

## Location

`/workspace/tools/voice-reader-bot/`

Files:

- `index.html` — UI
- `styles.css` — styling
- `app.js` — speech synthesis + feminine voice preference + content guard
- `README.md` — this file

## Run / hear the demo

From this folder:

```bash
python3 -m http.server 8765 --bind 0.0.0.0
```

Then open:

`http://127.0.0.1:8765/`

in **Chrome** or **Edge** (best Web Speech support).

1. Click **عرض تجريبي** for the playable demo.
2. Allow audio if the browser asks.
3. You should hear a strongly feminine, warm, slower voice with short breath pauses between sentences.
4. Or paste any non-explicit text and click **قراءة**.

## Voice character

- Prefers feminine-labeled system voices when available.
- Demo pitch `1.55` and rate `0.84` for a clearly more feminine, calm delivery.
- Soft breath + ~700ms pause between sentences.
- Explicit sexual content remains blocked.
