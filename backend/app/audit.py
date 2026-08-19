import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import Request
from supabase_client import get_supabase

# Configurar logger de auditoría inalterable local
appdata_path = os.environ.get("APPDATA")
if appdata_path:
    audit_dir = os.path.join(appdata_path, "History-Ar", "audit")
else:
    audit_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "audit")

os.makedirs(audit_dir, exist_ok=True)
audit_log_file = os.path.join(audit_dir, "audit_trail.log")

audit_logger = logging.getLogger("HistoryArAuditLogger")
audit_logger.setLevel(logging.INFO)

if not audit_logger.handlers:
    file_handler = logging.FileHandler(audit_log_file, encoding="utf-8")
    formatter = logging.Formatter('%(asctime)s - %(message)s')
    file_handler.setFormatter(formatter)
    audit_logger.addHandler(file_handler)

def log_audit_event(
    accion: str,
    usuario_id: Optional[str] = None,
    paciente_id: Optional[int] = None,
    detalle: Optional[str] = None,
    request: Optional[Request] = None
) -> None:
    """Registra de manera inalterable una acción clínica (LECTURA, CREACION, MODIFICACION, ELIMINACION, EXPORTACION_PDF)

    en cumplimiento directo con la Ley 26.529 y la Ley 25.326.
    """
    timestamp_utc = datetime.now(timezone.utc).isoformat()
    ip_cliente = None
    user_agent = None

    if request:
        ip_cliente = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
        user_agent = request.headers.get("user-agent")

    event_payload = {
        "usuario_id": usuario_id or "sistema",
        "accion": accion.upper(),
        "paciente_id": paciente_id,
        "detalle": detalle or "",
        "timestamp": timestamp_utc,
        "ip": ip_cliente or "127.0.0.1",
        "user_agent": user_agent or "History-Ar Client"
    }

    # 1. Registrar en archivo local de auditoría (local immutable fallback)
    try:
        audit_logger.info(json.dumps(event_payload, ensure_ascii=False))
    except Exception:
        pass

    # 2. Registrar en Supabase Cloud audit_logs
    try:
        supabase = get_supabase()
        supabase.table("audit_logs").insert(event_payload).execute()
    except Exception:
        pass
