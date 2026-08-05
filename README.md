# History-Ar - Sistema de Gestión de Historias Clínicas y Turnos Médicos

Suite médica de escritorio y en la nube diseñada para consultorios. Permite registrar fichas de pacientes, llevar el historial clínico completo, digitalizar/escanear documentos físicos (WIA), importar padecimientos desde PDF, gestionar la agenda de turnos, emitir recetas médicas pre-selladas con firma digital procesada, enviar notificaciones por WhatsApp y correo electrónico (Gmail SMTP), y sincronizar datos con la nube de **Supabase**.

---

## 🛠️ Tecnologías y Arquitectura

El proyecto está construido bajo una arquitectura desacoplada para desarrollo y consolidada para distribución ejecutable de escritorio:

### **Frontend**
* **Core:** React 18, TypeScript, Vite
* **Estilos:** Vanilla CSS moderno con variables CSS, animaciones suaves y diseño responsive.
* **Puerto en desarrollo:** `http://localhost:1420` (o `1421`)

### **Backend**
* **Framework:** FastAPI (Python 3.10+)
* **Base de Datos:** PostgreSQL en la nube vía **Supabase Cloud API** (`supabase-py`)
* **Autenticación:** Nombre y Matrícula Profesional + Bcrypt hashing para contraseñas de médicos
* **Procesamiento de Firma/Sello:** Pillow (PIL) para eliminación automática de fondos blancos en firmas escaneadas.
* **Extracción de PDF:** `pdfplumber` para la lectura e importación de archivos PDF como consultas médicas.
* **Escaneo Físico:** Integración nativa con Windows Image Acquisition (WIA) a través de scripts de escáner.
* **Puerto en desarrollo:** `http://localhost:8000`

---

## ⚙️ Requisitos Previos e Instalación

Para que cualquier miembro del equipo pueda clonar, ejecutar y trabajar en el proyecto, necesita contar con los siguientes elementos instalados en su equipo:

1. **Sistema Operativo:** Windows 10 o Windows 11.
2. **Node.js:** Versión 18 o superior. [Descargar Node.js](https://nodejs.org/)
3. **Python:** Versión 3.10 o superior (asegurarse de marcar la casilla "Add Python to PATH" durante la instalación). [Descargar Python](https://www.python.org/)
4. **Microsoft Edge:** Utilizado por los scripts para renderizar el frontend en "Modo Aplicación de Escritorio".

---

## 📁 Estructura del Repositorio

```
History-Ar/
├── frontend/                # Código fuente del cliente React + Vite
│   ├── src/
│   │   ├── App.tsx          # Componente principal de la aplicación
│   │   ├── App.css / index.css
│   └── package.json
├── backend/                 # API FastAPI y lógica del servidor Python
│   ├── app/
│   │   ├── main.py          # Enrutador FastAPI y definición de endpoints
│   │   ├── crud.py          # Operaciones CRUD sobre Supabase PostgreSQL
│   │   ├── schemas.py       # Esquemas Pydantic / SQLModel para validaciones
│   │   ├── models.py        # Modelos de datos del dominio
│   │   ├── supabase_client.py # Cliente de conexión a Supabase Cloud
│   │   └── scanner.py       # Módulo de integración con escáneres WIA (Windows)
│   ├── supabase_schema.sql  # Esquema SQL DDL para recrear las tablas en Supabase
│   ├── migrate_sqlite_to_supabase.py # Script utilitario de migración
│   └── requirements.txt     # Dependencias de Python
├── setup.bat                # Script de instalación inicial automática
├── dev.bat                  # Script de ejecución para entorno de desarrollo
└── build.bat                # Script de compilación a ejecutable portable (.exe)
```

---

## 🚀 Guía de Inicio Rápido (Workflow para el Equipo)

### 1. Clonar el Repositorio e Inicializar (`setup.bat`)
Ejecutar por única vez tras clonar el repositorio para crear el entorno virtual de Python (`.venv`), instalar los paquetes de `requirements.txt` e instalar las dependencias de Node.js en la carpeta `frontend/`:
```powershell
.\setup.bat
```

### 2. Variables de Entorno y Configuración de Supabase
La aplicación está configurada para conectar por defecto con el proyecto en Supabase Cloud. Si necesitas conectar tu propia instancia de Supabase:
- Revisa o edita `SUPABASE_URL` y `SUPABASE_KEY` en `backend/app/supabase_client.py` o mediante variables de entorno.
- En caso de crear un nuevo proyecto en Supabase, ejecuta el script de tabla en Supabase SQL Editor disponible en **`backend/supabase_schema.sql`**.

### 3. Ejecutar en Modo Desarrollo (`dev.bat`)
Inicia el backend en FastAPI (puerto 8000) y el frontend en React Vite (puerto 1420) con recarga automática (*Hot Reload*) y abre la ventana en Microsoft Edge:
```powershell
.\dev.bat
```

### 4. Compilar a Ejecutable Portable (`build.bat`)
Genera la versión compilada estática de React, la copia al servidor FastAPI y compila el backend a un único archivo `.exe` con **PyInstaller**:
```powershell
.\build.bat
```
El ejecutable resultante se ubicará en **`backend/dist/History-Ar.exe`**.

---

## 🔐 Configuración de Autenticación y Notificaciones

- **Autenticación Médica:** Al iniciar la app por primera vez, registrar la cuenta médica con **Nombre Completo** y **Número de Matrícula**. Esta información se guarda en Supabase y se incluye automáticamente en los membretes de recetas e historias clínicas.
- **Notificaciones por Email:** Para habilitar el envío de correos automáticos de confirmación de turnos a los pacientes, el médico debe configurar en la pestaña *Configuración* su cuenta Gmail emisora y su *Contraseña de aplicación de Google*.
- **Notificaciones por WhatsApp:** Genera enlaces directos `https://api.whatsapp.com/send` formateando automáticamente números de Argentina (`+549...`).
