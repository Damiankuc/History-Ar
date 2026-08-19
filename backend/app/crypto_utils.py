import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

def _get_fernet_key() -> bytes:
    """Obtiene o deriva una clave Fernet AES-256 válida a partir de la variable de entorno PHI_ENCRYPTION_KEY."""
    raw_key = os.environ.get("PHI_ENCRYPTION_KEY", "HistoryAr_Secret_PHI_Encryption_Key_2026_ArgentineMedicalLaw")
    # Derivar una clave de 32 bytes URL-safe base64 usando PBKDF2
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"HistoryAr_PHI_Salt_26529",
        iterations=100000,
    )
    return base64.urlsafe_b64encode(kdf.derive(raw_key.encode("utf-8")))

_fernet_instance = Fernet(_get_fernet_key())

def encrypt_field(plain_text: Optional[str]) -> Optional[str]:
    """Cifra una cadena de texto plano retornando un token cifrado Fernet (prefix 'ENC:')."""
    if not plain_text or not isinstance(plain_text, str) or not plain_text.strip():
        return plain_text
    
    # Si ya está cifrado, evitar re-cifrar
    if plain_text.startswith("ENC:"):
        return plain_text

    try:
        cipher_bytes = _fernet_instance.encrypt(plain_text.encode("utf-8"))
        return f"ENC:{cipher_bytes.decode('utf-8')}"
    except Exception:
        return plain_text

def decrypt_field(cipher_text: Optional[str]) -> Optional[str]:
    """Descifra un token Fernet (prefix 'ENC:') retornando la cadena de texto plano original."""
    if not cipher_text or not isinstance(cipher_text, str) or not cipher_text.startswith("ENC:"):
        return cipher_text

    try:
        raw_token = cipher_text[4:]
        plain_bytes = _fernet_instance.decrypt(raw_token.encode("utf-8"))
        return plain_bytes.decode("utf-8")
    except Exception:
        # Fallback seguro si falla la clave o es texto plano sin prefijo
        return cipher_text
