from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uuid
import shutil
import zipfile
import sys
import subprocess
import threading
import time
from datetime import datetime

# Asegurar que el directorio de la app está en el path de búsqueda de Python
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Prevenir 'NoneType object has no attribute isatty' en executables noconsole de PyInstaller
if getattr(sys, 'frozen', False):
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

from schemas import (
    UsuarioRegister,
    UsuarioLogin,
    UsuarioRead,
    PacienteCreate,
    PacienteRead,
    PacienteReadConConsultas,
    ConsultaCreate,
    ConsultaRead,
    DocumentoRead,
    ConfiguracionRead,
    ConfiguracionUpdate,
    RecetaCreate,
    RecetaRead,
    CitaCreate,
    CitaRead,
    CitaReadConPaciente,
    AuthEstadoRead
)
import crud
import scanner
from supabase_client import get_supabase

def kill_other_instances():
    """Mata instancias previas colgadas de History-Ar.exe en segundo plano."""
    if not getattr(sys, 'frozen', False):
        return
    try:
        current_pid = os.getpid()
        subprocess.run(
            ["taskkill", "/F", "/IM", "History-Ar.exe", "/FI", f"PID ne {current_pid}"],
            capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
    except Exception:
        pass

def launch_browser():
    """Abre la aplicación en Edge (Modo App)."""
    time.sleep(1.5)
    try:
        subprocess.run(["cmd", "/c", "start msedge.exe --app=http://localhost:8000"], shell=True)
    except Exception:
        pass

last_heartbeat = time.time()

def monitor_heartbeat():
    time.sleep(15.0)
    while True:
        time.sleep(2.0)
        if time.time() - last_heartbeat > 12.0:
            print("Navegador cerrado por el cliente. Apagando servidor backend...")
            os._exit(0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Probar conexión a Supabase
    try:
        supabase = get_supabase()
        print("Conectado exitosamente a Supabase PostgreSQL Cloud.")
    except Exception as e:
        print(f"Advertencia al conectar con Supabase: {e}")
        
    if getattr(sys, 'frozen', False):
        kill_other_instances()
        threading.Thread(target=launch_browser, daemon=True).start()
        threading.Thread(target=monitor_heartbeat, daemon=True).start()
        
    yield

app = FastAPI(
    title="History-Ar Cloud API",
    description="Backend en la nube para la gestión de Historias Médicas (Supabase)",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoint de Salud & Heartbeat ---

@app.get("/api/health", status_code=status.HTTP_200_OK)
def health_check():
    return {"status": "ok", "app": "History-Ar Backend (Supabase Cloud)"}

@app.post("/api/heartbeat")
def post_heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return {"status": "ok"}

# --- Endpoints de Autenticación por Nombre y Matrícula (Supabase) ---

@app.post("/api/auth/register", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def register_usuario(req: UsuarioRegister):
    """Registra un nuevo usuario/médico en Supabase mediante su Nombre y Número de Matrícula."""
    try:
        usuario = crud.register_usuario(req)
        return usuario
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al registrar usuario: {str(e)}")

@app.post("/api/auth/login")
def login_usuario(req: UsuarioLogin):
    """Inicia sesión utilizando Nombre y Número de Matrícula."""
    usuario = crud.login_usuario(nombre=req.nombre, matricula=req.matricula, password=req.password)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nombre o número de matrícula incorrectos"
        )
    return {
        "ok": True,
        "usuario": {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "especialidad": usuario.get("especialidad", ""),
            "matricula": usuario["matricula"],
            "firma_ruta": usuario.get("firma_ruta")
        }
    }

@app.get("/api/auth/estado", response_model=AuthEstadoRead)
def auth_estado():
    """Devuelve el estado de autenticación."""
    supabase = get_supabase()
    try:
        users = supabase.table("usuarios").select("id").limit(1).execute()
        tiene_usuarios = bool(users.data)
    except Exception:
        tiene_usuarios = False

    return AuthEstadoRead(
        pedir_password_al_iniciar=True,
        tiene_password=True,
        primer_inicio_completado=tiene_usuarios
    )

# --- Endpoints de Pacientes ---

@app.get("/api/pacientes", response_model=List[PacienteRead])
def read_pacientes(q: Optional[str] = None, skip: int = 0, limit: int = 100):
    """Obtiene el listado de pacientes desde Supabase."""
    return crud.get_pacientes(skip=skip, limit=limit, q=q)

@app.get("/api/pacientes/{paciente_id}", response_model=PacienteReadConConsultas)
def read_paciente(paciente_id: int):
    """Obtiene un paciente por ID con sus consultas, recetas, citas y documentos."""
    db_paciente = crud.get_paciente(paciente_id=paciente_id)
    if db_paciente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no encontrado"
        )
    return db_paciente

@app.post("/api/pacientes", response_model=PacienteRead, status_code=status.HTTP_201_CREATED)
def create_paciente(paciente: PacienteCreate):
    """Registra un nuevo paciente en Supabase."""
    db_paciente = crud.get_paciente_by_dni(dni=paciente.dni)
    if db_paciente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El paciente con DNI {paciente.dni} ya se encuentra registrado"
        )
    return crud.create_paciente(paciente_in=paciente)

@app.put("/api/pacientes/{paciente_id}", response_model=PacienteRead)
def update_paciente(paciente_id: int, paciente: PacienteCreate):
    """Actualiza la información personal de un paciente."""
    db_paciente = crud.update_paciente(paciente_id=paciente_id, paciente_update=paciente)
    if db_paciente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no encontrado"
        )
    return db_paciente

