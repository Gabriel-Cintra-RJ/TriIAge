# TriIAge — web

Front-end e BFF do TriIAge, em Next.js 16. O navegador fala só com este app; as rotas `/api` repassam as chamadas ao microsserviço de triagem (FastAPI), que é o único a acessar o banco e o modelo JEV.

## Rodando localmente

O front precisa da API e do banco no ar (os usuários ficam na tabela `users`). O jeito mais fácil é subir tudo pelo `docker compose up --build` da pasta `TCC`. Para mexer só no front com hot reload:

```bash
cp .env.example .env.local   # preencha NEXTAUTH_SECRET e AUTH_DEMO_PASSWORD
npm install
npm run dev                  # http://localhost:3000
```

### Contas de demonstração

Os usuários são criados pelo `03_demo_data.sql` do backend. Todos usam a senha definida em `AUTH_DEMO_PASSWORD`:

| E-mail | Perfil | Acessa |
|---|---|---|
| paciente@triiage.local | Paciente (Maria Aparecida Souza) | Nova avaliação, meus atendimentos (com receitas), meu histórico |
| enfermagem@triiage.local | Enfermagem | Fila de triagem e triagem com sinais vitais |
| recepcao@triiage.local | Recepção | Fila de triagem (só consulta) |
| medico@triiage.local | Médico(a) | Consultas: diagnóstico e receita |
| auditoria@triiage.local | Auditoria | Logs de auditoria (planejado) |
| gestao@triiage.local | Gestão clínica | Governança do modelo (planejado) |

## O fluxo

1. **Paciente** (`/avaliacao`): conta o que está sentindo, marca sintomas, desde quando e a dor. Recebe o nível de urgência, onde procurar atendimento e os sinais de alerta.
2. **Enfermagem** (`/fila` → `/fila/[id]`): vê os pacientes que já fizeram a avaliação, ordenados por gravidade, com o relato e o histórico. Completa com os sinais vitais; o JEV classifica de novo e o atendimento vai para o médico. Pode mudar o nível, com justificativa. Enquanto o paciente espera o médico, o atalho **Nova triagem** (na fila ou no atendimento, `?nova=1`) refaz a triagem; as anteriores ficam no histórico do atendimento.
3. **Médico** (`/consultas` → `/consultas/[id]`): vê tudo (relato, triagem, classificações, histórico) e registra diagnóstico, receita e recomendações.
4. **Paciente** (`/atendimentos/[id]`): acompanha as etapas e, no fim, vê a receita com o que a bula diz de cada remédio. Em `/historico` ficam sinais vitais, remédios (com intervalo e período), doenças, alergias, cirurgias e atendimentos.

## Interface

- **Tela inicial por perfil** (`src/app/(app)/_painel`): cards com os números do dia (vindos do `GET /dashboard` da API) e uma grade de ações rápidas. Paciente, enfermagem/recepção, médico e auditoria/gestão têm painéis diferentes.
- **Temas**: claro (padrão, branco/cinza/verde) e escuro, trocados pelo botão no cabeçalho. A escolha fica no `localStorage` (`tema`) e um script no `<head>` aplica antes da página aparecer. As cores estão em `src/app/globals.css`.
- **Celular**: abaixo de 768 px o menu vira hambúrguer; filas e tabelas de sinais vitais viram cartões, e as abas do histórico viram um select.

## Docker

```bash
docker build -t triiage-web .
docker run -p 3000:3000 --env-file .env.local \
  -e TRIAGE_API_URL=http://host.docker.internal:8000 triiage-web
```

## Estrutura

| Caminho | Papel |
|---|---|
| `src/lib/api-types.ts` | Contrato da API. Ajuste aqui quando os esquemas Pydantic mudarem. |
| `src/lib/api.ts` | Cliente da FastAPI, só no servidor. Traduz os erros da API em mensagens. |
| `src/lib/bff.ts` | Confere sessão e perfil nas rotas `/api` e repassa os erros. |
| `src/lib/demo-users.ts` | Login de demonstração: senha única e usuário buscado na API. |
| `src/lib/roles.ts` | Perfis e áreas que cada um acessa. É usado pelo proxy e pela navegação. |
| `src/proxy.ts` | Bloqueia páginas sem sessão ou fora do perfil. |
| `src/app/api/encounters` | BFF do atendimento: criar (paciente), `[id]/nursing` (enfermagem), `[id]/prescription` (médico). |
| `src/app/api/me` | BFF do histórico do paciente logado (remédios, doenças/alergias/cirurgias, sinais vitais). |
| `src/app/(app)/{avaliacao,atendimentos,historico}` | Telas do paciente. |
| `src/app/(app)/fila` | Fila, triagem e retriagem da enfermagem. |
| `src/app/(app)/_painel` | Telas iniciais de cada perfil. |
| `src/app/(app)/consultas` | Fila e consulta do médico. |
| `src/app/(app)/{auditoria,governanca}` | Áreas planejadas, que dependem de novos endpoints na API. |

## Observações

- A sessão expira após 15 minutos sem atividade (RNF11).
- `cacheComponents` está ativo. Toda leitura de sessão ou da API fica dentro de `<Suspense>`, e as chamadas à API passam por `connection()`, para que nada seja pré-renderizado no build.
- O id do usuário que vai para a API sempre sai da sessão, nunca do corpo da requisição. O paciente só consegue abrir os próprios atendimentos.
- As faixas de alerta dos sinais vitais (`src/lib/vital-signs.ts`) são provisórias e ficam no front até a API expor `FaixaReferencia`.
