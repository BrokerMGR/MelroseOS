@echo off
setlocal EnableExtensions EnableDelayedExpansion
title MelroseOS Compiler v0.1

REM ==========================================================
REM MelroseOS Compiler
REM Repository:
REM   D:\MelroseOS\GitHub\MelroseOS
REM ==========================================================

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "PKGDIR=%ROOT%\Build\Packages"
set "OUTDIR=%ROOT%\AppsScript"

if not exist "%ROOT%" (
  echo [FAIL] Repository not found:
  echo %ROOT%
  pause
  exit /b 1
)

if not exist "%PKGDIR%" mkdir "%PKGDIR%"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

echo =====================================
echo MelroseOS Compiler
echo Repository: %ROOT%
echo =====================================

echo.
echo Package folder:
echo   %PKGDIR%
echo.
echo Output folder:
echo   %OUTDIR%
echo.

echo [READY]
echo.
echo Future releases will:
echo   1. Read *.pkg manifests
echo   2. Reconstruct full .gs files
echo   3. Verify checksums
echo   4. Write build logs
echo   5. Generate release manifests
echo.
pause
