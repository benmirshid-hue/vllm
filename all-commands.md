# مجموعة أوامر وكود شاملة (Windows + Bots + كتب + AI Agents)

ملف واحد يجمع أوامر عملية وأكواد بداية جاهزة للصق.
موجّه لمستخدم Windows (CMD / PowerShell).

---

## 0) تثبيت Cursor أولاً

```bat
:: تثبيت Cursor بصمت عبر winget
winget install --id Anysphere.Cursor -e --silent --accept-package-agreements --accept-source-agreements
```

```bat
:: بديل: تنزيل المثبّت ثم تثبيت صامت (x64 User)
curl -L "https://downloads.cursor.com/production/86776fcb52ca505783155631089b65d646f9b03f/win32/x64/user-setup/CursorUserSetup-x64-3.29.15.exe" -o "%TEMP%\CursorSetup.exe"
"%TEMP%\CursorSetup.exe" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
```

```bat
:: فتح Cursor بعد التثبيت
start "" "%LOCALAPPDATA%\Programs\cursor\Cursor.exe"
```

---

## 1) أوامر وبناء بوتات (Telegram / Discord / WhatsApp)

### 1.1 بيئة Python سريعة على Windows

```bat
:: تثبيت Python إن لم يكن موجوداً
winget install -e --id Python.Python.3.12

:: إنشاء مجلد المشروع
mkdir %USERPROFILE%\bots && cd /d %USERPROFILE%\bots
python -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip
```

### 1.2 بوت Telegram (python-telegram-bot)

```bat
:: تثبيت المكتبة
pip install python-telegram-bot==21.6 python-dotenv
```

```python
# telegram_echo_bot.py
# بوت تيليجرام بسيط: يرد بنفس الرسالة
import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

load_dotenv()
TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]  # ضع التوكن في ملف .env

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("مرحباً! أرسل أي نص وسأعيده لك.")

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(update.message.text or "(فارغ)")

def main() -> None:
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
```

```bat
:: تشغيل بوت تيليجرام
set TELEGRAM_BOT_TOKEN=ضع_التوكن_هنا
python telegram_echo_bot.py
```

### 1.3 بوت Discord (discord.py)

```bat
pip install discord.py==2.4.0 python-dotenv
```

```python
# discord_echo_bot.py
# بوت ديسكورد يرد على الرسائل التي تبدأ بـ !ping
import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.environ["DISCORD_BOT_TOKEN"]

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")

@bot.command()
async def ping(ctx: commands.Context):
    await ctx.send("pong")

@bot.command()
async def echo(ctx: commands.Context, *, text: str):
    await ctx.send(text)

bot.run(TOKEN)
```

```bat
set DISCORD_BOT_TOKEN=ضع_التوكن_هنا
python discord_echo_bot.py
```

### 1.4 واتساب عبر WhatsApp Cloud API (Meta) — HTTP بسيط

```bat
pip install requests
```

```python
# whatsapp_send.py
# إرسال رسالة نصية عبر WhatsApp Cloud API
import os
import requests

TOKEN = os.environ["WHATSAPP_TOKEN"]
PHONE_NUMBER_ID = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
TO = os.environ["WHATSAPP_TO"]  # مثل 9665xxxxxxxx

url = f"https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
payload = {
    "messaging_product": "whatsapp",
    "to": TO,
    "type": "text",
    "text": {"body": "مرحباً من البوت"},
}
r = requests.post(url, headers=headers, json=payload, timeout=30)
print(r.status_code, r.text)
```

### 1.5 إطار Botpress / بدائل سريعة

```bat
:: تشغيل n8n محلياً لأتمتة بوتات (اختياري)
npx n8n

:: تشغيل خادم Express بسيط كـ webhook للبوت
npm init -y
npm install express
```

```javascript
// webhook_server.js
// استقبال webhooks من تيليجرام/ميتا
const express = require("express");
const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("event:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(3000, () => console.log("listening on :3000"));
```

```bat
node webhook_server.js
```

---

## 2) أوامر Windows (CMD / PowerShell) — إدارة وتطوير

### 2.1 فحص النظام والعتاد

```bat
:: هل توجد بطاقة NVIDIA؟
nvidia-smi

:: معلومات المعالج والذاكرة
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"Total Physical Memory"

:: مساحة الأقراص
wmic logicaldisk get name,freespace,size
```

```powershell
# نفس الفحوصات من PowerShell
Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM
Get-ComputerInfo | Select-Object OsName, OsVersion, CsTotalPhysicalMemory
Get-PSDrive -PSProvider FileSystem
```

### 2.2 أدوات التطوير الأساسية

