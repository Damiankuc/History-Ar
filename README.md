# Be-Pacient - Sistema Local de Gestión de Historias Clínicas

Suite médica de escritorio local diseñada para consultorios. Permite registrar fichas de pacientes, llevar el historial clínico, digitalizar/escanear documentos físicos, programar turnos, emitir recetas médicas pre-selladas con firma digital y realizar copias de seguridad locales en formato `.zip`.

---

## 🛠️ Requisitos del Entorno de Desarrollo

Para que tu equipo de trabajo pueda clonar, ejecutar y modificar el proyecto de forma local, necesitan tener instalado lo siguiente en sus ordenadores:

1. **Sistema Operativo:** Windows 10 o Windows 11.
2. **Node.js (versión 18 o superior):** Para compilar e instalar dependencias del frontend. [Descargar Node.js](https://nodejs.org/)
3. **Python (versión 3.10 o superior):** Para ejecutar el servidor backend y la base de datos local. [Descargar Python](https://www.python.org/)
4. **Microsoft Edge:** Utilizado automáticamente por los scripts locales para renderizar la aplicación en "Modo Aplicación de Escritorio".

---

## 📁 Estructura del Proyecto

El proyecto está diseñado bajo una arquitectura desacoplada para desarrollo y consolidada para producción:

* **/frontend:** Aplicación interactiva construida en **React**, **TypeScript** y **Vite** (corre en el puerto `1420` en desarrollo).
* **/backend:** Servidor de APIs en **FastAPI** y base de datos relacional local en **SQLite** utilizando **SQLModel** (corre en el puerto `8000` en desarrollo).
* **/backend/app/uploads:** Carpeta local de almacenamiento donde se guardan los PDF y fotos subidos o escaneados por los médicos.

---

## 🚀 Guía de Configuración y Desarrollo

Hemos creado scripts de automatización en la raíz del proyecto para evitar configuraciones complejas manuales:

### 1. Inicializar el Proyecto (Solo la primera vez)
Para instalar todas las librerías de React, crear el entorno virtual de Python (`.venv`) e instalar las dependencias del backend:
```powershell
.\setup.bat
```

### 2. Ejecutar en Modo Desarrollo (Diseño y Programación)
Para levantar ambos servidores con recarga en caliente y abrir Edge de forma interactiva:
```powershell
.\dev.bat
```

### 3. Compilar a Ejecutable Portable (`.exe`) para Distribución
Para compilar todo el frontend React en archivos estáticos, guardarlos dentro de FastAPI y generar un único ejecutable standalone portable de Windows:
```powershell
.\build.bat
```
El archivo ejecutable resultante se ubicará en **`backend/dist/Be-Pacient.exe`** (ocupa ~20 MB y puede correr en otra PC sin necesidad de tener Node.js ni Python instalados).

---

## 💾 Persistencia de Datos e Historias Clínicas

* **En desarrollo:** La base de datos local se crea en la carpeta del backend como `pacientes.db`.
* **En producción (Ejecutable compilado):** Para evitar que el médico pierda información al reemplazar el ejecutable, la base de datos y los archivos adjuntos se guardan en la ruta de sistema aislada del usuario:
  `%APPDATA%/Be-Pacient/pacientes.db`
