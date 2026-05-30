@echo off
REM ============================================================
REM Sima Arome — Windows Startup
REM ============================================================
REM Usage:
REM   start.bat        Demo Mode (Backend + Frontend)
REM   start.bat ai     Full Mode (Backend + Frontend + AI Vision)

echo.
echo  ====================================================
echo   Sima Arome - Enterprise Manufacturing Intelligence
echo  ====================================================
echo.

REM Kill existing processes
echo  Cleaning up...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

REM Backend
echo  [1/3] Starting Backend (port 3000)...
start /min "Sima-Backend" cmd /c "cd backend && npx ts-node --transpile-only src/server.ts"
timeout /t 4 /nobreak >nul

REM Frontend
echo  [2/3] Starting Frontend (port 3001)...
start /min "Sima-Frontend" cmd /c "cd frontend && npx next dev --port 3001"
timeout /t 3 /nobreak >nul

REM AI (optional)
if "%1"=="ai" (
  echo  [3/3] Starting AI Vision (port 8000)...
  start /min "Sima-AI" cmd /c "cd ai && python main.py"
  timeout /t 2 /nobreak >nul
) else (
  echo  [3/3] AI Vision: DEMO MODE (skipped)
)

echo.
echo  ====================================================
echo   Ready!
echo  ====================================================
echo.
echo   Dashboard:   http://localhost:3001
echo   Swagger:     http://localhost:3000/api-docs
echo   Health:      http://localhost:3000/system/health
echo.
echo   Login:  sigma / skibidi  (Admin)
echo           qc001 / password123  (QC Inspector)
echo.
if "%1"=="ai" (
echo   AI Vision:   http://localhost:8000
)
echo   To stop: taskkill /F /IM node.exe
echo.
pause
