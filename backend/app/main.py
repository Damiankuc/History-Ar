from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
import os
import uuid
import shutil
from datetime import datetime

from .database import create_db_and_tables, get_session
from .schemas import (
    PacienteCreate,
    PacienteRead,
    PacienteReadConConsultas,
    ConsultaCreate,
    ConsultaRead,
    DocumentoRead
)
from . import crud
from . import scanner

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa las tablas de SQLite en el arranque del servidor
    create_db_and_tables()
    yield

app = FastAPI(
    title="Be-Pacient API",
    description="Backend local para la gestión de Historias Médicas",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS
# Permitimos todos los orígenes porque en local, la app de Tauri puede correr bajo orígenes
# personalizados como tauri://localhost o http://localhost:1420 (en desarrollo).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints de Pacientes ---

@app.get("/api/health", status_code=status.HTTP_200_OK)
def health_check():
    """Endpoint simple para verificar que la API está levantada y funcionando."""
    return {"status": "ok", "app": "Be-Pacient Backend"}

@app.get("/api/pacientes", response_model=List[PacienteRead])
def read_pacientes(
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session)
):
    """Obtiene el listado de pacientes. Permite filtrado por búsqueda 'q' (nombre, apellido, DNI)."""
    return crud.get_pacientes(db, skip=skip, limit=limit, q=q)

@app.get("/api/pacientes/{paciente_id}", response_model=PacienteReadConConsultas)
def read_paciente(paciente_id: int, db: Session = Depends(get_session)):
    """Obtiene un paciente por ID, incluyendo todo su historial de consultas médicas."""
    db_paciente = crud.get_paciente(db, paciente_id=paciente_id)
    if db_paciente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no encontrado"
        )
    return db_paciente

@app.post("/api/pacientes", response_model=PacienteRead, status_code=status.HTTP_201_CREATED)
def create_paciente(paciente: PacienteCreate, db: Session = Depends(get_session)):
    """Registra un nuevo paciente. Lanza error si el DNI ya está registrado."""
    db_paciente = crud.get_paciente_by_dni(db, dni=paciente.dni)
    if db_paciente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El paciente con DNI {paciente.dni} ya se encuentra registrado"
        )
    return crud.create_paciente(db=db, paciente_in=paciente)

@app.put("/api/pacientes/{paciente_id}", response_model=PacienteRead)
def update_paciente(paciente_id: int, paciente: PacienteCreate, db: Session = Depends(get_session)):
    """Actualiza la información personal de un paciente."""
    db_paciente = crud.update_paciente(db=db, paciente_id=paciente_id, paciente_update=paciente)
    if db_paciente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no encontrado"
        )
    return db_paciente

@app.delete("/api/pacientes/{paciente_id}")
def delete_paciente(paciente_id: int, db: Session = Depends(get_session)):
    """Elimina un paciente y todas sus consultas (borrado en cascada)."""
    exito = crud.delete_paciente(db=db, paciente_id=paciente_id)
    if not exito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no encontrado"
        )
    return {"message": "Paciente y consultas eliminados con éxito"}

# --- Endpoints de Consultas ---

@app.post("/api/consultas", response_model=ConsultaRead, status_code=status.HTTP_201_CREATED)
def create_consulta(consulta: ConsultaCreate, db: Session = Depends(get_session)):
    """Registra una nueva consulta médica en la historia clínica del paciente."""
    # Verificar que el paciente exista
    db_paciente = crud.get_paciente(db, paciente_id=consulta.paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se puede registrar consulta. Paciente con ID {consulta.paciente_id} no existe"
        )
    return crud.create_consulta(db=db, consulta_in=consulta)

@app.get("/api/consultas/{consulta_id}", response_model=ConsultaRead)
def read_consulta(consulta_id: int, db: Session = Depends(get_session)):
    """Obtiene los detalles de una consulta médica específica."""
    db_consulta = crud.get_consulta(db, consulta_id=consulta_id)
    if db_consulta is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consulta con ID {consulta_id} no encontrada"
        )
    return db_consulta

# --- Endpoints de Documentos Adjuntos ---

