from typing import List, Optional
from sqlmodel import Session, select, or_
from models import Paciente, Consulta, Documento, Configuracion, Receta, Cita
from schemas import PacienteCreate, PacienteBase, ConsultaCreate, ConfiguracionUpdate, RecetaCreate, CitaCreate

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

# --- CRUD Documentos ---

def create_documento(db: Session, nombre: str, ruta_archivo: str, tipo_mimetype: str, paciente_id: int, consulta_id: Optional[int] = None) -> Documento:
    db_documento = Documento(
        nombre=nombre,
        ruta_archivo=ruta_archivo,
        tipo_mimetype=tipo_mimetype,
        paciente_id=paciente_id,
        consulta_id=consulta_id
    )
    db.add(db_documento)
    db.commit()
    db.refresh(db_documento)
    return db_documento

def get_documento(db: Session, documento_id: int) -> Optional[Documento]:
    return db.get(Documento, documento_id)

def get_documentos_por_paciente(db: Session, paciente_id: int) -> List[Documento]:
    statement = select(Documento).where(Documento.paciente_id == paciente_id).order_by(Documento.fecha_subida.desc())
    return db.exec(statement).all()

def delete_documento(db: Session, documento_id: int) -> bool:
    db_documento = db.get(Documento, documento_id)
    if not db_documento:
        return False
    db.delete(db_documento)
    db.commit()
    return True

# --- CRUD Configuración ---

DEFAULT_PASSWORD = "HistoryAR2826"

def _hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _check_password(password: str, hashed: str) -> bool:
    import bcrypt
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def get_configuracion(db: Session) -> Configuracion:
    config = db.get(Configuracion, 1)
    if not config:
        # Primera vez: crear con contraseña por defecto hasheada
        config = Configuracion(
            id=1,
            doctor_nombre="",
            doctor_especialidad="",
            doctor_matricula="",
            password_hash=_hash_password(DEFAULT_PASSWORD),
            pedir_password_al_iniciar=True
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    elif config.password_hash is None:
        # Migración: si ya existía pero sin contraseña, asignar la contraseña por defecto
        config.password_hash = _hash_password(DEFAULT_PASSWORD)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def update_configuracion(db: Session, config_in: ConfiguracionUpdate) -> Configuracion:
    config = get_configuracion(db)
    update_data = config_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

def update_firma_ruta(db: Session, firma_ruta: str) -> Configuracion:
    config = get_configuracion(db)
    config.firma_ruta = firma_ruta
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

def verificar_password(db: Session, password: str) -> bool:
    """Verifica si la contraseña provista es correcta."""
    config = get_configuracion(db)
    if not config.password_hash:
        return False
    return _check_password(password, config.password_hash)

def cambiar_password(db: Session, password_actual: str, password_nueva: str) -> bool:
    """Cambia la contraseña si la actual es correcta. Devuelve True si tuvo éxito."""
    config = get_configuracion(db)
    if not config.password_hash or not _check_password(password_actual, config.password_hash):
        return False
    config.password_hash = _hash_password(password_nueva)
    db.add(config)
    db.commit()
    return True

# --- CRUD Recetas ---

def create_receta(db: Session, receta_in: RecetaCreate) -> Receta:
    db_receta = Receta.model_validate(receta_in)
    db.add(db_receta)
    db.commit()
    db.refresh(db_receta)
    return db_receta

def get_receta(db: Session, receta_id: int) -> Optional[Receta]:
    return db.get(Receta, receta_id)

def get_recetas_por_paciente(db: Session, paciente_id: int) -> List[Receta]:
    statement = select(Receta).where(Receta.paciente_id == paciente_id).order_by(Receta.fecha.desc())
    return db.exec(statement).all()

def delete_receta(db: Session, receta_id: int) -> bool:
    db_receta = db.get(Receta, receta_id)
    if not db_receta:
        return False
    db.delete(db_receta)
    db.commit()
    return True

# --- CRUD Citas ---

def create_cita(db: Session, cita_in: CitaCreate) -> Cita:
    db_cita = Cita.model_validate(cita_in)
    db.add(db_cita)
    db.commit()
    db.refresh(db_cita)
    return db_cita

def get_cita(db: Session, cita_id: int) -> Optional[Cita]:
    return db.get(Cita, cita_id)

def get_citas(db: Session) -> List[Cita]:
    statement = select(Cita).order_by(Cita.fecha_hora.asc())
    return db.exec(statement).all()

def update_cita_estado(db: Session, cita_id: int, estado: str) -> Optional[Cita]:
    db_cita = db.get(Cita, cita_id)
    if not db_cita:
        return None
    db_cita.estado = estado
    db.add(db_cita)
    db.commit()
    db.refresh(db_cita)
    return db_cita

def delete_cita(db: Session, cita_id: int) -> bool:
    db_cita = db.get(Cita, cita_id)
    if not db_cita:
        return False
    db.delete(db_cita)
    db.commit()
    return True

def delete_paciente(db: Session, paciente_id: int) -> bool:
    import os
    paciente = db.get(Paciente, paciente_id)
    if paciente:
        for doc in paciente.documentos:
            relative_path = doc.ruta_archivo.lstrip("/")
            file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), relative_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
        db.delete(paciente)
        db.commit()
        return True
    return False