```bat
:: تثبيت أدوات شائعة
winget install -e --id Git.Git
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Python.Python.3.12
winget install -e --id Microsoft.VisualStudioCode
winget install -e --id Docker.DockerDesktop
winget install -e --id 7zip.7zip
winget install -e --id curl.curl
```

```bat
:: التحقق من الإصدارات
git --version
node -v
npm -v
python --version
docker --version
```

### 2.3 تثبيت uv (إدارة بايثون الحديثة)

```bat
:: تثبيت uv
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

:: إنشاء بيئة وتشغيل بايثون عبر uv
uv venv --python 3.12
.venv\Scripts\activate
uv pip install requests httpx
```

### 2.4 أوامر ملفات ومسارات مفيدة

```bat
:: إنشاء مجلدات المشروع
mkdir %USERPROFILE%\ai-workspace\media %USERPROFILE%\ai-workspace\ebooks %USERPROFILE%\ai-workspace\agents
cd /d %USERPROFILE%\ai-workspace

:: عرض الملفات حسب النوع
dir /s /b *.mp4
dir /s /b *.png *.jpg *.webp
dir /s /b *.pdf *.epub *.mobi

:: نسخ قائمة الروابط إلى ملف
type urls.txt
```

```powershell
# تنزيل ملف برابط مباشر
Invoke-WebRequest -Uri "https://example.com/file.mp4" -OutFile "$env:USERPROFILE\ai-workspace\media\file.mp4"

# تنزيل عدة روابط من ملف urls.txt
Get-Content .\urls.txt | ForEach-Object {
  $name = Split-Path $_ -Leaf
  Invoke-WebRequest -Uri $_ -OutFile (Join-Path "$env:USERPROFILE\ai-workspace\media" $name)
}
```

### 2.5 تجاوز مشكلة SourceForge 403 (من جهازك المنزلي)

ملاحظة: الحظر غالباً على IP السحابة/الداتاسنتر. من ويندوز المنزلي غالباً ينجح التنزيل.

```bat
:: تنزيل ملف واحد مع User-Agent متصفح
curl -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" ^
  -o "%USERPROFILE%\ai-workspace\media\sample.mp4" ^
  "https://downloads.sourceforge.net/project/video-shotcraft.mirror/gallery-media/orbit-ring-title-open.mp4"
```

```powershell
# تنزيل دفعة من ملف VIDEO_URLS_ONLY.txt
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
$out = "$env:USERPROFILE\ai-workspace\media"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Get-Content .\VIDEO_URLS_ONLY.txt | Where-Object { $_ -match '^https?://' } | ForEach-Object {
  $url = $_.Trim()
  $name = [IO.Path]::GetFileName(([Uri]$url).AbsolutePath)
  Write-Host "Downloading $name"
  curl.exe -L -A $ua --fail --retry 3 -o (Join-Path $out $name) $url
}
```

---

## 3) أوامر الكتب والـ eBooks (تنزيل / تحويل / تنظيم)

### 3.1 تثبيت الأدوات

```bat
:: Calibre = أداة تحويل وتنظيم كتب قوية (يشمل ebook-convert)
winget install -e --id Calibre.Calibre

:: Pandoc لتحويل المستندات
winget install -e --id JohnMacFarlane.Pandoc
```

### 3.2 تحويل صيغ الكتب

```bat
:: EPUB إلى PDF
ebook-convert "book.epub" "book.pdf"

:: MOBI إلى EPUB
ebook-convert "book.mobi" "book.epub"

:: Markdown إلى EPUB
pandoc "notes.md" -o "notes.epub"

:: HTML إلى PDF عبر pandoc (إن توفر محرك PDF)
pandoc "page.html" -o "page.pdf"
```

### 3.3 تنظيم مجلد الكتب

```bat
:: إنشاء هيكل منظم
mkdir %USERPROFILE%\ai-workspace\ebooks\inbox
mkdir %USERPROFILE%\ai-workspace\ebooks\epub
mkdir %USERPROFILE%\ai-workspace\ebooks\pdf
mkdir %USERPROFILE%\ai-workspace\ebooks\converted
```

```powershell
# نقل الملفات حسب الامتداد
$base = "$env:USERPROFILE\ai-workspace\ebooks"
Get-ChildItem "$base\inbox" -File | ForEach-Object {
  switch ($_.Extension.ToLower()) {
    ".epub" { Move-Item $_.FullName "$base\epub\" -Force }
    ".pdf"  { Move-Item $_.FullName "$base\pdf\" -Force }
    ".mobi" { Move-Item $_.FullName "$base\converted\" -Force }
    default { }
  }
}
```

### 3.4 استخراج نص من PDF (للتغذية إلى نموذج)

```bat
pip install pypdf
```

