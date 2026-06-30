@echo off
title Compilar Be-Pacient Standalone
echo ===================================================
echo   Compilando Aplicacion Be-Pacient
echo ===================================================
echo.

:: 1. Compilar Frontend React
echo 1. Compilando React Frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion de React.
    pause
    exit /b 1
)
cd ..

:: 2. Copiar archivos compilados a backend/static
echo 2. Copiando archivos de distribucion a backend/static...
if exist backend\static (
    echo Limpiando directorio backend\static existente...
    rmdir /s /q backend\static
)
mkdir backend\static
xcopy /e /y /q frontend\dist\* backend\static\

:: 3. Compilar Backend con PyInstaller
echo 3. Compilando FastAPI Backend a Be-Pacient.exe...
cd backend
call .venv\Scripts\activate
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo activar el entorno virtual de Python.
    pause
    exit /b 1
)

:: Ejecutar PyInstaller
:: --onefile: genera un solo exe
:: --noconsole: corre sin consola negra de python en segundo plano
:: --add-data "static;static": adjunta la carpeta estática dentro del ejecutable
call pyinstaller --onefile --noconsole --name="Be-Pacient" --add-data "static;static" app/main.py
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion con PyInstaller.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   COMPILACION EXITOSA!
echo   El ejecutable se encuentra en:
echo   backend\dist\Be-Pacient.exe
echo ===================================================
echo.
pause
