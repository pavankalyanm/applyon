"""
Runs the bot subprocess on the user's machine.
Mirrors the subprocess-management logic from backend/bot_runner.py
but without DB access — all results are sent back via callbacks.
"""
from __future__ import annotations

import asyncio
import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable, Awaitable

from .checks import find_bot_entry

BOT_DIR = (Path(__file__).resolve().parent.parent / "bot")


def _resolve_python() -> str:
    return sys.executable


class BotProcess:
    def __init__(self, run_id: int):
        self.run_id = run_id
        self._process: subprocess.Popen | None = None
        self._stop_file: Path | None = None
        self._thread: threading.Thread | None = None

    def start(
        self,
        config: dict,
        on_line: Callable[[str], Awaitable[None]],
        on_done: Callable[[int], Awaitable[None]],
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        self._thread = threading.Thread(
            target=self._run,
            args=(config, on_line, on_done, loop),
            daemon=True,
        )
        self._thread.start()

    def _run(
        self,
        config: dict,
        on_line: Callable[[str], Awaitable[None]],
        on_done: Callable[[int], Awaitable[None]],
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        tmp_dir = Path(tempfile.mkdtemp(prefix="jobcook_"))
        config_file = tmp_dir / f"run_{self.run_id}.config.json"
        stop_file = tmp_dir / f"run_{self.run_id}.stop"
        self._stop_file = stop_file
        config_file.write_text(json.dumps(config), encoding="utf-8")

        bot_entry = find_bot_entry()
        if not bot_entry:
            asyncio.run_coroutine_threadsafe(
                on_line("[Jobcook] ERROR: bot/runAiBot.py not found"), loop
            ).result()
            asyncio.run_coroutine_threadsafe(on_done(1), loop).result()
            return

        log_file = tmp_dir / f"run_{self.run_id}.log"

        env = os.environ.copy()
        env["PYTHONPATH"] = f"{BOT_DIR}:{env.get('PYTHONPATH', '')}"
        env["BOT_STOP_FILE"] = str(stop_file)
        env["BOT_CONFIG_PATH"] = str(config_file)
        env["PYTHONUNBUFFERED"] = "1"
        # Jobcook streams output to the web UI — always suppress tkinter dialogs
        env["BOT_DISABLE_DIALOGS"] = "1"
        # Unique log file per run to avoid file-locking conflicts
        env["BOT_LOG_FILE"] = str(log_file)

        python_exe = _resolve_python()
        try:
            self._process = subprocess.Popen(
                [python_exe, "-u", str(bot_entry)],
                cwd=str(bot_entry.parent.parent),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
        except Exception as exc:
            asyncio.run_coroutine_threadsafe(
                on_line(f"[Jobcook] Failed to start bot: {exc}"), loop
            ).result()
            asyncio.run_coroutine_threadsafe(on_done(1), loop).result()
            return

        assert self._process.stdout is not None
        for line in self._process.stdout:
            raw = line.rstrip("\n")
            asyncio.run_coroutine_threadsafe(on_line(raw), loop)

        self._process.wait()
        exit_code = self._process.returncode

        # cleanup
        try:
            config_file.unlink(missing_ok=True)
            stop_file.unlink(missing_ok=True)
            tmp_dir.rmdir()
        except Exception:
            pass

        asyncio.run_coroutine_threadsafe(on_done(exit_code), loop).result()

    def stop(self) -> None:
        if self._stop_file:
            self._stop_file.write_text("stop", encoding="utf-8")

    def kill(self) -> None:
        self.stop()
        if not self._process:
            return
        pid = self._process.pid
        try:
            os.killpg(pid, signal.SIGTERM)
        except Exception:
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                pass
        deadline = time.monotonic() + 2.0
        while time.monotonic() < deadline:
            if self._process.poll() is not None:
                return
            time.sleep(0.1)
        try:
            os.killpg(pid, signal.SIGKILL)
        except Exception:
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass


class RunnerManager:
    """Manages multiple concurrent BotProcess instances."""

    def __init__(self):
        self._runs: dict[int, BotProcess] = {}

    def start(
        self,
        run_id: int,
        config: dict,
        on_line: Callable[[str], Awaitable[None]],
        on_done: Callable[[int], Awaitable[None]],
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        proc = BotProcess(run_id)
        self._runs[run_id] = proc
        proc.start(config, on_line, on_done, loop)

    def stop(self, run_id: int) -> None:
        proc = self._runs.get(run_id)
        if proc:
            proc.stop()

    def kill(self, run_id: int) -> None:
        proc = self._runs.get(run_id)
        if proc:
            proc.kill()

    def remove(self, run_id: int) -> None:
        self._runs.pop(run_id, None)