```python
# pdf_to_text.py
# استخراج نص من PDF لحفظه كملف txt
from pathlib import Path
from pypdf import PdfReader

src = Path("book.pdf")
reader = PdfReader(str(src))
text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
Path(src.with_suffix(".txt")).write_text(text, encoding="utf-8")
print(f"pages={len(reader.pages)} chars={len(text)}")
```

> تنبيه قانوني: نزّل/حوّل فقط الكتب التي تملك حق استخدامها أو المرخّصة مجاناً.

---

## 4) بناء وكلاء ذكاء اصطناعي (مثل Cursor) — أوامر + نفس نمط الكود

فكرة وكيل مثل Cursor باختصار:
1) يستقبل مهمة من المستخدم
2) يختار أداة (قراءة ملف / تشغيل أمر / بحث)
3) ينفّذ الأداة
4) يمرر النتيجة للنموذج
5) يكرر حتى ينتهي ثم يرد

### 4.1 تثبيت محركات محلية/سحابية

```bat
:: Ollama لتشغيل نماذج محلياً
winget install -e --id Ollama.Ollama

:: سحب وتشغيل نموذج متوسط (أفضل من 120b على جهاز عادي)
ollama pull llama3.2:3b
ollama run llama3.2:3b
```

```bat
:: ملاحظة: gpt-oss:120b و 20b يحتاجان VRAM/RAM ضخمة
:: على جهاز بدون GPU قوي استخدم نماذج صغيرة مثل 3b/8b فقط
ollama list
nvidia-smi
```

```bat
:: LM Studio CLI (إن ثبّت LM Studio)
winget search LMStudio
:: بعد التثبيت قد يتوفر الأمر lms
lms --help
```

```bat
:: Hugging Face transformers (خدمة محلية بسيطة)
pip install "transformers[serving]" torch
:: ثم (حسب إصدارك):
transformers serve
```

### 4.2 مفاتيح وبيئة للـ APIs

```bat
:: مثال إعداد مفاتيح (لا تشاركها ولا ترفعها لـ git)
setx OPENAI_API_KEY "sk-..."
setx ANTHROPIC_API_KEY "sk-ant-..."
setx GROQ_API_KEY "gsk_..."
```

```bat
pip install openai httpx rich python-dotenv
```

### 4.3 نفس نمط الكود: Agent Loop + Tools (نواة شبيهة بوكلاء Cursor)

```python
# mini_cursor_agent.py
# وكيل أدوات بسيط بنفس منطق: تفكير -> أداة -> ملاحظة -> جواب
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Callable

from openai import OpenAI

ROOT = Path.cwd()
client = OpenAI()  # يحتاج OPENAI_API_KEY أو أي مزود متوافق

SYSTEM = """أنت وكيل برمجي.
يمكنك استخدام الأدوات التالية عند الحاجة ثم الإجابة نهائياً.
أرجع JSON فقط عندما تريد أداة بالشكل:
{"tool":"read_file","args":{"path":"README.md"}}
أو {"tool":"run_cmd","args":{"command":"dir"}}
أو {"tool":"list_dir","args":{"path":"."}}
عندما تنتهي أرجع JSON:
{"final":"نص الجواب للمستخدم"}
"""


def read_file(path: str) -> str:
    p = (ROOT / path).resolve()
    if not str(p).startswith(str(ROOT.resolve())):
        return "error: path outside workspace"
    return p.read_text(encoding="utf-8", errors="replace")[:20000]


def list_dir(path: str = ".") -> str:
    p = (ROOT / path).resolve()
    items = []
    for child in sorted(p.iterdir())[:200]:
        kind = "dir" if child.is_dir() else "file"
        items.append(f"{kind}\t{child.name}")
    return "\n".join(items) or "(empty)"


def run_cmd(command: str) -> str:
    # تنبيه: لا تشغّل أوامر غير موثوقة
    completed = subprocess.run(
        command,
        shell=True,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=60,
    )
    out = (completed.stdout or "") + (completed.stderr or "")
    return out[:20000] or f"(exit {completed.returncode})"


TOOLS: dict[str, Callable[..., str]] = {
    "read_file": lambda path: read_file(path),
    "list_dir": lambda path=".": list_dir(path),
    "run_cmd": lambda command: run_cmd(command),
}


def parse_json_blob(text: str) -> dict[str, Any] | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
        return None


def agent(task: str, max_steps: int = 8) -> str:
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": task},
    ]
    for step in range(1, max_steps + 1):
        resp = client.chat.completions.create(
            model=os.getenv("AGENT_MODEL", "gpt-4.1-mini"),
            messages=messages,
            temperature=0.2,
        )
        content = resp.choices[0].message.content or ""
        messages.append({"role": "assistant", "content": content})
        data = parse_json_blob(content)
        if not data:
            return content
        if "final" in data:
            return str(data["final"])
        tool = data.get("tool")
        args = data.get("args") or {}
        if tool not in TOOLS:
            observation = f"unknown tool: {tool}"
        else:
            try:
                observation = TOOLS[tool](**args)
            except TypeError as exc:
                observation = f"bad args: {exc}"
            except Exception as exc:  # noqa: BLE001
                observation = f"tool error: {exc}"
        messages.append(
            {
                "role": "user",
                "content": f"observation (step {step}):\n{observation}",
            }
        )
    return "توقفت بعد الحد الأقصى من الخطوات."


if __name__ == "__main__":
    print(agent("اقرأ الملفات في المجلد الحالي ثم لخّص المشروع بجملتين."))
```