# Configuración del directorio de subidas local (uploads)
appdata_path = os.environ.get("APPDATA")
if appdata_path:
    uploads_dir = os.path.join(appdata_path, "Be-Pacient", "uploads")
else:
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

os.makedirs(uploads_dir, exist_ok=True)

# Montamos la carpeta de archivos subidos ANTES que el frontend estático
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.post("/api/pacientes/{paciente_id}/documentos/subir", response_model=DocumentoRead, status_code=status.HTTP_201_CREATED)
def subir_documento(
    paciente_id: int,
    consulta_id: Optional[int] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_session)
):
    """Sube un archivo médico adjunto (PDF, imagen) para la ficha del paciente."""
    # Verificar que el paciente exista
    db_paciente = crud.get_paciente(db, paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no existe"
        )
        
    # Verificar consulta si se proporciona
    if consulta_id:
        db_consulta = crud.get_consulta(db, consulta_id=consulta_id)
        if not db_consulta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Consulta con ID {consulta_id} no existe"
            )

    # Generar un nombre único de archivo para evitar colisiones
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(uploads_dir, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo guardar el archivo en el disco: {str(e)}"
        )

    # El campo ruta_archivo guarda el path relativo para poder servirlo estáticamente
    relative_path = f"/uploads/{unique_filename}"
    
    return crud.create_documento(
        db=db,
        nombre=file.filename or "archivo_sin_nombre",
        ruta_archivo=relative_path,
        tipo_mimetype=file.content_type or "application/octet-stream",
        paciente_id=paciente_id,
        consulta_id=consulta_id
    )

@app.post("/api/pacientes/{paciente_id}/documentos/escanear", response_model=DocumentoRead, status_code=status.HTTP_201_CREATED)
def escanear_documento(
    paciente_id: int,
    consulta_id: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """Dispara la adquisición física con el escáner de Windows y guarda el archivo."""
    # Verificar que el paciente exista
    db_paciente = crud.get_paciente(db, paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no existe"
        )

    # Generar nombre y ruta física del archivo escaneado (siempre PNG por defecto del script WIA)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"escaneo_{timestamp}.png"
    file_path = os.path.join(uploads_dir, filename)

    try:
        # Llamar al digitalizador nativo de Windows (scanner.py)
        scanner.scan_to_file(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error en el escáner: {str(e)}"
        )

    # Verificar que se haya guardado
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La digitalización se completó pero el archivo no pudo ser guardado."
        )

    relative_path = f"/uploads/{filename}"
    
    return crud.create_documento(
        db=db,
        nombre=f"Escaneo {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        ruta_archivo=relative_path,
        tipo_mimetype="image/png",
        paciente_id=paciente_id,
        consulta_id=consulta_id
    )

@app.get("/api/pacientes/{paciente_id}/documentos", response_model=List[DocumentoRead])
def read_documentos(paciente_id: int, db: Session = Depends(get_session)):
    """Lista todos los documentos cargados para la ficha del paciente."""
    db_paciente = crud.get_paciente(db, paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no existe"
        )
    return crud.get_documentos_por_paciente(db, paciente_id=paciente_id)

@app.delete("/api/documentos/{documento_id}")
def delete_documento(documento_id: int, db: Session = Depends(get_session)):
    """Elimina permanentemente un documento médico (del disco y base de datos)."""
    db_documento = crud.get_documento(db, documento_id=documento_id)
    if not db_documento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Documento con ID {documento_id} no encontrado"
        )

    # 1. Eliminar archivo físico del disco
    filename = os.path.basename(db_documento.ruta_archivo)
    physical_path = os.path.join(uploads_dir, filename)
    if os.path.exists(physical_path):
        try:
            os.remove(physical_path)
        except Exception as e:
            # Continuamos con el borrado de la DB aun si falla en disco
            pass

    # 2. Eliminar registro de la base de datos
    crud.delete_documento(db, documento_id=documento_id)
    return {"message": "Documento eliminado con éxito"}

# Servir archivos estáticos del frontend de React en producción
# Solo si existe la carpeta 'static' en el directorio del backend.
from fastapi.staticfiles import StaticFiles
import os

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(backend_root, "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

