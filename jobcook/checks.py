"""
Pre-flight checks: Chrome, Python version, bot entry point.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path


def find_chrome() -> str | None:
    candidates = [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        # macOS
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        # Windows
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
        found = shutil.which(c)
        if found:
            return found
    return None


def check_python_version() -> tuple[bool, str]:
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 10):
        return False, f"Python 3.10+ required, found {major}.{minor}"
    return True, f"Python {major}.{minor}"


def find_bot_entry() -> Path | None:
    """Find runAiBot.py relative to this package (works for editable installs)."""
    candidate = Path(__file__).resolve().parent.parent / "bot" / "runAiBot.py"
    if candidate.exists():
        return candidate
    return None


def run_all() -> list[tuple[str, bool, str]]:
    """Returns list of (check_name, passed, message)."""
    results = []

    ok, msg = check_python_version()
    results.append(("Python version", ok, msg))

    chrome = find_chrome()
    results.append((
        "Google Chrome",
        chrome is not None,
        chrome or "Not found — install Chrome from https://www.google.com/chrome",
    ))

    bot = find_bot_entry()
    results.append((
        "Bot entry point",
        bot is not None,
        str(bot) if bot else "bot/runAiBot.py not found",
    ))

    return results
