from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
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

from database import create_db_and_tables, get_session, engine, DATABASE_FILENAME
from schemas import (
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
    CitaReadConPaciente
)
import crud
import scanner

def launch_browser():
    # Esperar 2.0 segundos a que el servidor FastAPI levante
    time.sleep(2.0)
    try:
        # Lanzar Edge en Modo App apuntando al host local
        subprocess.run(["cmd", "/c", "start msedge.exe --app=http://localhost:8000"], shell=True)
    except Exception:
        pass

# Monitoreo de actividad (Heartbeat) para evitar que quede corriendo en segundo plano
last_heartbeat = time.time()

def monitor_heartbeat():
    # Dar 12 segundos al inicio para permitir que se abra la ventana y mande el primer latido
    time.sleep(12.0)
    while True:
        time.sleep(2.0)
        # Si han pasado más de 7 segundos sin recibir un latido, asumimos que el navegador se cerró
        if time.time() - last_heartbeat > 7.0:
            print("No heartbeat received from frontend. Shutting down FastAPI backend...")
            os._exit(0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa las tablas de SQLite en el arranque del servidor
    create_db_and_tables()
    
    # Si la aplicación está compilada (PyInstaller), abrir el navegador en Modo App y monitorear actividad
    if getattr(sys, 'frozen', False):
        threading.Thread(target=launch_browser, daemon=True).start()
        threading.Thread(target=monitor_heartbeat, daemon=True).start()
        
    yield

app = FastAPI(
    title="History-Ar API",
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
    return {"status": "ok", "app": "History-Ar Backend"}

@app.post("/api/heartbeat")
def post_heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return {"status": "ok"}

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
    uploads_dir = os.path.join(appdata_path, "History-Ar", "uploads")
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

# --- Endpoints de Configuración Médica ---

@app.get("/api/configuracion", response_model=ConfiguracionRead)
def read_configuracion(db: Session = Depends(get_session)):
    """Obtiene los datos de configuración del médico (nombre, especialidad, matrícula)."""
    return crud.get_configuracion(db)

@app.post("/api/configuracion", response_model=ConfiguracionRead)
def update_configuracion(config_in: ConfiguracionUpdate, db: Session = Depends(get_session)):
    """Actualiza los datos de configuración del médico."""
    return crud.update_configuracion(db, config_in)

@app.post("/api/configuracion/firma", response_model=ConfiguracionRead)
def subir_firma_doctor(file: UploadFile = File(...), db: Session = Depends(get_session)):
    """Sube la firma o sello digitalizado del médico."""
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"doctor_signature{file_extension}"
    file_path = os.path.join(uploads_dir, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo guardar la firma: {str(e)}"
        )
        
    relative_path = f"/uploads/{filename}"
    return crud.update_firma_ruta(db, relative_path)

# --- Endpoints de Recetas Médicas ---

@app.post("/api/recetas", response_model=RecetaRead, status_code=status.HTTP_201_CREATED)
def crear_receta(receta_in: RecetaCreate, db: Session = Depends(get_session)):
    """Crea una nueva receta médica asociada a un paciente."""
    db_paciente = crud.get_paciente(db, paciente_id=receta_in.paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {receta_in.paciente_id} no existe"
        )
    return crud.create_receta(db, receta_in)

@app.get("/api/pacientes/{paciente_id}/recetas", response_model=List[RecetaRead])
def listar_recetas_paciente(paciente_id: int, db: Session = Depends(get_session)):
    """Lista las recetas médicas emitidas para el paciente."""
    db_paciente = crud.get_paciente(db, paciente_id=paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {paciente_id} no existe"
        )
    return crud.get_recetas_por_paciente(db, paciente_id=paciente_id)

@app.delete("/api/recetas/{receta_id}")
def delete_receta(receta_id: int, db: Session = Depends(get_session)):
    """Elimina una receta médica del historial."""
    success = crud.delete_receta(db, receta_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receta con ID {receta_id} no encontrada"
        )
    return {"message": "Receta eliminada con éxito"}

# --- Endpoints de Agenda y Citas ---

@app.post("/api/citas", response_model=CitaRead, status_code=status.HTTP_201_CREATED)
def crear_cita(cita_in: CitaCreate, db: Session = Depends(get_session)):
    """Registra un nuevo turno/cita en la agenda."""
    db_paciente = crud.get_paciente(db, paciente_id=cita_in.paciente_id)
    if not db_paciente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paciente con ID {cita_in.paciente_id} no existe"
        )
    return crud.create_cita(db, cita_in)

@app.get("/api/citas", response_model=List[CitaReadConPaciente])
def listar_citas(db: Session = Depends(get_session)):
    """Obtiene el listado de todos los turnos registrados en la agenda."""
    return crud.get_citas(db)

@app.put("/api/citas/{cita_id}", response_model=CitaRead)
def actualizar_cita_estado(cita_id: int, estado: str, db: Session = Depends(get_session)):
    """Cambia el estado de una cita (ej. completada, cancelada)."""
    cita = crud.update_cita_estado(db, cita_id, estado)
    if not cita:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cita con ID {cita_id} no encontrada"
        )
    return cita

