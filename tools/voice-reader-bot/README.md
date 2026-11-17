# Arabic Voice Call Bot

Voice↔voice bot with **16 Arabic female Neural voices** (`edge-tts`), voice picker, and smart contextual replies.

No sexual content. No flirtation.

## Run

```bash
cd tools/voice-reader-bot
python3 -m pip install -r requirements.txt
./manage.sh start
```

Open: http://127.0.0.1:8765/

## Direct bot page

Open the bot UI (not the GitHub folder):

https://htmlpreview.github.io/?https://raw.githubusercontent.com/benmirshid-hue/vllm/cursor/voice-reader-public-d925/tools/voice-reader-bot/public.html

Local full TTS (edge-tts): http://127.0.0.1:8765/

## Project links

- Folder: https://github.com/benmirshid-hue/vllm/tree/cursor/voice-reader-public-d925/tools/voice-reader-bot
- Pull request: https://github.com/benmirshid-hue/vllm/pull/8

## Check

```bash
./manage.sh status
./manage.sh test-tts
```
