@echo off
title MelroseOS Cross-Project Health

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-00_CrossProjectHealth.ps1"

pause