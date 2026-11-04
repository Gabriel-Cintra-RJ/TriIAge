# 7. Passo a passo para rodar e testar

Os comandos são para Windows. Quando muda entre cmd e PowerShell, deixei os dois (no PowerShell o prompt
começa com `PS`).

## 1. Pré-requisitos

Instale e abra o Docker Desktop e espere aparecer *Engine running*. Para conferir:

```
docker --version
docker compose version
```

Para rodar os testes fora do Docker, instale também o [uv](https://docs.astral.sh/uv/).

## 2. Configurar o `.env`

```
copy .env.example .env
```

Preencha `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (você escolhe) e `TYPESAFE_API_KEY` (a chave do
JEV). O resto pode ficar como está. O `.env` está no `.gitignore` e não deve ir para o Git.

## 3. Subir

```
docker compose up --build
```

Nos logs do banco devem aparecer duas cargas, `COPY 90` (medications) e `COPY 81` (symptom_urgency), e depois
`Uvicorn running on http://0.0.0.0:8000`. Deixe esse terminal aberto e abra outro.

## 4. Conferir o banco

Troque `SEU_USER` e `SEU_DB` pelos valores do `.env`:

```
docker exec -it triage_db psql -U SEU_USER -d SEU_DB -c "SELECT urgency_level, count(*) FROM symptom_urgency GROUP BY 1;"
docker exec -it triage_db psql -U SEU_USER -d SEU_DB -c "SELECT count(*) FROM medications;"
```

## 5. Testar sem o JEV

No navegador, http://localhost:8000/health deve mostrar `{"status":"ok"}` e http://localhost:8000/medications
lista os remédios da base. Pelo terminal: `curl http://localhost:8000/health` no cmd ou
`Invoke-RestMethod http://localhost:8000/health` no PowerShell.

## 6. Testar com o JEV

O jeito mais fácil é pela tela `/docs` (capítulo 6). Pelo terminal, salve o corpo num arquivo em UTF-8, por
exemplo `encounter_test.json`:

```json
{
  "patient_id": 6,
  "description": "Dor no peito há 30 minutos, com falta de ar e suor frio",
  "pain_score": 8
}
```

e envie:

- cmd: `curl -X POST http://localhost:8000/encounters -H "Content-Type: application/json" --data-binary @encounter_test.json`
- PowerShell: `Invoke-RestMethod -Method Post -Uri http://localhost:8000/encounters -ContentType "application/json; charset=utf-8" -InFile encounter_test.json`

A resposta é o atendimento aberto, mais ou menos neste formato (os números variam):

```json
{
  "id": 2,
  "status": "waiting_nurse",
  "patient_name": "Maria Aparecida Souza",
  "urgency_level": "emergency",
  "priority": 1,
  "needs_human_review": false,
  "classifications": [
    {
      "stage": "patient",
      "matched": true,
      "urgency_level": "emergency",
      "guidance": "Ligue agora para o SAMU 192. ...",
      "care_timeframe": "Imediato – acionar o SAMU 192",
      "warning_signs": ["dor no peito em aperto", "falta de ar súbita", "..."],
      "escalated": false,
      "confidence": 0.86,
      "matched_record": { "id": "SYM-00xx", "main_symptom": "Dor no peito", "source": "...", "source_url": "..." },
      "model": "jev-..."
    }
  ],
  "nursing": null,
  "prescription": null,
  "disclaimer": "Informação de apoio ..."
}
```

Os próximos passos são `POST /encounters/{id}/nursing` e `POST /encounters/{id}/prescription` (exemplos no
capítulo 6).

Para os medicamentos, o mesmo esquema com `POST /medications/lookup` e o corpo
`{ "medications": ["Dipirona 1g", "Losartana 50mg"] }`. Cada item volta com `found`, `match_method` e os dados
da bula.

Para ver as classificações gravadas:

```
docker exec -it triage_db psql -U SEU_USER -d SEU_DB -c "SELECT encounter_id, stage, urgency_level, escalated, confidence FROM classifications;"
```

## 7. Testes automatizados

```
uv run pytest -v
```

Não precisam de Docker nem do JEV.

## 8. Desligar

`docker compose down` para tudo e mantém os dados. `docker compose down -v` apaga o banco, que é recriado a
partir dos CSVs na próxima subida.

## Problemas que já apareceram

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| `'Invoke-RestMethod' não é reconhecido` | você está no cmd | use `curl` ou troque para o PowerShell |
| `port 5432 is already allocated` | já tem um PostgreSQL instalado no Windows | troque para `"5433:5432"` no `docker-compose.yml` |
| tabelas vazias ou com colunas antigas | o volume já existia e a carga não rodou de novo | `docker compose down -v` e suba de novo |
| `$'\r': command not found` nos logs do banco | `02_seed.sh` com quebra de linha CRLF | mude para LF no VS Code e rode `down -v` |
| `curl` diz *Failed to connect* | os containers não estão de pé | `docker compose ps` e `docker compose logs api` |
| `502` "Erro no JEV" | chave inválida | confira a `TYPESAFE_API_KEY` |
| `503` "JEV indisponível" | sem internet ou demora do JEV | tente de novo e veja `docker compose logs api` |
| `matched: false` | o relato não bateu com nada da base | normal; a resposta orienta procurar um profissional |
