from typing import List, Optional, Dict, Any
from datetime import datetime
import bcrypt
from supabase_client import get_supabase, get_supabase_for_user
from schemas import (
    UsuarioRegister, UsuarioLogin, UsuarioRead,
    PacienteCreate, PacienteRead, PacienteReadConConsultas,
    ConsultaCreate, ConsultaRead,
    DocumentoRead,
    ConfiguracionRead, ConfiguracionUpdate,
    RecetaCreate, RecetaRead,
    CitaCreate, CitaRead, CitaReadConPaciente
)

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# --- CRUD Usuarios (Médicos) en Supabase ---

def get_usuario_by_matricula(matricula: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("usuarios").select("*").eq("matricula", matricula.strip()).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def register_usuario(usuario_in: UsuarioRegister) -> Dict[str, Any]:
    supabase = get_supabase()
    # Verificar si ya existe por matrícula
    existing = get_usuario_by_matricula(usuario_in.matricula)
    if existing:
        raise ValueError(f"Ya existe un usuario registrado con la matrícula '{usuario_in.matricula}'")
    
    pass_hash = _hash_password(usuario_in.password) if usuario_in.password else None
    
    data = {
        "nombre": usuario_in.nombre.strip(),
        "especialidad": (usuario_in.especialidad or "").strip(),
        "matricula": usuario_in.matricula.strip(),
        "password_hash": pass_hash
    }
    
    # Intentar también registro en Supabase Auth nativo si hay password
    email = f"doctor_{usuario_in.matricula.strip()}@history-ar.local"
    if usuario_in.password:
        try:
            supabase.auth.sign_up({"email": email, "password": usuario_in.password})
        except Exception:
            pass

    res = supabase.table("usuarios").insert(data).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    raise Exception("No se pudo registrar el usuario en Supabase")

def login_usuario(nombre: str, matricula: str, password: Optional[str] = None) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    matricula_clean = matricula.strip()
    nombre_clean = nombre.strip().lower()
    
    res = supabase.table("usuarios").select("*").eq("matricula", matricula_clean).execute()
    if not res.data:
        return None
        
    usuario = res.data[0]
    # Verificar coincidencia exacta de nombre (insensible a mayúsculas y espacios)
    if usuario.get("nombre", "").strip().lower() != nombre_clean:
        return None
        
    # Verificar contraseña obligatoria si el usuario la tiene configurada
    if usuario.get("password_hash"):
        if not password or not _check_password(password, usuario["password_hash"]):
            return None

    # Intentar obtener JWT de Supabase Auth nativo
    access_token = None
    email = usuario.get("email") or f"doctor_{matricula_clean}@history-ar.local"
    if password:
        try:
            auth_res = supabase.auth.sign_in_with_password({"email": email, "password": password})
            if auth_res and auth_res.session:
                access_token = auth_res.session.access_token
        except Exception:
            pass
            
    usuario["access_token"] = access_token
    return usuario


# --- CRUD Pacientes ---

def get_pacientes(skip: int = 0, limit: int = 100, q: Optional[str] = None, token: Optional[str] = None) -> List[Dict[str, Any]]:
    supabase = get_supabase_for_user(token)
    query = supabase.table("pacientes").select("*")
    if q and q.strip():
        search = f"%{q.strip()}%"
        query = query.or_(f"nombre.ilike.{search},apellido.ilike.{search},dni.ilike.{search}")
    
    query = query.order("apellido").order("nombre").range(skip, skip + limit - 1)
    res = query.execute()
    return res.data or []


def get_paciente(paciente_id: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()
    if res.data and len(res.data) > 0:
        paciente = res.data[0]
        # Cargar relaciones completas (consultas, documentos, recetas, citas)
        consultas = get_consultas_por_paciente(paciente_id)
        documentos = get_documentos_por_paciente(paciente_id)
        recetas = get_recetas_por_paciente(paciente_id)
        citas = supabase.table("citas").select("*").eq("paciente_id", paciente_id).execute().data or []
        
        paciente["consultas"] = consultas
        paciente["documentos"] = documentos
        paciente["recetas"] = recetas
        paciente["citas"] = citas
        return paciente
    return None

def get_paciente_by_dni(dni: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("pacientes").select("*").eq("dni", dni.strip()).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def create_paciente(paciente_in: PacienteCreate) -> Dict[str, Any]:
    supabase = get_supabase()
    data = paciente_in.model_dump(exclude_unset=True)
    res = supabase.table("pacientes").insert(data).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    raise Exception("No se pudo crear el paciente en Supabase")

def update_paciente(paciente_id: int, paciente_update: PacienteCreate) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    data = paciente_update.model_dump(exclude_unset=True)
    res = supabase.table("pacientes").update(data).eq("id", paciente_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def delete_paciente(paciente_id: int) -> bool:
    supabase = get_supabase()
    res = supabase.table("pacientes").delete().eq("id", paciente_id).execute()
    return bool(res.data)

# --- CRUD Consultas (Historias Médicas / Padecimientos) ---

def create_consulta(consulta_in: ConsultaCreate) -> Dict[str, Any]:
    supabase = get_supabase()
    data = consulta_in.model_dump(exclude_unset=True)
    res = supabase.table("consultas").insert(data).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    raise Exception("No se pudo registrar la consulta médica")

def get_consulta(consulta_id: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("consultas").select("*").eq("id", consulta_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def get_consultas_por_paciente(paciente_id: int) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("consultas").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
    return res.data or []

# --- CRUD Documentos ---

def create_documento(nombre: str, ruta_archivo: str, tipo_mimetype: str, paciente_id: int, consulta_id: Optional[int] = None) -> Dict[str, Any]:
    supabase = get_supabase()
    data = {
        "nombre": nombre,
        "ruta_archivo": ruta_archivo,
        "tipo_mimetype": tipo_mimetype,
        "paciente_id": paciente_id,
        "consulta_id": consulta_id
    }
    res = supabase.table("documentos").insert(data).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    raise Exception("No se pudo crear el registro de documento en Supabase")

def get_documento(documento_id: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("documentos").select("*").eq("id", documento_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def get_documentos_por_paciente(paciente_id: int) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("documentos").select("*").eq("paciente_id", paciente_id).order("fecha_subida", desc=True).execute()
    return res.data or []

def delete_documento(documento_id: int) -> bool:
    supabase = get_supabase()
    res = supabase.table("documentos").delete().eq("id", documento_id).execute()
    return bool(res.data)

# --- CRUD Recetas ---

def create_receta(receta_in: RecetaCreate) -> Dict[str, Any]:
    supabase = get_supabase()
    data = receta_in.model_dump(exclude_unset=True)
    res = supabase.table("recetas").insert(data).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    raise Exception("No se pudo crear la receta")

def get_receta(receta_id: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("recetas").select("*").eq("id", receta_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def get_recetas_por_paciente(paciente_id: int) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("recetas").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
    return res.data or []

def delete_receta(receta_id: int) -> bool:
    supabase = get_supabase()
    res = supabase.table("recetas").delete().eq("id", receta_id).execute()
    return bool(res.data)

# --- CRUD Citas ---

def create_cita(cita_in: CitaCreate) -> Dict[str, Any]:
    supabase = get_supabase()
    data = cita_in.model_dump(exclude_unset=True)
    if "fecha_hora" in data and isinstance(data["fecha_hora"], datetime):
        data["fecha_hora"] = data["fecha_hora"].isoformat()
    res = supabase.table("citas").insert(data).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    raise Exception("No se pudo agendar la cita")

def get_cita(cita_id: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("citas").select("*").eq("id", cita_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def get_citas() -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("citas").select("*, paciente:paciente_id(id, nombre, apellido, dni, fecha_nacimiento, telefono, email)").order("fecha_hora").execute()
    return res.data or []

def update_cita_estado(cita_id: int, estado: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("citas").update({"estado": estado}).eq("id", cita_id).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]
    return None

def delete_cita(cita_id: int) -> bool:
    supabase = get_supabase()
    res = supabase.table("citas").delete().eq("id", cita_id).execute()
    return bool(res.data)

# --- Configuración del Médico / Usuario ---

def get_configuracion(usuario_id: Optional[int] = None) -> Dict[str, Any]:
    supabase = get_supabase()
    if usuario_id:
        res = supabase.table("usuarios").select("*").eq("id", usuario_id).execute()
        if res.data and len(res.data) > 0:
            u = res.data[0]
            return {
                "id": u["id"],
                "doctor_nombre": u.get("nombre", ""),
                "doctor_especialidad": u.get("especialidad", ""),
                "doctor_matricula": u.get("matricula", ""),
                "firma_ruta": u.get("firma_ruta"),
                "pedir_password_al_iniciar": True
            }
    
    # Fallback al primer médico registrado
    res = supabase.table("usuarios").select("*").limit(1).execute()
    if res.data and len(res.data) > 0:
        u = res.data[0]
        return {
            "id": u["id"],
            "doctor_nombre": u.get("nombre", ""),
            "doctor_especialidad": u.get("especialidad", ""),
            "doctor_matricula": u.get("matricula", ""),
            "firma_ruta": u.get("firma_ruta"),
            "pedir_password_al_iniciar": True
        }
    
    return {
        "id": 0,
        "doctor_nombre": "",
        "doctor_especialidad": "",
        "doctor_matricula": "",
        "firma_ruta": None,
        "pedir_password_al_iniciar": False
    }

def update_configuracion(config_in: ConfiguracionUpdate, usuario_id: Optional[int] = None) -> Dict[str, Any]:
    supabase = get_supabase()
    update_data = {}
    if config_in.doctor_nombre is not None:
        update_data["nombre"] = config_in.doctor_nombre
    if config_in.doctor_especialidad is not None:
        update_data["especialidad"] = config_in.doctor_especialidad
    if config_in.doctor_matricula is not None:
        update_data["matricula"] = config_in.doctor_matricula
        
    if update_data and usuario_id:
        res = supabase.table("usuarios").update(update_data).eq("id", usuario_id).execute()
        if res.data and len(res.data) > 0:
            return get_configuracion(usuario_id)
            
    return get_configuracion(usuario_id)

def update_firma_ruta(firma_ruta: str, usuario_id: Optional[int] = None) -> Dict[str, Any]:
    supabase = get_supabase()
    if usuario_id:
        supabase.table("usuarios").update({"firma_ruta": firma_ruta}).eq("id", usuario_id).execute()
    else:
        # Actualizar primer usuario
        users = supabase.table("usuarios").select("id").limit(1).execute()
        if users.data:
            supabase.table("usuarios").update({"firma_ruta": firma_ruta}).eq("id", users.data[0]["id"]).execute()
    return get_configuracion(usuario_id)
