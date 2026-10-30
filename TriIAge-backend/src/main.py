from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typesafe_sdk import TypeSafeAPIConnectionError, TypeSafeClient, TypeSafeError

from src.api.routes import router
from src.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # abrimos o cliente do JEV uma vez só, assim ele reaproveita as conexões em vez de abrir uma por request
    with TypeSafeClient(api_key=settings.typesafe_api_key.get_secret_value(), model=settings.jev_model) as jev:
        app.state.jev = jev
        yield


app = FastAPI(title="TriIAge - motor de triagem", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(TypeSafeAPIConnectionError)
def jev_unavailable(_: Request, exc: TypeSafeAPIConnectionError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": f"JEV indisponível: {exc}"})


@app.exception_handler(TypeSafeError)
def jev_error(_: Request, exc: TypeSafeError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_502_BAD_GATEWAY, content={"detail": f"Erro no JEV: {exc}"})


app.include_router(router)
