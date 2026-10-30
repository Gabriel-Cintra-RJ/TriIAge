from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    """Configurações da API. No Docker vêm das variáveis de ambiente; rodando local, do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str
    postgres_password: SecretStr
    postgres_db: str
    postgres_host: str = "localhost" 
    postgres_port: int = 5432

    typesafe_api_key: SecretStr
    jev_model: str = "jev-latest"
    # se o JEV responder com confiança menor que isso, marcamos para um profissional revisar
    min_confidence: float = 0.7

    # endereços do front que podem chamar a API. No .env tem que ser em JSON: CORS_ORIGINS=["http://localhost:3000"]
    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def database_url(self) -> URL:
        return URL.create(
            "postgresql+psycopg2",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
