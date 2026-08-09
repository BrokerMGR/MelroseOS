@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM MelroseOS GitHub-Relative BAT Workflow
REM Auto-detects the Git repository root.
REM No hardcoded D:\MelroseOS path.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%" >nul 2>&1

for /f "delims=" %%G in ('git rev-parse --show-toplevel 2^>nul') do set "ROOT=%%G"

if not defined ROOT (
    REM Fallback: assume BAT is inside <repo>\Build\
    for %%I in ("%SCRIPT_DIR%..") do set "ROOT=%%~fI"
)

if not exist "%ROOT%\.git" (
    echo.
    echo [ERROR] Could not locate the MelroseOS Git repository.
    echo.
    echo Put this BAT inside the repository or inside a Build subfolder.
    echo Expected structure:
    echo   MelroseOS\
    echo     .git\
    echo     Build\
    echo       this-file.bat
    echo.
    popd >nul 2>&1
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  MelroseOS Repository Detected
echo  ROOT: %ROOT%
echo ============================================================
echo.

title MelroseOS - Source Batch 01

set "SRC=%ROOT%\AppsScript\Core"

if not exist "%SRC%" mkdir "%SRC%"

echo Creating Source Batch 01 in:
echo %SRC%
echo.

call :write_bootstrap
call :write_config
call :write_constants
call :write_utilities
call :write_logging

echo.
echo ============================================================
echo  COMPLETE - Source Batch 01
echo.
echo  Created / verified:
echo    CORE-00_Bootstrap.gs
echo    CORE-01_Config.gs
echo    CORE-02_Constants.gs
echo    CORE-03_Utilities.gs
echo    CORE-04_Logging.gs
echo ============================================================
echo.

popd >nul 2>&1
pause
exit /b 0

:write_bootstrap
set "F=%SRC%\CORE-00_Bootstrap.gs"
if exist "%F%" (
  echo [SKIP] CORE-00_Bootstrap.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * MelroseOS Enterprise Core
  echo  * File: CORE-00_Bootstrap.gs
  echo  */
  echo.
  echo const MGR_CORE_VERSION = '1.0.0';
  echo.
  echo function MGR_bootstrapCore^(^) {
  echo   const result = {
  echo     success: true,
  echo     system: 'MelroseOS',
  echo     module: 'Enterprise Core',
  echo     version: MGR_CORE_VERSION,
  echo     timestamp: new Date^(^).toISOString^(^)
  echo   };
  echo   MGR_logInfo^('MGR_bootstrapCore', result^);
  echo   return result;
  echo }
  echo.
  echo function MGR_coreHealthCheck^(^) {
  echo   return {
  echo     success: true,
  echo     version: MGR_CORE_VERSION,
  echo     timezone: Session.getScriptTimeZone^(^) ^|^| 'America/Chicago',
  echo     effectiveUser: Session.getEffectiveUser^(^).getEmail^(^) ^|^| ''
  echo   };
  echo }
)
echo [CREATED] CORE-00_Bootstrap.gs
exit /b 0

:write_config
set "F=%SRC%\CORE-01_Config.gs"
if exist "%F%" (
  echo [SKIP] CORE-01_Config.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-01_Config.gs
  echo  */
  echo.
  echo const MGR_CONFIG = Object.freeze^({
  echo   SYSTEM_NAME: 'MelroseOS',
  echo   TIMEZONE: 'America/Chicago',
  echo   ENVIRONMENT: 'DEV',
  echo   BROKER_EMAIL: 'melrosegroupbroker@gmail.com',
  echo   BROKERAGE_EMAIL: 'melrosegrouprealty@gmail.com',
  echo   LEAD_DISTRIBUTION_EMAIL: 'agentleadcentral@gmail.com',
  echo   STAFF_OPERATIONS_EMAIL: 'melrosegroupstaff@gmail.com',
  echo   LEADS_VAULT_EMAIL: 'melrosegroupleads@gmail.com'
  echo }^);
  echo.
  echo function MGR_getConfig^(key^) {
  echo   if ^(!key^) return MGR_CONFIG;
  echo   if ^(!Object.prototype.hasOwnProperty.call^(MGR_CONFIG, key^)^) {
  echo     throw new Error^('Unknown MelroseOS config key: ' + key^);
  echo   }
  echo   return MGR_CONFIG[key];
  echo }
)
echo [CREATED] CORE-01_Config.gs
exit /b 0

:write_constants
set "F=%SRC%\CORE-02_Constants.gs"
if exist "%F%" (
  echo [SKIP] CORE-02_Constants.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-02_Constants.gs
  echo  */
  echo.
  echo const MGR_CONST = Object.freeze^({
  echo   STATUS: Object.freeze^({
  echo     NEW: 'NEW',
  echo     IN_REVIEW: 'IN_REVIEW',
  echo     BROKER_REVIEW: 'BROKER_REVIEW',
  echo     COMPLETED: 'COMPLETED',
  echo     OVERRIDDEN: 'OVERRIDDEN',
  echo     ARCHIVED: 'ARCHIVED'
  echo   }^),
  echo   ROUTE: Object.freeze^({
  echo     BROKER_ONLY: 'BROKER_ONLY',
  echo     BROKER_DIRECT: 'BROKER_DIRECT',
  echo     BROKER_FALLBACK: 'BROKER_FALLBACK',
  echo     LEAD_LOCK: 'LEAD_LOCK',
  echo     ROUND_ROBIN: 'ROUND_ROBIN'
  echo   }^)
  echo }^);
)
echo [CREATED] CORE-02_Constants.gs
exit /b 0

:write_utilities
set "F=%SRC%\CORE-03_Utilities.gs"
if exist "%F%" (
  echo [SKIP] CORE-03_Utilities.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-03_Utilities.gs
  echo  */
  echo.
  echo function MGR_nowIso^(^) {
  echo   return new Date^(^).toISOString^(^);
  echo }
  echo.
  echo function MGR_normalizeEmail^(value^) {
  echo   return String^(value ^|^| ''^).trim^(^).toLowerCase^(^);
  echo }
  echo.
  echo function MGR_normalizePhone^(value^) {
  echo   return String^(value ^|^| ''^).replace^(/\D/g, ''^);
  echo }
  echo.
  echo function MGR_require^(value, label^) {
  echo   if ^(value === undefined ^|^| value === null ^|^| String^(value^).trim^(^) === ''^) {
  echo     throw new Error^((label ^|^| 'Value'^) + ' is required.'^);
  echo   }
  echo   return value;
  echo }
)
echo [CREATED] CORE-03_Utilities.gs
exit /b 0

:write_logging
set "F=%SRC%\CORE-04_Logging.gs"
if exist "%F%" (
  echo [SKIP] CORE-04_Logging.gs already exists
  exit /b 0
)
> "%F%" (
  echo /**
  echo  * File: CORE-04_Logging.gs
  echo  */
  echo.
  echo function MGR_logInfo^(source, payload^) {
  echo   console.log^(JSON.stringify^({
  echo     level: 'INFO',
  echo     source: source ^|^| '',
  echo     timestamp: new Date^(^).toISOString^(^),
  echo     payload: payload === undefined ? null : payload
  echo   }^)^);
  echo }
  echo.
  echo function MGR_logWarn^(source, payload^) {
  echo   console.warn^(JSON.stringify^({
  echo     level: 'WARN',
  echo     source: source ^|^| '',
  echo     timestamp: new Date^(^).toISOString^(^),
  echo     payload: payload === undefined ? null : payload
  echo   }^)^);
  echo }
  echo.
  echo function MGR_logError^(source, error, context^) {
  echo   console.error^(JSON.stringify^({
  echo     level: 'ERROR',
  echo     source: source ^|^| '',
  echo     timestamp: new Date^(^).toISOString^(^),
  echo     message: error ^&^& error.message ? error.message : String^(error ^|^| ''^),
  echo     stack: error ^&^& error.stack ? error.stack : '',
  echo     context: context === undefined ? null : context
  echo   }^)^);
  echo }
)
echo [CREATED] CORE-04_Logging.gs
exit /b 0
