from typing import List, Optional
from sqlmodel import Session, select, or_
from .models import Paciente, Consulta
from .schemas import PacienteCreate, PacienteBase, ConsultaCreate

# --- CRUD Pacientes ---

def get_pacientes(db: Session, skip: int = 0, limit: int = 100, q: Optional[str] = None) -> List[Paciente]:
    statement = select(Paciente)
    if q:
        # Búsqueda por nombre, apellido o DNI
        search_filter = or_(
            Paciente.nombre.contains(q),
            Paciente.apellido.contains(q),
            Paciente.dni.contains(q)
        )
        statement = statement.where(search_filter)
    
    # Ordenar por apellido y nombre
    statement = statement.order_by(Paciente.apellido, Paciente.nombre).offset(skip).limit(limit)
    return db.exec(statement).all()

def get_paciente(db: Session, paciente_id: int) -> Optional[Paciente]:
    return db.get(Paciente, paciente_id)

def get_paciente_by_dni(db: Session, dni: str) -> Optional[Paciente]:
    statement = select(Paciente).where(Paciente.dni == dni)
    return db.exec(statement).first()

def create_paciente(db: Session, paciente_in: PacienteCreate) -> Paciente:
    db_paciente = Paciente.model_validate(paciente_in)
    db.add(db_paciente)
    db.commit()
    db.refresh(db_paciente)
    return db_paciente

def update_paciente(db: Session, paciente_id: int, paciente_update: PacienteCreate) -> Optional[Paciente]:
    db_paciente = db.get(Paciente, paciente_id)
    if not db_paciente:
        return None
    
    # Actualizar campos
    paciente_data = paciente_update.model_dump(exclude_unset=True)
    for key, value in paciente_data.items():
        setattr(db_paciente, key, value)
        
    db.add(db_paciente)
    db.commit()
    db.refresh(db_paciente)
    return db_paciente

def delete_paciente(db: Session, paciente_id: int) -> bool:
    db_paciente = db.get(Paciente, paciente_id)
    if not db_paciente:
        return False
    db.delete(db_paciente)
    db.commit()
    return True

# --- CRUD Consultas (Historias Clínicas) ---

def create_consulta(db: Session, consulta_in: ConsultaCreate) -> Consulta:
    db_consulta = Consulta.model_validate(consulta_in)
    db.add(db_consulta)
    db.commit()
    db.refresh(db_consulta)
    return db_consulta

def get_consulta(db: Session, consulta_id: int) -> Optional[Consulta]:
    return db.get(Consulta, consulta_id)

def get_consultas_por_paciente(db: Session, paciente_id: int) -> List[Consulta]:
    statement = select(Consulta).where(Consulta.paciente_id == paciente_id).order_by(Consulta.fecha.desc())
    return db.exec(statement).all()
