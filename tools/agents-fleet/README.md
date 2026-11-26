# أسطول الوكلاء الذاتي (Planner / Coder / Reviewer / Sandbox)

محرك محلي معزول عن نواة vLLM. يخطط، يكتب داخل `workspace/` فقط، يراجع الفوارق، ثم يشغّل اختبارات الوحدة.

هذا الأسطول غير فهرس الوكلاء الخمسة والثلاثين في `examples/basic/offline_inference/agents/`. لا يفتح شبكة، ولا يستدعي Cursor CLI، ولا يكتب خارج مجلد العمل.

المهمة الافتراضية: مصادقة سحابية مع عزل المستأجر (`tenant_id` على كل سجل) وتدقيق أمني يرفض `eval`/`exec` والأسرار المضمّنة.

## التشغيل

من Linux أو macOS:

```bash
python tools/agents-fleet/agents_fleet_engine.py
python tools/agents-fleet/agents_fleet_engine.py --mode planner
python tools/agents-fleet/agents_fleet_engine.py --mode coders
python tools/agents-fleet/agents_fleet_engine.py --mode reviewer
python tools/agents-fleet/agents_fleet_engine.py --mode sandbox
```

من Windows، شغّل `tools\agents-fleet\run_agents_fleet.bat` واختر من القائمة، أو:

```bat
python tools\agents-fleet\agents_fleet_engine.py --mission "هدفك هنا"
```

`--workdir` يقيّد الكتابة. الافتراضي `tools/agents-fleet/workspace/` (غير متتبَّع في git).

## الاختبار

```bash
python tools/agents-fleet/test_agents_fleet.py
```

الاختبار يولّد المعمارية في مجلد مؤقت ويتأكد أن مستأجراً لا يقرأ جلسة مستأجر آخر.
