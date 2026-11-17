# Arabic Voice Call Bot

Voice↔voice bot with **edge-tts** (16 Arabic female Neural voices), smart contextual replies, and a **scoped service manager**.

## Features

1. Voice↔voice via mic + `edge-tts` (no device Arabic voices needed)
2. Smart contextual replies
3. Service control limited to this folder (`manage.sh`, `/api/services`)
4. No flirtation/seduction; explicit sexual content blocked

## Run

```bash
cd tools/voice-reader-bot
python3 -m pip install -r requirements.txt
./manage.sh start
./manage.sh status
./manage.sh test-tts
```

Open `http://127.0.0.1:8765/`

Stop: `./manage.sh stop`
