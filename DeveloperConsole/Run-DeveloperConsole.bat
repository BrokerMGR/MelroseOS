@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Developer Console

set "CONSOLE=%~dp0"
for %%I in ("%CONSOLE%..") do set "ROOT=%%~fI"

call "%CONSOLE%Menus\DC-01_MainMenu.bat"
exit /b %errorlevel%
