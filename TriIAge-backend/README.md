# TriIAge backend

Microsserviço do TriIAge que usa o JEV (TypeSafe AI, SDK `typesafe-sdk`) sobre duas bases de
conhecimento em PostgreSQL:

- **Pré-consulta:** recebe o relato de sintomas e devolve o nível de urgência e onde/quando procurar atendimento.
- **Pós-consulta:** recebe os medicamentos da receita e devolve as indicações previstas em bula de cada um.

A explicação completa, passo a passo, está na pasta [docs/](docs/README.md).

## Estrutura

```
database/
  init/01_schema.sql   # tabelas (fonte da verdade do schema)
  init/02_seed.sh      # carrega database/csv/*.csv nas tabelas
  csv/                 # bases do JEV: symptom_urgency.csv e medications.csv (ver docs/04-database.md)
src/
  main.py              # app FastAPI, CORS, cliente JEV, tratamento de erros do JEV
  core/config.py       # configurações lidas do .env
  db/                  # engine/sessão e modelos SQLAlchemy
  schemas.py           # contratos de entrada/saída (Pydantic)
  services/triage.py   # sintomas -> urgência (busca na base + escolha pelo JEV)
  services/medications.py # medicamentos -> indicações em bula
  api/routes.py        # endpoints
tests/
```

## Rodando com Docker

```bash
cp .env.example .env   # preencha a senha e o TYPESAFE_API_KEY
docker compose up --build
```

- API: http://localhost:8000 (documentação em http://localhost:8000/docs)
- Postgres: localhost:5432

O banco é criado e populado com os CSVs **apenas na primeira vez** (volume vazio). Depois de
alterar um CSV ou o schema, recrie o volume:

```bash
docker compose down -v && docker compose up
```

## Rodando a API fora do Docker

```bash
docker compose up db
uv sync
uv run uvicorn src.main:app --reload
uv run pytest
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Verifica a conexão com o banco |
| POST | `/triages` | Sintomas → nível de urgência e orientação (grava o histórico) |
| GET | `/medications` | Lista os medicamentos da base |
| POST | `/medications/lookup` | Medicamentos da receita → indicações em bula |

### `POST /triages`

```json
{
  "age": 58,
  "sex": "M",
  "description": "Dor no peito há 30 minutos, com falta de ar e suor frio",
  "symptoms": ["falta de ar"],
  "conditions": ["hipertensão"],
  "vital_signs": { "heart_rate": 125 }
}
```

Como funciona: a API busca na base as queixas parecidas com o relato e envia todas as faixas de gravidade
dessas queixas ao JEV, que escolhe a que corresponde (ou `none`). Se uma faixa mais grave também for
plausível (probabilidade ≥ 20%), ela prevalece (`escalated: true`). Confiança abaixo de `MIN_CONFIDENCE`
marca `needs_human_review: true`. Sem correspondência, `matched: false` e a orientação diz que não há
informação suficiente.

Resposta (resumida): `urgency_level` (`emergency`, `very_urgent`, `urgent`, `less_urgent`,
`guided_self_care`), `priority` (1–5), `guidance`, `care_timeframe`, `warning_signs`, `matched_record`
(com a fonte) e `disclaimer`.

### `POST /medications/lookup`

```json
{ "medications": ["Dipirona 1g", "Losartana 50mg", "Amoxil"] }
```

Para cada nome: busca por princípio ativo, nome ou marca; se não achar, o JEV tenta identificar (grafia
aproximada, outra marca). Cada resultado traz `found`, `match_method` (`name`, `jev` ou `none`), a lista
`medications` (indicações, condições relacionadas, mecanismo, contraindicações, advertências, faixa etária,
fonte da bula) e `message`. Sem correspondência confiável, `found: false`.