```bat
:: تشغيل الوكيل المصغّر
set OPENAI_API_KEY=sk-...
set AGENT_MODEL=gpt-4.1-mini
python mini_cursor_agent.py
```

### 4.4 نفس الفكرة مع Ollama محلياً (بدون مفتاح سحابي)

```python
# ollama_agent.py
# وكيل محلي عبر Ollama HTTP API
import json
import urllib.request

OLLAMA = "http://127.0.0.1:11434/api/chat"
MODEL = "llama3.2:3b"


def chat(messages):
    req = urllib.request.Request(
        OLLAMA,
        data=json.dumps({"model": MODEL, "messages": messages, "stream": False}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)["message"]["content"]


messages = [
    {"role": "system", "content": "أجب باختصار بالعربية."},
    {"role": "user", "content": "اشرح لي ما هو AI agent في 3 نقاط."},
]
print(chat(messages))
```

```bat
:: تأكد أن Ollama يعمل ثم شغّل
ollama serve
python ollama_agent.py
```

### 4.5 وكيل صوتي بسيط (Speech-to-Text ثم Agent)

```bat
pip install openai-whisper sounddevice scipy numpy
```

```python
# voice_once.py
# تسجيل ثوانٍ من المايك -> تفريغ نص -> طباعة الأمر
import sounddevice as sd
from scipy.io.wavfile import write
import whisper

fs = 16000
seconds = 5
print("تحدث الآن...")
audio = sd.rec(int(seconds * fs), samplerate=fs, channels=1, dtype="int16")
sd.wait()
write("input.wav", fs, audio)
model = whisper.load_model("base")
result = model.transcribe("input.wav", language="ar")
print("النص:", result["text"])
```

### 4.6 هيكل مشروع وكيل (موصى به)

```text
ai-workspace/
  agents/
    mini_cursor_agent.py
    ollama_agent.py
    tools/
      files.py
      shell.py
  bots/
    telegram_echo_bot.py
    discord_echo_bot.py
  ebooks/
  media/
  all-commands.md
```

```bat
mkdir %USERPROFILE%\ai-workspace\agents\tools
mkdir %USERPROFILE%\ai-workspace\bots
copy mini_cursor_agent.py %USERPROFILE%\ai-workspace\agents\
```

---

## 5) أوامر Git عملية لهذا المستودع

```bat
git status
git branch --show-current
git pull origin main
git checkout -b feature/my-change
git add .
git commit -m "Describe change"
git push -u origin HEAD
```

---

## 6) ترتيب التشغيل المقترح الآن (Windows)

```bat
:: 1) ثبّت Cursor
winget install --id Anysphere.Cursor -e --silent --accept-package-agreements --accept-source-agreements

:: 2) ثبّت أساسيات التطوير
winget install -e --id Git.Git
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS

:: 3) افحص GPU
nvidia-smi

:: 4) إن وجد GPU مناسب: ثبّت Ollama ونموذج صغير
winget install -e --id Ollama.Ollama
ollama pull llama3.2:3b

:: 5) أنشئ مجلد العمل
mkdir %USERPROFILE%\ai-workspace && cd /d %USERPROFILE%\ai-workspace
```

---

## 7) ملاحظات مهمة

- Cursor فيه خطة **Free** محدودة الاستخدام؛ الاستخدام الثقيل للـ Agent يحتاج اشتراك مدفوع.
- `gpt-oss:120b` / `20b` غير عمليين على جهاز عادي بدون VRAM كبير.
- روابط SourceForge قد تفشل بـ 403 من السحابة؛ من ويندوز المنزلي مع `curl -A "Mozilla/5.0 ..."` غالباً تعمل.
- لا تضع التوكنات داخل Git. استخدم متغيرات بيئة أو ملف `.env` محلي.

---

آخر تحديث: 2026-11-12 (توقيت Asia/Riyadh)
