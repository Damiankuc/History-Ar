from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
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
    AuthEstadoRead,
    EnviarEmailRequest,
    CompartirHistoriaEmailRequest,
    MedicamentoRead,
    MedicamentoCustomCreate
)
from models import MedicamentoCustom
from vademecum_data import VADEMECUM_BASE
from database import engine
from sqlmodel import Session, select
import crud
import scanner
from supabase_client import get_supabase
from auth import get_current_user, get_current_user_token

limiter = Limiter(key_func=get_remote_address)


def free_port_8000():
    """Si el puerto 8000 está ocupado por una instancia previa o de dev, lo libera antes de arrancar."""
    if not getattr(sys, 'frozen', False):
        return
    try:
        current_pid = str(os.getpid())
        output = subprocess.check_output("netstat -ano", shell=True, text=True, errors="ignore")
        pids_to_kill = set()
        for line in output.strip().splitlines():
            if ":8000 " in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                if pid != current_pid and pid != "0":
                    pids_to_kill.add(pid)
        for pid in pids_to_kill:
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            time.sleep(0.3)
    except Exception:
        pass

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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: /uploads/;"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:1420,http://localhost:1421,http://localhost:5173,http://localhost:3000,http://localhost:8000,http://127.0.0.1:1420,http://127.0.0.1:1421,http://127.0.0.1:5173,http://127.0.0.1:8000")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
@limiter.limit("5/minute")
def register_usuario(request: Request, req: UsuarioRegister):
    """Registra un nuevo usuario/médico en Supabase mediante su Nombre y Número de Matrícula."""
    try:
        usuario = crud.register_usuario(req)
        return usuario
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al registrar usuario: {str(e)}")

@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login_usuario(request: Request, req: UsuarioLogin):
    """Inicia sesión utilizando Nombre y Número de Matrícula y devuelve token JWT si está disponible."""
    usuario = crud.login_usuario(nombre=req.nombre, matricula=req.matricula, password=req.password)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nombre o número de matrícula incorrectos"
        )
    resp = {
        "ok": True,
        "usuario": {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "especialidad": usuario.get("especialidad", ""),
            "matricula": usuario["matricula"],
            "firma_ruta": usuario.get("firma_ruta")
        }
    }
    if usuario.get("access_token"):
        resp["access_token"] = usuario["access_token"]
        resp["token_type"] = "bearer"
    return resp


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
def read_pacientes(
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user),
    token: Optional[str] = Depends(get_current_user_token)
):
    """Obtiene el listado de pacientes desde Supabase propagando el token al RLS de Postgres."""
    return crud.get_pacientes(skip=skip, limit=limit, q=q, token=token)


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

def _validate_magic_bytes(file_obj, extension: str) -> bool:
    """Valida los primeros bytes del archivo (firma binaria / magic bytes) según la extensión."""
    try:
        file_obj.seek(0)
        header = file_obj.read(512)
        file_obj.seek(0)
    except Exception:
        return False

    ext = extension.lower()
    if ext == ".pdf":
        return header.startswith(b"%PDF")
    elif ext == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    elif ext in (".jpg", ".jpeg"):
        return header.startswith(b"\xff\xd8\xff")
    elif ext == ".webp":
        return header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    elif ext == ".heic":
        return b"ftyp" in header[:12]
    elif ext in (".doc", ".docx"):
        return header.startswith(b"\xd0\xcf\x11\xe0") or header.startswith(b"PK\x03\x04")
    elif ext in (".dcm", ".dicom"):
        return (len(header) >= 132 and header[128:132] == b"DICM") or header.startswith(b"PK\x03\x04") or header.startswith(b"\x05\x00") or True
    return True

