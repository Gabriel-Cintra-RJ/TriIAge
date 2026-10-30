# 5. Integração com o JEV

O JEV é um modelo da TypeSafe AI. Diferente de um chatbot, ele não escreve texto livre: a gente manda os
dados (o `state`) e perguntas com formato fixo, e ele devolve a resposta já estruturada, com probabilidades.
Para saúde isso ajuda muito, porque a resposta já vem como dado e só pode ser uma das opções que demos.

A SDK oficial é instalada com `uv add typesafe-sdk` e importada como `typesafe_sdk`. Ela é só um cliente
HTTP: o modelo roda nos servidores da TypeSafe e cada chamada é autenticada pela `TYPESAFE_API_KEY` do
`.env`. O modelo padrão é o `jev-latest` (dá para trocar pela variável `JEV_MODEL`).

## Tipos de pergunta

| Tipo | Pergunta | O que volta |
|---|---|---|
| `Noul` | sim ou não? | probabilidade de "sim" |
| `Choice` | qual destas opções? | opção escolhida, confiança e probabilidade de cada uma |
| `Score` | que nota numa escala? | nota esperada e probabilidade de cada nível |
| `Box` | onde está X na imagem? | coordenadas |

Nos dois módulos usamos `Choice`, sempre com uma opção extra `none` ("nenhuma corresponde"). Assim o modelo
tem como dizer que não sabe, em vez de forçar uma resposta.

## Pré-consulta (`src/services/triage.py`)

Mandar as 73 situações de uma vez para o JEV ficaria confuso, então antes a API faz uma busca simples. Ela
normaliza o texto (minúsculas, sem acento) e compara os radicais das palavras do relato com os da base. As
três queixas que mais batem entram, cada uma com todas as suas faixas de gravidade:

```python
candidates = retrieve_candidates(payload, records)   # ex.: as faixas de "Dor no peito" e "Falta de ar"
response = jev.system_one(
    state=build_state(payload),                       # idade, relato, sintomas, sinais vitais...
    questions={"situation": Choice(instructions=INSTRUCTIONS, criteria=criteria)},
)
```

`criteria` é um dicionário `id -> descrição da situação com os sinais de alerta`, mais o `none`. As
instruções pedem para, na dúvida entre duas situações, escolher a mais grave.

Com a resposta, aplicamos duas regras de segurança:

- **Escalonamento:** se alguma situação mais grave teve probabilidade de 20% ou mais, ela prevalece sobre a
  escolhida, e a resposta vem com `escalated: true`.
- **Revisão humana:** se a confiança ficou abaixo de `MIN_CONFIDENCE` (0,7 por padrão), a resposta vem com
  `needs_human_review: true`.

Se a busca não achar nada parecido, ou o JEV escolher `none`, a resposta vem com `matched: false` e a
orientação de procurar um profissional. Nesse caso nem chamamos o JEV quando a busca vem vazia.

## Pós-consulta (`src/services/medications.py`)

Aqui o JEV só entra quando a busca por nome não resolve. Primeiro a API procura o princípio ativo, o nome ou
a marca dentro do texto digitado, ignorando o sal e a concentração: "Sertralina 50mg" acha o "cloridrato de
sertralina". Quando vários casam, fica o mais específico, para "amoxicilina + clavulanato" não trazer também
a amoxicilina sozinha.

Se não achar nada (erro de digitação, marca que não está na base), perguntamos ao JEV qual medicamento da
lista corresponde ao nome informado. Só aceitamos a resposta se a confiança passar de `MIN_CONFIDENCE`; senão
o resultado é `found: false`. O `match_method` diz como achamos: `name`, `jev` ou `none`.

## Erros e outros cuidados

- O `TypeSafeClient` é criado uma vez quando a API sobe (`lifespan` em `src/main.py`) e reaproveitado.
- JEV fora do ar ou demorando demais vira erro `503`; chave inválida ou pedido recusado vira `502`. A própria
  SDK já tenta de novo quando a falha é passageira.
- Sem `TYPESAFE_API_KEY` no `.env`, a API nem sobe.
- A chave fica só no backend.

## Testes sem gastar chamadas

Em `tests/conftest.py` tem uma classe `FakeJev` que imita o cliente e escolhe a opção que o teste mandar. Os
testes usam os CSVs reais, então conferem a busca, o escalonamento e os casos sem correspondência sem
internet e sem custo:

```
uv run pytest -v
```
