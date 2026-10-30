# 6. A tela /docs

Com a API rodando, abra http://localhost:8000/docs. Essa página vem pronta no FastAPI, ninguém escreveu ela.
O FastAPI lê as rotas e as classes do `src/schemas.py`, monta uma especificação no padrão OpenAPI
(http://localhost:8000/openapi.json) e o Swagger UI transforma isso numa página onde dá para testar tudo.
Existe também a versão só de leitura em http://localhost:8000/redoc.

O melhor disso é que a documentação nunca fica desatualizada: mudou um campo no schema, ele aparece na tela.

## Endpoints

| Grupo | Rota | Para que serve |
|---|---|---|
| infra | `GET /health` | confere se a API está no ar e falando com o banco |
| pré-consulta | `POST /triages` | relato de sintomas → nível de urgência e orientação |
| pós-consulta | `GET /medications` | lista os medicamentos da base |
| pós-consulta | `POST /medications/lookup` | medicamentos da receita → indicações em bula |

No fim da página fica a seção *Schemas*, com o formato de cada objeto, os campos obrigatórios e os limites.

## Testando pela tela

Clique na rota, depois em **Try it out**, cole o corpo e clique em **Execute**. Abaixo aparecem o comando curl
equivalente, o código de resposta e o JSON de resposta.

Triagem:

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

Os campos são: `age` (obrigatório), `sex` (`F`, `M` ou `other`), `pregnant` (true/false), `description`
(obrigatório, o relato livre), `symptoms` e `conditions` (listas de texto) e `vital_signs` (opcional).

Medicamentos:

```json
{ "medications": ["Dipirona 1g", "Losartana 50mg", "Amoxil"] }
```

## Códigos de resposta

| Código | Quando |
|---|---|
| `200` | consulta normal |
| `201` | triagem feita e gravada |
| `422` | JSON fora do formato (ex.: idade negativa, lista de medicamentos vazia); a resposta diz qual campo |
| `502` | o JEV recusou o pedido (ex.: chave inválida) |
| `503` | o JEV não respondeu, ou a base de sintomas está vazia |

Vale testar de propósito com `"age": -1` para ver o `422`.

## Para o frontend

O `openapi.json` pode gerar os tipos TypeScript automaticamente, por exemplo com o `openapi-typescript`. Assim
front e back sempre concordam sobre o formato dos dados.
