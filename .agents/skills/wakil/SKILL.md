---
name: wakil
description: >
  استخدم هذه المهارة عندما يطلب العمل الوكيل الكامل: استيعاب JSONL إلى
  بيان تدريب، أو إعادة إنتاج رد عربي وبناء خطة، أو توليد مفتاح محلي.
---

# الوكيل الكامل

اقرأ `examples/basic/offline_inference/وكيل.md`.

## الأدوات

- الاستيعاب ثم النموذج:
  `python examples/basic/offline_inference/wakil.py --task all --input corpus.jsonl --dedupe`
- الاستيعاب وحده:
  `python examples/basic/offline_inference/wakil.py --task ingest --input corpus.jsonl`
- مفتاح محلي خارج المستودع بصلاحية `0600`:
  `python examples/basic/offline_inference/wakil.py --task key --out /tmp/vllm-api-key`

لا تحفظ المفتاح داخل المستودع ولا ترسل البيان أو المفتاح إلى مضيف آخر.

فهرس الوكلاء الخمسة والثلاثين وتشغيلهم المحلي:

[agents/README.md](../../../examples/basic/offline_inference/agents/README.md)

## النماذج

تفاصيل النموذج والوسائط في دليل إعادة الإنتاج:

[دليل.md](../../../examples/basic/offline_inference/دليل.md)

قبل التحميل على المعالج:

```bash
export VLLM_CPU_OMP_THREADS_BIND=nobind
export VLLM_CPU_KVCACHE_SPACE=1
```
