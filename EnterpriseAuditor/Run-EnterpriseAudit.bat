@echo off
setlocal EnableExtensions

title MelroseOS Enterprise Auditor

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "AUDIT=%ROOT%\EnterpriseAuditor\Scripts\EA-001_EnterpriseAudit.ps1"

echo.
echo ==========================================================
echo          MELROSEOS ENTERPRISE AUDITOR
echo ==========================================================
echo.

if not exist "%AUDIT%" (
    echo [FAIL] Enterprise auditor script not found:
    echo %AUDIT%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%AUDIT%"
set "RC=%ERRORLEVEL%"

echo.
echo ==========================================================
if "%RC%"=="0" (
    echo ENTERPRISE AUDIT PASSED
) else (
    echo ENTERPRISE AUDIT FOUND ITEMS REQUIRING ATTENTION
)
echo ==========================================================
echo.
echo Reports:
echo %ROOT%\EnterpriseAuditor\Reports
echo.
pause
exit /b %RC%
