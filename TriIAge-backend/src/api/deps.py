from fastapi import Request
from typesafe_sdk import TypeSafeClient


def get_jev(request: Request) -> TypeSafeClient:
    """Devolve o cliente do JEV que foi aberto no lifespan do main.py (é um só para a API toda)."""
    return request.app.state.jev