@app.delete("/api/citas/{cita_id}")
def eliminar_cita(cita_id: int, db: Session = Depends(get_session)):
    """Elimina de forma permanente una cita de la agenda."""
    success = crud.delete_cita(db, cita_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cita con ID {cita_id} no encontrada"
        )
    return {"message": "Cita eliminada con éxito"}

# --- Endpoints de Copia de Seguridad (Backup & Restore) ---

def remove_file(path: str):
    try:
        os.remove(path)
    except Exception:
        pass

@app.get("/api/backup")
def crear_backup(background_tasks: BackgroundTasks):
    """Crea una copia de seguridad empaquetada en ZIP (base de datos + archivos adjuntos)."""
    db_path = str(engine.url).replace("sqlite:///", "")
    
    zip_filename = f"backup_bepacient_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    zip_path = os.path.join(uploads_dir, zip_filename)
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Agregar base de datos SQLite
            if os.path.exists(db_path):
                zip_file.write(db_path, arcname=DATABASE_FILENAME)
            
            # 2. Agregar carpeta uploads
            for root, _, files in os.walk(uploads_dir):
                for file in files:
                    if file == zip_filename or file.startswith("temp_restore_"):
                        continue
                    file_path = os.path.join(root, file)
                    arcname = os.path.join("uploads", file)
                    zip_file.write(file_path, arcname=arcname)
                    
        background_tasks.add_task(remove_file, zip_path)
        
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type="application/zip"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo crear la copia de seguridad: {str(e)}"
        )

@app.post("/api/restore")
def restaurar_backup(file: UploadFile = File(...), db: Session = Depends(get_session)):
    """Restaura una copia de seguridad a partir de un archivo ZIP."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo proporcionado debe ser un .zip válido"
        )
        
    temp_zip_path = os.path.join(uploads_dir, f"temp_restore_{uuid.uuid4()}.zip")
    
    # 1. Guardar el zip subido
    try:
        with open(temp_zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar archivo temporal: {str(e)}"
        )
        
    # 2. Descomprimir e importar
    db_path = str(engine.url).replace("sqlite:///", "")
    
    try:
        # Cerrar conexiones activas en el pool de SQLAlchemy para liberar el archivo SQLite
        engine.dispose()
        
        # Copia de seguridad temporal preventiva
        backup_db_path = db_path + ".bak"
        if os.path.exists(db_path):
            shutil.copy2(db_path, backup_db_path)
            
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            namelist = zip_ref.namelist()
            if DATABASE_FILENAME not in namelist:
                if os.path.exists(backup_db_path):
                    shutil.copy2(backup_db_path, db_path)
                    os.remove(backup_db_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El archivo zip no contiene una base de datos {DATABASE_FILENAME} válida"
                )
                
            # Extraer base de datos
            zip_ref.extract(DATABASE_FILENAME, path=os.path.dirname(db_path))
            
            # Extraer archivos de uploads
            for item in namelist:
                if item.startswith("uploads/") and not item.endswith("/"):
                    filename = os.path.basename(item)
                    dest_file_path = os.path.join(uploads_dir, filename)
                    with zip_ref.open(item) as source_file:
                        with open(dest_file_path, "wb") as dest_file:
                            shutil.copyfileobj(source_file, dest_file)
                            
        if os.path.exists(backup_db_path):
            os.remove(backup_db_path)
        os.remove(temp_zip_path)
        
        # Re-crear tablas (si el backup es de una versión anterior que no tiene todas las tablas)
        create_db_and_tables()
        
        return {"message": "Copia de seguridad restaurada con éxito"}
        
    except Exception as e:
        # Revertir db en caso de fallo
        backup_db_path = db_path + ".bak"
        if os.path.exists(backup_db_path):
            shutil.copy2(backup_db_path, db_path)
            os.remove(backup_db_path)
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fallo durante la restauración: {str(e)}"
        )

# Servir archivos estáticos del frontend de React en producción
from fastapi.staticfiles import StaticFiles

# Determinar si estamos corriendo compilados por PyInstaller o en modo desarrollo
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

static_dir = os.path.join(base_path, "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    if getattr(sys, 'frozen', False):
        uvicorn.run(app, host="127.0.0.1", port=8000, log_config=None)
    else:
        uvicorn.run(app, host="127.0.0.1", port=8000)

