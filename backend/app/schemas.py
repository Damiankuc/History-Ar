from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from sqlmodel import SQLModel
from models import PacienteBase, ConsultaBase

# --- Esquemas de Usuario / Médico (Nube) ---

class UsuarioRegister(BaseModel):
    nombre: str
    especialidad: Optional[str] = None
    matricula: str
    password: Optional[str] = None

class UsuarioLogin(BaseModel):
    nombre: str
    matricula: str
    password: Optional[str] = None

class UsuarioRead(BaseModel):
    id: int
    nombre: str
    especialidad: Optional[str] = None
    matricula: str
    firma_ruta: Optional[str] = None
    fecha_creacion: Optional[datetime] = None

# --- Esquemas para Consulta ---

class ConsultaCreate(ConsultaBase):
    pass

class ConsultaRead(ConsultaBase):
    id: int
    fecha: datetime

# --- Esquemas para Paciente ---

class PacienteCreate(PacienteBase):
    usuario_id: Optional[int] = None

class PacienteRead(PacienteBase):
    id: int
    fecha_creacion: datetime
    usuario_id: Optional[int] = None

# --- Esquemas para Documento ---

class DocumentoRead(SQLModel):
    id: int
    nombre: str
    ruta_archivo: str
    tipo_mimetype: str
    fecha_subida: datetime
    paciente_id: int
    consulta_id: Optional[int] = None

# --- Esquemas para Configuración Médica ---

class ConfiguracionRead(SQLModel):
    id: int
    doctor_nombre: str
    doctor_especialidad: str
    doctor_matricula: str
    firma_ruta: Optional[str] = None
    pedir_password_al_iniciar: bool = False

class ConfiguracionUpdate(SQLModel):
    doctor_nombre: Optional[str] = None
    doctor_especialidad: Optional[str] = None
    doctor_matricula: Optional[str] = None
    pedir_password_al_iniciar: Optional[bool] = None

# --- Schemas de Autenticación Legacy ---

class LoginRequest(SQLModel):
    password: str

class CambiarPasswordRequest(SQLModel):
    password_actual: str
    password_nueva: str

class AuthEstadoRead(SQLModel):
    pedir_password_al_iniciar: bool
    tiene_password: bool
    primer_inicio_completado: bool

# --- Esquemas para Receta ---

class RecetaCreate(SQLModel):
    medicamentos: str
    indicaciones: Optional[str] = None
    paciente_id: int
    consulta_id: Optional[int] = None

class RecetaRead(SQLModel):
    id: int
    medicamentos: str
    indicaciones: Optional[str] = None
    fecha: datetime
    paciente_id: int
    consulta_id: Optional[int] = None

# --- Esquemas para Cita ---

class CitaCreate(SQLModel):
    fecha_hora: datetime
    duracion_minutos: int = 30
    motivo: str
    paciente_id: int
    estado: str = "programado"

class CitaRead(SQLModel):
    id: int
    fecha_hora: datetime
    duracion_minutos: int
    motivo: str
    estado: str
    paciente_id: int

class CitaReadConPaciente(CitaRead):
    paciente: PacienteRead

# --- Esquemas compuestos para respuestas complejas ---

class PacienteReadConConsultas(PacienteRead):
    consultas: List[ConsultaRead] = []
    documentos: List[DocumentoRead] = []
    recetas: List[RecetaRead] = []
    citas: List[CitaRead] = []

class ConsultaReadConPaciente(ConsultaRead):
    paciente: PacienteRead

# --- Esquema para Notificación de Citas por Email ---

class EnviarEmailRequest(BaseModel):
    smtp_email: Optional[str] = None
    smtp_password: Optional[str] = None
    email_destino: Optional[str] = None

