#!/usr/bin/env bash

# Detect OS
case "$(uname -s)" in
    Darwin*)  OS="mac";;
    MINGW*|MSYS*|CYGWIN*) OS="win";;
    *)        OS="other";;
esac

# Check if Python is installed
if ! (python3 -V &> /dev/null || python -V &> /dev/null || py -V &> /dev/null); then
    while ! (python3 -V &> /dev/null || python -V &> /dev/null || py -V &> /dev/null); do
        echo "Python is not installed or not accessible!"
        echo "Please install Python and make sure it is added to your system's PATH."
        echo "https://www.python.org/downloads/"
        echo "After installing Python, close and reopen setup file."
        read -p "Press Enter to retry..."
    done
else
    echo "Python is already installed."
fi

# Prefer Python 3.10+ (README requirement)
PYTHON=""
for p in python3.12 python3.11 python3.10 python3; do
    if $p -c "import sys; exit(0 if sys.version_info >= (3,10) else 1)" 2>/dev/null; then
        PYTHON=$p
        break
    fi
done
[ -z "$PYTHON" ] && PYTHON="python3"
echo "Using: $($PYTHON --version 2>/dev/null || true)"

# Install required Python packages (from README); use venv if system pip is externally managed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"
echo "Installing Python packages..."
if $PYTHON -m pip install undetected-chromedriver pyautogui setuptools openai flask-cors flask 2>/dev/null; then
    echo "Python packages installed (system or user)."
elif [ -d "$VENV_DIR" ] && [ -x "$VENV_DIR/bin/pip" ]; then
    "$VENV_DIR/bin/pip" install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null && echo "Python packages installed into .venv." || \
    "$VENV_DIR/bin/pip" install undetected-chromedriver pyautogui setuptools openai flask-cors flask
else
    echo "Creating virtual environment at $VENV_DIR ..."
    $PYTHON -m venv "$VENV_DIR" && "$VENV_DIR/bin/pip" install --upgrade pip && "$VENV_DIR/bin/pip" install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null || \
    "$VENV_DIR/bin/pip" install undetected-chromedriver pyautogui setuptools openai flask-cors flask
    echo "Python packages installed into .venv. Run the bot with: .venv/bin/python runAiBot.py"
fi
echo "Python packages done."

# Check if Google Chrome is installed
if [ "$OS" = "mac" ]; then
    if [ ! -d "/Applications/Google Chrome.app" ]; then
        echo "Google Chrome is not installed or not in the default location."
        echo "Please install from: https://www.google.com/chrome/"
        echo "After installing, run this script again."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "Google Chrome is already installed."
elif [ "$OS" = "win" ]; then
    if ! command -v "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" &> /dev/null 2>&1; then
        echo "Google Chrome is not installed or not in the default location."
        echo "Please install from: https://www.google.com/chrome/"
        read -p "Press Enter to continue..."
    else
        echo "Google Chrome is already installed."
    fi
else
    echo "Assuming Google Chrome is installed."
fi

# ChromeDriver (optional; stealth_mode usually downloads its own)
if [ "$OS" != "mac" ]; then
    # Windows path
    latest_versions_info=$(curl -sS "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json")
    download_url=$(echo "$latest_versions_info" | grep -A 5 '"platform": "win64",' | grep 'url":' | awk -F'"' '{print $4}')
    chrome_install_dir="/c/Program Files/Google/Chrome"
    if [ -n "$download_url" ]; then
        curl -o chromedriver.zip "$download_url"
        mkdir -p "$chrome_install_dir"
        unzip -q -o chromedriver.zip -d "$chrome_install_dir"
        mv "$chrome_install_dir/chromedriver_win64/chromedriver.exe" "$chrome_install_dir" 2>/dev/null || true
        rm -rf "$chrome_install_dir/chromedriver_win64" chromedriver.zip 2>/dev/null
        echo "export PATH=\"\$PATH:${chrome_install_dir}\"" >> ~/.bashrc 2>/dev/null || true
    fi
