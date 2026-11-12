# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""تشغيل كل الوكلاء بلا شبكة وبلا تسريب مفتاح."""

import io
import json
import os
import socket
import stat
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import catalog  # noqa: E402
import oss  # noqa: E402
import studio  # noqa: E402


class CatalogTests(unittest.TestCase):
    def test_index_has_every_agent(self) -> None:
        rows = catalog.agents()
        self.assertEqual(len(rows), 35)
        slugs = [row["slug"] for row in rows]
        self.assertEqual(len(slugs), len(set(slugs)))
        kinds = {row["kind"] for row in rows}
        self.assertEqual(kinds, {"local", "external", "empty"})
        self.assertEqual(sum(row["kind"] == "empty" for row in rows), 4)
        self.assertEqual(sum(row["kind"] == "local" for row in rows), 14)

    def test_graphs_match_index_ids(self) -> None:
        index = {row["graph_id"]: row for row in catalog.agents()}
        graphs = HERE / "graphs"
        expected = {
            "build_studio.json": "73e521fc-081a-4b3a-81ad-9161d77b410a",
            "page_generator.json": "305e0dd5-3d8b-4084-adbc-fede6e3a71d8",
            "service_maestro.json": "614ce970-58b4-42a3-b0ed-e8850a88b917",
            "auto_publisher.json": "ded64c44-994b-4d78-913c-e2a80f04e754",
            "video_studio.json": "d212d957-8203-4548-a604-689af90740cd",
        }
        for filename, graph_id in expected.items():
            graph = json.loads((graphs / filename).read_text(encoding="utf-8"))
            self.assertEqual(graph["id"], graph_id)
            self.assertIn(graph_id, index)


class RunTests(unittest.TestCase):
    def test_page_is_local_and_has_no_remote_image(self) -> None:
        result = studio.execute(
            "page-generator",
            {
                "business": "مقهى البيت",
                "goal": "حجز",
                "contact": "واتساب 966500000000 وبريد a@b.co",
                "lang": "Arabic",
            },
        )
        self.assertEqual(result["status"], "ready")
        page = result["output"]["html"]
        self.assertIn('dir="rtl"', page)
        self.assertIn("https://wa.me/966500000000", page)
        self.assertIn("mailto:a@b.co", page)
        self.assertIn('getElementById("y")', page)
        self.assertNotIn('src="http', page)
        self.assertNotIn("عميل سعيد", page)

    def test_build_store_has_plan_and_cart(self) -> None:
        result = studio.execute(
            "build-studio",
            {
                "idea": "متجر عسل",
                "kind": "online_store",
                "contact": "a@b.co",
                "style": "luxury",
            },
        )
        self.assertEqual(result["status"], "ready")
        self.assertIn("متجر عسل", result["output"]["project_plan"])
        self.assertIn('id="cart"', result["output"]["html"])

    def test_video_clamps_and_external_does_not_call(self) -> None:
        video = studio.execute("video-studio", {"scene_seconds": 99, "prompt": "حديقة"})
        self.assertEqual(video["output"]["total_seconds"], 180)
        self.assertEqual(len(video["output"]["scenes"]), 6)
        self.assertIsNone(video["output"]["video"])
        self.assertIn("HyperFrames", video["output"]["note"])
        self.assertNotIn("api.heygen.com", video["output"]["note"])
        short = studio.execute("site-to-video", {"scene_seconds": 1})
        self.assertEqual(short["output"]["total_seconds"], 30)
        external = studio.execute(
            "resume-rater",
            {"Resume": "خبرة مبيعات"},
        )
        self.assertEqual(external["status"], "external")
        self.assertIn("prepared", external["output"])
        empty = studio.execute("باع", {})
        self.assertEqual(empty["status"], "empty")

    def test_publisher_dry_run_drops_profile_key(self) -> None:
        secret = "SECRET-PKEY-99"
        result = studio.execute(
            "auto-publisher",
            {"brief": "عرض", "pkey": secret},
        )
        self.assertEqual(result["status"], "ready")
        self.assertFalse(result["output"]["sent"])
        self.assertNotIn(secret, json.dumps(result))

    def test_publisher_is_dry_and_maestro_hides_key(self) -> None:
        secret = "SECRET-PKEY-99"
        with tempfile.TemporaryDirectory() as tmp:
            keys = Path(tmp) / "keys.json"
            issued = studio.execute(
                "key-issuer",
                {"client_key": "client-1", "pkey": secret},
                keys,
            )
            self.assertEqual(issued["output"]["registered"], "client-1")
            self.assertEqual(stat.S_IMODE(keys.stat().st_mode), 0o600)
            routed = studio.execute(
                "service-maestro",
                {
                    "client_key": "client-1",
                    "service": "publisher",
                    "brief": "عرض الأسبوع",
                },
                keys,
            )
            self.assertEqual(routed["status"], "ready")
            self.assertFalse(routed["output"]["sent"])
            dumped = json.dumps(routed, ensure_ascii=False)
            self.assertNotIn(secret, dumped)
            unknown = studio.execute(
                "service-maestro",
                {"client_key": "client-1", "service": "maps"},
                keys,
            )
            self.assertEqual(unknown["output"]["error"], "Unknown service name")
            invalid = studio.execute(
                "service-maestro",
                {"client_key": "missing", "service": "publisher"},
                keys,
            )
            self.assertIn("Invalid", invalid["output"]["error"])

    def test_refuses_key_file_inside_repo_and_bad_enum(self) -> None:
        inside = HERE / "secret-keys.json"
        result = studio.execute(
            "key-issuer",
            {"client_key": "a", "pkey": "b"},
            inside,
        )
        self.assertEqual(result["status"], "error")
        self.assertFalse(inside.exists())
        bad = studio.execute(
            "build-studio",
            {"idea": "فكرة", "kind": "castle", "contact": "x"},
        )
        self.assertEqual(bad["status"], "error")

    def test_contract_ledger_and_notebook(self) -> None:
        contract = studio.execute(
            "contract-drafter",
            {"party_a": "شركة ألف", "party_b": "شركة باء", "terms": "دفعة واحدة"},
        )
        self.assertIn("شركة ألف", contract["output"]["contract_text"])
        self.assertIn("محام", contract["output"]["notes"])
        entry = studio.execute(
            "ledger",
            {"owner": "نورة", "entry": "بيع بمبلغ 250 ريال"},
        )
        self.assertEqual(entry["output"]["amount"], "250")
        self.assertEqual(entry["output"]["category"], "بيع")
        notes = studio.execute(
            "notebook",
            {"source": "الجملة الأولى. الجملة الثانية.", "task": "key_ideas"},
        )
        self.assertIn("الجملة الأولى", notes["output"]["result"])

    def test_cli_lists_all(self) -> None:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            code = studio.main(["list"])
        self.assertEqual(code, 0)
        rows = json.loads(buffer.getvalue())
        self.assertEqual(len(rows), 35)

    def test_nothing_opens_a_socket(self) -> None:
        def refuse(*_args, **_kwargs):
            raise AssertionError("network")

        with tempfile.TemporaryDirectory() as tmp:
            keys = Path(tmp) / "keys.json"
            with (
                patch.object(socket, "socket", refuse),
                patch.object(socket, "create_connection", refuse),
            ):
                for agent in catalog.agents():
                    fields = _sample(agent)
                    result = studio.execute(agent["slug"], fields, keys)
                    self.assertIn(
                        result["status"],
                        {"ready", "external", "empty", "error"},
                    )
                    self.assertNotIn("SECRET-PKEY", json.dumps(result))


