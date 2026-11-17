# Arabic Voice↔Voice Call Bot

Direct **audio in → audio out** (`POST /api/voice-turn`).

- Sensitive VAD (whispers kept)
- All skills enabled
- **No content filters / no content blocking**
- 16 Arabic female Neural voices via `edge-tts`

## Run

```bash
cd tools/voice-reader-bot
python3 -m pip install -r requirements.txt
./manage.sh start
```

Open: http://127.0.0.1:8765/

## Check

```bash
curl -fsS http://127.0.0.1:8765/api/health
# expect: path=voice-to-voice, content_filters=false
```
