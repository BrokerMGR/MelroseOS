@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS - Source Batch 02

REM ============================================================
REM MelroseOS GitHub-Relative BAT Workflow
REM Source Batch 02 - Creates 5 additional Apps Script files
REM Auto-detects Git repository root.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%" >nul 2>&1

for /f "delims=" %%G in ('git rev-parse --show-toplevel 2^>nul') do set "ROOT=%%G"

if not defined ROOT (
    for %%I in ("%SCRIPT_DIR%..") do set "ROOT=%%~fI"
)

if not exist "%ROOT%\.git" (
    echo.
    echo [ERROR] Could not locate the MelroseOS Git repository.
    echo Put this BAT inside the repository or inside its Build folder.
    echo.
    popd >nul 2>&1
    pause
    exit /b 1
)

set "SRC=%ROOT%\AppsScript\Core"

if not exist "%SRC%" mkdir "%SRC%"

echo.
echo ============================================================
echo  MelroseOS - Source Batch 02
echo  ROOT: %ROOT%
echo  TARGET: %SRC%
echo ============================================================
echo.

call :write_properties
call :write_validation
call :write_audit
call :write_locking
call :write_ids

echo.
echo ============================================================
echo  COMPLETE - Source Batch 02
echo.
echo  Created / verified:
echo    CORE-05_Properties.gs
echo    CORE-06_Validation.gs
echo    CORE-07_Audit.gs
echo    CORE-08_Locking.gs
echo    CORE-09_Ids.gs
echo ============================================================
echo.

popd >nul 2>&1
pause
exit /b 0

:write_properties
set "F=%SRC%\CORE-05_Properties.gs"
if exist "%F%" (
  echo [SKIP] CORE-05_Properties.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-05_Properties.gs
  echo  * Purpose: Script property helpers.
  echo  */
  echo.
  echo function MGR_getScriptProperty^(key, fallback^) {
  echo   const value = PropertiesService.getScriptProperties^(^).getProperty^(key^);
  echo   return value === null ? fallback : value;
  echo }
  echo.
  echo function MGR_setScriptProperty^(key, value^) {
  echo   MGR_require^(key, 'Property key'^);
  echo   PropertiesService.getScriptProperties^(^).setProperty^(key, String^(value^)^);
  echo   return true;
  echo }
  echo.
  echo function MGR_deleteScriptProperty^(key^) {
  echo   MGR_require^(key, 'Property key'^);
  echo   PropertiesService.getScriptProperties^(^).deleteProperty^(key^);
  echo   return true;
  echo }
  echo.
  echo function MGR_getAllScriptProperties^(^) {
  echo   return PropertiesService.getScriptProperties^(^).getProperties^(^);
  echo }
)
echo [CREATED] CORE-05_Properties.gs
exit /b 0

:write_validation
set "F=%SRC%\CORE-06_Validation.gs"
if exist "%F%" (
  echo [SKIP] CORE-06_Validation.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-06_Validation.gs
  echo  * Purpose: Shared validation helpers.
  echo  */
  echo.
  echo function MGR_isValidEmail^(value^) {
  echo   const email = MGR_normalizeEmail^(value^);
  echo   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test^(email^);
  echo }
  echo.
  echo function MGR_isValidPhone^(value^) {
  echo   const digits = MGR_normalizePhone^(value^);
  echo   return digits.length ^>= 10 ^&^& digits.length ^<= 15;
  echo }
  echo.
  echo function MGR_assertEmail^(value, label^) {
  echo   if ^(!MGR_isValidEmail^(value^)^) {
  echo     throw new Error^((label ^|^| 'Email'^) + ' is invalid.'^);
  echo   }
  echo   return MGR_normalizeEmail^(value^);
  echo }
  echo.
  echo function MGR_assertOneOf^(value, allowed, label^) {
  echo   if ^(!Array.isArray^(allowed^) ^|^| allowed.indexOf^(value^) === -1^) {
  echo     throw new Error^((label ^|^| 'Value'^) + ' is not allowed: ' + value^);
  echo   }
  echo   return value;
  echo }
)
echo [CREATED] CORE-06_Validation.gs
exit /b 0

:write_audit
set "F=%SRC%\CORE-07_Audit.gs"
if exist "%F%" (
  echo [SKIP] CORE-07_Audit.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-07_Audit.gs
  echo  * Purpose: Standardized audit event construction.
  echo  */
  echo.
  echo function MGR_buildAuditEvent^(action, entityType, entityId, details^) {
  echo   return {
  echo     auditId: MGR_newId^('AUD'^),
  echo     timestamp: MGR_nowIso^(^),
  echo     action: String^(action ^|^| ''^),
  echo     entityType: String^(entityType ^|^| ''^),
  echo     entityId: String^(entityId ^|^| ''^),
  echo     actor: Session.getEffectiveUser^(^).getEmail^(^) ^|^| '',
  echo     details: details === undefined ? null : details
  echo   };
  echo }
  echo.
  echo function MGR_audit^(action, entityType, entityId, details^) {
  echo   const event = MGR_buildAuditEvent^(action, entityType, entityId, details^);
  echo   MGR_logInfo^('AUDIT', event^);
  echo   return event;
  echo }
)
echo [CREATED] CORE-07_Audit.gs
exit /b 0

:write_locking
set "F=%SRC%\CORE-08_Locking.gs"
if exist "%F%" (
  echo [SKIP] CORE-08_Locking.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-08_Locking.gs
  echo  * Purpose: Safe script-lock execution helper.
  echo  */
  echo.
  echo function MGR_withScriptLock^(fn, timeoutMs^) {
  echo   if ^(typeof fn !== 'function'^) {
  echo     throw new Error^('MGR_withScriptLock requires a function.'^);
  echo   }
  echo.
  echo   const lock = LockService.getScriptLock^(^);
  echo   const timeout = Number^(timeoutMs ^|^| 30000^);
  echo.
  echo   if ^(!lock.tryLock^(timeout^)^) {
  echo     throw new Error^('Unable to obtain MelroseOS script lock within ' + timeout + ' ms.'^);
  echo   }
  echo.
  echo   try {
  echo     return fn^(^);
  echo   } finally {
  echo     lock.releaseLock^(^);
  echo   }
  echo }
)
echo [CREATED] CORE-08_Locking.gs
exit /b 0

:write_ids
set "F=%SRC%\CORE-09_Ids.gs"
if exist "%F%" (
  echo [SKIP] CORE-09_Ids.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-09_Ids.gs
  echo  * Purpose: Stable unique ID generation.
  echo  */
  echo.
  echo function MGR_newId^(prefix^) {
  echo   const cleanPrefix = String^(prefix ^|^| 'MOS'^)
  echo     .toUpperCase^(^)
  echo     .replace^(/[^A-Z0-9_-]/g, ''^);
  echo   const uuid = Utilities.getUuid^(^).replace^(/-/g, ''^).substring^(0, 16^).toUpperCase^(^);
  echo   return cleanPrefix + '-' + uuid;
  echo }
  echo.
  echo function MGR_newTimestampId^(prefix^) {
  echo   const stamp = Utilities.formatDate^(new Date^(^), MGR_CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss'^);
  echo   const suffix = Utilities.getUuid^(^).substring^(0, 8^).toUpperCase^(^);
  echo   return String^(prefix ^|^| 'MOS'^).toUpperCase^(^) + '-' + stamp + '-' + suffix;
  echo }
)
echo [CREATED] CORE-09_Ids.gs
exit /b 0
