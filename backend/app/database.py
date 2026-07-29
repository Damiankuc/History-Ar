import os
from sqlmodel import SQLModel, create_engine, Session

DATABASE_FILENAME = "pacientes.db"

# Resolver la ruta de la base de datos
# En producción (instalado), usamos la carpeta AppData del usuario para persistencia.
# En desarrollo, lo guardamos localmente en el directorio de trabajo.
appdata_path = os.environ.get("APPDATA")
if appdata_path:
    db_dir = os.path.join(appdata_path, "History-Ar")
    os.makedirs(db_dir, exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.join(db_dir, DATABASE_FILENAME)}"
else:
    # Ruta por defecto para desarrollo o si no hay APPDATA
    DATABASE_URL = f"sqlite:///./{DATABASE_FILENAME}"

# connect_args={"check_same_thread": False} es necesario para que SQLite funcione con múltiples hilos en FastAPI
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=True  # Muestra las consultas SQL en consola para depuración
)

def create_db_and_tables():
    """Crea las tablas en la base de datos si no existen."""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Generador para obtener la sesión de base de datos en los endpoints."""
    with Session(engine) as session:
        yield session
