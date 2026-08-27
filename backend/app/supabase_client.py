import os
from typing import Optional
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qvutqqfsypzcfjhhzqsk.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_KT61xj__yMLdxD37Wc5Teg_RFfQz6Rm")

_supabase_instance: Client = None

def get_supabase() -> Client:
    global _supabase_instance
    if _supabase_instance is None:
        _supabase_instance = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_instance

def get_supabase_for_user(token: Optional[str] = None) -> Client:
    """Retorna una instancia del cliente de Supabase inyectando el token JWT del usuario

    para que la base de datos Postgres evalúe auth.uid() en las políticas RLS.
    """
    if not token or not isinstance(token, str) or token.count(".") != 2:
        return get_supabase()
    try:
        options = ClientOptions(headers={"Authorization": f"Bearer {token}"})
        return create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
    except Exception:
        return get_supabase()


