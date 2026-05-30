@echo off
REM ============================================================
REM Sima Arome — Windows Startup Script (Optimized)
REM ============================================================
REM Usage: start.bat        (Backend + Frontend only)
REM        start.bat ai     (Backend + Frontend + AI Vision)

echo.
echo  ====================================================
echo   Sima Arome - Starting Services
echo  ====================================================
echo.

REM Kill any existing processes on our ports
echo  Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

REM ── Backend (port 3000) ──
echo  [1] Starting Backend (port 3000)...
start /min "Sima-Backend" cmd /c "cd backend && npx ts-node --transpile-only src/server.ts"
timeout /t 4 /nobreak >nul

REM ── Frontend (port 3001) ──
echo  [2] Starting Frontend (port 3001)...
start /min "Sima-Frontend" cmd /c "cd frontend && npx next dev --port 3001"
timeout /t 3 /nobreak >nul

REM ── AI Vision (port 8000) — Only if "ai" argument passed ──
if "%1"=="ai" (
  echo  [3] Starting AI Vision (port 8000) - CPU mode...
  start /min "Sima-AI" cmd /c "cd ai && python main.py"
  timeout /t 2 /nobreak >nul
) else (
  echo  [3] AI Vision skipped (run "start.bat ai" to include)
)

echo.
echo  ====================================================
echo   All Services Running!
echo  ====================================================
echo.
echo   Frontend:      http://localhost:3001
echo   Backend API:   http://localhost:3000
if "%1"=="ai" (
echo   AI QC Vision:  http://localhost:8000
)
echo.
echo   Login: admin / password123
echo   Demo:  sigma / skibidi
echo.
echo   Services run minimized. Close this window to keep running.
echo   To stop all: taskkill /F /IM node.exe ^& taskkill /F /IM python.exe
echo.
pause
