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
    notas_generales: Optional[str] = None

class Paciente(PacienteBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)
    
    # Relación de uno a muchos: un paciente tiene muchas consultas
    consultas: List["Consulta"] = Relationship(back_populates="paciente", cascade_delete=True)
    # Relación de uno a muchos: un paciente tiene muchos documentos
    documentos: List["Documento"] = Relationship(back_populates="paciente", cascade_delete=True)

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