class OpenSourceTests(unittest.TestCase):
    def test_inventory_keeps_heygen_api_closed(self) -> None:
        data = oss.inventory()
        opened = {item["name"]: item for item in data["heygen_open"]}
        self.assertEqual(opened["HyperFrames"]["license"], "Apache-2.0")
        self.assertFalse(opened["HyperFrames"]["called"])
        closed = {item["name"] for item in data["heygen_closed"]}
        self.assertEqual(
            closed,
            {"MCP", "API", "Video Agent", "Avatar V", "Voice"},
        )
        self.assertTrue(all(item["called"] is False for item in data["heygen_closed"]))
        modes = {row["modality"]: row["status"] for row in data["mozilla"]}
        self.assertEqual(modes["text"], "local")
        self.assertEqual(modes["image-generation"], "unavailable")
        self.assertEqual(modes["video-generation"], "unavailable")
        self.assertEqual(oss.loopback_host(), "127.0.0.1")
        self.assertIn("--server --port 8080", oss.WINDOWS_SERVE)
        self.assertIn("llamafile.exe", oss.WINDOWS_SERVE)

    def test_serve_argv_matches_the_bat_shape(self) -> None:
        with patch.dict(os.environ, {"LLAMAFILE_PORT": "8080"}, clear=False):
            os.environ.pop("LLAMAFILE_BIN", None)
            os.environ.pop("LLAMAFILE_MODEL", None)
            argv = oss.serve_argv()
        self.assertEqual(argv[1], "-m")
        self.assertTrue(argv[2].endswith("model.gguf"))
        self.assertEqual(argv[3:], ["--server", "--port", "8080"])
        self.assertNotIn("http", " ".join(argv))

    def test_ask_stays_on_loopback(self) -> None:
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                body = json.dumps(
                    {"choices": [{"message": {"content": "مرحبا"}}]}
                ).encode()
                self.wfile.write(body)

            def log_message(self, _format: str, *_args) -> None:
                return

        server = HTTPServer((oss.loopback_host(), 0), Handler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with patch.dict(os.environ, {"LLAMAFILE_HOST": "https://example.com"}):
                result = oss.complete("اختبار", port)
            self.assertEqual(result["text"], "مرحبا")
            self.assertEqual(result["host"], "127.0.0.1")
        finally:
            server.shutdown()
            server.server_close()

    def test_ask_reports_a_stopped_server(self) -> None:
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()
        with self.assertRaises(oss.StudioError):
            oss.complete("مرحبا", port)


def _sample(agent: dict) -> dict:
    fields = {}
    props = agent.get("input_schema", {}).get("properties") or {}
    required = set(agent.get("input_schema", {}).get("required") or [])
    for key, spec in props.items():
        default = spec.get("default")
        if default not in (None, ""):
            fields[key] = default
            continue
        if key not in required:
            continue
        allowed = spec.get("enum")
        fields[key] = allowed[0] if allowed else "اختبار"
    return fields


if __name__ == "__main__":
    unittest.main()
