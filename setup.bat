@echo off
title Configurando entorno Be-Pacient
echo ===================================================
echo   Configurando entorno de desarrollo - Be-Pacient
echo ===================================================
echo.

:: 1. Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado. Por favor instalalo antes de continuar.
    pause
    exit /b 1
)
echo [OK] Node.js detectado.

:: 2. Verificar Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado. Por favor instalalo antes de continuar.
    pause
    exit /b 1
)
echo [OK] Python detectado.

echo.
echo ===================================================
echo   Configurando el Backend (FastAPI + SQLite)
echo ===================================================
cd backend
if not exist .venv (
    echo Creando entorno virtual .venv...
    python -m venv .venv
)
echo Activando entorno virtual e instalando dependencias de Python...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
echo [OK] Backend configurado con exito.

echo.
echo ===================================================
echo   Configurando el Frontend (React)
echo ===================================================
cd frontend
echo Instalando dependencias de Node.js...
call npm install
echo Instalando navegadores de Playwright para pruebas E2E...
call npx playwright install chromium
cd ..
echo [OK] Frontend configurado con exito.

echo.
echo ===================================================
echo   Instalacion completada con exito!
echo ===================================================
echo Para ejecutar la aplicacion en modo desarrollo, corre: dev.bat
echo.
pause
