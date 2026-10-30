# TriIAge — web

Front-end e BFF do TriIAge, em Next.js 16. O navegador fala só com este app; as rotas `/api` repassam as chamadas ao microsserviço de triagem (FastAPI), que é o único a acessar o banco e o modelo JEV.

## Rodando localmente

```bash
cp .env.example .env.local   # preencha NEXTAUTH_SECRET e AUTH_DEMO_PASSWORD
npm install
npm run dev                  # http://localhost:3000
```

Para desenvolver sem o microsserviço, use `TRIAGE_API_MOCK=true`. Com ele, as respostas são simuladas e uma faixa amarela avisa disso na tela. A troca vale por requisição: o mesmo build serve os dois modos.

### Contas de demonstração

Todas usam a senha definida em `AUTH_DEMO_PASSWORD`:

| E-mail | Perfil | Acessa |
|---|---|---|
| recepcao@triiage.local | Recepção | Nova triagem, fila |
| enfermagem@triiage.local | Enfermagem | Nova triagem, fila |
| medico@triiage.local | Médico(a) | Orientações de alta |
| auditoria@triiage.local | Auditoria | Logs de auditoria |
| gestao@triiage.local | Gestão clínica | Governança do modelo |

Essas contas são provisórias e existem até a API ter uma tabela de usuários (RNF11). Para trocar por usuários reais, altere apenas `src/lib/demo-users.ts`.

## Docker

```bash
docker build -t triiage-web .
docker run -p 3000:3000 --env-file .env.local \
  -e TRIAGE_API_URL=http://host.docker.internal:8000 triiage-web
```

## Estrutura

| Caminho | Papel |
|---|---|
| `src/lib/triage-types.ts` | Contrato da API de triagem. Ajuste aqui quando os esquemas Pydantic mudarem. |
| `src/lib/triage-api.ts` | Cliente da FastAPI, só no servidor. Traduz 422, 502 e 503 em mensagens. |
| `src/lib/triage-api.mock.ts` | Respostas simuladas. |
| `src/lib/roles.ts` | Perfis e áreas que cada um acessa. É usado pelo proxy e pela navegação. |
| `src/proxy.ts` | Bloqueia páginas sem sessão ou fora do perfil. |
| `src/app/api/triages` | BFF do `POST /triages` (pré-consulta). Valida a sessão e o perfil antes de repassar. |
| `src/app/api/medications/lookup` | BFF do `POST /medications/lookup` (pós-consulta), só para o perfil médico. |
| `src/app/(app)/triagem/nova` | Formulário de triagem (relato, sintomas, gestação, doenças, sinais vitais) e o resultado do modelo. |
| `src/app/(app)/alta` | Consulta dos medicamentos da receita: o que a bula diz de cada um. |
| `src/app/(app)/{fila,auditoria,governanca}` | Áreas planejadas, que dependem de novos endpoints na API. |

## Observações

- A sessão expira após 15 minutos sem atividade (RNF11).
- `cacheComponents` está ativo. Toda leitura de sessão ou da API fica dentro de `<Suspense>`, e as chamadas à API passam por `connection()`, para que nada seja pré-renderizado no build.
- As faixas de alerta dos sinais vitais (`src/lib/vital-signs.ts`) são provisórias e ficam no front até a API expor `FaixaReferencia`.
