import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qvutqqfsypzcfjhhzqsk.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_KT61xj__yMLdxD37Wc5Teg_RFfQz6Rm")

_supabase_instance: Client = None

def get_supabase() -> Client:
    global _supabase_instance
    if _supabase_instance is None:
        _supabase_instance = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_instance