@app.delete("/api/pacientes/{paciente_id}")
def delete_paciente(paciente_id: int):
    """Elimina un paciente y sus registros de la nube."""
    exito = crud.delete_paciente(paciente_id=paciente_id)
    if not exito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no encontrado"
        )
    return {"message": "Paciente y sus registros eliminados con éxito"}

# --- Endpoints de Consultas ---

@app.post("/api/consultas", response_model=ConsultaRead, status_code=status.HTTP_201_CREATED)
def create_consulta(consulta: ConsultaCreate):
    """Registra una nueva consulta/padecimiento en la historia clínica del paciente."""
    db_paciente = crud.get_paciente(paciente_id=consulta.paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se puede registrar consulta. Paciente con ID {consulta.paciente_id} no existe"
        )
    return crud.create_consulta(consulta_in=consulta)

@app.get("/api/consultas/{consulta_id}", response_model=ConsultaRead)
def read_consulta(consulta_id: int):
    """Obtiene los detalles de una consulta médica específica."""
    db_consulta = crud.get_consulta(consulta_id=consulta_id)
    if db_consulta is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consulta con ID {consulta_id} no encontrada"
        )
    return db_consulta

# --- Endpoints de Documentos Adjuntos ---

appdata_path = os.environ.get("APPDATA")
if appdata_path:
    uploads_dir = os.path.join(appdata_path, "History-Ar", "uploads")
