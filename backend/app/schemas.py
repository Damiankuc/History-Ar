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

# --- Esquemas compuestos para respuestas complejas ---

class PacienteReadConConsultas(PacienteRead):
    consultas: List[ConsultaRead] = []

class ConsultaReadConPaciente(ConsultaRead):
    paciente: PacienteRead
