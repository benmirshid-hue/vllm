# SPDX-License-Identifier: Apache-2.0
"""Autonomous multi-agent fleet: planner, coders, reviewer, sandbox."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

FLEET_ROOT = Path(__file__).resolve().parent
TEMPLATES = FLEET_ROOT / "templates"
DEFAULT_WORKDIR = FLEET_ROOT / "workspace"
DEFAULT_MISSION = (
    "بناء معمارية مصادقة سحابية مع عزل كامل للبيانات وتدقيق أمني تلقائي"
)
SKIP_DIR_NAMES = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
}
UNSAFE_DIFF = re.compile(
    r"\beval\s*\(|\bexec\s*\(|pickle\.loads\s*\(|shell\s*=\s*True",
    re.IGNORECASE,
)
HARDCODED_SECRET = re.compile(
    r"""(?ix)
    (password|secret|api_key|token)\s*=\s*['"][^'"]+['"]
    """
)
ARTIFACTS = {
    "src/models.py": TEMPLATES / "models.py",
    "src/core_engine.py": TEMPLATES / "core_engine.py",
    "src/types.ts": TEMPLATES / "types.ts",
    "src/services.ts": TEMPLATES / "services.ts",
    "tests/test_engine.py": TEMPLATES / "test_engine.py",
}


class AgentRole(Enum):
    COORDINATOR = "coordinator"
    PLANNER = "planner"
    CODER = "coder"
    REVIEWER = "reviewer"
    SANDBOX_RUNNER = "sandbox_runner"
    DEPLOYER = "deployer"


@dataclass
class TaskSpecification:
    task_id: str
    title: str
    description: str
    target_files: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    status: str = "pending"
    result: str | None = None
    diff_output: str | None = None


@dataclass
class FleetReport:
    mission: str
    workdir: str
    tasks: list[dict[str, Any]]
    approved: list[str]
    rejected: list[str]
    tests_passed: bool
    files_written: list[str]
    sandbox_output: str | None = None


def _say(message: str) -> None:
    print(message, file=sys.stderr)


class PathEscapeError(ValueError):
    """A coder target escaped the bounded workdir."""


class BaseAutonomousAgent:
    def __init__(self, name: str, role: AgentRole, model: str = "auto"):
        self.name = name
        self.role = role
        self.model = model
        self.memory: list[dict[str, str]] = []
        self.logs: list[str] = []

    async def log(self, message: str) -> None:
        self.logs.append(message)
        print(
            f"[{self.role.value.upper()} - {self.name}] {message}",
            file=sys.stderr,
        )


def resolve_in_workdir(workdir: Path, relative: str) -> Path:
    """Return a path that is strictly inside workdir."""
    if not relative or Path(relative).is_absolute():
        raise PathEscapeError(relative)
    parts = Path(relative).parts
    if ".." in parts or parts[:1] == ("/",):
        raise PathEscapeError(relative)
    root = workdir.resolve()
    dest = (root / relative).resolve()
    if dest != root and root not in dest.parents:
        raise PathEscapeError(relative)
    return dest


def list_context_files(root: Path, limit: int = 20) -> list[str]:
    if not root.exists():
        return []
    found: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            name
            for name in sorted(dirnames)
            if name not in SKIP_DIR_NAMES and not name.startswith(".")
        ]
        for filename in sorted(filenames):
            if filename.startswith("."):
                continue
            found.append(str(Path(dirpath) / filename))
            if len(found) >= limit:
                return found
    return found


def unified_add_diff(relative: str, body: str) -> str:
    lines = body.splitlines() or [""]
    numbered = "\n".join(f"+{line}" for line in lines)
    return (
        f"--- /dev/null\n+++ b/{relative}\n"
        f"@@ -0,0 +1,{len(lines)} @@\n{numbered}\n"
    )


class PlannerAgent(BaseAutonomousAgent):
    """وكيل التخطيط المعماري - قراءة السياق دون مساس بالملفات."""

    def __init__(self, name: str = "ArchitectPrime", model: str = "auto"):
        super().__init__(name, AgentRole.PLANNER, model)

    async def create_plan(
        self, high_level_goal: str, repo_path: Path
    ) -> list[TaskSpecification]:
        await self.log(
            f"فحص المستودع في '{repo_path}' وبدء هندسة خطة العمل لـ: "
            f"'{high_level_goal}'"
        )
        files = list_context_files(repo_path)
        await self.log(f"تم تحليل {len(files)} ملفاً مرجعياً في السياق.")
        tasks = [
            TaskSpecification(
                task_id="TASK-01",
                title="تهيئة البنية وإعداد نماذج البيانات",
                description=(
                    "إنشاء الهياكل الأساسية والواجهات البرمجية لتحقيق: "
                    f"{high_level_goal}"
                ),
                target_files=["src/models.py", "src/types.ts"],
                constraints=[
                    "read-only planning",
                    "every record carries tenant_id",
                ],
            ),
            TaskSpecification(
                task_id="TASK-02",
                title="تطوير المنطق التشغيلي والخوارزميات",
                description="تنفيذ الدوال ومحركات المعالجة الأساسية",
                target_files=["src/core_engine.py", "src/services.ts"],
                constraints=[
                    "hash secrets",
                    "cross-tenant verify raises IsolationError",
                ],
            ),
            TaskSpecification(
                task_id="TASK-03",
                title="كتابة اختبارات الوحدة والأمان الميداني",
                description="تغطية كافة المسارات باختبارات آلية صارمة",
                target_files=["tests/test_engine.py"],
                constraints=["assert tenant isolation"],
            ),
        ]
        await self.log(
            f"تم اعتماد خطة العمل المكونة من {len(tasks)} مهام رئيسية بنجاح."
        )
        return tasks


class CoderAgent(BaseAutonomousAgent):
    """وكيل كتابة الشفرات - يكتب فقط داخل workdir."""

    def __init__(
        self,
        name: str = "CodeMaster",
        model: str = "auto",
        workdir: Path | None = None,
        delay: float = 0.0,
    ):
        super().__init__(name, AgentRole.CODER, model)
        self.workdir = (workdir or DEFAULT_WORKDIR).resolve()
        self.delay = delay

    async def execute_task(self, task: TaskSpecification) -> TaskSpecification:
        await self.log(f"بدء تنفيذ المهمة: [{task.task_id}] {task.title}")
        if self.delay:
            await asyncio.sleep(self.delay)
        try:
            written, diff_chunks = self._materialize(task.target_files)
        except PathEscapeError as exc:
            task.status = "failed"
            task.result = f"رفض مسار خارج مساحة العمل: {exc}"
            await self.log(task.result)
            return task
        except FileNotFoundError as exc:
            task.status = "failed"
            task.result = f"قالب مفقود: {exc}"
            await self.log(task.result)
            return task
        task.diff_output = "\n".join(diff_chunks)
        task.status = "coded"
        task.result = (
            f"تم إنجاز التعديلات البرمجية لـ {task.title} بنجاح. "
            f"ملفات: {', '.join(written)}"
        )
        await self.log(f"اكتمل التشفير لـ [{task.task_id}].")
        return task

    def _materialize(self, target_files: list[str]) -> tuple[list[str], list[str]]:
        self.workdir.mkdir(parents=True, exist_ok=True)
        (self.workdir / "src").mkdir(parents=True, exist_ok=True)
        (self.workdir / "tests").mkdir(parents=True, exist_ok=True)
        init_py = resolve_in_workdir(self.workdir, "src/__init__.py")
        if not init_py.exists():
            init_py.write_text(
                "# SPDX-License-Identifier: Apache-2.0\n", encoding="utf-8"
            )
        written: list[str] = []
        diffs: list[str] = []
        for relative in target_files:
            dest = resolve_in_workdir(self.workdir, relative)
            source = ARTIFACTS.get(relative)
            if source is None or not source.is_file():
                raise FileNotFoundError(relative)
            body = source.read_text(encoding="utf-8")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(body, encoding="utf-8")
            written.append(relative)
            diffs.append(unified_add_diff(relative, body))
        return written, diffs


class ReviewerAgent(BaseAutonomousAgent):
    """وكيل التدقيق البرمجي وفحص الثغرات."""

    def __init__(
        self,
        name: str = "BugBotSentinel",
        model: str = "auto",
        delay: float = 0.0,
    ):
        super().__init__(name, AgentRole.REVIEWER, model)
        self.delay = delay

    async def review_diff(self, task: TaskSpecification) -> bool:
        await self.log(
            f"فحص الفوارق البرمجية للمهمة [{task.task_id}] "
            "وكشف الثغرات ومعايير الأمان..."
        )
        if self.delay:
            await asyncio.sleep(self.delay)
        if task.status != "coded":
            task.status = "rejected"
            await self.log(f"رفض [{task.task_id}]: المهمة لم تُشفَّر.")
            return False
        findings = review_payload(task.diff_output or "", task.target_files)
        if findings:
            task.status = "rejected"
            task.result = " ؛ ".join(findings)
            await self.log(
                f"⚠️ [تحذير أمني] [{task.task_id}]: {task.result}. تم رفض الدمج."
            )
            return False
        task.status = "approved"
        await self.log(
            f"✅ تم اجتياز الفحص الأمني ومعايير الكود للمهمة [{task.task_id}]."
        )
        return True


def review_payload(diff: str, target_files: list[str]) -> list[str]:
    findings: list[str] = []
    if UNSAFE_DIFF.search(diff):
        findings.append("ممارسة غير آمنة (eval/exec/pickle/shell)")
    if HARDCODED_SECRET.search(diff):
        findings.append("سر مضمّن في الشفرة")
    for relative in target_files:
        if (
            not relative
            or Path(relative).is_absolute()
            or ".." in Path(relative).parts
        ):
            findings.append(f"مسار خارج المساحة: {relative}")
    if target_files and "src/models.py" in target_files and "tenant_id" not in diff:
        findings.append("النماذج بلا tenant_id")
    if (
        target_files
        and "src/core_engine.py" in target_files
        and "IsolationError" not in diff
    ):
        findings.append("المحرك بلا IsolationError")
    return findings


class SandboxRunnerAgent(BaseAutonomousAgent):
    """وكيل تشغيل اختبارات الوحدة داخل workdir فقط."""

    def __init__(
        self,
        name: str = "SandboxExecutor",
        model: str = "auto",
        workdir: Path | None = None,
        delay: float = 0.0,
    ):
        super().__init__(name, AgentRole.SANDBOX_RUNNER, model)
        self.workdir = (workdir or DEFAULT_WORKDIR).resolve()
        self.delay = delay

    async def run_tests(self, task: TaskSpecification) -> tuple[bool, str]:
        await self.log(f"تشغيل بيئة الاختبارات المعزولة للمهمة [{task.task_id}]...")
        if self.delay:
            await asyncio.sleep(self.delay)
        ok, output = run_workdir_tests(self.workdir)
        if ok:
            await self.log(
                f"🧪 اختبارات [{task.task_id}] أظهرت: PASS."
            )
        else:
            await self.log(f"🧪 اختبارات [{task.task_id}] فشلت.")
        return ok, output


def run_workdir_tests(workdir: Path, timeout: int = 60) -> tuple[bool, str]:
    tests_dir = workdir / "tests"
    if not tests_dir.is_dir():
        return False, "missing tests/"
    env = os.environ.copy()
    src = str(workdir / "src")
    pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = src if not pythonpath else os.pathsep.join([src, pythonpath])
    completed = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        cwd=workdir,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        shell=False,
    )
    output = (completed.stdout or "") + (completed.stderr or "")
    return completed.returncode == 0, output


class FleetCoordinator:
    """المنسق الأعلى لإطلاق أسطول الوكلاء بالتوازي."""

    def __init__(
        self,
        workdir: Path | None = None,
        workers: int = 3,
        delay: float = 0.0,
    ):
        self.workdir = (workdir or DEFAULT_WORKDIR).resolve()
        self.planner = PlannerAgent()
        self.coder_pool = [
            CoderAgent(f"Coder-Worker-{index}", workdir=self.workdir, delay=delay)
            for index in range(1, workers + 1)
        ]
        self.reviewer = ReviewerAgent(delay=delay)
        self.sandbox = SandboxRunnerAgent(workdir=self.workdir, delay=delay)

    async def run_fleet(
        self,
        user_mission: str,
        stop_after: str = "sandbox",
    ) -> FleetReport:
        _say("=" * 80)
        _say(f"🚀 إطلاق أسطول الوكلاء الذاتية لتنفيذ المهمة: {user_mission}")
        _say("=" * 80)

        tasks = await self.planner.create_plan(user_mission, self.workdir)
        if stop_after == "planner":
            return self._report(user_mission, tasks, [], [], True, [], None)

        _say("\n⚡ جاري إطلاق وكلاء البرمجة المتوازيين...")
        coding = [
            self.coder_pool[index % len(self.coder_pool)].execute_task(task)
            for index, task in enumerate(tasks)
        ]
        completed = await asyncio.gather(*coding)
        files_written = _written_from(completed)
        if stop_after == "coders":
            coded_ok = all(task.status == "coded" for task in completed)
            return self._report(
                user_mission, completed, [], [], coded_ok, files_written, None
            )

        _say("\n🛡️ جاري مراجعة الأمان والتحقق التلقائي...")
        review_flags = await asyncio.gather(
            *[self.reviewer.review_diff(task) for task in completed]
        )
        approved = [
            task.task_id
            for task, ok in zip(completed, review_flags, strict=True)
            if ok
        ]
        rejected = [
            task.task_id
            for task, ok in zip(completed, review_flags, strict=True)
            if not ok
        ]
        if stop_after == "reviewer":
            return self._report(
                user_mission,
                completed,
                approved,
                rejected,
                not rejected,
                files_written,
                None,
            )

        _say("\n🧪 تنفيذ الاختبارات الميدانية...")
        passed_all = bool(approved) and not rejected
        sandbox_output = None
        if approved:
            probe = next(task for task in completed if task.task_id in approved)
            test_ok, sandbox_output = await self.sandbox.run_tests(probe)
            passed_all = passed_all and test_ok

        _say("\n" + "=" * 80)
        if passed_all and not rejected:
            _say("🏆 اكتمل تنفيذ كافة المهام بنجاح وتم اعتماد الشفرات.")
        else:
            _say("⚠️ تم الانتهاء مع ملاحظات تتطلب تدخل المطور.")
        _say("=" * 80)
        return self._report(
            user_mission,
            completed,
            approved,
            rejected,
            passed_all and not rejected,
            files_written,
            sandbox_output,
        )

    def _report(
        self,
        mission: str,
        tasks: list[TaskSpecification],
        approved: list[str],
        rejected: list[str],
        tests_passed: bool,
        files_written: list[str],
        sandbox_output: str | None,
    ) -> FleetReport:
        return FleetReport(
            mission=mission,
            workdir=str(self.workdir),
            tasks=[asdict(task) for task in tasks],
            approved=approved,
            rejected=rejected,
            tests_passed=tests_passed,
            files_written=files_written,
            sandbox_output=sandbox_output,
        )


def _written_from(tasks: list[TaskSpecification]) -> list[str]:
    names: list[str] = []
    for task in tasks:
        names.extend(task.target_files)
    return names


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="أسطول الوكلاء الذاتي (Planner / Coder / Reviewer / Sandbox)"
    )
    parser.allow_abbrev = False
    parser.add_argument("--mission", default=DEFAULT_MISSION)
    parser.add_argument("--workdir", type=Path, default=DEFAULT_WORKDIR)
    parser.add_argument(
        "--mode",
        choices=("fleet", "planner", "coders", "reviewer", "sandbox"),
        default="fleet",
    )
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--delay", type=float, default=0.0)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args(argv)


def _stop_after(mode: str) -> str:
    return {
        "planner": "planner",
        "coders": "coders",
        "reviewer": "reviewer",
        "sandbox": "sandbox",
        "fleet": "sandbox",
    }[mode]


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.workers < 1:
        print("workers must be >= 1", file=sys.stderr)
        return 2
    workdir = args.workdir.expanduser()
    coordinator = FleetCoordinator(
        workdir=workdir, workers=args.workers, delay=args.delay
    )
    report = asyncio.run(
        coordinator.run_fleet(args.mission, stop_after=_stop_after(args.mode))
    )
    report_path = workdir / "fleet_report.json"
    workdir.mkdir(parents=True, exist_ok=True)
    payload = asdict(report)
    report_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if report.tests_passed or args.mode in {"planner", "coders"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
