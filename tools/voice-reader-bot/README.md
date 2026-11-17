# Arabic Voice↔Voice Call Bot

Direct **audio in → audio out** path (`POST /api/voice-turn`).

- Mic capture uses sensitive VAD (whispers kept; no browser SpeechRecognition gate)
- All skills enabled
- Filters mode: **all-allow** (content restrictions removed per «فك القيود»)
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
curl -fsS http://127.0.0.1:8765/api/skills
curl -fsS http://127.0.0.1:8765/api/filters
```
