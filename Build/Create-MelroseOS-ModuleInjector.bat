@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Module Injector

set ROOT=D:\MelroseOS\GitHub\MelroseOS
set SOURCE=%ROOT%\SourceModules
set TARGET=%ROOT%\tools\LeadMigration

echo.
echo ==========================================
echo     MELROSEOS MODULE INJECTOR
echo ==========================================
echo.

if not exist "%SOURCE%" (
    echo Creating SourceModules folder...
    mkdir "%SOURCE%"
)

echo.

for %%F in ("%SOURCE%\*.ps1") do (

    echo Installing %%~nxF

    copy /Y "%%F" "%TARGET%\%%~nxF" >nul

)

echo.
echo ==========================================
echo MODULE INSTALL COMPLETE
echo ==========================================
echo.
echo Source :
echo %SOURCE%
echo.
echo Target :
echo %TARGET%
echo.
echo [PASS]
pause