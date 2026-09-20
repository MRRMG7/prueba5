from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = "tu_clave_secreta_super_segura_para_desarrollo_local"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token", auto_error=False)

def verify_password(plain_password: str, stored_password: str) -> bool:
    """Compara directamente la contraseña en texto plano sin encriptación/hashing."""
    return plain_password.strip() == stored_password.strip()

def get_password_hash(password: str) -> str:
    """Retorna la contraseña directamente en texto plano."""
    return password

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
