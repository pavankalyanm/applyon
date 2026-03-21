"""
Jobcook CLI — entry point for the `jobcook` command.

Commands:
  jobcook login            — save API URL + token
  jobcook start            — start the agent (foreground or via service)
  jobcook stop             — stop the background service
  jobcook install-service  — install as OS background service (auto-start on login)
  jobcook uninstall-service — remove OS service
  jobcook status           — show connection info and pre-flight checks
  jobcook logout           — remove saved credentials
"""
from __future__ import annotations

import asyncio
import sys

import click
from rich.console import Console
from rich.table import Table

from . import __version__
from . import config as cfg
from . import checks, service

console = Console()


def _require_creds() -> tuple[str, str]:
    api_url = cfg.get_api_url()
    token = cfg.get_token()
    if not api_url or not token:
        console.print(
            "[red]Not logged in.[/red] Run [bold]jobcook login[/bold] first."
        )
        sys.exit(1)
    return api_url, token


# ── login ────────────────────────────────────────────────────────────────────

@click.command()
@click.option("--url", prompt="Backend URL", default="http://localhost:8000", show_default=True)
@click.option("--email", prompt="Email")
@click.option("--password", prompt="Password", hide_input=True)
def login(url: str, email: str, password: str) -> None:
    """Log in with your email and password."""
    import httpx
    url = url.rstrip("/")
    with console.status("Signing in..."):
        try:
            r = httpx.post(
                f"{url}/auth/login",
                json={"email": email, "password": password},
                timeout=10,
            )
            r.raise_for_status()
            token = r.json()["access_token"]
        except httpx.HTTPStatusError as exc:
            console.print(f"[red]Login failed:[/red] {exc.response.status_code} — {exc.response.text}")
            sys.exit(1)
        except Exception as exc:
            console.print(f"[red]Could not reach backend:[/red] {exc}")
            sys.exit(1)

    cfg.set_credentials(url, token)
    console.print(f"[green]Logged in as {email}[/green]")
    console.print("Run [bold]jobcook start[/bold] to launch the agent.")


# ── logout ───────────────────────────────────────────────────────────────────

@click.command()
def logout() -> None:
    """Remove saved credentials."""
    cfg.clear()
    console.print("Logged out.")


# ── status ───────────────────────────────────────────────────────────────────

@click.command()
def status() -> None:
    """Show credentials and run pre-flight checks."""
    api_url = cfg.get_api_url()
    token = cfg.get_token()

    console.print(f"\n[bold]Jobcook[/bold] v{__version__}\n")
    console.print(f"  Backend URL : {api_url or '[dim]not set[/dim]'}")
    console.print(f"  Token       : {'[green]saved[/green]' if token else '[red]not set[/red]'}")
    console.print()

    table = Table(show_header=True, header_style="bold")
    table.add_column("Check")
    table.add_column("Result")
    table.add_column("Detail")

    for name, passed, detail in checks.run_all():
        icon = "[green]OK[/green]" if passed else "[red]FAIL[/red]"
        table.add_row(name, icon, detail)

    console.print(table)
    console.print()


# ── start ────────────────────────────────────────────────────────────────────

@click.command()
def start() -> None:
    """Start the Jobcook agent (runs in foreground)."""
    api_url, token = _require_creds()

    # Pre-flight
    failed = [name for name, passed, _ in checks.run_all() if not passed]
    if failed:
        console.print(f"[red]Pre-flight checks failed:[/red] {', '.join(failed)}")
        console.print("Run [bold]jobcook status[/bold] for details.")
        sys.exit(1)

    console.print(f"[bold]Jobcook[/bold] v{__version__} — starting agent")
    console.print(f"Backend: {api_url}")
    console.print("Press Ctrl+C to stop.\n")

    from .agent import run as run_agent

    def on_status(msg: str) -> None:
        console.print(f"[dim]{msg}[/dim]")

    try:
        asyncio.run(run_agent(api_url, token, on_status=on_status))
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped.[/yellow]")


# ── install-service ───────────────────────────────────────────────────────────

@click.command("install-service")
def install_service() -> None:
    """Install Jobcook as a background service (auto-starts on login)."""
    _require_creds()
    with console.status("Installing service..."):
        try:
            msg = service.install()
        except Exception as exc:
            console.print(f"[red]Failed:[/red] {exc}")
            sys.exit(1)
    console.print(f"[green]{msg}[/green]")
    console.print("Jobcook will now start automatically on login.")


# ── uninstall-service ─────────────────────────────────────────────────────────

@click.command("uninstall-service")
def uninstall_service() -> None:
    """Remove the Jobcook background service."""
    with console.status("Removing service..."):
        try:
            msg = service.uninstall()
        except Exception as exc:
            console.print(f"[red]Failed:[/red] {exc}")
            sys.exit(1)
    console.print(f"[green]{msg}[/green]")


# ── main group ────────────────────────────────────────────────────────────────

@click.group()
@click.version_option(__version__, prog_name="jobcook")
def main() -> None:
    """Jobcook — AI job application agent."""


main.add_command(login)
main.add_command(logout)
main.add_command(status)
main.add_command(start)
main.add_command(install_service)
main.add_command(uninstall_service)
