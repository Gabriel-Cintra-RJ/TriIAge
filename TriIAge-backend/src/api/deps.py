from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session
from typesafe_sdk import TypeSafeClient

from src.core.config import Settings, get_settings
from src.db.session import get_db


def get_jev(request: Request) -> TypeSafeClient:
    """Devolve o cliente do JEV que foi aberto no lifespan do main.py (é um só para a API toda)."""
    return request.app.state.jev


Db = Annotated[Session, Depends(get_db)]
Jev = Annotated[TypeSafeClient, Depends(get_jev)]
Config = Annotated[Settings, Depends(get_settings)]
