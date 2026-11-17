# كل الوكلاء

الفهرس `INDEX_all_35_agents.json` فيه 35 وكيلاً. رسوم AutoGPT الخمسة المستوردة في `graphs/`:

- `build_studio.json` استوديو البناء
- `page_generator.json` مولّد الصفحة
- `service_maestro.json` مايسترو الخدمة
- `auto_publisher.json` الناشر
- `video_studio.json` استوديو الفيديو

النسخ المكررة من الملفات نفسها لم تُضف مرة ثانية.

## التشغيل

```bash
python examples/basic/offline_inference/agents/studio.py list
python examples/basic/offline_inference/agents/studio.py show page-generator
python examples/basic/offline_inference/agents/studio.py run page-generator \
  --set business="مقهى" --set contact="واتساب 966500000000"
```

الوكلاء ذات `kind=local` تُنتج ناتجها على هذا الجهاز: صفحة، خطة بناء، مسودة عقد، قيد، دفتر، خطة فيديو من ستة مشاهد، أو بطاقة نشر. `kind=external` يتحقق من المدخلات ويعيد البطاقة جاهزة من غير فتح اتصال. `kind=empty` رسم بلا عقد.

النشر إلى المنصات، وتوليد الصورة والفيديو، والبريد، والخرائط، ويوتيوب، ووردبريس لا تُستدعى من هنا. الناتج يحمل `sent: false` عندما يكون الناشر. مفاتيح العملاء تُكتب بـ `--keys` في ملف خارج المستودع بصلاحية `0600`، ولا تُطبع في الناتج.

## موزيلا على هذا الجهاز

النص يمر عبر خادم llamafile على `127.0.0.1` فقط. أمر ويندوز:

```bat
"%USERPROFILE%\mozilla\ai\bin\llamafile.exe" -m "%USERPROFILE%\mozilla\ai\models\model.gguf" --server --port 8080
```

```bash
python examples/basic/offline_inference/agents/studio.py inventory
python examples/basic/offline_inference/agents/studio.py serve
python examples/basic/offline_inference/agents/studio.py ask --text "أجب بالعربية: مرحبا"
```

`inventory` يفرّق ما يعمل محلياً. llamafile وwhisperfile محليان. توليد الصورة وتوليد الفيديو غير متاحين من موزيلا. أصغر ملف جاهز عندهم Qwen3.5 0.8B، وهو ليس نموذجاً عربياً من صنع موزيلا.

من HeyGen، المفتوح للتأليف هو HyperFrames برخصة Apache-2.0، والمهارات وLiveAvatar SDK مفتوحة كذلك. الاستوديو لا يستدعيها. MCP وAPI وVideo Agent وAvatar V وVoice مغلقة ولا تُستدعى.
