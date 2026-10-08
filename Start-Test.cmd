@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Users\goro0\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "C:\Users\goro0\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
  ) else (
    echo Node.js is required to start this app.
    pause
  )
) else (
  node server.js
)
