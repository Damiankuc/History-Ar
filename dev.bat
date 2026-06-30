@echo off
title Levantar Entorno Be-Pacient
echo ===================================================
echo   Iniciando Servidores en Desarrollo - Be-Pacient
echo ===================================================
echo.

:: 1. Lanzar el Backend en una ventana nueva
echo Levantando API de FastAPI (SQLite) en puerto 8000...
start "Be-Pacient API Backend" cmd /k "cd backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"

:: 2. Lanzar el Frontend en otra ventana
echo Levantando Frontend de React (Vite) en puerto 1420...
start "Be-Pacient React Frontend" cmd /k "cd frontend && npm run dev"

:: 3. Esperar a que se levanten los servidores y abrir Edge en Modo App
echo Esperando a que arranquen los servidores...
timeout /t 4 /nobreak >nul
echo Abriendo aplicacion en Microsoft Edge (Modo App)...
start msedge.exe --app=http://localhost:1420

echo.
echo ===================================================
echo   Servidores levantados y aplicacion abierta!
echo ===================================================
echo.
