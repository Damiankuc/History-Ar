from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from .database import create_db_and_tables, get_session
from .schemas import (
    PacienteCreate,
    PacienteRead,
    PacienteReadConConsultas,
    ConsultaCreate,
    ConsultaRead
)
from . import crud

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
