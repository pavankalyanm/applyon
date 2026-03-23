@echo off
setlocal EnableDelayedExpansion

set "REPO_URL=https://github.com/pavankalyanm/applyon.git"
set "INSTALL_DIR=%USERPROFILE%\.jobcook\app"
set "VENV_DIR=%USERPROFILE%\.jobcook\venv"

echo.
echo Jobcook Installer
echo =====================================

:: ── Find Python 3.10+ ─────────────────────────────────────────────────────────
set "PYTHON_EXE="

for %%c in (py python3 python) do (
    if "!PYTHON_EXE!" == "" (
        where %%c >nul 2>&1
        if !errorlevel! == 0 (
            %%c -c "import sys; exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
            if !errorlevel! == 0 set "PYTHON_EXE=%%c"
        )
    )
)

if "!PYTHON_EXE!" == "" (
    echo [!] Python 3.10+ not found. Installing Python 3.12 via winget...
    where winget >nul 2>&1
    if !errorlevel! == 0 (
        winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        if !errorlevel! neq 0 (
            echo [!] winget install failed.
            goto :python_manual
        )
        :: Refresh PATH for this session
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        if not exist "!PYTHON_EXE!" set "PYTHON_EXE=python"
        :: Verify
        "!PYTHON_EXE!" --version >nul 2>&1
        if !errorlevel! neq 0 (
            echo [!] Python installed but not in PATH yet.
            echo     Please close and reopen CMD, then re-run this installer.
            pause
            exit /b 1
        )
    ) else (
        :python_manual
        echo.
        echo [!] Please install Python 3.12 manually:
        echo     1. Go to https://www.python.org/downloads/
        echo     2. Download Python 3.12
        echo     3. Check "Add Python to PATH" during installation
        echo     4. Re-run this installer
        echo.
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%v in ('!PYTHON_EXE! --version 2^>^&1') do echo [OK] %%v

:: ── Check / install git ───────────────────────────────────────────────────────
where git >nul 2>&1
if !errorlevel! neq 0 (
    echo [!] git not found. Installing via winget...
    where winget >nul 2>&1
    if !errorlevel! == 0 (
        winget install -e --id Git.Git --silent --accept-package-agreements --accept-source-agreements
        set "PATH=%PATH%;C:\Program Files\Git\cmd"
    ) else (
        echo [!] Please install git from https://git-scm.com/downloads and re-run.
        pause
        exit /b 1
    )
)
echo [OK] git available

:: ── Check Chrome ─────────────────────────────────────────────────────────────
set "CHROME_FOUND=0"
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"

if "!CHROME_FOUND!" == "1" (
    echo [OK] Google Chrome found
) else (
    echo [!] Google Chrome not found — install from https://www.google.com/chrome
    echo     The agent will install but the bot won't run without Chrome.
)

:: ── Download / update repo ────────────────────────────────────────────────────
echo.
if exist "%INSTALL_DIR%\.git" (
    echo Updating Jobcook in %INSTALL_DIR% ...
    git -C "%INSTALL_DIR%" pull --quiet
) else (
    echo Downloading Jobcook to %INSTALL_DIR% ...
    if not exist "%USERPROFILE%\.jobcook" mkdir "%USERPROFILE%\.jobcook"
    git clone --quiet --depth 1 "%REPO_URL%" "%INSTALL_DIR%"
)
echo [OK] Code ready

:: ── Create venv + install ─────────────────────────────────────────────────────
echo Installing dependencies ...
!PYTHON_EXE! -m venv "%VENV_DIR%"
if !errorlevel! neq 0 (
    echo [!] Failed to create virtual environment. Try running as Administrator.
    pause
    exit /b 1
)
"%VENV_DIR%\Scripts\pip" install -e "%INSTALL_DIR%" --quiet
if !errorlevel! neq 0 (
    echo [!] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Jobcook installed

:: ── Add Scripts dir to user PATH ─────────────────────────────────────────────
set "JOBCOOK_BIN=%VENV_DIR%\Scripts"
set "PATH=!JOBCOOK_BIN!;!PATH!"

:: Add permanently to user PATH in registry
for /f "skip=2 tokens=3*" %%a in ('reg query HKCU\Environment /v PATH 2^>nul') do set "CUR_PATH=%%a %%b"
echo !CUR_PATH! | find /i "!JOBCOOK_BIN!" >nul 2>&1
if !errorlevel! neq 0 (
    setx PATH "!JOBCOOK_BIN!;!CUR_PATH!" >nul 2>&1
    echo [OK] Added to PATH ^(restart CMD to use jobcook globally^)
)

:: ── Done ──────────────────────────────────────────────────────────────────────
echo.
echo Jobcook installed successfully!
echo.
echo Next steps:
echo   1. jobcook login             -- connect to your account
echo   2. jobcook install-service   -- auto-start on login ^(recommended^)
echo   3. Open the web app and click Run
echo.
echo That's it. The web app controls everything from here.
echo.
pause
endlocal
