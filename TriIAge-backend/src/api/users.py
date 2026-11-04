from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from src.api.deps import Db
from src.db.models import User
from src.schemas import UserOut

router = APIRouter(prefix="/users", tags=["usuários"])


@router.get("/by-email", response_model=UserOut)
def user_by_email(email: str, db: Db):
    """Usado pelo login do front: a senha é conferida lá, aqui só devolvemos quem é a pessoa e o perfil dela."""
    user = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role)
