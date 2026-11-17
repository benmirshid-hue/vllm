# Arabic Voice Call Bot

Voice↔voice bot with **16 Arabic female Neural voices** (`edge-tts`), Saudi natural register (Cursor call style), and smart contextual replies.

All topics allowed except **explicit sexual content**.

## Run

```bash
cd tools/voice-reader-bot
python3 -m pip install -r requirements.txt
./manage.sh start
```

Open: http://127.0.0.1:8765/

## Check

```bash
./manage.sh status
./manage.sh test-tts
curl -fsS http://127.0.0.1:8765/api/health
```

`"."` alone is not a valid TTS warmup (edge-tts returns no audio). Health must be ok; warmup uses a real word like `هلا`.

## Notes

- Default voice: `Zariyah` (ar-SA)
- Dialect: natural Saudi / Gulf white — not MSA skits
- Branch: `cursor/voice-reader-bot-d925`
