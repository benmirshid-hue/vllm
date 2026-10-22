---
name: dalil
description: >
  استخدم هذه المهارة عندما يطلب العمل دليل الوكيل العربي: إعادة إنتاج رد،
  أو بناء خطة للبناء والفيديو والصوت والصور، أو اختيار نموذج، أو توليد مفتاح محلي.
---

# دليل

اقرأ `examples/basic/offline_inference/دليل.md`.

## الأدوات

- إعادة الإنتاج والبناء الأصلي:
  `python examples/basic/offline_inference/dalil.py --task all`
- مفتاح محلي يُطبع مرة واحدة:
  `python examples/basic/offline_inference/generate_secret_key.py`
- المفتاح في ملف جديد خارج المستودع بصلاحية `0600`:
  `python examples/basic/offline_inference/generate_secret_key.py --out /tmp/vllm-api-key`

مرّر المفتاح عبر `VLLM_API_KEY` أو `--api-key` فقط. لا تحفظه داخل المستودع ولا ترسله إلى مضيف آخر.

## النماذج

| المهمة | النموذج | متى |
| --- | --- | --- |
| نص عربي على هذا الجهاز | `Qwen/Qwen2.5-0.5B-Instruct` | الافتراضي بلا وحدة رسوم |
| صورة أو فيديو | `Qwen/Qwen2.5-VL-7B-Instruct` | يحتاج ذاكرة أكبر |
| صوت | نموذج يقبل `audio_url` | لا ترفقه بالنموذج النصي |

قبل التحميل على المعالج:

```bash
export VLLM_CPU_OMP_THREADS_BIND=nobind
export VLLM_CPU_KVCACHE_SPACE=1
```
