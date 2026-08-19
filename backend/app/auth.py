import os
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_client import get_supabase

security = HTTPBearer(auto_error=False)

def get_current_user_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    """Extrae el token JWT en formato string de la cabecera Authorization: Bearer <TOKEN>."""
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return None

def get_current_user(token: Optional[str] = Depends(get_current_user_token)) -> Dict[str, Any]:
    """Valida el token JWT recibido contra Supabase Auth y retorna los datos del usuario autenticado."""
    REQUIRE_AUTH = os.environ.get("REQUIRE_AUTH", "false").lower() == "true"

    if not token:
        if REQUIRE_AUTH:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Se requiere un token de autenticación Bearer válido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Modo dev/fallback cuando no se exige auth estricta en entorno local de pruebas
        return {"id": "00000000-0000-0000-0000-000000000000", "email": "dev@history-ar.local", "role": "authenticated"}

    supabase = get_supabase()
    try:
        res = supabase.auth.get_user(token)
        if res and res.user:
            return {
                "id": str(res.user.id),
                "email": res.user.email,
                "role": getattr(res.user, "role", "authenticated"),
                "user_metadata": getattr(res.user, "user_metadata", {})
            }
    except Exception as e:
        if REQUIRE_AUTH:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token JWT inválido o expirado: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return {"id": "00000000-0000-0000-0000-000000000000", "email": "dev@history-ar.local", "role": "authenticated"}
