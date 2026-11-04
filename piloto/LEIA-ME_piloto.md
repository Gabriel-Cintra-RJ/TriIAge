# Kit do piloto de avaliação do TriIAge

Serve para gerar os números que o artigo precisa (pontos 3 e 4 do professor). **O kit não gera dados:** ele só mede o que o grupo fornecer. Nenhum resultado do artigo foi inventado.

## As configurações comparadas

| Coluna | Configuração | O que roda |
|---|---|---|
| `A_arvore` | A – árvore de decisão | Só regras: acha a queixa por palavras e desce pelas faixas de gravidade (mais grave → mais leve) procurando discriminadores no relato. Não chama o JEV. É a mesma árvore da contingência da API. |
| `B_modelo` | B – modelo isolado | Só o JEV: escolhe entre **todas** as situações da base, sem filtro por palavras e sem a regra de escalonamento. |
| `C_hibrido` | C – motor híbrido (UC06) | O que a API usa: o JEV escolhe entre as queixas mais parecidas (com escalonamento) e a árvore também classifica; se divergirem, prevalece o mais urgente. Se o JEV falhar, vale só a árvore (origem "rules"). |
| `D_base` | D – linha de base | Calculada pelo `analisar_piloto.py`: sempre o nível mais frequente da referência. |

## O que o grupo precisa fazer

1. **Montar os casos.** Pelo menos 100 relatos clínicos simulados, em linguagem leiga, cobrindo os cinco níveis (evitar concentrar tudo no amarelo). Usar `casos_modelo.csv` como modelo. Colunas:
   - `id`, `relato`, `idade` (obrigatórias);
   - `sexo` (F ou M), `gestante` (sim/não) e `condicoes` (doenças prévias separadas por `;`, ex.: `hipertensão; diabetes`) — mudam a classificação, então preencha quando fizer sentido no caso.

   Os casos não podem ser gerados pela árvore de decisão do sistema.
2. **Rotular de forma independente.** Dois enfermeiros com experiência em triagem preenchem `avaliador1` e `avaliador2` (níveis 1 a 5: 1 vermelho, 2 laranja, 3 amarelo, 4 verde, 5 azul), sem ver o rótulo um do outro. Divergências são resolvidas por consenso e o resultado vai em `referencia`.
3. **Dividir.** 60% `desenvolvimento` (para ajustar o limiar de confiança e as regras) e 40% `teste` (usado uma única vez), estratificado por nível. Preencher a coluna `particao`.
4. **Rodar o sistema** (na pasta `TCC`, com o `TriIAge-backend/.env` preenchido; não precisa do Docker):

```
uv run --project TriIAge-backend python piloto/rodar_sistema.py piloto/casos.csv --saida piloto/casos_rodados.csv
```

   Preenche `A_arvore`, `B_modelo` e `C_hibrido` (nível 1 a 5, ou vazio quando o sistema não achou nada na base) e colunas de apoio: situação escolhida (`*_situacao`), confiança do JEV, tempo em ms (`A_ms`, `B_ms`, `C_ms`), revisão humana (`C_revisao`), origem (`C_origem`), divergência árvore × JEV (`C_divergencia`) e a versão do modelo (`modelo`). Se cair no meio, rode o mesmo comando: os casos já feitos são pulados. Opções úteis: `--subconjunto desenvolvimento`, `--configs A` (só a árvore, sem gastar chamadas do JEV), `--limite 5` (para testar).

5. **Analisar.**

```
uv run --no-project --with numpy --with pandas python piloto/analisar_piloto.py piloto/casos_rodados.csv --subconjunto teste --saida piloto/resultados.json
```

   O script imprime a tabela do artigo (cobertura, kappa ponderado quadrático com IC 95% por bootstrap, acurácia exata e ±1 nível, subtriagem nos níveis 1 e 2, sobretriagem, sensibilidade e especificidade para casos urgentes, tempo mediano e p95) e as taxas do motor híbrido (revisão humana, divergência e contingência por regras). Grava no JSON a matriz de confusão 5×5 e as métricas por nível. Se `avaliador1` e `avaliador2` estiverem preenchidos, calcula também a concordância entre os avaliadores.

   **Casos sem nível** entram na coluna "Cobertura" e, por padrão, ficam fora das demais métricas. Para a análise de sensibilidade, rode de novo com `--sem-nivel-como 3` (ou outro nível) e informe os dois resultados.

   Para os subgrupos do relatório: `--sem-nivel-como 3`, `--subconjunto teste`, `--filtro na_base=sim` e `--filtro na_base=não`, cada um com sua `--saida` (nomes em `gerar_relatorio.py`).

6. **Gerar o relatório em Word** (lê os JSON e o CSV; nenhum número é digitado à mão):

```
uv run --no-project --with python-docx python piloto/gerar_relatorio.py
```

7. **Passar para o artigo.** Colar os valores no Quadro 4 e no Resumo/Abstract, nos campos marcados em amarelo.

## Rodada de 04/11/2026 (base sintética sem enfermeiros)

- `casos.csv`: 100 casos escritos com auxílio de assistente de IA (20/22/25/20/13 nos níveis 1 a 5; 79 com queixa na base e 21 fora). A `referencia` foi atribuída na criação de cada caso, pelos critérios do CAB 28/Manchester, com justificativa na coluna `justificativa_referencia`. **Não foi validada por enfermeiros.**
- `casos_rodados.csv`, `resultados_*.json` e `TriIAge_Relatorio_Piloto.docx` são a saída dessa rodada (JEV `jev-1.14.0`).

## Cuidados

- Participação de enfermeiros como avaliadores é pesquisa com seres humanos: confirmar com o orientador e o CEP a necessidade de apreciação ética (CNS 466/2012 e 510/2016).
- Não enviar ao modelo externo nenhum dado real de paciente.
- Registrar a versão do modelo externo usada na rodada (coluna `modelo`).
- Se aparecer `C_origem = rules` na rodada, o JEV falhou naquele caso e o híbrido usou só a árvore. Para o artigo, apague as colunas `C_*` desses casos e rode de novo (ou relate como contingência).
- A base de conhecimento tem poucas situações de nível 4 e 5 (as de nível 5 são faixas complementares do projeto, pendentes de validação; a coluna `base` do CSV rodado registra a base usada); casos fora das 26 queixas da base (trauma, torção, corte...) tendem a ficar sem nível ou a casar com uma queixa errada por uma palavra só (ex.: "inchado" → reação alérgica). Isso deve aparecer na Discussão e pode ser calibrado com o conjunto de desenvolvimento.
- Com 40 casos de teste, os intervalos de confiança serão largos. Isso é esperado e deve ser dito na Discussão; não esconder.
- O script foi conferido contra o `cohen_kappa_score` do scikit-learn (pesos quadráticos) em dados de brinquedo, com valores idênticos.
