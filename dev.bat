@echo off
title Levantar Entorno Be-Pacient
echo ===================================================
echo   Iniciando Servidores en Desarrollo - Be-Pacient
echo ===================================================
echo.

:: Asegurar que la ruta a Cargo este disponible
set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"

:: 1. Lanzar el Backend en una ventana nueva
echo Levantando API de FastAPI (SQLite) en puerto 8000...
start "Be-Pacient API Backend" cmd /k "cd backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"

:: 2. Lanzar el Frontend en otra ventana
echo Levantando Frontend de Tauri + React (Vite)...
start "Be-Pacient Tauri App" cmd /k "cd frontend && set PATH=%PATH%;%USERPROFILE%\.cargo\bin && npm run tauri dev"

echo.
echo ===================================================
echo   Servidores levantados. Revisa las nuevas ventanas
echo ===================================================
echo.
pause
