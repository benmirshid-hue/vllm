# SPDX-License-Identifier: Apache-2.0
"""Fleet planner, coder bounds, reviewer gates, and sandbox tests."""

from __future__ import annotations

import asyncio
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import agents_fleet_engine as fleet  # noqa: E402


def _run(coro):
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        return asyncio.run(coro)


class PlannerTests(unittest.TestCase):
    def test_plan_is_read_only_and_has_three_tasks(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workdir = Path(raw)
            marker = workdir / "keep.txt"
            marker.write_text("stay", encoding="utf-8")
            planner = fleet.PlannerAgent()
            tasks = _run(planner.create_plan("مهمة تجريبية", workdir))
            self.assertEqual(len(tasks), 3)
            self.assertEqual([task.task_id for task in tasks], [
                "TASK-01",
                "TASK-02",
                "TASK-03",
            ])
            self.assertEqual(list(workdir.iterdir()), [marker])
            self.assertEqual(marker.read_text(encoding="utf-8"), "stay")
            self.assertTrue(any("tenant_id" in c for t in tasks for c in t.constraints))


class CoderBoundTests(unittest.TestCase):
    def test_rejects_parent_escape(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workdir = Path(raw) / "box"
            workdir.mkdir()
            coder = fleet.CoderAgent(workdir=workdir)
            task = fleet.TaskSpecification(
                task_id="TASK-X",
                title="escape",
                description="must not write outside the box",
                target_files=["../evil.py"],
            )
            result = _run(coder.execute_task(task))
            self.assertEqual(result.status, "failed")
            self.assertFalse((workdir.parent / "evil.py").exists())
            self.assertFalse((workdir / "evil.py").exists())

    def test_writes_templates_inside_workdir(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workdir = Path(raw)
            coder = fleet.CoderAgent(workdir=workdir)
            task = fleet.TaskSpecification(
                task_id="TASK-01",
                title="models",
                description="models",
                target_files=["src/models.py", "src/types.ts"],
            )
            result = _run(coder.execute_task(task))
            self.assertEqual(result.status, "coded")
            models = (workdir / "src" / "models.py").read_text(encoding="utf-8")
            self.assertIn("tenant_id", models)
            self.assertIn("+++ b/src/models.py", result.diff_output or "")


class ReviewerTests(unittest.TestCase):
    def test_rejects_eval(self) -> None:
        task = fleet.TaskSpecification(
            task_id="TASK-02",
            title="bad",
            description="bad",
            target_files=["src/core_engine.py"],
            status="coded",
            diff_output="def run():\n    return eval('1')\n",
        )
        ok = _run(fleet.ReviewerAgent().review_diff(task))
        self.assertFalse(ok)
        self.assertEqual(task.status, "rejected")

    def test_rejects_hardcoded_secret(self) -> None:
        task = fleet.TaskSpecification(
            task_id="TASK-02",
            title="bad",
            description="bad",
            target_files=["src/core_engine.py"],
            status="coded",
            diff_output='password = "hunter2"\nclass IsolationError: ...\n',
        )
        ok = _run(fleet.ReviewerAgent().review_diff(task))
        self.assertFalse(ok)

    def test_approves_clean_engine_diff(self) -> None:
        body = (HERE / "templates" / "core_engine.py").read_text(encoding="utf-8")
        task = fleet.TaskSpecification(
            task_id="TASK-02",
            title="engine",
            description="engine",
            target_files=["src/core_engine.py"],
            status="coded",
            diff_output=fleet.unified_add_diff("src/core_engine.py", body),
        )
        ok = _run(fleet.ReviewerAgent().review_diff(task))
        self.assertTrue(ok)
        self.assertEqual(task.status, "approved")


class FleetIntegrationTests(unittest.TestCase):
    def test_full_fleet_builds_isolated_auth(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workdir = Path(raw)
            coordinator = fleet.FleetCoordinator(workdir=workdir, delay=0.0)
            report = _run(coordinator.run_fleet(fleet.DEFAULT_MISSION))
            self.assertEqual(report.rejected, [])
            self.assertEqual(
                set(report.approved), {"TASK-01", "TASK-02", "TASK-03"}
            )
            self.assertTrue(report.tests_passed)
            self.assertIn("Ran ", report.sandbox_output or "")
            self.assertIn("OK", report.sandbox_output or "")
            engine = workdir / "src" / "core_engine.py"
            self.assertIn("IsolationError", engine.read_text(encoding="utf-8"))

    def test_cli_json_planner_does_not_write_src(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            workdir = Path(raw)
            sink = io.StringIO()
            with redirect_stdout(sink), redirect_stderr(sink):
                code = fleet.main(
                    ["--mode", "planner", "--workdir", str(workdir), "--json"]
                )
            self.assertEqual(code, 0)
            self.assertTrue((workdir / "fleet_report.json").is_file())
            self.assertFalse((workdir / "src").exists())
            payload = json.loads(
                (workdir / "fleet_report.json").read_text(encoding="utf-8")
            )
            self.assertEqual(len(payload["tasks"]), 3)


if __name__ == "__main__":
    unittest.main()
