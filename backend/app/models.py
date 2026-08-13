from datetime import datetime
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel

class PacienteBase(SQLModel):
    nombre: str = Field(index=True)
    apellido: str = Field(index=True)
    dni: str = Field(index=True, unique=True)
    fecha_nacimiento: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    obra_social: Optional[str] = None
    numero_afiliado: Optional[str] = None
    notas_generales: Optional[str] = None

class Paciente(PacienteBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)
    
    # Relación de uno a muchos: un paciente tiene muchas consultas
    consultas: List["Consulta"] = Relationship(back_populates="paciente", cascade_delete=True)
    # Relación de uno a muchos: un paciente tiene muchos documentos
    documentos: List["Documento"] = Relationship(back_populates="paciente", cascade_delete=True)
    # Relación de uno a muchos: un paciente tiene muchas recetas
    recetas: List["Receta"] = Relationship(back_populates="paciente", cascade_delete=True)
    # Relación de uno a muchos: un paciente tiene muchas citas agendadas
    citas: List["Cita"] = Relationship(back_populates="paciente", cascade_delete=True)

class ConsultaBase(SQLModel):
    motivo: str
    diagnostico: str
    tratamiento: str
    notas: Optional[str] = None
    paciente_id: int = Field(foreign_key="paciente.id")

class Consulta(ConsultaBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: datetime = Field(default_factory=datetime.utcnow)
    
    # Relación inversa: la consulta pertenece a un paciente
    paciente: Paciente = Relationship(back_populates="consultas")
    # Relación: una consulta puede tener asociados varios documentos
    documentos: List["Documento"] = Relationship(back_populates="consulta")
    # Relación: una consulta puede tener recetas asociadas
    recetas: List["Receta"] = Relationship(back_populates="consulta")

class Documento(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str
    ruta_archivo: str  # Ruta relativa en el disco
    tipo_mimetype: str  # pdf, image/jpeg, png, etc.
    fecha_subida: datetime = Field(default_factory=datetime.utcnow)
    
    paciente_id: int = Field(foreign_key="paciente.id")
    paciente: Paciente = Relationship(back_populates="documentos")
    
    consulta_id: Optional[int] = Field(default=None, foreign_key="consulta.id")
    consulta: Optional[Consulta] = Relationship(back_populates="documentos")

# --- Nuevos Modelos Fase 2 ---

class Configuracion(SQLModel, table=True):
    id: Optional[int] = Field(default=1, primary_key=True)
    doctor_nombre: str = ""
    doctor_especialidad: str = ""
    doctor_matricula: str = ""
    firma_ruta: Optional[str] = None  # Ruta a la firma digitalizada
    password_hash: Optional[str] = None  # Hash bcrypt de la contraseña de acceso
    pedir_password_al_iniciar: bool = Field(default=False)  # Si True, pide login en cada arranque
    primer_inicio_completado: bool = Field(default=False)   # True tras el primer login de activación

class Receta(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    medicamentos: str
    indicaciones: Optional[str] = None
    fecha: datetime = Field(default_factory=datetime.utcnow)
    
    paciente_id: int = Field(foreign_key="paciente.id")
    paciente: Paciente = Relationship(back_populates="recetas")
    
    consulta_id: Optional[int] = Field(default=None, foreign_key="consulta.id")
    consulta: Optional[Consulta] = Relationship(back_populates="recetas")

class Cita(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha_hora: datetime
    duracion_minutos: int = Field(default=30)
    motivo: str
    estado: str = Field(default="programado")  # "programado", "completado", "cancelado"
    
    paciente_id: int = Field(foreign_key="paciente.id")
    paciente: Paciente = Relationship(back_populates="citas")

class MedicamentoCustom(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre_comercial: str = Field(index=True)
    monodroga: Optional[str] = Field(default=None, index=True)
    presentacion: Optional[str] = None
    dosis_sugerida: Optional[str] = None
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)

