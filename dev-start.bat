@echo off
setlocal

where pnpm >nul 2>&1
if %ERRORLEVEL%==0 (
  set PM=pnpm
) else (
  where npm >nul 2>&1
  if %ERRORLEVEL%==0 (
    set PM=npm
  ) else (
    echo Install Node.js and npm/pnpm first and ensure they are in PATH.
    exit /b 1
  )
)

echo Using package manager: %PM%
%PM% install || exit /b 1
if exist .next rmdir /s /q .next
%PM% run dev
