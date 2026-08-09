@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Documentation Builder

REM ==========================================================
REM MelroseOS Enterprise
REM Documentation Builder
REM Version 2.0.0
REM ==========================================================

REM ----------------------------------------------------------
REM Locate Repository
REM ----------------------------------------------------------

set "BUILD_DIR=%~dp0"

for %%I in ("%BUILD_DIR%..") do (
    set "ROOT=%%~fI"
)

set "DOCS=%ROOT%\Documentation"

cls

echo.
echo ==========================================================
echo         MELROSEOS DOCUMENTATION BUILDER
echo ==========================================================
echo.

REM ----------------------------------------------------------
REM Create Root Folder
REM ----------------------------------------------------------

if not exist "%DOCS%" (
    mkdir "%DOCS%"
)

REM ----------------------------------------------------------
REM Create Documentation Folders
REM ----------------------------------------------------------

call :CreateFolder Decisions
call :CreateFolder MeetingNotes
call :CreateFolder Diagrams
call :CreateFolder Images
call :CreateFolder Templates
call :CreateFolder References

echo.
echo ----------------------------------------------------------
echo Creating Documentation Files
echo ----------------------------------------------------------
echo.

call :CreateDoc "00-Project-Overview.md"
call :CreateDoc "01-Architecture.md"
call :CreateDoc "02-Build-System.md"
call :CreateDoc "03-Git-Workflow.md"
call :CreateDoc "04-Folder-Structure.md"
call :CreateDoc "05-Coding-Standards.md"
call :CreateDoc "06-Module-Reference.md"
call :CreateDoc "07-Enterprise-Roadmap.md"
call :CreateDoc "08-Release-Notes.md"
call :CreateDoc "09-Troubleshooting.md"

echo.
echo ==========================================================
echo DOCUMENTATION BUILD COMPLETE
echo ==========================================================
echo.

echo Documentation Root:
echo %DOCS%
echo.

echo [PASS]

pause
exit /b 0

REM ==========================================================
REM Create Folder
REM ==========================================================

:CreateFolder

if not exist "%DOCS%\%~1" (

    mkdir "%DOCS%\%~1"

    echo.>"%DOCS%\%~1\.gitkeep"

    echo [PASS] Folder %~1

) else (

    echo [SKIP] Folder %~1

)

exit /b

REM ==========================================================
REM Create Markdown Document
REM ==========================================================

:CreateDoc

if not exist "%DOCS%\%~1" (

(
echo # %~1
echo.
echo ---
echo.
echo **Project:** MelroseOS Enterprise
echo.
echo **Release:** MOS5-016
echo.
echo **Status:** Draft
echo.
echo ---
echo.
echo ## Purpose
echo.
echo.
echo ## Overview
echo.
echo.
echo ## Design
echo.
echo.
echo ## Implementation
echo.
echo.
echo ## Notes
echo.
echo.
echo ## Revision History
echo.
)> "%DOCS%\%~1"

echo [PASS] %~1

) else (

echo [SKIP] %~1

)

exit /b