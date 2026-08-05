import os
import sys
import sqlite3
from typing import List, Dict, Any

# Asegurar path de imports
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.join(current_dir, "app")
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from supabase_client import get_supabase

def find_sqlite_db() -> str:
    """Busca la base de datos local SQLite pacientes.db en AppData o directorio actual."""
    appdata_path = os.environ.get("APPDATA")
    if appdata_path:
        db_path = os.path.join(appdata_path, "History-Ar", "pacientes.db")
        if os.path.exists(db_path):
            return db_path
    
    local_path = os.path.join(current_dir, "pacientes.db")
    if os.path.exists(local_path):
        return local_path
        
    return ""

def migrate():
    print("=== Migración de History-Ar a Supabase ===")
    supabase = get_supabase()
    
    db_path = find_sqlite_db()
    if not db_path:
        print("No se encontró base de datos local pacientes.db (se iniciará limpia en Supabase).")
    else:
        print(f"Base de datos SQLite encontrada: {db_path}")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. Migrar Configuración a Usuarios (Médico)
        try:
            cursor.execute("SELECT * FROM configuracion LIMIT 1")
            config = cursor.fetchone()
            if config:
                doctor_nombre = config["doctor_nombre"] or "Médico Principal"
                doctor_matricula = config["doctor_matricula"] or "MP-0001"
                doctor_esp = config["doctor_especialidad"] or "Medicina General"
                pass_hash = config["password_hash"]
                firma = config["firma_ruta"]
                
                print(f"Migrando médico: {doctor_nombre} ({doctor_matricula})...")
                res = supabase.table("usuarios").upsert({
                    "nombre": doctor_nombre,
                    "matricula": doctor_matricula,
                    "especialidad": doctor_esp,
                    "password_hash": pass_hash,
                    "firma_ruta": firma
                }, on_conflict="matricula").execute()
                print("Médico migrado con éxito a Supabase.")
        except Exception as e:
            print(f"Error o tabla configuracion inexistente: {e}")

        # 2. Migrar Pacientes
        try:
            cursor.execute("SELECT * FROM paciente")
            pacientes = cursor.fetchall()
            print(f"Migrando {len(pacientes)} pacientes...")
            for p in pacientes:
                p_data = dict(p)
                p_id = p_data.pop("id", None)
                supabase.table("pacientes").upsert({
                    "id": p_id,
                    "nombre": p_data.get("nombre", ""),
                    "apellido": p_data.get("apellido", ""),
                    "dni": p_data.get("dni", ""),
                    "fecha_nacimiento": str(p_data.get("fecha_nacimiento", "")),
                    "telefono": p_data.get("telefono"),
                    "email": p_data.get("email"),
                    "direccion": p_data.get("direccion"),
                    "obra_social": p_data.get("obra_social"),
                    "numero_afiliado": p_data.get("numero_afiliado"),
                    "notas_generales": p_data.get("notas_generales")
                }).execute()
            print("Pacientes migrados con éxito.")
        except Exception as e:
            print(f"Error al migrar pacientes: {e}")

        # 3. Migrar Consultas (Padecimientos / Historias Médicas)
        try:
            cursor.execute("SELECT * FROM consulta")
            consultas = cursor.fetchall()
            print(f"Migrando {len(consultas)} consultas...")
            for c in consultas:
                c_data = dict(c)
                supabase.table("consultas").upsert({
                    "id": c_data.get("id"),
                    "fecha": str(c_data.get("fecha", "")),
                    "motivo": c_data.get("motivo", ""),
                    "diagnostico": c_data.get("diagnostico", ""),
                    "tratamiento": c_data.get("tratamiento", ""),
                    "notas": c_data.get("notas"),
                    "paciente_id": c_data.get("paciente_id")
                }).execute()
            print("Consultas migradas con éxito.")
        except Exception as e:
            print(f"Error al migrar consultas: {e}")

        # 4. Migrar Recetas
        try:
            cursor.execute("SELECT * FROM receta")
            recetas = cursor.fetchall()
            print(f"Migrando {len(recetas)} recetas...")
            for r in recetas:
                r_data = dict(r)
                supabase.table("recetas").upsert({
                    "id": r_data.get("id"),
                    "fecha": str(r_data.get("fecha", "")),
                    "medicamentos": r_data.get("medicamentos", ""),
                    "indicaciones": r_data.get("indicaciones"),
                    "paciente_id": r_data.get("paciente_id"),
                    "consulta_id": r_data.get("consulta_id")
                }).execute()
            print("Recetas migradas con éxito.")
        except Exception as e:
            print(f"Error al migrar recetas: {e}")

        # 5. Migrar Citas
        try:
            cursor.execute("SELECT * FROM cita")
            citas = cursor.fetchall()
            print(f"Migrando {len(citas)} citas...")
            for ci in citas:
                ci_data = dict(ci)
                supabase.table("citas").upsert({
                    "id": ci_data.get("id"),
                    "fecha_hora": str(ci_data.get("fecha_hora", "")),
                    "duracion_minutos": ci_data.get("duracion_minutos", 30),
                    "motivo": ci_data.get("motivo", ""),
                    "estado": ci_data.get("estado", "programado"),
                    "paciente_id": ci_data.get("paciente_id")
                }).execute()
            print("Citas migradas con éxito.")
        except Exception as e:
            print(f"Error al migrar citas: {e}")

        # 6. Migrar Documentos
        try:
            cursor.execute("SELECT * FROM documento")
            docs = cursor.fetchall()
            print(f"Migrando {len(docs)} documentos...")
            for d in docs:
                d_data = dict(d)
                supabase.table("documentos").upsert({
                    "id": d_data.get("id"),
                    "fecha_subida": str(d_data.get("fecha_subida", "")),
                    "nombre": d_data.get("nombre", ""),
                    "ruta_archivo": d_data.get("ruta_archivo", ""),
                    "tipo_mimetype": d_data.get("tipo_mimetype", ""),
                    "paciente_id": d_data.get("paciente_id"),
                    "consulta_id": d_data.get("consulta_id")
                }).execute()
            print("Documentos migrados con éxito.")
        except Exception as e:
            print(f"Error al migrar documentos: {e}")

        conn.close()

    print("=== Migración completada ===")

if __name__ == "__main__":
    migrate()
