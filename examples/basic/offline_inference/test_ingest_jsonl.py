# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""سلوك استيعاب JSONL ومسار الوكيل الذي لا يحمّل النموذج."""

import contextlib
import importlib.util
import io
import json
import stat
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ingest_mod = load("ingest_jsonl")
wakil = load("wakil")


def write_jsonl(path: Path, rows: list[str]) -> None:
    body = "".join(row if row.endswith("\n") else row + "\n" for row in rows)
    path.write_text(body, encoding="utf-8")


class IngestTests(unittest.TestCase):
    def test_shapes_and_skips(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "in.jsonl"
            output = root / "out.jsonl"
            write_jsonl(
                source,
                [
                    json.dumps(
                        {"text": "  مرحبا  ", "source": "book"},
                        ensure_ascii=False,
                    ),
                    "",
                    "not-json",
                    json.dumps({"foo": 1}),
                    json.dumps({"text": ""}),
                    json.dumps({"text": "مرحبا", "source": "book"}, ensure_ascii=False),
                    json.dumps({"content": [{"type": "text", "text": "سطر"}]}),
                    json.dumps(
                        {
                            "messages": [
                                {"role": "user", "content": "سؤال"},
                                {"role": "assistant", "content": "جواب"},
                            ]
                        }
                    ),
                    json.dumps(
                        {
                            "conversations": [
                                {"from": "human", "value": "أ"},
                                {"from": "gpt", "value": "ب"},
                            ],
                            "dataset": "share",
                        },
                        ensure_ascii=False,
                    ),
                    json.dumps(
                        {
                            "instruction": "لخّص",
                            "input": "نص",
                            "output": "ملخص",
                            "id": 7,
                            "language": "ar",
                            "split": "train",
                        },
                        ensure_ascii=False,
                    ),
                    json.dumps({"prompt": "س", "completion": "ج"}),
                    json.dumps({"question": "ما؟", "answer": "هذا"}),
                    json.dumps(
                        {
                            "text": "ن",
                            "messages": [{"role": "user", "content": "يتجاهل"}],
                        }
                    ),
                    json.dumps(
                        {"content": [{"type": "image_url", "image_url": {"url": "x"}}]}
                    ),
                ],
            )
            stats = ingest_mod.ingest(
                source,
                output,
                dedupe=True,
                min_chars=2,
                keep_meta=True,
            )
            raw = output.read_text(encoding="utf-8").splitlines()
            rows = [json.loads(line) for line in raw]
            texts = [row["text"] for row in rows]
            self.assertEqual(texts[0], "مرحبا")
            self.assertNotIn("يتجاهل", texts)
            self.assertIn("user: سؤال\nassistant: جواب", texts)
            self.assertIn("human: أ\ngpt: ب", texts)
            self.assertIn("لخّص\n\nنص\n\nملخص", texts)
            self.assertEqual(stats["duplicates"], 1)
            self.assertEqual(stats["skipped_invalid"], 1)
            self.assertGreaterEqual(stats["skipped_shape"], 2)
            self.assertEqual(stats["skipped_short"], 1)
            self.assertEqual(stats["written"], len(rows))
            self.assertEqual(stats["output"], str(output))
            alpaca = next(row for row in rows if row["text"].startswith("لخّص"))
            self.assertEqual(alpaca["id"], 7)
            self.assertEqual(alpaca["lang"], "ar")
            self.assertEqual(alpaca["split"], "train")
            self.assertEqual(alpaca["source"], "unknown")
            share = next(row for row in rows if row["source"] == "share")
            self.assertNotIn("id", share)

    def test_strict_keeps_previous_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "bad.jsonl"
            output = root / "out.jsonl"
            source.write_text('{"text": "تمام"}\n{', encoding="utf-8")
            output.write_text("old\n", encoding="utf-8")
            with self.assertRaises(ingest_mod.IngestError):
                ingest_mod.ingest(source, output, strict=True)
            self.assertEqual(output.read_text(encoding="utf-8"), "old\n")
            self.assertFalse((root / "out.jsonl.partial").exists())

    def test_refuses_same_path_and_short_limit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "in.jsonl"
            source.write_text('{"text": "abcdef"}\n', encoding="utf-8")
            with self.assertRaises(ingest_mod.IngestError):
                ingest_mod.ingest(source, source)
            with self.assertRaises(ingest_mod.IngestError):
                ingest_mod.ingest(
                    source,
                    Path(tmp) / "bad-limit.jsonl",
                    min_chars=4,
                    max_chars=2,
                )
            stats = ingest_mod.ingest(source, Path(tmp) / "long.jsonl", max_chars=3)
            self.assertEqual(stats["written"], 0)
            self.assertEqual(stats["skipped_long"], 1)

    def test_cli_prints_written(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "in.jsonl"
            output = Path(tmp) / "nested" / "out.jsonl"
            source.write_text('{"text": "سلام", "source": "x"}\n', encoding="utf-8")
            code = ingest_mod.main(["--input", str(source), "--output", str(output)])
            self.assertEqual(code, 0)
            row = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(row, {"text": "سلام", "source": "x"})


class WakilTests(unittest.TestCase):
    def test_all_ingests_then_builds_model_command(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "in.jsonl"
            output = Path(tmp) / "out.jsonl"
            source.write_text('{"text": "حديقة"}\n', encoding="utf-8")
            seen: list[list[str]] = []

            def runner(cmd, cwd):
                seen.append(cmd)
                self.assertEqual(cwd, wakil.REPO_ROOT)
                return 0

            code = wakil.main(
                [
                    "--task",
                    "all",
                    "--input",
                    str(source),
                    "--output",
                    str(output),
                    "--image-url",
                    "https://example.test/cat.jpg",
                    "--model",
                    "Qwen/Qwen2.5-0.5B-Instruct",
                ],
                model_runner=runner,
            )
            self.assertEqual(code, 0)
            saved = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(saved["text"], "حديقة")
            cmd = seen[0]
            self.assertTrue(cmd[1].endswith("dalil.py"))
            self.assertEqual(cmd[2:4], ["--task", "all"])
            self.assertIn("--model", cmd)
            self.assertIn("--image-url", cmd)
            self.assertIn("https://example.test/cat.jpg", cmd)

    def test_ingest_requires_input_and_rejects_unknown(self) -> None:
        self.assertEqual(wakil.main(["--task", "ingest"]), 1)
        self.assertEqual(wakil.main(["--task", "ingest", "--input", "x", "--nope"]), 1)

    def test_key_refuses_short_and_repo_path(self) -> None:
        with contextlib.redirect_stdout(io.StringIO()):
            code = wakil.main(["--task", "key", "--nbytes", "8"])
        self.assertEqual(code, 1)
        inside = HERE / "secret.txt"
        with contextlib.redirect_stdout(io.StringIO()):
            code = wakil.main(["--task", "key", "--out", str(inside)])
        self.assertEqual(code, 1)
        self.assertFalse(inside.exists())

    def test_key_writes_private_file_outside_repo(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "vllm-api-key"
            with contextlib.redirect_stdout(io.StringIO()):
                code = wakil.main(["--task", "key", "--out", str(dest)])
            self.assertEqual(code, 0)
            self.assertEqual(stat.S_IMODE(dest.stat().st_mode), 0o600)
            key = dest.read_text(encoding="utf-8").strip()
            self.assertGreaterEqual(len(key), 32)


if __name__ == "__main__":
    unittest.main()
