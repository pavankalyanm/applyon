#!/bin/sh
# Jobcook install script
# Usage: curl -sSL https://applyflowai.com/install | sh
set -e

REPO_URL="https://github.com/pavankalyanm/applyon.git"
INSTALL_DIR="$HOME/.jobcook/app"
VENV_DIR="$HOME/.jobcook/venv"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo "${BOLD}Jobcook Installer${RESET}"
echo "─────────────────────────────────────"

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 >/dev/null 2>&1; then
    echo "${RED}Error:${RESET} Python 3 is not installed."
    echo "Install it from https://www.python.org/downloads/ and re-run."
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]; }; then
    echo "${RED}Error:${RESET} Python 3.10+ required, found $PYTHON_VERSION"
    echo "Install a newer version from https://www.python.org/downloads/"
    exit 1
fi
echo "${GREEN}✓${RESET} Python $PYTHON_VERSION"

# ── Check pip ─────────────────────────────────────────────────────────────────
if ! python3 -m pip --version >/dev/null 2>&1; then
    echo "${RED}Error:${RESET} pip is not available."
    echo "Run: python3 -m ensurepip --upgrade"
    exit 1
fi
echo "${GREEN}✓${RESET} pip available"

# ── Check git ─────────────────────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
    echo "${RED}Error:${RESET} git is not installed."
    echo "Install it from https://git-scm.com/downloads and re-run."
    exit 1
fi
echo "${GREEN}✓${RESET} git available"

# ── Check Chrome ─────────────────────────────────────────────────────────────
CHROME_FOUND=0
for candidate in \
    "google-chrome" "google-chrome-stable" "chromium" "chromium-browser" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/usr/bin/google-chrome" \
    "C:/Program Files/Google/Chrome/Application/chrome.exe"
do
    if command -v "$candidate" >/dev/null 2>&1 || [ -f "$candidate" ]; then
        CHROME_FOUND=1
        break
    fi
done

if [ "$CHROME_FOUND" -eq 1 ]; then
    echo "${GREEN}✓${RESET} Google Chrome found"
else
    echo "${YELLOW}!${RESET} Google Chrome not found — install it from https://www.google.com/chrome"
    echo "  The agent will install but the bot won't run without Chrome."
fi

# ── Download / update repo ────────────────────────────────────────────────────
echo ""
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating Jobcook in $INSTALL_DIR ..."
    git -C "$INSTALL_DIR" pull --quiet
else
    echo "Downloading Jobcook to $INSTALL_DIR ..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --quiet --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
echo "${GREEN}✓${RESET} Code ready"

# ── Create venv + install package ────────────────────────────────────────────
echo "Installing dependencies ..."
python3 -m venv "$VENV_DIR" --clear
"$VENV_DIR/bin/pip" install -e "$INSTALL_DIR" --quiet
echo "${GREEN}✓${RESET} Jobcook installed"

# ── Add venv bin to PATH via shell profile ────────────────────────────────────
JOBCOOK_BIN="$VENV_DIR/bin"
EXPORT_LINE="export PATH=\"$JOBCOOK_BIN:\$PATH\""

for profile in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$profile" ]; then
        if ! grep -q "$JOBCOOK_BIN" "$profile" 2>/dev/null; then
            echo "" >> "$profile"
            echo "# Jobcook agent" >> "$profile"
            echo "$EXPORT_LINE" >> "$profile"
        fi
    fi
done

export PATH="$JOBCOOK_BIN:$PATH"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "${GREEN}${BOLD}Jobcook installed successfully!${RESET}"
echo ""
echo "Next steps:"
echo "  ${BOLD}1.${RESET} jobcook login             — connect to your account"
echo "  ${BOLD}2.${RESET} jobcook install-service    — auto-start on login (recommended)"
echo "  ${BOLD}3.${RESET} Open the web app and click Run"
echo ""
echo "That's it. The web app controls everything from here."
echo ""
