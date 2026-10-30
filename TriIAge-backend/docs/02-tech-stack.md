# 2. Tecnologias

As dependências estão no `pyproject.toml` e as versões exatas ficam travadas no `uv.lock`. Assim todo
mundo do grupo instala a mesma coisa.

## Linguagem e gerenciador

- **Python 3.14**, versão fixada no `.python-version`.
- **uv** no lugar do `pip`. É bem mais rápido e já cuida do ambiente virtual. Os dois comandos que mais uso:
  `uv add <lib>` para instalar e `uv run <comando>` para rodar algo dentro do ambiente do projeto.

## Bibliotecas da aplicação

**FastAPI** é o framework da API. Uma função com `@router.post("/triages")` vira um endpoint. Escolhemos
porque ele valida a entrada pelos tipos do Python e gera sozinho a tela `/docs` (capítulo 6).

**Uvicorn** é o servidor que escuta a porta 8000 e entrega as requisições para o FastAPI. Por isso o
comando de execução é `uvicorn src.main:app`.

**Pydantic** define o formato dos dados. Em `src/schemas.py`, por exemplo:

```python
class TriageRequest(BaseModel):
    age: int = Field(ge=0, le=130)
    description: str = Field(min_length=3, max_length=2000)
    symptoms: list[str] = Field(default_factory=list)
```

Se o front mandar `"age": -5`, a requisição é recusada antes de chegar no nosso código. Pensando como
engenharia de dados, é validação de schema na entrada do pipeline.

**pydantic-settings** lê o `.env` e transforma em uma classe tipada (`src/core/config.py`). Se faltar uma
variável obrigatória, como a `TYPESAFE_API_KEY`, a API já falha na inicialização com uma mensagem clara.

**SQLAlchemy 2** é o ORM: as tabelas viram classes (`SymptomUrgency`, `Medication`, `Triage`) e as consultas
são escritas em Python, por exemplo `db.scalars(select(Medication)).all()`.

**psycopg2** é o driver que o SQLAlchemy usa para falar com o PostgreSQL. É por isso que a URL de conexão
começa com `postgresql+psycopg2://`.

**typesafe-sdk** é a SDK oficial do JEV. Ela cuida da autenticação, de tentar de novo quando a rede falha e
de converter a resposta em objetos Python. Detalhes no capítulo 5.

## Só para desenvolvimento

- **pytest** para os testes (`uv run pytest`).
- **httpx**, que o `TestClient` do FastAPI usa por baixo.

## Infraestrutura

- **PostgreSQL 17**: banco relacional, gratuito, com o tipo `JSONB` que usamos para guardar a entrada de
  cada triagem.
- **Docker e Docker Compose**: sobem a API e o banco juntos (capítulo 3).
