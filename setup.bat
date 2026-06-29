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

:: 3. Verificar Rust/Cargo (temporalmente agregar la ruta de Cargo por si no se reinicio la consola)
set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ALERTA] Rust/Cargo no detectado. Intentando instalar Rust de forma silenciosa...
    powershell -Command "Invoke-WebRequest -Uri 'https://win.rustup.rs/x86_64' -OutFile 'rustup-init.exe'"
    if exist rustup-init.exe (
        echo Instalando Rust... Por favor espera un momento.
        rustup-init.exe -y
        del rustup-init.exe
        set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"
        echo [OK] Rust instalado correctamente.
    ) else (
        echo [ERROR] No se pudo descargar el instalador de Rust. Por favor instalalo desde https://rustup.rs/
        pause
        exit /b 1
    )
) else (
    echo [OK] Rust/Cargo detectado.
)

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
echo   Configurando el Frontend (Tauri + React)
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
