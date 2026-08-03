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
    """Crea las tablas en la base de datos si no existen y ejecuta migraciones de columnas."""
    SQLModel.metadata.create_all(engine)
    _migrate_db()

def _migrate_db():
    """Agrega columnas nuevas si no existen (compatibilidad con DBs antiguas)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE configuracion ADD COLUMN password_hash TEXT",
            "ALTER TABLE configuracion ADD COLUMN pedir_password_al_iniciar BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE configuracion ADD COLUMN primer_inicio_completado BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE paciente ADD COLUMN obra_social TEXT",
            "ALTER TABLE paciente ADD COLUMN numero_afiliado TEXT",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass

def get_session():
    """Generador para obtener la sesión de base de datos en los endpoints."""
    with Session(engine) as session:
        yield session

# Asegurar que la DB y sus migraciones se ejecuten al importar el módulo
create_db_and_tables()