else
    # macOS: download chromedriver for non-stealth mode (optional)
    latest_versions_info=$(curl -sS "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json")
    if [ -z "$latest_versions_info" ]; then
        echo "Could not fetch ChromeDriver versions (no network?). Stealth mode will download driver when needed."
    else
        arch=$(uname -m)
        if [ "$arch" = "arm64" ]; then
            platform_key="mac-arm64"
        else
            platform_key="mac-x64"
        fi
        download_url=$(echo "$latest_versions_info" | grep -A 2 "\"platform\": \"$platform_key\"" | grep 'url":' | head -1 | awk -F'"' '{print $4}')
        if [ -n "$download_url" ]; then
            echo "Downloading ChromeDriver for $platform_key..."
            curl -sSL -o chromedriver.zip "$download_url"
            DRIVER_DIR="/usr/local/bin"
            if [ -w "$DRIVER_DIR" ] 2>/dev/null; then
                unzip -q -o -j chromedriver.zip "chromedriver-*/chromedriver" -d /tmp/chromedriver_extract 2>/dev/null
                chmod +x /tmp/chromedriver_extract/chromedriver 2>/dev/null
                mv /tmp/chromedriver_extract/chromedriver "$DRIVER_DIR/chromedriver" 2>/dev/null
                rm -rf /tmp/chromedriver_extract chromedriver.zip 2>/dev/null
                echo "ChromeDriver installed to $DRIVER_DIR"
            else
                echo "Skipping ChromeDriver install (no write access to $DRIVER_DIR). Stealth mode will download when needed."
                rm -f chromedriver.zip 2>/dev/null
            fi
        fi
    fi
fi

echo "Setup complete. You can now use the web scraping tool."
read -r -p "Press Enter to continue..."








# # Get the latest ChromeDriver version
# LATEST_VERSION=$(curl -sS https://chromedriver.storage.googleapis.com/LATEST_RELEASE)

# # Download ChromeDriver
# echo "Installing latest version of Google Chrome Driver (${LATEST_VERSION})"
# CHROMEDRIVER_URL="https://chromedriver.storage.googleapis.com/${LATEST_VERSION}/chromedriver_win32.zip"
# CHROMEDRIVER_FILE="chromedriver.zip"
# CHROMEDRIVER_DIR="chromedriver"

# # Download ChromeDriver using certutil
# certutil -urlcache -split -f $CHROMEDRIVER_URL $CHROMEDRIVER_FILE

# # Extract ChromeDriver zip
# unzip $CHROMEDRIVER_FILE -d $CHROMEDRIVER_DIR
# rm $CHROMEDRIVER_FILE

# # Get the absolute path to the current directory
# CURRENT_DIR=$(pwd)

# # Set up environment variables
# echo "setx CHROME_DRIVER_PATH \"${CURRENT_DIR}\\${CHROMEDRIVER_DIR}\\chromedriver.exe\"" >> setup_env.bat
# echo "setx PATH \"%PATH%;${CURRENT_DIR}\\${CHROMEDRIVER_DIR}\"" >> setup_env.bat

# # Run the environment setup script
# cmd.exe /c setup_env.bat

# echo "Setup complete. You can now use the web scraping tool."

# # Remove the environment setup script
# rm setup_env.bat
# read -p "Press any key to continue!"# Get the latest ChromeDriver version
# LATEST_VERSION=$(curl -sS https://chromedriver.storage.googleapis.com/LATEST_RELEASE)

# # Set the destination directory
# CHROME_INSTALL_DIR="C:\\Program Files\\Google\\Chrome"

# # Download ChromeDriver
# echo "Installing latest version of Google Chrome Driver (${LATEST_VERSION})"
# CHROMEDRIVER_URL="https://chromedriver.storage.googleapis.com/${LATEST_VERSION}/chromedriver_win32.zip"
# CHROMEDRIVER_FILE="chromedriver.zip"
# CHROMEDRIVER_DIR="$CHROME_INSTALL_DIR"

# # Create the destination directory if it doesn't exist
# mkdir -p "$CHROME_INSTALL_DIR"

# # Download ChromeDriver using certutil
# certutil -urlcache -split -f $CHROMEDRIVER_URL $CHROMEDRIVER_FILE

# # Extract ChromeDriver zip to the installation directory
# unzip $CHROMEDRIVER_FILE -d $CHROME_INSTALL_DIR
# rm $CHROMEDRIVER_FILE

# echo "Setup complete. You can now use the web scraping tool."
