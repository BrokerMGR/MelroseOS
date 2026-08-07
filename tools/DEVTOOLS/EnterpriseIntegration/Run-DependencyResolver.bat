@echo off
title MelroseOS Dependency Resolver

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-01_DependencyResolver.ps1"

pause