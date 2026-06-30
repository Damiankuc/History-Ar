from datetime import datetime
from typing import List, Optional
from .models import PacienteBase, ConsultaBase

# --- Esquemas para Consulta ---

class ConsultaCreate(ConsultaBase):
    pass

class ConsultaRead(ConsultaBase):
    id: int
    fecha: datetime

# --- Esquemas para Paciente ---

class PacienteCreate(PacienteBase):
    pass

class PacienteRead(PacienteBase):
    id: int
    fecha_creacion: datetime

# --- Esquemas para Documento ---

from sqlmodel import SQLModel

class DocumentoRead(SQLModel):
    id: int
    nombre: str
    ruta_archivo: str
    tipo_mimetype: str
    fecha_subida: datetime
    paciente_id: int
    consulta_id: Optional[int]

# --- Esquemas compuestos para respuestas complejas ---

class PacienteReadConConsultas(PacienteRead):
    consultas: List[ConsultaRead] = []
    documentos: List[DocumentoRead] = []

class ConsultaReadConPaciente(ConsultaRead):
    paciente: PacienteRead

