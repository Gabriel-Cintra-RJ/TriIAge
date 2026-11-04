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
| GET | `/users/by-email?email=` | Usuário e perfil (usado pelo login do front) |
| GET | `/patients/{id}/history` | Histórico do paciente: cadastro, doenças/alergias/cirurgias, remédios, sinais vitais e atendimentos |
| POST/DELETE | `/patients/{id}/health-records`, `/medications`, `/vital-signs` | Paciente completa o próprio histórico |
| POST | `/encounters` | Paciente manda os sintomas → pré-análise do JEV (abre o atendimento) |
| GET | `/encounters?status=&patient_id=` | Filas da enfermagem/médico e lista do paciente |
| GET | `/encounters/{id}` | Atendimento completo: relato, classificações, triagem e receita |
| POST | `/encounters/{id}/nursing` | Enfermagem manda os sinais vitais → JEV classifica de novo (pode repetir: retriagem) |
| GET | `/dashboard?user_id=` | Números das telas iniciais (filas, graves esperando, triagens do dia, estatísticas do JEV) |
| POST | `/encounters/{id}/prescription` | Médico manda diagnóstico e receita → atendimento finalizado |
| GET | `/medications` | Lista os medicamentos da base |
| POST | `/medications/lookup` | Nomes de remédios → indicações em bula |

### O atendimento

1. **Paciente** (`POST /encounters`): manda o relato, os sintomas, desde quando e a dor (0 a 10). A API junta
   com o histórico dele (idade, sexo, doenças, alergias, remédios em uso) e classifica pelo **motor híbrido**:
   o JEV escolhe entre as faixas das queixas parecidas (se uma faixa mais grave também for plausível, com
   probabilidade ≥ 20%, ela prevalece) e a **árvore de decisão** também classifica; se divergirem, fica o mais
   urgente (`divergent: true`). Confiança abaixo de `MIN_CONFIDENCE` marca `needs_human_review: true`. Se o
   JEV falhar ou passar de `JEV_TIMEOUT`, vale só a árvore (`origin: "rules"`). Status: `waiting_nurse`.
   Detalhes em [docs/05-jev.md](docs/05-jev.md).
2. **Enfermagem** (`POST /encounters/{id}/nursing`): manda os sinais vitais (pressão, FC, FR, temperatura,
   SpO₂, glicemia), a dor avaliada e observações. O JEV classifica de novo com esses dados. A enfermagem pode
   escolher outro nível, mas aí a justificativa (mínimo 10 caracteres) é obrigatória. Status: `waiting_doctor`.
   Enquanto o médico não atendeu, a enfermagem pode refazer a triagem (por exemplo, se o paciente piorou na
   espera). Cada triagem é uma linha nova na tabela `triages`; as anteriores não são alteradas e o nível do
   atendimento passa a ser o da última.
3. **Médico** (`POST /encounters/{id}/prescription`): manda o diagnóstico, observações clínicas,
   recomendações e os remédios da receita (nome como ele escreveu, dose, intervalo, duração). Cada remédio é
   procurado na base de bulas (pelo nome ou pelo JEV). O diagnóstico e os remédios entram no histórico do
   paciente. Status: `completed`.

Cada classificação fica salva em `classifications` (a pré-análise e uma por triagem), então dá para comparar
a pré-análise com as da enfermagem.

### Dados de exemplo

O `database/init/03_demo_data.sql` cria a equipe e a paciente Maria Aparecida Souza (`paciente@triiage.local`),
com hipertensão, alergia a dipirona, medições de pressão feitas em casa e um atendimento de setembro já
finalizado, com receita e com uma retriagem (a febre subiu enquanto ela esperava). A senha das contas é o `AUTH_DEMO_PASSWORD` do front.

### `POST /medications/lookup`

```json
{ "medications": ["Dipirona 1g", "Losartana 50mg", "Amoxil"] }
```

Para cada nome: busca por princípio ativo, nome ou marca; se não achar, o JEV tenta identificar (grafia
aproximada, outra marca). Cada resultado traz `found`, `match_method` (`name`, `jev` ou `none`), a lista
`medications` (indicações, condições relacionadas, mecanismo, contraindicações, advertências, faixa etária,
fonte da bula) e `message`. Sem correspondência confiável, `found: false`.
