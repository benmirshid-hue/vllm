# Personal Arabic Text Chat Bot

Private-to-you text conversation bot (Cursor-like chat style), Arabic-first.

## What it is

- Text chat only (no TTS / no phone-call voice mode)
- Conversation history kept in **browser localStorage** on your device
- Soft block for explicit sexual content

## Files

- `index.html` — chat UI
- `app.js` — conversation + local history
- `styles.css` — styling
- `public.html` — single-file build for phone/public preview hosting

## Open on phone

After this branch is pushed:

https://htmlpreview.github.io/?https://raw.githubusercontent.com/benmirshid-hue/vllm/cursor/voice-reader-public-d925/tools/voice-reader-bot/public.html

Write a message and tap **أرسل**.

## Note on privacy

- Chat history stays on your device (localStorage).
- Anyone with the preview URL can open the app shell, but they do not see your local history.
- For a Cursor-hosted private app, confirm Publish as **Private** in Cursor.
