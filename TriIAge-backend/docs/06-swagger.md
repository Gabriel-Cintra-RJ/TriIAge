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
| usuários | `GET /users/by-email` | usado pelo login do front para saber quem é a pessoa e o perfil |
| paciente | `GET /patients/{id}/history` | cadastro, doenças/alergias/cirurgias, remédios, sinais vitais e atendimentos |
| paciente | `POST /patients/{id}/health-records`, `/medications`, `/vital-signs` | o paciente completa o histórico |
| paciente | `DELETE /patients/{id}/health-records/{rid}`, `/medications/{mid}` | remove o que ele mesmo cadastrou |
| atendimento | `POST /encounters` | paciente manda os sintomas → pré-análise (nível de urgência e orientação) |
| atendimento | `GET /encounters?status=...&patient_id=...` | filas da enfermagem e do médico, e a lista do paciente |
| atendimento | `GET /encounters/{id}` | tudo do atendimento: relato, classificações, triagem e receita |
| atendimento | `POST /encounters/{id}/nursing` | enfermagem manda os sinais vitais → JEV classifica de novo; pode repetir enquanto o médico não atendeu (retriagem) |
| painel | `GET /dashboard?user_id=` | números das telas iniciais de cada perfil |
| atendimento | `POST /encounters/{id}/prescription` | médico manda diagnóstico e receita → atendimento finalizado |
| pós-consulta | `GET /medications` | lista os medicamentos da base |
| pós-consulta | `POST /medications/lookup` | medicamentos da receita → indicações em bula |

No fim da página fica a seção *Schemas*, com o formato de cada objeto, os campos obrigatórios e os limites.

## Testando pela tela

Clique na rota, depois em **Try it out**, cole o corpo e clique em **Execute**. Abaixo aparecem o comando curl
equivalente, o código de resposta e o JSON de resposta.

Pré-análise do paciente (`POST /encounters`), usando a paciente de exemplo (veja o id dela em
`GET /users/by-email?email=paciente@triiage.local`):

```json
{
  "patient_id": 6,
  "description": "Dor no peito há 30 minutos, com falta de ar e suor frio",
  "symptoms": ["falta de ar"],
  "onset": "Começou hoje",
  "pain_score": 8
}
```

A idade, o sexo, as doenças, as alergias e os remédios a API pega do histórico do paciente, então não precisa
mandar. Depois a enfermagem completa com `POST /encounters/{id}/nursing`:

```json
{ "nurse_id": 4, "vital_signs": { "systolic_bp": 150, "diastolic_bp": 95, "heart_rate": 125 }, "pain_score": 8 }
```

E o médico fecha com `POST /encounters/{id}/prescription`:

```json
{
  "doctor_id": 5,
  "diagnosis": "Síndrome coronariana aguda (em investigação)",
  "items": [{ "name": "AAS 100 mg", "dosage": "1 comprimido", "frequency": "1 vez ao dia", "duration": "uso contínuo" }]
}
```

Medicamentos:

```json
{ "medications": ["Dipirona 1g", "Losartana 50mg", "Amoxil"] }
```

## Códigos de resposta

| Código | Quando |
|---|---|
| `200` | consulta normal |
| `201` | atendimento ou registro criado |
| `403` | usuário sem o perfil certo para a etapa (ex.: médico tentando fazer a triagem) |
| `404` | paciente, atendimento ou registro não existe |
| `409` | etapa fora de ordem (ex.: receita antes da triagem, triagem depois da consulta) ou tentativa de apagar algo que veio do médico |
| `422` | JSON fora do formato (ex.: dor maior que 10, mudar o nível sem justificativa); a resposta diz qual campo |
| `502` | o JEV recusou o pedido (ex.: chave inválida) |
| `503` | o JEV não respondeu, ou a base de sintomas está vazia |

Vale testar de propósito com `"pain_score": 11` para ver o `422`.

## Para o frontend

O `openapi.json` pode gerar os tipos TypeScript automaticamente, por exemplo com o `openapi-typescript`. Assim
front e back sempre concordam sobre o formato dos dados.
