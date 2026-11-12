# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""فهرس الوكلاء الخمسة والثلاثين وتصنيف ما يُنفَّذ محلياً."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX_PATH = ROOT / "INDEX_all_35_agents.json"

SLUG_BY_GRAPH = {
    "73e521fc-081a-4b3a-81ad-9161d77b410a": "build-studio",
    "305e0dd5-3d8b-4084-adbc-fede6e3a71d8": "page-generator",
    "614ce970-58b4-42a3-b0ed-e8850a88b917": "service-maestro",
    "ded64c44-994b-4d78-913c-e2a80f04e754": "auto-publisher",
    "1b7ac947-5a52-4b0b-852a-8c6a5a46d979": "site-to-video",
    "d212d957-8203-4548-a604-689af90740cd": "video-studio",
    "275886d8-80de-43fa-a75f-460e764802fb": "key-issuer",
    "7cc4b50d-c32c-41a7-a0a0-f9697f640f51": "image-to-video",
    "6776633f-e510-4d1c-b15c-992ec828af69": "edit-video",
    "2f8547a6-6e3f-4b32-bbc7-cffcf510f940": "edit-image",
    "dcc1458a-cbee-4f63-829f-ea8de3924630": "contract-drafter",
    "bd1f4e5e-9de9-478f-935c-a49d5beeaa40": "ledger",
    "66bc9776-7b71-468b-a70f-511fc49b17b7": "notebook",
    "031cbeab-92dc-4a23-b29b-116fc35be5e5": "baa",
    "b4ab3460-f3bb-4381-b501-71af9116196e": "resume-rater",
    "00ffe635-c92d-456c-aca0-9119fdc06cf9": "support-agent",
    "7edf1803-0bb5-47bd-b493-fc497e30edbb": "webpage-copy",
    "f078dcb6-6123-49df-a153-12aaf6dbd10f": "ai-video",
    "9e66896c-de30-450f-8195-8f2e613d5cf6": "launch-tracker",
    "16db664e-9284-4cf2-9bca-5a0972171409": "decision-leads",
    "f0321fd3-4a50-4a82-ad36-4fa5b11bc99e": "domain-finder",
    "72a81253-8cfa-4f9c-afea-0940b1156891": "youtube-blog",
    "b219c250-8654-46a4-b7dc-8defc71f7e7b": "seo-blog",
    "2214e0c7-f933-4622-bee2-c64d559cdc8e": "auto-publisher-v7",
    "63997a66-d111-4aa9-9a25-64bcccbc2270": "youtube-linkedin",
    "2a65b19f-4c82-4756-8884-8159a614486b": "keyword-seo",
    "f4027695-097d-4964-abbd-578ac338d33a": "lead-finder",
    "0a64153e-0176-4772-905f-4fc889a5edbf": "workflow-empty-1",
    "3b9fa866-1208-4c6b-92de-3ed695affbb5": "workflow-empty-2",
    "d4cd69ae-c578-4fc9-bacf-51b7825ff5bb": "newsletter",
    "cb6a3ad8-e2b1-4bf5-8055-4bd139cddeef": "research-scraper",
    "775e2238-6158-4dd1-825d-d4c88f7d56ae": "workflow-empty-3",
    "cc478340-abc7-4db6-8116-c6c74817e255": "flux-copy",
    "96260d6a-3f39-472e-b96d-0483296c9d6d": "flux",
    "a2869c6a-98b7-4b7a-9040-3a2959970ec6": "plan-reviewer",
}

LOCAL_SLUGS = {
    "build-studio",
    "page-generator",
    "service-maestro",
    "auto-publisher",
    "auto-publisher-v7",
    "site-to-video",
    "video-studio",
    "key-issuer",
    "image-to-video",
    "edit-video",
    "edit-image",
    "contract-drafter",
    "ledger",
    "notebook",
}

EMPTY_SLUGS = {
    "baa",
    "workflow-empty-1",
    "workflow-empty-2",
    "workflow-empty-3",
}


class StudioError(ValueError):
    """مدخل أو وكيل لا يمكن تشغيله."""


def load_index() -> list[dict]:
    """يقرأ فهرس الوكلاء كما صُدِّر من المنصة."""
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise StudioError("الفهرس ليس قائمة")
    return data


def slug_for(agent: dict) -> str:
    graph_id = agent.get("graph_id", "")
    return SLUG_BY_GRAPH.get(graph_id, graph_id)


def kind_for(slug: str) -> str:
    if slug in LOCAL_SLUGS:
        return "local"
    if slug in EMPTY_SLUGS:
        return "empty"
    return "external"


def agents() -> list[dict]:
    """كل وكيل مع slug وkind."""
    rows = []
    for agent in load_index():
        slug = slug_for(agent)
        rows.append({**agent, "slug": slug, "kind": kind_for(slug)})
    return rows


def find_agent(name: str) -> dict:
    """يجد وكيلاً بالاسم أو الـ slug أو graph_id."""
    key = name.strip().casefold()
    for agent in agents():
        names = {
            agent["slug"].casefold(),
            agent.get("graph_id", "").casefold(),
            str(agent.get("name", "")).casefold(),
        }
        if key in names:
            return agent
    raise StudioError(f"وكيل غير موجود: {name}")


def _enum_values(spec: dict) -> list | None:
    if "enum" in spec:
        return spec["enum"]
    for option in spec.get("anyOf") or []:
        if isinstance(option, dict) and "enum" in option:
            return option["enum"]
    return None


def prepare_fields(
    agent: dict,
    fields: dict,
    optional: tuple[str, ...] = (),
) -> dict:
    """يملأ القيم الافتراضية ثم يتحقق من المطلوب ومن القوائم."""
    prepared = dict(fields)
    properties = agent.get("input_schema", {}).get("properties") or {}
    for key, spec in properties.items():
        if (key not in prepared or prepared[key] is None) and "default" in spec:
            prepared[key] = spec["default"]
    missing = []
    for key in agent.get("input_schema", {}).get("required") or []:
        if key in optional:
            continue
        value = prepared.get(key)
        if value is None or value == "":
            missing.append(key)
    if missing:
        raise StudioError("حقول مطلوبة: " + ", ".join(missing))
    for key, spec in properties.items():
        if key not in prepared or prepared[key] in (None, ""):
            continue
        allowed = _enum_values(spec)
        if allowed is not None and prepared[key] not in allowed:
            raise StudioError(f"قيمة غير مسموحة للحقل {key}")
    return prepared