else:
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.post("/api/pacientes/{paciente_id}/documentos/subir", response_model=DocumentoRead, status_code=status.HTTP_201_CREATED)
def subir_documento(
    paciente_id: int,
    consulta_id: Optional[int] = None,
    file: UploadFile = File(...)
):
    """Sube un archivo médico adjunto y guarda la metadata en Supabase."""
    db_paciente = crud.get_paciente(paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Paciente ID {paciente_id} no existe")
        
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(uploads_dir, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error guardando archivo: {str(e)}")

    relative_path = f"/uploads/{unique_filename}"
    return crud.create_documento(
        nombre=file.filename or "archivo_sin_nombre",
        ruta_archivo=relative_path,
        tipo_mimetype=file.content_type or "application/octet-stream",
        paciente_id=paciente_id,
        consulta_id=consulta_id
    )

@app.post("/api/pacientes/{paciente_id}/documentos/escanear", response_model=DocumentoRead, status_code=status.HTTP_201_CREATED)
def escanear_documento(paciente_id: int, consulta_id: Optional[int] = None):
    """Escanera documento físico con WIA y registra metadata en Supabase."""
    db_paciente = crud.get_paciente(paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Paciente ID {paciente_id} no existe")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"escaneo_{timestamp}.png"
    file_path = os.path.join(uploads_dir, filename)

    try:
        scanner.scan_to_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error en escáner: {str(e)}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Archivo no guardado.")

    relative_path = f"/uploads/{filename}"
    return crud.create_documento(
        nombre=f"Escaneo {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        ruta_archivo=relative_path,
        tipo_mimetype="image/png",
        paciente_id=paciente_id,
        consulta_id=consulta_id
    )

@app.get("/api/pacientes/{paciente_id}/documentos", response_model=List[DocumentoRead])
def read_documentos(paciente_id: int):
    """Lista todos los documentos del paciente desde Supabase."""
    return crud.get_documentos_por_paciente(paciente_id=paciente_id)

@app.delete("/api/documentos/{documento_id}")
def delete_documento(documento_id: int):
    """Elimina documento del disco y de Supabase."""
    db_documento = crud.get_documento(documento_id=documento_id)
    if not db_documento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")

    filename = os.path.basename(db_documento["ruta_archivo"])
    physical_path = os.path.join(uploads_dir, filename)
    if os.path.exists(physical_path):
        try:
            os.remove(physical_path)
        except Exception:
            pass

    crud.delete_documento(documento_id=documento_id)
    return {"message": "Documento eliminado con éxito"}

# --- Endpoints de Configuración Médica ---

@app.get("/api/configuracion", response_model=ConfiguracionRead)
def read_configuracion(usuario_id: Optional[int] = None):
    """Obtiene los datos de configuración del médico desde Supabase."""
    return crud.get_configuracion(usuario_id)

@app.post("/api/configuracion", response_model=ConfiguracionRead)
def update_configuracion(config_in: ConfiguracionUpdate, usuario_id: Optional[int] = None):
    """Actualiza la configuración del médico en Supabase."""
    return crud.update_configuracion(config_in, usuario_id)

@app.post("/api/configuracion/firma", response_model=ConfiguracionRead)
def subir_firma_doctor(file: UploadFile = File(...), usuario_id: Optional[int] = None):
    """Sube la firma o sello digitalizado del médico."""
    global last_heartbeat
    last_heartbeat = time.time()
    
    filename = f"doctor_signature_{usuario_id or 'default'}.png"
    file_path = os.path.join(uploads_dir, filename)
    
    try:
        content = file.file.read()
        from main import _remover_fondo_blanco
        processed_content = _remover_fondo_blanco(content)
        with open(file_path, "wb") as buffer:
            buffer.write(processed_content)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"No se pudo guardar la firma: {str(e)}")
        
    relative_path = f"/uploads/{filename}"
    return crud.update_firma_ruta(relative_path, usuario_id)

def _remover_fondo_blanco(input_bytes: bytes, bg_threshold: int = 175, ink_threshold: int = 120) -> bytes:
    try:
        from PIL import Image, ImageEnhance
        import io
        img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
        img.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.3)
        
        raw_bytes = bytearray(img.tobytes())
        for i in range(0, len(raw_bytes), 4):
            r, g, b = raw_bytes[i], raw_bytes[i+1], raw_bytes[i+2]
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            if lum >= bg_threshold:
                raw_bytes[i+3] = 0
            elif lum <= ink_threshold:
                raw_bytes[i+3] = 255
            else:
                alpha = int((bg_threshold - lum) / (bg_threshold - ink_threshold) * 255)
                raw_bytes[i+3] = max(0, min(255, alpha))
                
        result_img = Image.frombytes("RGBA", img.size, bytes(raw_bytes))
        output = io.BytesIO()
        result_img.save(output, format="PNG")
        return output.getvalue()
    except Exception:
        return input_bytes

# --- Endpoints de Extracción de Texto de PDF ---

@app.post("/api/pdf/extraer-texto")
def extraer_texto_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo debe ser un PDF (.pdf)")
    try:
        import pdfplumber
        import io
        contenido = file.file.read()
        texto_total = ""
        with pdfplumber.open(io.BytesIO(contenido)) as pdf:
            partes = []
            num_paginas = len(pdf.pages)
            for pagina in pdf.pages:
                texto_pagina = pagina.extract_text()
                if texto_pagina:
                    partes.append(texto_pagina.strip())
            texto_total = "\n\n".join(partes)
        
        if not texto_total.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se pudo extraer texto del PDF.")
        
        return {"texto": texto_total, "paginas": num_paginas}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al procesar PDF: {str(e)}")

# --- Endpoints de Recetas Médicas ---

@app.post("/api/recetas", response_model=RecetaRead, status_code=status.HTTP_201_CREATED)
def crear_receta(receta_in: RecetaCreate):
    return crud.create_receta(receta_in)

@app.get("/api/pacientes/{paciente_id}/recetas", response_model=List[RecetaRead])
def listar_recetas_paciente(paciente_id: int):
    return crud.get_recetas_por_paciente(paciente_id=paciente_id)

@app.delete("/api/recetas/{receta_id}")
def delete_receta(receta_id: int):
    success = crud.delete_receta(receta_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return {"message": "Receta eliminada con éxito"}

# --- Endpoints de Agenda y Citas ---

@app.post("/api/citas", response_model=CitaRead, status_code=status.HTTP_201_CREATED)
def crear_cita(cita_in: CitaCreate):
    return crud.create_cita(cita_in)

@app.get("/api/citas", response_model=List[CitaReadConPaciente])
def listar_citas():
    return crud.get_citas()

@app.put("/api/citas/{cita_id}", response_model=CitaRead)
def actualizar_cita_estado(cita_id: int, estado: str):
    cita = crud.update_cita_estado(cita_id, estado)
    if not cita:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    return cita

@app.delete("/api/citas/{cita_id}")
def eliminar_cita(cita_id: int):
    success = crud.delete_cita(cita_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    return {"message": "Cita eliminada con éxito"}

# Servir frontend estático si existe
base_path = sys._MEIPASS if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS') else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(base_path, "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    if getattr(sys, 'frozen', False):
        uvicorn.run(app, host="127.0.0.1", port=8000, log_config=None)
    else:
        uvicorn.run(app, host="127.0.0.1", port=8000)