@app.post("/api/pacientes/{paciente_id}/documentos/subir", response_model=DocumentoRead, status_code=status.HTTP_201_CREATED)
def subir_documento(
    paciente_id: int,
    consulta_id: Optional[int] = None,
    file: UploadFile = File(...)
):
    """Sube un archivo médico adjunto (PDF, foto, escaneo) y guarda la metadata en Supabase."""
    # Sanitizar nombre original y extensión permitida
    raw_filename = os.path.basename(file.filename) if file.filename else "documento_adjunto"
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic", ".dcm", ".dicom", ".doc", ".docx"}
    file_extension = os.path.splitext(raw_filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo '{file_extension}' no permitido. Formatos aceptados: PDF, JPG, PNG, WEBP, HEIC, DICOM, DOC/DOCX."
        )

    # Validar tamaño máximo (10 MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB en bytes
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo excede el tamaño máximo permitido de 10 MB ({file_size / (1024*1024):.1f} MB)."
        )

    # Validar Magic Bytes (Firma binaria real del archivo)
    if not _validate_magic_bytes(file.file, file_extension):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El contenido binario del archivo no coincide con una firma válida para la extensión '{file_extension}'."
        )

    db_paciente = crud.get_paciente(paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Paciente ID {paciente_id} no existe")


    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(uploads_dir, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error guardando archivo: {str(e)}")

    relative_path = f"/uploads/{unique_filename}"
    return crud.create_documento(
        nombre=raw_filename,
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

import re

def parse_medical_text(text: str) -> dict:
    """
    Analiza el texto extraído de una historia médica PDF e identifica automáticamente
    las secciones comunes (Motivo/Síntomas, Diagnóstico, Tratamiento/Medicación, Observaciones/Notas).
    """
    sections = {
        "motivo": "",
        "diagnostico": "",
        "tratamiento": "",
        "observaciones": ""
    }

    if not text or not text.strip():
        return sections

    # Patrones de encabezados en línea única o títulos de sección (pueden llevar o no :, -, /, etc.)
    motivo_re = re.compile(
        r'^\s*(?:motivo(?:\s+de\s+consulta)?|s[íi]ntomas|anamnesis|enfermedad\s+actual|cuadro\s+cl[íi]nico|causa(?:\s+de\s+atenci[óo]n)?)\s*[:\-–\/]?\s*$',
        re.IGNORECASE
    )
    diag_re = re.compile(
        r'^\s*(?:diagn[óo]stico(?:\s+presuntivo|\s+definitivo)?|juicio\s+cl[íi]nico|impresi[óo]n\s+diagn[óo]stica|dx\.?)\s*[:\-–\/]?\s*$',
        re.IGNORECASE
    )
    trat_re = re.compile(
        r'^\s*(?:tratamiento(?:\s+m[ée]dico|\s+indicado)?|plan(?:\s+m[ée]dico|\s+terap[ée]utico)?|medicaci[óo]n(?:\s+de\s+control\s+continuo|\s+habitual)?|prescripci[óo]n(?:\s+m[ée]dica)?|rp\.?|conducta)\s*[:\-–\/]?\s*$',
        re.IGNORECASE
    )
    obs_re = re.compile(
        r'^\s*(?:observaciones(?:\s+adicionales)?|indicaciones(?:\s+adicionales)?|notas(?:\s+adicionales|\s+m[ée]dicas)?|evoluci[óo]n(?:\s+m[ée]dica)?|antecedentes(?:\s+patol[óo]gicos)?|comentarios|resumen)\s*[:\-–\/]?\s*$',
        re.IGNORECASE
    )

    # Patrones en línea con contenido en la misma línea
    inline_motivo = re.compile(r'^\s*(?:motivo(?:\s+de\s+consulta)?|s[íi]ntomas|anamnesis|enfermedad\s+actual|cuadro\s+cl[íi]nico)\s*[:\-–\/]\s*(.*)$', re.IGNORECASE)
    inline_diag = re.compile(r'^\s*(?:diagn[óo]stico(?:\s+presuntivo|\s+definitivo)?|juicio\s+cl[íi]nico|impresi[óo]n\s+diagn[óo]stica|dx\.?)\s*[:\-–\/]\s*(.*)$', re.IGNORECASE)
    inline_trat = re.compile(r'^\s*(?:tratamiento(?:\s+m[ée]dico)?|plan(?:\s+m[ée]dico)?|medicaci[óo]n(?:\s+de\s+control\s+continuo)?|prescripci[óo]n(?:\s+m[ée]dica)?|rp\.?)\s*[:\-–\/]\s*(.*)$', re.IGNORECASE)
    inline_obs = re.compile(r'^\s*(?:observaciones(?:\s+adicionales)?|indicaciones(?:\s+adicionales)?|notas|evoluci[óo]n|antecedentes)\s*[:\-–\/]\s*(.*)$', re.IGNORECASE)

    # Líneas administrativas de encabezado/pie de página que no son síntomas ni diagnóstico
    admin_header_re = re.compile(
        r'^\s*(?:centro\s+m[ée]dico|dr\.|dra\.|m[ée]dico|m\.p\.|m\.n\.|av\.|calle|piso|tel|paciente|d\.?n\.?i|edad|obra\s+social|n[°º]\s*afiliado|fecha\s+de\s+emisi[óo]n)',
        re.IGNORECASE
    )

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    current_section = None
    section_buffers = {
        "motivo": [],
        "diagnostico": [],
        "tratamiento": [],
        "observaciones": []
    }
    
    for line in lines:
        # 1. Coincidencia de título de sección en línea única
        if motivo_re.match(line):
            current_section = "motivo"
            continue
        elif diag_re.match(line):
            current_section = "diagnostico"
            continue
        elif trat_re.match(line):
            current_section = "tratamiento"
            continue
        elif obs_re.match(line):
            current_section = "observaciones"
            continue

        # 2. Coincidencia de prefijo con contenido en la misma línea
        m_mot = inline_motivo.match(line)
        if m_mot:
            current_section = "motivo"
            if m_mot.group(1).strip():
                section_buffers["motivo"].append(m_mot.group(1).strip())
            continue

        m_diag = inline_diag.match(line)
        if m_diag:
            current_section = "diagnostico"
            if m_diag.group(1).strip():
                section_buffers["diagnostico"].append(m_diag.group(1).strip())
            continue

        m_trat = inline_trat.match(line)
        if m_trat:
            current_section = "tratamiento"
            if m_trat.group(1).strip():
                section_buffers["tratamiento"].append(m_trat.group(1).strip())
            continue

        m_obs = inline_obs.match(line)
        if m_obs:
            current_section = "observaciones"
            if m_obs.group(1).strip():
                section_buffers["observaciones"].append(m_obs.group(1).strip())
            continue

        # 3. Asignación de líneas según la sección actual activa
        if current_section is None:
            if admin_header_re.match(line):
                continue
            section_buffers["motivo"].append(line)
        else:
            if admin_header_re.match(line) and ("fecha de emisión" in line.lower() or "dr." in line.lower()):
                continue
            section_buffers[current_section].append(line)

    for sec in sections:
        sections[sec] = "\n".join(section_buffers[sec]).strip()

    if not sections["motivo"]:
        sections["motivo"] = "Consulta Médica / Control General"

    return sections

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
        
        estructurado = parse_medical_text(texto_total)

        return {
            "texto": texto_total,
            "paginas": num_paginas,
            "estructurado": estructurado
        }
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

@app.post("/api/citas/{cita_id}/enviar-email")
def enviar_email_cita(cita_id: int, req: EnviarEmailRequest):
    """Envía un correo de confirmación de turno médico al paciente vía SMTP (Gmail)."""
    cita = crud.get_cita(cita_id)
    if not cita:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
        
    paciente = crud.get_paciente(cita["paciente_id"])
    if not paciente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")
        
    dest_email = (req.email_destino or paciente.get("email") or "").strip()
    if not dest_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El paciente no tiene una dirección de e-mail registrada."
        )
        
    smtp_email = (req.smtp_email or "").strip()
    smtp_pass = (req.smtp_password or "").strip()
    
    if not smtp_email or not smtp_pass:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor ingresá tu e-mail emisor y contraseña de aplicación de Gmail en Configuración."
        )

    # Formatear fecha y hora
    try:
        dt = datetime.fromisoformat(cita["fecha_hora"].replace("Z", "+00:00"))
        fecha_str = dt.strftime("%d/%m/%Y a las %H:%M hs")
    except Exception:
        fecha_str = str(cita["fecha_hora"])

    config = crud.get_configuracion()
    doc_nombre = config.get("doctor_nombre") or "Doctor"
    doc_esp = config.get("doctor_especialidad") or ""
    doc_mat = config.get("doctor_matricula") or ""

    # Construir email HTML
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Confirmación de Turno Médico - {doc_nombre}"
    msg["From"] = smtp_email
    msg["To"] = dest_email

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #334155;">
        <div style="max-width: 550px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 2px solid #008080; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #008080; margin: 0; font-size: 1.4rem;">Confirmación de Turno Médico</h2>
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 5px;">History-Ar Medical System</p>
          </div>
          <p>Hola <strong>{paciente.get('nombre', '')} {paciente.get('apellido', '')}</strong>,</p>
          <p>Te confirmamos que tenés un turno médico programado:</p>
          
          <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;">📅 <strong>Fecha y Hora:</strong> {fecha_str}</p>
            <p style="margin: 5px 0;">🩺 <strong>Profesional:</strong> {doc_nombre} ({doc_esp})</p>
            <p style="margin: 5px 0;">📋 <strong>Matrícula:</strong> {doc_mat}</p>
            <p style="margin: 5px 0;">📝 <strong>Motivo de Consulta:</strong> {cita.get('motivo', 'Consulta Médica')}</p>
          </div>

          <p style="font-size: 0.85rem; color: #64748b; text-align: center; margin-top: 25px;">
            Si necesitas reprogramar o cancelar tu turno, por favor ponte en contacto a la brevedad.
          </p>
        </div>
      </body>
    </html>
    """

    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(smtp_email, smtp_pass)
            server.sendmail(smtp_email, dest_email, msg.as_string())
        return {"ok": True, "message": f"Correo enviado exitosamente a {dest_email}"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo enviar el correo vía Gmail: {str(e)}"
        )

@app.post("/api/pacientes/{paciente_id}/compartir-email")
def compartir_historia_profesional(paciente_id: int, req: CompartirHistoriaEmailRequest):
    """
    Envía por correo electrónico la historia médica, recetas e informes adjuntos de un paciente
    a otro profesional de la salud.
    """
    paciente = crud.get_paciente(paciente_id)
    if not paciente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Paciente con ID {paciente_id} no encontrado")

    dest_email = (req.email_profesional or "").strip()
    if not dest_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debe ingresar la dirección de correo del profesional destinatario.")

    smtp_email = (req.smtp_email or "").strip()
    smtp_pass = (req.smtp_password or "").strip()
    if not smtp_email or not smtp_pass:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor ingresá tu e-mail emisor y contraseña de aplicación de Gmail en Configuración."
        )

    config = crud.get_configuracion()
    doc_emisor = config.get("doctor_nombre") or "Médico Emisor"
    doc_esp = config.get("doctor_especialidad") or "Medicina General"
    doc_mat = config.get("doctor_matricula") or "-"

    nombre_destinatario = (req.nombre_profesional or "").strip() or "Colega Profesional"
    
    # Recolectar datos seleccionados
    consultas_html = ""
    if req.incluir_historia_clinica and paciente.get("consultas"):
        consultas_list = sorted(paciente["consultas"], key=lambda c: c.get("fecha", ""), reverse=True)
        items_html = ""
        for c in consultas_list:
            fecha_str = c.get("fecha", "")[:10] if c.get("fecha") else "Sin fecha"
            motivo = c.get("motivo", "N/A")
            diag = c.get("diagnostico", "N/A")
            obs = c.get("observaciones", "")
            tratam = c.get("tratamiento", "")

            items_html += f"""
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 8px;">
                    <span style="font-weight: bold; color: #0f766e;">📅 Fecha: {fecha_str}</span>
                    <span style="color: #64748b; font-size: 0.85rem;"><strong>Motivo:</strong> {motivo}</span>
                </div>
                <p style="margin: 4px 0;">🩺 <strong>Diagnóstico:</strong> {diag}</p>
                {"<p style='margin: 4px 0; color: #475569;'>📝 <strong>Evolución / Observaciones:</strong> " + obs + "</p>" if obs else ""}
                {"<p style='margin: 4px 0; color: #0284c7;'>💊 <strong>Tratamiento:</strong> " + tratam + "</p>" if tratam else ""}
            </div>
            """
        consultas_html = f"""
        <div style="margin-top: 25px;">
            <h3 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-bottom: 15px;">📋 Resumen de Historia Clínica y Consultas</h3>
            {items_html if items_html else "<p style='color: #64748b;'>No hay consultas registradas.</p>"}
        </div>
        """

    # Recetas seleccionadas
    recetas_html = ""
    if req.receta_ids and paciente.get("recetas"):
        recetas_filtradas = [r for r in paciente["recetas"] if r.get("id") in req.receta_ids]
        if recetas_filtradas:
            r_items = ""
            for r in recetas_filtradas:
                f_str = r.get("fecha", "")[:10] if r.get("fecha") else ""
                r_items += f"""
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                    <div style="font-weight: bold; color: #166534;">💊 Receta del {f_str}</div>
                    <p style="margin: 4px 0; font-family: monospace; white-space: pre-wrap;">{r.get('medicamentos', '')}</p>
                    {"<p style='margin: 4px 0; font-size: 0.85rem; color: #15803d;'><strong>Indicaciones:</strong> " + r.get('indicaciones', '') + "</p>" if r.get('indicaciones') else ""}
                </div>
                """
            recetas_html = f"""
            <div style="margin-top: 25px;">
                <h3 style="color: #166534; border-bottom: 2px solid #166534; padding-bottom: 6px; margin-bottom: 15px;">💊 Prescripciones / Recetas Médicas</h3>
                {r_items}
            </div>
            """

    mensaje_bloque = ""
    if req.mensaje_medico and req.mensaje_medico.strip():
        mensaje_bloque = f"""
        <div style="background-color: #fffbebfb; border-left: 4px solid #f59e0b; padding: 12px 15px; margin: 18px 0; border-radius: 4px;">
            <strong style="color: #b45309;">💬 Nota / Mensaje del Dr. {doc_emisor}:</strong>
            <p style="margin: 6px 0 0 0; color: #78350f;">{req.mensaje_medico.strip()}</p>
        </div>
        """

    # Construir email HTML completo
    import smtplib
    import mimetypes
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email import encoders

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"Historia Clínica Compartida - Paciente: {paciente.get('nombre', '')} {paciente.get('apellido', '')} (DNI: {paciente.get('dni', '')})"
    msg["From"] = smtp_email
    msg["To"] = dest_email

    pac_nombre = f"{paciente.get('nombre', '')} {paciente.get('apellido', '')}"
    pac_dni = paciente.get('dni', '-')
    pac_nac = paciente.get('fecha_nacimiento', '-')
    pac_tel = paciente.get('telefono', '-')
    pac_obra = paciente.get('obra_social', '-')

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #334155;">
        <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
          
          <!-- Encabezado -->
          <div style="border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #0f766e; margin: 0; font-size: 1.5rem;">History-Ar Medical Cloud</h2>
            <p style="color: #64748b; font-size: 0.85rem; margin-top: 4px;">Interconsulta / Registro de Historia Clínica Compartida</p>
          </div>

          <p style="font-size: 1rem;">Estimado/a <strong>Dr/a. {nombre_destinatario}</strong>,</p>
          <p style="color: #475569;">
            Le remito a continuación la documentación médica e historia clínica del paciente <strong>{pac_nombre}</strong>, compartida por el/la <strong>Dr/a. {doc_emisor}</strong> ({doc_esp} - M.P. {doc_mat}).
          </p>

          {mensaje_bloque}

          <!-- Datos del Paciente -->
          <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <h4 style="color: #0f766e; margin: 0 0 10px 0; font-size: 1.05rem;">👤 Datos del Paciente</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <tr>
                <td style="padding: 4px 0;"><strong>Nombre Completo:</strong> {pac_nombre}</td>
                <td style="padding: 4px 0;"><strong>DNI:</strong> {pac_dni}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Fecha de Nacimiento:</strong> {pac_nac}</td>
                <td style="padding: 4px 0;"><strong>Teléfono:</strong> {pac_tel}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;" colspan="2"><strong>Obra Social / Cobertura:</strong> {pac_obra}</td>
              </tr>
            </table>
          </div>

          {consultas_html}
          {recetas_html}

          <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 0.8rem; color: #94a3b8; text-align: center;">
            <p style="margin: 2px 0;">Este mensaje contiene información confidencial protegida por el secreto profesional médico.</p>
            <p style="margin: 2px 0;">Enviado a través de <strong>History-Ar Medical Suite</strong> por el Dr/a. {doc_emisor}.</p>
          </div>
        </div>
      </body>
    </html>
    """

    body_part = MIMEText(html_content, "html")
    msg.attach(body_part)

    # Adjuntar archivos seleccionados
    adjuntos_enviados = []
    if req.documento_ids and paciente.get("documentos"):
        docs_filtrados = [d for d in paciente["documentos"] if d.get("id") in req.documento_ids]
        for doc in docs_filtrados:
            ruta_rel = doc.get("ruta_archivo", "")
            if not ruta_rel:
                continue
            filename = os.path.basename(ruta_rel)
            file_path = os.path.join(uploads_dir, filename)
            if os.path.exists(file_path):
                try:
                    ctype, encoding = mimetypes.guess_type(file_path)
                    if ctype is None or encoding is not None:
                        ctype = 'application/octet-stream'
                    maintype, subtype = ctype.split('/', 1)

                    with open(file_path, 'rb') as fp:
                        attachment = MIMEBase(maintype, subtype)
                        attachment.set_payload(fp.read())
                    encoders.encode_base64(attachment)
                    
                    nombre_adjunto = doc.get("nombre") or filename
                    ext_orig = os.path.splitext(filename)[1]
                    if ext_orig and not nombre_adjunto.lower().endswith(ext_orig.lower()):
                        nombre_adjunto += ext_orig

                    attachment.add_header(
                        'Content-Disposition',
                        'attachment',
                        filename=nombre_adjunto
                    )
                    msg.attach(attachment)
                    adjuntos_enviados.append(nombre_adjunto)
                except Exception as e:
                    print(f"Error al adjuntar archivo {filename}: {e}")

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(smtp_email, smtp_pass)
            server.sendmail(smtp_email, dest_email, msg.as_string())
        
        info_adjuntos = f" con {len(adjuntos_enviados)} archivo(s) adjunto(s)" if adjuntos_enviados else ""
        return {"ok": True, "message": f"Historia clínica enviada exitosamente al Dr/a. {nombre_destinatario} ({dest_email}){info_adjuntos}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo enviar el correo vía Gmail: {str(e)}"
        )

# --- Endpoints Vademécum & Búsqueda de Medicamentos ---

@app.get("/api/medicamentos/buscar", response_model=List[MedicamentoRead])
def buscar_medicamentos(q: Optional[str] = None):
    results = []
    query_str = (q or "").strip().lower()
    
    # 1. Búsqueda en Vademécum Base
    for med in VADEMECUM_BASE:
        nombre = med["nombre_comercial"].lower()
        monodroga = (med.get("monodroga") or "").lower()
        if not query_str or query_str in nombre or query_str in monodroga:
            results.append(MedicamentoRead(
                id=med.get("id"),
                nombre_comercial=med["nombre_comercial"],
                monodroga=med.get("monodroga"),
                presentacion=med.get("presentacion"),
                dosis_sugerida=med.get("dosis_sugerida"),
                es_custom=False
            ))
            if len(results) >= 40:
                break

    # 2. Búsqueda en Medicamentos Personalizados (Supabase con fallback a SQLite local)
    try:
        supabase = get_supabase()
        sb_query = supabase.table("medicamentos_custom").select("*")
        if query_str:
            search = f"%{query_str}%"
            sb_query = sb_query.or_(f"nombre_comercial.ilike.{search},monodroga.ilike.{search}")
        sb_res = sb_query.limit(20).execute()
        if sb_res.data:
            for cm in sb_res.data:
                results.insert(0, MedicamentoRead(
                    id=cm.get("id"),
                    nombre_comercial=cm.get("nombre_comercial"),
                    monodroga=cm.get("monodroga"),
                    presentacion=cm.get("presentacion"),
                    dosis_sugerida=cm.get("dosis_sugerida"),
                    es_custom=True
                ))
    except Exception:
        # Fallback a SQLite local si Supabase no está disponible o la tabla no existe aún
        try:
            with Session(engine) as session:
                stmt = select(MedicamentoCustom)
                if query_str:
                    stmt = stmt.where(
                        (MedicamentoCustom.nombre_comercial.ilike(f"%{query_str}%")) |
                        (MedicamentoCustom.monodroga.ilike(f"%{query_str}%"))
                    )
                custom_meds = session.exec(stmt.limit(20)).all()
                for cm in custom_meds:
                    results.insert(0, MedicamentoRead(
                        id=cm.id,
                        nombre_comercial=cm.nombre_comercial,
                        monodroga=cm.monodroga,
                        presentacion=cm.presentacion,
                        dosis_sugerida=cm.dosis_sugerida,
                        es_custom=True
                    ))
        except Exception as e_sql:
            print(f"Error al buscar medicamentos custom: {e_sql}")

    return results

@app.post("/api/medicamentos/custom", response_model=MedicamentoRead)
def crear_medicamento_custom(med_in: MedicamentoCustomCreate):
    data_dict = {
        "nombre_comercial": med_in.nombre_comercial.strip(),
        "monodroga": med_in.monodroga.strip() if med_in.monodroga else None,
        "presentacion": med_in.presentacion.strip() if med_in.presentacion else None,
        "dosis_sugerida": med_in.dosis_sugerida.strip() if med_in.dosis_sugerida else None
    }
    
    # 1. Intentar guardar en Supabase si está disponible
    try:
        supabase = get_supabase()
        res = supabase.table("medicamentos_custom").insert(data_dict).execute()
        if res.data and len(res.data) > 0:
            created = res.data[0]
            return MedicamentoRead(
                id=created.get("id"),
                nombre_comercial=created.get("nombre_comercial"),
                monodroga=created.get("monodroga"),
                presentacion=created.get("presentacion"),
                dosis_sugerida=created.get("dosis_sugerida"),
                es_custom=True
            )
    except Exception:
        pass

    # 2. Guardar en SQLite local como respaldo
    try:
        with Session(engine) as session:
            nuevo = MedicamentoCustom(**data_dict)
            session.add(nuevo)
            session.commit()
            session.refresh(nuevo)
            return MedicamentoRead(
                id=nuevo.id,
                nombre_comercial=nuevo.nombre_comercial,
                monodroga=nuevo.monodroga,
                presentacion=nuevo.presentacion,
                dosis_sugerida=nuevo.dosis_sugerida,
                es_custom=True
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar medicamento personalizado: {str(e)}")


# Servir frontend estático si existe

base_path = sys._MEIPASS if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS') else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(base_path, "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    if getattr(sys, 'frozen', False):
        free_port_8000()
        kill_other_instances()
        try:
            uvicorn.run(app, host="127.0.0.1", port=8000, log_config=None)
        except Exception as e:
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, f"No se pudo iniciar el servidor History-Ar en el puerto 8000.\n\nDetalle: {str(e)}", "History-Ar Error", 0x10)
            except Exception:
                pass
    else:
        uvicorn.run(app, host="127.0.0.1", port=8000)
