"""
Install Jobcook as a background OS service so it starts automatically.
Supports: macOS (launchd), Linux (systemd user), Windows (Task Scheduler).
"""
from __future__ import annotations

import os
import platform
import subprocess
import sys
from pathlib import Path


def _jobcook_exe() -> str:
    """Path to the installed jobcook binary."""
    scripts = Path(sys.executable).parent
    exe = scripts / "jobcook"
    if not exe.exists():
        exe = scripts / "jobcook.exe"
    return str(exe) if exe.exists() else "jobcook"


# ── macOS ────────────────────────────────────────────────────────────────────

LAUNCHD_LABEL = "com.jobcook.agent"
LAUNCHD_PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LAUNCHD_LABEL}.plist"


def _mac_plist(log_dir: Path) -> str:
    exe = _jobcook_exe()
    log_dir.mkdir(parents=True, exist_ok=True)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{LAUNCHD_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{exe}</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{log_dir}/jobcook.log</string>
    <key>StandardErrorPath</key>
    <string>{log_dir}/jobcook.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>{Path(sys.executable).parent}:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
"""


def install_mac() -> str:
    log_dir = Path.home() / ".jobcook" / "logs"
    LAUNCHD_PLIST.parent.mkdir(parents=True, exist_ok=True)
    LAUNCHD_PLIST.write_text(_mac_plist(log_dir))
    subprocess.run(["launchctl", "unload", str(LAUNCHD_PLIST)], capture_output=True)
    subprocess.run(["launchctl", "load", "-w", str(LAUNCHD_PLIST)], check=True)
    return f"Service installed and started. Logs: {log_dir}/jobcook.log"


def uninstall_mac() -> str:
    if LAUNCHD_PLIST.exists():
        subprocess.run(["launchctl", "unload", str(LAUNCHD_PLIST)], capture_output=True)
        LAUNCHD_PLIST.unlink()
    return "Service removed."


# ── Linux ────────────────────────────────────────────────────────────────────

SYSTEMD_SERVICE = Path.home() / ".config" / "systemd" / "user" / "jobcook.service"


def _linux_unit() -> str:
    exe = _jobcook_exe()
    return f"""[Unit]
Description=Jobcook Agent
After=network.target

[Service]
ExecStart={exe} start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="PATH={Path(sys.executable).parent}:/usr/local/bin:/usr/bin:/bin"

[Install]
WantedBy=default.target
"""


def install_linux() -> str:
    SYSTEMD_SERVICE.parent.mkdir(parents=True, exist_ok=True)
    SYSTEMD_SERVICE.write_text(_linux_unit())
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", "jobcook"], check=True)
    return "Service installed and started. Use 'journalctl --user -u jobcook -f' to view logs."


def uninstall_linux() -> str:
    subprocess.run(["systemctl", "--user", "disable", "--now", "jobcook"], capture_output=True)
    if SYSTEMD_SERVICE.exists():
        SYSTEMD_SERVICE.unlink()
    subprocess.run(["systemctl", "--user", "daemon-reload"], capture_output=True)
    return "Service removed."


# ── Windows ──────────────────────────────────────────────────────────────────

def install_windows() -> str:
    exe = _jobcook_exe()
    task_name = "JobcookAgent"
    cmd = [
        "schtasks", "/Create", "/F",
        "/TN", task_name,
        "/SC", "ONLOGON",
        "/TR", f'"{exe}" start',
        "/RL", "HIGHEST",
    ]
    subprocess.run(cmd, check=True)
    subprocess.run(["schtasks", "/Run", "/TN", task_name], check=True)
    return f"Task '{task_name}' created and started."


def uninstall_windows() -> str:
    subprocess.run(
        ["schtasks", "/Delete", "/F", "/TN", "JobcookAgent"],
        capture_output=True,
    )
    return "Task removed."


# ── Dispatch ─────────────────────────────────────────────────────────────────

def install() -> str:
    os_name = platform.system()
    if os_name == "Darwin":
        return install_mac()
    elif os_name == "Linux":
        return install_linux()
    elif os_name == "Windows":
        return install_windows()
    else:
        raise NotImplementedError(f"Service install not supported on {os_name}")


def uninstall() -> str:
    os_name = platform.system()
    if os_name == "Darwin":
        return uninstall_mac()
    elif os_name == "Linux":
        return uninstall_linux()
    elif os_name == "Windows":
        return uninstall_windows()
    else:
        raise NotImplementedError(f"Service uninstall not supported on {os_name}")
