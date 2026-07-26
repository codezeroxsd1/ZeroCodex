@echo off
cd /d "%~dp0\.."
npm run dev > "%~dp0\..\dev-local.log" 2>&1
