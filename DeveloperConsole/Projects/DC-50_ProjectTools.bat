@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"

set "REGISTER=%ROOT%\Build\Register-MelroseOS-Projects.bat"
if not exist "%REGISTER%" set "REGISTER=%ROOT%\Register-MelroseOS-Projects.bat"

set "PREVIEW=%ROOT%\Build\Preview-MelroseOS-Projects.bat"
if not exist "%PREVIEW%" set "PREVIEW=%ROOT%\Preview-MelroseOS-Projects.bat"

set "PROJECTS=%ROOT%\PROJECTS"
set "DEVTOOLS=%ROOT%\tools\DEVTOOLS\ProjectRegistration"

if /I "%~1"=="REGISTER" goto REGISTER
if /I "%~1"=="PREVIEW" goto PREVIEW
if /I "%~1"=="OPEN" goto OPEN
if /I "%~1"=="DEVTOOLS" goto DEVTOOLS

echo [FAIL] Unknown project action.
pause
exit /b 1

:REGISTER
if not exist "%REGISTER%" (
    echo [FAIL] Register-MelroseOS-Projects.bat not found.
    echo Checked repository root and Build folder.
    pause
    exit /b 1
)
call "%REGISTER%"
pause
exit /b %errorlevel%

:PREVIEW
if not exist "%PREVIEW%" (
    echo [FAIL] Preview-MelroseOS-Projects.bat not found.
    echo Checked repository root and Build folder.
    pause
    exit /b 1
)
call "%PREVIEW%"
pause
exit /b %errorlevel%

:OPEN
if not exist "%PROJECTS%" mkdir "%PROJECTS%"
start "" explorer "%PROJECTS%"
exit /b 0

:DEVTOOLS
if not exist "%DEVTOOLS%" (
    echo [FAIL] ProjectRegistration tools folder not found:
    echo %DEVTOOLS%
    pause
    exit /b 1
)
start "" explorer "%DEVTOOLS%"
exit /b 0
