@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Launcher

REM ==========================================================
REM MelroseOS Enterprise
REM Master Launcher
REM Version 4.0.0
REM ==========================================================

set "BUILD_DIR=%~dp0"

for %%I in ("%BUILD_DIR%..") do (
    set "ROOT=%%~fI"
)

set "CONFIG_FILE=%ROOT%\MelroseOS.config"

if not exist "%CONFIG_FILE%" (
    echo.
    echo [FAIL] MelroseOS.config not found.
    pause
    exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    set "%%A=%%B"
)

:MENU

cls

echo.
echo ==========================================================
echo               MELROSEOS ENTERPRISE
echo ==========================================================
echo.
echo   1. Full Build / Commit / Push
echo   2. Install Modules
echo   3. Validate Project
echo   4. Commit / Push Only
echo   5. Create New Module
echo   6. Open Development Folder
echo   7. Open Repository
echo   8. Git Status
echo   9. Latest Commit
echo   0. Exit
echo.
echo ==========================================================
echo.

set /p OPTION=Select Option: 

if "%OPTION%"=="1" goto FULLBUILD
if "%OPTION%"=="2" goto INSTALL
if "%OPTION%"=="3" goto VALIDATE
if "%OPTION%"=="4" goto COMMIT
if "%OPTION%"=="5" goto NEWMODULE
if "%OPTION%"=="6" goto OPENDEV
if "%OPTION%"=="7" goto OPENREPO
if "%OPTION%"=="8" goto GITSTATUS
if "%OPTION%"=="9" goto LATEST
if "%OPTION%"=="0" goto END

goto MENU

:FULLBUILD

cls

call "%BUILD_DIR%Build-MelroseOS.bat"

pause
goto MENU

:INSTALL

cls

call "%BUILD_DIR%Install-Module.bat"

pause
goto MENU

:VALIDATE

cls

call "%BUILD_DIR%Validate-MelroseOS.bat"

pause
goto MENU

:COMMIT

cls

call "%BUILD_DIR%Commit-MelroseOS.bat"

pause
goto MENU

:NEWMODULE

cls

call "%BUILD_DIR%New-Module.bat"

pause
goto MENU

:OPENDEV

if not exist "%DEVELOPMENT%" (
    mkdir "%DEVELOPMENT%"
)

explorer "%DEVELOPMENT%"

goto MENU

:OPENREPO

explorer "%ROOT%"

goto MENU

:GITSTATUS

cls

cd /d "%ROOT%"

echo.
echo ==========================================================
echo GIT STATUS
echo ==========================================================
echo.

git status

echo.
pause
goto MENU

:LATEST

cls

cd /d "%ROOT%"

echo.
echo ==========================================================
echo LATEST COMMIT
echo ==========================================================
echo.

git log --oneline -1

echo.
pause
goto MENU

:END

exit /b 0