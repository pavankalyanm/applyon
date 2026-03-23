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

# ── Detect OS ─────────────────────────────────────────────────────────────────
OS="$(uname -s)"

# ── Python auto-install helpers ───────────────────────────────────────────────
install_python_mac() {
    echo "${YELLOW}→${RESET} Installing Python 3.12 via Homebrew..."
    if ! command -v brew >/dev/null 2>&1; then
        echo "${YELLOW}→${RESET} Homebrew not found — installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add Homebrew to PATH for Apple Silicon and Intel
        if [ -f "/opt/homebrew/bin/brew" ]; then
            export PATH="/opt/homebrew/bin:$PATH"
            echo 'export PATH="/opt/homebrew/bin:$PATH"' >> "$HOME/.zshrc"
        elif [ -f "/usr/local/bin/brew" ]; then
            export PATH="/usr/local/bin:$PATH"
        fi
    fi
    brew install python@3.12
    # Export the brewed Python to PATH
    BREW_PYTHON_BIN="$(brew --prefix python@3.12)/bin"
    export PATH="$BREW_PYTHON_BIN:$PATH"
    # Persist to shell profiles
    for profile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
        if [ -f "$profile" ] && ! grep -q "$BREW_PYTHON_BIN" "$profile" 2>/dev/null; then
            echo "" >> "$profile"
            echo "# Python 3.12 (installed by Jobcook)" >> "$profile"
            echo "export PATH=\"$BREW_PYTHON_BIN:\$PATH\"" >> "$profile"
        fi
    done
    echo "${GREEN}✓${RESET} Python 3.12 installed via Homebrew"
}

install_python_linux() {
    echo "${YELLOW}→${RESET} Installing Python 3.12..."
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq
        sudo apt-get install -y python3.12 python3.12-venv python3-pip
        # Make python3.12 the default python3 if needed
        if ! command -v python3 >/dev/null 2>&1 || [ "$(python3 -c 'import sys; print(sys.version_info.minor)')" -lt 10 ]; then
            sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 2>/dev/null || true
        fi
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y python3.12 python3.12-pip
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y python3.12
    else
        echo "${RED}Error:${RESET} Could not detect package manager. Install Python 3.12 manually from https://www.python.org/downloads/"
        exit 1
    fi
    echo "${GREEN}✓${RESET} Python 3.12 installed"
}

# ── Check / install Python ────────────────────────────────────────────────────
PYTHON3=""
NEED_INSTALL=0

# Find python3 binary
if command -v python3.12 >/dev/null 2>&1; then
    PYTHON3="python3.12"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON3="python3"
else
    NEED_INSTALL=1
fi

# Check version if found
if [ "$NEED_INSTALL" -eq 0 ] && [ -n "$PYTHON3" ]; then
    PY_MAJOR=$("$PYTHON3" -c "import sys; print(sys.version_info.major)")
    PY_MINOR=$("$PYTHON3" -c "import sys; print(sys.version_info.minor)")
    PY_VERSION=$("$PYTHON3" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
        echo "${YELLOW}!${RESET} Python $PY_VERSION found but 3.10+ required — installing Python 3.12..."
        NEED_INSTALL=1
    fi
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
    if [ "$OS" = "Darwin" ]; then
        install_python_mac
    elif [ "$OS" = "Linux" ]; then
        install_python_linux
    else
        echo "${RED}Error:${RESET} Automatic Python install not supported on $OS."
        echo "Download Python 3.12 from https://www.python.org/downloads/ and re-run."
        exit 1
    fi
    # Re-detect after install
    if command -v python3.12 >/dev/null 2>&1; then
        PYTHON3="python3.12"
    elif command -v python3 >/dev/null 2>&1; then
        PYTHON3="python3"
    else
        echo "${RED}Error:${RESET} Python install failed. Please install Python 3.12 manually."
        exit 1
    fi
fi

PY_VERSION=$("$PYTHON3" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "${GREEN}✓${RESET} Python $PY_VERSION"

# ── Check git (auto-install) ───────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
    echo "${YELLOW}→${RESET} git not found — installing..."
    if [ "$OS" = "Darwin" ]; then
        xcode-select --install 2>/dev/null || brew install git
    elif [ "$OS" = "Linux" ]; then
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get install -y git
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y git
        fi
    fi
fi
echo "${GREEN}✓${RESET} git available"

# ── Check Chrome ──────────────────────────────────────────────────────────────
CHROME_FOUND=0
for candidate in \
    "google-chrome" "google-chrome-stable" "chromium" "chromium-browser" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/usr/bin/google-chrome"
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

# ── Create venv + install package ─────────────────────────────────────────────
echo "Installing dependencies ..."
"$PYTHON3" -m venv "$VENV_DIR" --clear
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

# ── Symlink to /usr/local/bin so jobcook works immediately without rehashing ──
SYMLINK_TARGET="/usr/local/bin/jobcook"
if ln -sf "$JOBCOOK_BIN/jobcook" "$SYMLINK_TARGET" 2>/dev/null; then
    echo "${GREEN}✓${RESET} jobcook available globally (/usr/local/bin)"
elif sudo ln -sf "$JOBCOOK_BIN/jobcook" "$SYMLINK_TARGET" 2>/dev/null; then
    echo "${GREEN}✓${RESET} jobcook available globally (/usr/local/bin)"
else
    echo "${YELLOW}Note:${RESET} Open a new terminal (or run: source ~/.zshrc) to use jobcook"
fi

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
