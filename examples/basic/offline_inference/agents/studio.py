# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""يشغّل كل وكلاء الفهرس. الوكلاء الخارجية تُجهَّز ولا تُستدعى."""

import argparse
import json
import sys
from pathlib import Path

from catalog import StudioError, agents, find_agent, prepare_fields
from local import HANDLERS, redact

DRY_RUN = {"auto-publisher", "auto-publisher-v7"}


def _result(agent: dict, status: str, output: object) -> dict:
    return {
        "slug": agent["slug"],
        "name": agent["name"],
        "kind": agent["kind"],
        "status": status,
        "output": redact(output),
    }


def execute(name: str, fields: dict, keys: Path | None = None) -> dict:
    """يشغّل وكيلاً بالاسم أو يعيد بطاقة جاهزة بلا اتصال."""
    agent = find_agent(name)
    optional = ("pkey",) if agent["slug"] in DRY_RUN else ()
    try:
        prepared = prepare_fields(agent, fields, optional)
    except StudioError as exc:
        return _result(agent, "error", {"error": str(exc)})
    if agent["slug"] in DRY_RUN:
        prepared.pop("pkey", None)
    if agent["kind"] == "empty":
        return _result(agent, "empty", {"error": "الرسم فارغ"})
    if agent["kind"] == "external":
        return _result(
            agent,
            "external",
            {
                "error": "هذا الوكيل يحتاج خدمته الخارجية ولم يُفتح اتصال.",
                "prepared": prepared,
            },
        )
    try:
        output = HANDLERS[agent["slug"]](prepared, keys)
    except StudioError as exc:
        return _result(agent, "error", {"error": str(exc)})
    return _result(agent, "ready", output)


def _parse_sets(pairs: list[str]) -> dict:
    fields = {}
    for pair in pairs:
        if "=" not in pair:
            raise StudioError(f"صيغة --set غير صالحة: {pair}")
        key, value = pair.split("=", 1)
        fields[key] = value
    return fields


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="كل الوكلاء")
    parser.allow_abbrev = False
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    show = sub.add_parser("show")
    show.add_argument("agent")
    run = sub.add_parser("run")
    run.add_argument("agent")
    run.add_argument("--json", dest="payload", default=None)
    run.add_argument("--set", action="append", default=[])
    run.add_argument("--keys", type=Path, default=None)
    args = parser.parse_args(argv)
    try:
        if args.command == "list":
            rows = [
                {"slug": item["slug"], "kind": item["kind"], "name": item["name"]}
                for item in agents()
            ]
            print(json.dumps(rows, ensure_ascii=False))
            return 0
        if args.command == "show":
            agent = find_agent(args.agent)
            print(
                json.dumps(
                    {
                        "slug": agent["slug"],
                        "kind": agent["kind"],
                        "name": agent["name"],
                        "description": agent.get("description", ""),
                        "input_schema": agent.get("input_schema", {}),
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        fields = {}
        if args.payload:
            fields.update(json.loads(args.payload))
        fields.update(_parse_sets(args.set))
        print(
            json.dumps(
                execute(args.agent, fields, args.keys),
                ensure_ascii=False,
            )
        )
        return 0
    except (StudioError, json.JSONDecodeError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
