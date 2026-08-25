from typing import List, Optional, Dict, Any
from datetime import datetime
import bcrypt
from supabase_client import get_supabase, get_supabase_for_user
from crypto_utils import encrypt_field, decrypt_field
from audit import log_audit_event
from database import engine
from sqlmodel import Session, select
from models import Paciente, Consulta, Documento, Receta, Cita
from schemas import (
    UsuarioRegister, UsuarioLogin, UsuarioRead,
    PacienteCreate, PacienteRead, PacienteReadConConsultas,
    ConsultaCreate, ConsultaRead,
    DocumentoRead,
    ConfiguracionRead, ConfiguracionUpdate,
    RecetaCreate, RecetaRead,
    CitaCreate, CitaRead, CitaReadConPaciente
)

def _decrypt_paciente(paciente: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not paciente:
        return paciente
    if paciente.get("dni"):
        paciente["dni"] = decrypt_field(paciente["dni"])
    if paciente.get("notas_generales"):
        paciente["notas_generales"] = decrypt_field(paciente["notas_generales"])
    if paciente.get("antecedentes_medicos"):
        paciente["antecedentes_medicos"] = decrypt_field(paciente["antecedentes_medicos"])
    if paciente.get("antecedentes_familiares"):
        paciente["antecedentes_familiares"] = decrypt_field(paciente["antecedentes_familiares"])
    return paciente

def _encrypt_paciente_data(data: Dict[str, Any]) -> Dict[str, Any]:
    if "dni" in data and data["dni"]:
        data["dni"] = encrypt_field(data["dni"])
    if "notas_generales" in data and data["notas_generales"]:
        data["notas_generales"] = encrypt_field(data["notas_generales"])
    if "antecedentes_medicos" in data and data["antecedentes_medicos"]:
        data["antecedentes_medicos"] = encrypt_field(data["antecedentes_medicos"])
    if "antecedentes_familiares" in data and data["antecedentes_familiares"]:
        data["antecedentes_familiares"] = encrypt_field(data["antecedentes_familiares"])
    return data

def _decrypt_consulta(consulta: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not consulta:
        return consulta
    if consulta.get("subjetivo_motivo"):
        consulta["subjetivo_motivo"] = decrypt_field(consulta["subjetivo_motivo"])
    if consulta.get("diagnostico"):
        consulta["diagnostico"] = decrypt_field(consulta["diagnostico"])
    if consulta.get("plan_tratamiento"):
        consulta["plan_tratamiento"] = decrypt_field(consulta["plan_tratamiento"])
    return consulta

def _encrypt_consulta_data(data: Dict[str, Any]) -> Dict[str, Any]:
    if "subjetivo_motivo" in data and data["subjetivo_motivo"]:
        data["subjetivo_motivo"] = encrypt_field(data["subjetivo_motivo"])
    if "diagnostico" in data and data["diagnostico"]:
        data["diagnostico"] = encrypt_field(data["diagnostico"])
    if "plan_tratamiento" in data and data["plan_tratamiento"]:
        data["plan_tratamiento"] = encrypt_field(data["plan_tratamiento"])
    return data

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

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
    try:
        supabase = get_supabase_for_user(token)
        query = supabase.table("pacientes").select("*")
        if q and q.strip():
            search = f"%{q.strip()}%"
            query = query.or_(f"nombre.ilike.{search},apellido.ilike.{search},dni.ilike.{search}")
        
        query = query.order("apellido").order("nombre").range(skip, skip + limit - 1)
        res = query.execute()
        pacientes = res.data or []
        if len(pacientes) > 0:
            return [_decrypt_paciente(p) for p in pacientes]
    except Exception as e:
        print(f"Aviso al obtener pacientes de Supabase: {e}")

    # Fallback local a SQLite
    with Session(engine) as session:
        stmt = select(Paciente)
        if q and q.strip():
            q_clean = f"%{q.strip()}%"
            stmt = stmt.where(
                (Paciente.nombre.like(q_clean)) | 
                (Paciente.apellido.like(q_clean)) | 
                (Paciente.dni.like(q_clean))
            )
        stmt = stmt.offset(skip).limit(limit)
        locales = session.exec(stmt).all()
        return [
            {
                "id": p.id,
                "nombre": p.nombre,
                "apellido": p.apellido,
                "dni": p.dni,
                "fecha_nacimiento": p.fecha_nacimiento,
                "telefono": p.telefono,
                "email": p.email,
                "direccion": p.direccion,
                "obra_social": p.obra_social,
                "numero_afiliado": p.numero_afiliado,
                "notas_generales": p.notas_generales,
                "fecha_creacion": p.fecha_creacion
            } for p in locales
        ]


def get_paciente(paciente_id: int) -> Optional[Dict[str, Any]]:
    try:
        supabase = get_supabase()
        res = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()
        if res.data and len(res.data) > 0:
            paciente = _decrypt_paciente(res.data[0])
            consultas = get_consultas_por_paciente(paciente_id)
            documentos = get_documentos_por_paciente(paciente_id)
            recetas = get_recetas_por_paciente(paciente_id)
            citas_res = supabase.table("citas").select("*").eq("paciente_id", paciente_id).execute()
            citas = citas_res.data or []
            
            paciente["consultas"] = consultas
            paciente["documentos"] = documentos
            paciente["recetas"] = recetas
            paciente["citas"] = citas
            log_audit_event(accion="LECTURA_HISTORIA_CLINICA", paciente_id=paciente_id, detalle=f"Lectura completa de historia clínica de paciente ID {paciente_id}")
            return paciente
    except Exception as e:
        print(f"Aviso al obtener paciente ID {paciente_id} de Supabase: {e}")

    with Session(engine) as session:
        p = session.get(Paciente, paciente_id)
        if p:
            consultas = session.exec(select(Consulta).where(Consulta.paciente_id == paciente_id)).all()
            documentos = session.exec(select(Documento).where(Documento.paciente_id == paciente_id)).all()
            recetas = session.exec(select(Receta).where(Receta.paciente_id == paciente_id)).all()
            citas = session.exec(select(Cita).where(Cita.paciente_id == paciente_id)).all()

            return {
                "id": p.id,
                "nombre": p.nombre,
                "apellido": p.apellido,
                "dni": p.dni,
                "fecha_nacimiento": p.fecha_nacimiento,
                "telefono": p.telefono,
                "email": p.email,
                "direccion": p.direccion,
                "obra_social": p.obra_social,
                "numero_afiliado": p.numero_afiliado,
                "notas_generales": p.notas_generales,
                "fecha_creacion": p.fecha_creacion,
                "consultas": [{"id": c.id, "motivo": c.motivo, "diagnostico": c.diagnostico, "tratamiento": c.tratamiento, "notas": c.notas, "fecha": c.fecha, "paciente_id": c.paciente_id} for c in consultas],
                "documentos": [{"id": d.id, "nombre": d.nombre, "ruta_archivo": d.ruta_archivo, "tipo_mimetype": d.tipo_mimetype, "fecha_subida": d.fecha_subida, "paciente_id": d.paciente_id, "consulta_id": d.consulta_id} for d in documentos],
                "recetas": [{"id": r.id, "medicamentos": r.medicamentos, "indicaciones": r.indicaciones, "fecha": r.fecha, "paciente_id": r.paciente_id, "consulta_id": r.consulta_id} for r in recetas],
                "citas": [{"id": ci.id, "fecha_hora": ci.fecha_hora, "duracion_minutos": ci.duracion_minutos, "motivo": ci.motivo, "estado": ci.estado, "paciente_id": ci.paciente_id} for ci in citas]
            }
    return None

def get_paciente_by_dni(dni: str) -> Optional[Dict[str, Any]]:
    try:
        supabase = get_supabase()
        encrypted_dni = encrypt_field(dni.strip())
        res = supabase.table("pacientes").select("*").or_(f"dni.eq.{dni.strip()},dni.eq.{encrypted_dni}").execute()
        if res.data and len(res.data) > 0:
            return _decrypt_paciente(res.data[0])
    except Exception:
        pass

    with Session(engine) as session:
        p = session.exec(select(Paciente).where(Paciente.dni == dni.strip())).first()
        if p:
            return {
                "id": p.id,
                "nombre": p.nombre,
                "apellido": p.apellido,
                "dni": p.dni,
                "fecha_nacimiento": p.fecha_nacimiento,
                "telefono": p.telefono,
                "email": p.email,
                "direccion": p.direccion,
                "obra_social": p.obra_social,
                "numero_afiliado": p.numero_afiliado,
                "notas_generales": p.notas_generales,
                "fecha_creacion": p.fecha_creacion
            }
    return None

def create_paciente(paciente_in: PacienteCreate) -> Dict[str, Any]:
    data = paciente_in.model_dump(exclude_unset=True)
    try:
        supabase = get_supabase()
        data_supa = dict(data)
        _encrypt_paciente_data(data_supa)
        res = supabase.table("pacientes").insert(data_supa).execute()
        if res.data and len(res.data) > 0:
            paciente = _decrypt_paciente(res.data[0])
            log_audit_event(accion="CREACION_PACIENTE", paciente_id=paciente["id"], detalle=f"Creación de nuevo paciente ID {paciente['id']}")
            return paciente
    except Exception as e:
        print(f"Aviso al guardar paciente en Supabase (usando resguardo local SQLite): {e}")

    with Session(engine) as session:
        existente = session.exec(select(Paciente).where(Paciente.dni == paciente_in.dni.strip())).first()
        if existente:
            return {
                "id": existente.id,
                "nombre": existente.nombre,
                "apellido": existente.apellido,
                "dni": existente.dni,
                "fecha_nacimiento": existente.fecha_nacimiento,
                "telefono": existente.telefono,
                "email": existente.email,
                "direccion": existente.direccion,
                "obra_social": existente.obra_social,
                "numero_afiliado": existente.numero_afiliado,
                "notas_generales": existente.notas_generales,
                "fecha_creacion": existente.fecha_creacion
            }
        nuevo_local = Paciente(**data)
        session.add(nuevo_local)
        session.commit()
        session.refresh(nuevo_local)
        log_audit_event(accion="CREACION_PACIENTE", paciente_id=nuevo_local.id, detalle=f"Creación local de paciente ID {nuevo_local.id}")
        return {
            "id": nuevo_local.id,
            "nombre": nuevo_local.nombre,
            "apellido": nuevo_local.apellido,
            "dni": nuevo_local.dni,
            "fecha_nacimiento": nuevo_local.fecha_nacimiento,
            "telefono": nuevo_local.telefono,
            "email": nuevo_local.email,
            "direccion": nuevo_local.direccion,
            "obra_social": nuevo_local.obra_social,
            "numero_afiliado": nuevo_local.numero_afiliado,
            "notas_generales": nuevo_local.notas_generales,
            "fecha_creacion": nuevo_local.fecha_creacion
        }

def update_paciente(paciente_id: int, paciente_update: PacienteCreate) -> Optional[Dict[str, Any]]:
    data = paciente_update.model_dump(exclude_unset=True)
    try:
        supabase = get_supabase()
        data_supa = dict(data)
        _encrypt_paciente_data(data_supa)
        res = supabase.table("pacientes").update(data_supa).eq("id", paciente_id).execute()
        if res.data and len(res.data) > 0:
            paciente = _decrypt_paciente(res.data[0])
            log_audit_event(accion="MODIFICACION_PACIENTE", paciente_id=paciente_id, detalle=f"Modificación de paciente ID {paciente_id}")
            return paciente
    except Exception as e:
        print(f"Aviso al modificar paciente en Supabase: {e}")

    with Session(engine) as session:
        p = session.get(Paciente, paciente_id)
        if p:
            for k, v in data.items():
                setattr(p, k, v)
            session.add(p)
            session.commit()
            session.refresh(p)
            return {
                "id": p.id,
                "nombre": p.nombre,
                "apellido": p.apellido,
                "dni": p.dni,
                "fecha_nacimiento": p.fecha_nacimiento,
                "telefono": p.telefono,
                "email": p.email,
                "direccion": p.direccion,
                "obra_social": p.obra_social,
                "numero_afiliado": p.numero_afiliado,
                "notas_generales": p.notas_generales,
                "fecha_creacion": p.fecha_creacion
            }
    return None

def delete_paciente(paciente_id: int) -> bool:
    eliminado = False
    try:
        supabase = get_supabase()
        res = supabase.table("pacientes").delete().eq("id", paciente_id).execute()
        if bool(res.data):
            eliminado = True
    except Exception as e:
        print(f"Aviso al eliminar paciente en Supabase: {e}")

    with Session(engine) as session:
        p = session.get(Paciente, paciente_id)
        if p:
            session.delete(p)
            session.commit()
            eliminado = True

    if eliminado:
        log_audit_event(accion="ELIMINACION_PACIENTE", paciente_id=paciente_id, detalle=f"Eliminación de ficha de paciente ID {paciente_id}")
    return eliminado

# --- CRUD Consultas (Historias Médicas / Padecimientos) ---

def create_consulta(consulta_in: ConsultaCreate) -> Dict[str, Any]:
    data = consulta_in.model_dump(exclude_unset=True)
    try:
        supabase = get_supabase()
        data_supa = dict(data)
        _encrypt_consulta_data(data_supa)
        res = supabase.table("consultas").insert(data_supa).execute()
        if res.data and len(res.data) > 0:
            consulta = _decrypt_consulta(res.data[0])
            log_audit_event(accion="CREACION_CONSULTA", paciente_id=consulta.get("paciente_id"), detalle=f"Registro de consulta médica ID {consulta.get('id')}")
            return consulta
    except Exception as e:
        print(f"Aviso al guardar consulta en Supabase: {e}")

    with Session(engine) as session:
        nueva_c = Consulta(**data)
        session.add(nueva_c)
        session.commit()
        session.refresh(nueva_c)
        log_audit_event(accion="CREACION_CONSULTA", paciente_id=nueva_c.paciente_id, detalle=f"Registro local de consulta médica ID {nueva_c.id}")
        return {
            "id": nueva_c.id,
            "motivo": nueva_c.motivo,
            "diagnostico": nueva_c.diagnostico,
            "tratamiento": nueva_c.tratamiento,
            "notas": nueva_c.notas,
            "fecha": nueva_c.fecha,
            "paciente_id": nueva_c.paciente_id
        }

def get_consulta(consulta_id: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("consultas").select("*").eq("id", consulta_id).execute()
    if res.data and len(res.data) > 0:
        return _decrypt_consulta(res.data[0])
    return None

def get_consultas_por_paciente(paciente_id: int) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("consultas").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
    consultas = res.data or []
    return [_decrypt_consulta(c) for c in consultas]


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
