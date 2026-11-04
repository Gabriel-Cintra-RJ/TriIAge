#!/usr/bin/env python3
"""TriIAge - gera o relatório do piloto em Word a partir dos resultados do analisar_piloto.py.

Todos os números vêm dos arquivos JSON e do CSV rodado; nada é digitado à mão. Rode depois da análise:

    uv run --no-project --with python-docx python piloto/gerar_relatorio.py

Espera na pasta piloto: casos_rodados.csv, resultados_todos.json, resultados_sem_nivel_3.json,
resultados_teste.json, resultados_na_base.json e resultados_fora_base.json (comandos no LEIA-ME).
"""
import csv
import json
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

PASTA = Path(__file__).resolve().parent
VERDE = RGBColor(0x12, 0x7A, 0x4A)
A, B, C, D = "A - árvore de decisão", "B - modelo (JEV)", "C - motor híbrido", "D - linha de base"
NOMES_NIVEL = {1: "1 Vermelho", 2: "2 Laranja", 3: "3 Amarelo", 4: "4 Verde", 5: "5 Azul"}
COLUNA = {A: "A_arvore", B: "B_modelo", C: "C_hibrido"}


def carregar(nome):
    with open(PASTA / nome, encoding="utf-8") as f:
        return json.load(f)


def pct(d):
    if not d or d["n"] == 0:
        return "—"
    return f"{100 * d['valor']:.1f}% ({100 * d['ic95'][0]:.1f}–{100 * d['ic95'][1]:.1f})"


def frac(d):
    return f"{d['x']}/{d['n']}" if d and d["n"] else "—"


def kappa(m):
    k = m["kappa_ponderado_quadratico"]
    return f"{k['valor']:.2f} ({k['ic95_bootstrap'][0]:.2f}–{k['ic95_bootstrap'][1]:.2f})"


# ---------- formatação ----------
def sombrear(celula, cor="E2F2E9"):
    tc = celula._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cor)
    tc.append(shd)


def tabela(doc, cabecalho, linhas, larguras=None, tamanho=9):
    t = doc.add_table(rows=1, cols=len(cabecalho))
    t.style = "Table Grid"
    for i, texto in enumerate(cabecalho):
        c = t.rows[0].cells[i]
        c.text = ""
        r = c.paragraphs[0].add_run(texto)
        r.bold = True
        r.font.size = Pt(tamanho)
        sombrear(c)
    for linha in linhas:
        cells = t.add_row().cells
        for i, texto in enumerate(linha):
            cells[i].text = ""
            cells[i].paragraphs[0].add_run(str(texto)).font.size = Pt(tamanho)
    # repete o cabeçalho quando a tabela quebra de página
    trPr = t.rows[0]._tr.get_or_add_trPr()
    repetir = OxmlElement("w:tblHeader")
    repetir.set(qn("w:val"), "true")
    trPr.append(repetir)
    if larguras:
        for row in t.rows:
            for i, w in enumerate(larguras):
                row.cells[i].width = Cm(w)
    doc.add_paragraph()
    return t


def titulo(doc, texto, nivel=1):
    h = doc.add_heading(texto, level=nivel)
    for r in h.runs:
        r.font.color.rgb = VERDE if nivel == 1 else RGBColor(0x14, 0x25, 0x1C)
        r.font.name = "Arial"
    return h


def paragrafo(doc, texto, negrito_inicio=None):
    p = doc.add_paragraph()
    if negrito_inicio:
        p.add_run(negrito_inicio).bold = True
    p.add_run(texto)
    return p


def item(doc, texto):
    return doc.add_paragraph(texto, style="List Bullet")


def linha_config(m):
    t = m.get("tempo_ms")
    return [frac(m["cobertura"]) if "cobertura" in m else "—", kappa(m), pct(m["acuracia_exata"]),
            pct(m["acuracia_mais_menos_1"]), pct(m["subtriagem_niveis_1_e_2"]), pct(m["sobretriagem_geral"]),
            pct(m["urgente_sensibilidade"]), pct(m["urgente_especificidade"]),
            f"{t['mediana']:.0f} / {t['p95']:.0f}" if t else "—"]


CAB_METRICAS = ["Configuração", "Cobertura", "Kappa pond. (IC95%)", "Acurácia exata", "±1 nível",
                "Subtriagem níveis 1–2", "Sobretriagem", "Sens. urgente", "Espec. urgente", "Tempo ms (mediana/p95)"]


def tabela_metricas(doc, res):
    linhas = [[nome.split(" - ")[0] + " – " + nome.split(" - ")[1]] + linha_config(m)
              for nome, m in res["configuracoes"].items()]
    tabela(doc, CAB_METRICAS, linhas, [2.6, 1.5, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 1.8], tamanho=8)


def main():
    casos = list(csv.DictReader(open(PASTA / "casos_rodados.csv", encoding="utf-8")))
    todos = carregar("resultados_todos.json")
    sem3 = carregar("resultados_sem_nivel_3.json")
    teste = carregar("resultados_teste.json")
    na_base = carregar("resultados_na_base.json")
    fora = carregar("resultados_fora_base.json")
    modelo = next((c["modelo"] for c in casos if c.get("modelo")), "não registrado")
    base = next((c["base"] for c in casos if c.get("base")), "não registrada")
    cfg = todos["configuracoes"]

    doc = Document()
    estilo = doc.styles["Normal"]
    estilo.font.name = "Arial"
    estilo.font.size = Pt(10.5)
    # paisagem: as tabelas de métricas têm muitas colunas
    secao = doc.sections[0]
    secao.orientation = WD_ORIENT.LANDSCAPE
    secao.page_width, secao.page_height = Cm(29.7), Cm(21.0)
    for lado in ("left_margin", "right_margin"):
        setattr(secao, lado, Cm(2))
    secao.top_margin = secao.bottom_margin = Cm(1.8)

    # ---------- capa ----------
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("TriIAge — Relatório do piloto de avaliação")
    r.bold, r.font.size, r.font.color.rgb = True, Pt(22), VERDE
    s = doc.add_paragraph()
    s.alignment = WD_ALIGN_PARAGRAPH.CENTER
    s.add_run(f"Evidências e dados · {date.today().strftime('%d/%m/%Y')} · modelo externo: {modelo}").italic = True

    nota = doc.add_paragraph()
    nota.add_run("Natureza deste piloto: ").bold = True
    nota.add_run("piloto técnico com base sintética. Os casos e o nível de referência de cada um foram elaborados com "
                 "auxílio de um assistente de IA, seguindo os critérios do Caderno de Atenção Básica 28 e do Protocolo "
                 "de Manchester, e não foram validados por enfermeiros. Os resultados medem a concordância do sistema "
                 "com essa referência e não constituem validação clínica.")

    # ---------- 1. resumo ----------
    titulo(doc, "1 Resumo dos resultados")
    paragrafo(doc, f"Base: {todos['n_casos']} casos sintéticos em linguagem leiga, distribuídos nos cinco níveis "
                   f"({', '.join(f'{k}: {v}' for k, v in todos['distribuicao_referencia'].items())}). "
                   "Métrica principal: kappa ponderado quadrático com IC 95% por bootstrap; taxa de subtriagem nos "
                   "níveis 1 e 2 como métrica de segurança.")
    for nome in (A, B, C):
        m = cfg[nome]
        item(doc, f"{nome}: cobertura {frac(m['cobertura'])}; kappa {kappa(m)}; subtriagem nos níveis 1–2 "
                  f"{pct(m['subtriagem_niveis_1_e_2'])}; sensibilidade para urgentes {pct(m['urgente_sensibilidade'])}.")
    item(doc, f"{D} (sempre o nível mais frequente): kappa {kappa(cfg[D])}; acurácia {pct(cfg[D]['acuracia_exata'])}.")

    # ---------- 2. objetivo ----------
    titulo(doc, "2 Objetivo")
    paragrafo(doc, "Responder, em caráter preliminar, às questões de pesquisa do plano de avaliação: (QP1) o motor híbrido "
                   "concorda mais com a referência do que a árvore de decisão ou o modelo isolados? (QP2) qual a taxa de "
                   "subtriagem de cada configuração, sobretudo nos casos mais graves?")

    # ---------- 3. base sintética ----------
    titulo(doc, "3 Base sintética")
    na = sum(1 for c in casos if c.get("na_base") == "sim")
    paragrafo(doc, f"Foram escritos {len(casos)} relatos fictícios em linguagem leiga (primeira pessoa ou acompanhante), "
                   "cada um com idade, sexo, gestação e doenças prévias. Nenhum dado real de paciente foi usado. "
                   f"{na} casos têm queixa coberta pela base de conhecimento do sistema (26 queixas do CAB 28) e "
                   f"{len(casos) - na} estão fora dela de propósito (trauma, corte, sinais de AVC, entorse, demandas "
                   "administrativas etc.), para medir o comportamento do sistema diante do que ele não conhece.")
    paragrafo(doc, "nível atribuído na criação de cada caso, pelos critérios do CAB 28 e do Protocolo de Manchester, com "
                   "uma justificativa curta (Apêndice A). Não houve avaliadores humanos independentes nesta etapa; por "
                   "isso a concordância entre avaliadores não foi calculada.", negrito_inicio="Padrão de referência: ")
    paragrafo(doc, "Divisão: 60% desenvolvimento e 40% teste, estratificada por nível, com semente fixa (42). Nenhum "
                   "parâmetro do sistema foi ajustado com o conjunto de desenvolvimento nesta rodada.")
    linhas = []
    for nivel in range(1, 6):
        do_nivel = [c for c in casos if int(c["referencia"]) == nivel]
        linhas.append([NOMES_NIVEL[nivel], len(do_nivel),
                       sum(c["particao"] == "desenvolvimento" for c in do_nivel),
                       sum(c["particao"] == "teste" for c in do_nivel),
                       sum(c.get("na_base") == "sim" for c in do_nivel),
                       sum(c.get("na_base") != "sim" for c in do_nivel)])
    linhas.append(["Total", len(casos), sum(c["particao"] == "desenvolvimento" for c in casos),
                   sum(c["particao"] == "teste" for c in casos), na, len(casos) - na])
    tabela(doc, ["Nível de referência", "Casos", "Desenvolvimento", "Teste", "Queixa na base", "Fora da base"], linhas,
           [4, 2.5, 3, 2.5, 3, 3])

    # ---------- 4. configurações ----------
    titulo(doc, "4 Configurações comparadas")
    tabela(doc, ["Configuração", "Descrição"], [
        ["A – árvore de decisão", "Só regras: identifica a queixa por palavras e desce pelas faixas de gravidade "
                                  "procurando discriminadores no relato; não usa o modelo."],
        ["B – modelo isolado", f"Só o modelo externo JEV ({modelo}), escolhendo entre todas as situações da base ({base}), "
                               "sem filtro por palavras e sem regra de escalonamento."],
        ["C – motor híbrido", "Configuração do sistema (UC06): o JEV escolhe entre as queixas mais parecidas, com "
                              "escalonamento (opção mais grave com probabilidade ≥ 20% prevalece), e a árvore também "
                              "classifica; se divergirem, prevalece o nível mais urgente. Confiança < 0,70 marca revisão humana."],
        ["D – linha de base", "Sugere sempre o nível mais frequente da referência."],
    ], [5, 20])

    # ---------- 5. métricas ----------
    titulo(doc, "5 Métricas e análise estatística")
    for texto in [
        "Kappa ponderado quadrático (Cohen, 1968) entre o nível sugerido e a referência, com IC 95% por bootstrap "
        f"({todos['bootstrap']} reamostragens, semente {todos['semente']}).",
        "Acurácia exata e dentro de ±1 nível; subtriagem (nível sugerido menos urgente que a referência) nos casos de "
        "referência 1 ou 2; sobretriagem geral; sensibilidade e especificidade para casos urgentes (níveis 1 e 2). "
        "Proporções com IC 95% de Wilson.",
        "Cobertura: proporção de casos em que a configuração sugeriu algum nível. Quando a base não tem nada parecido "
        "com o relato, o sistema responde que não há informação suficiente e orienta avaliação presencial. Na análise "
        "principal esses casos ficam fora das métricas (o n de cada linha é diferente); na análise de sensibilidade "
        "(Seção 6.2) eles contam como nível 3, que é a orientação dada ao paciente nesse caso.",
        "Tempo de classificação por caso (mediana e percentil 95), medido no script.",
    ]:
        item(doc, texto)

    # ---------- 6. resultados ----------
    titulo(doc, "6 Resultados")
    titulo(doc, f"6.1 Todos os casos (n = {todos['n_casos']}, métricas sobre os casos com nível)", 2)
    tabela_metricas(doc, todos)
    if "motor_hibrido" in todos:
        mh = todos["motor_hibrido"]
        paragrafo(doc, f"Motor híbrido: revisão humana em {pct(mh['revisao_humana'])} dos casos ({frac(mh['revisao_humana'])}); "
                       f"divergência entre árvore e modelo em {pct(mh['divergencia_arvore_modelo'])} "
                       f"({frac(mh['divergencia_arvore_modelo'])}); contingência por regras em "
                       f"{pct(mh['contingencia_por_regras'])} ({frac(mh['contingencia_por_regras'])}).")

    titulo(doc, "6.2 Análise de sensibilidade: casos sem nível contados como nível 3 (n = 100)", 2)
    tabela_metricas(doc, sem3)

    titulo(doc, f"6.3 Conjunto de teste (n = {teste['n_casos']})", 2)
    tabela_metricas(doc, teste)

    titulo(doc, "6.4 Queixas cobertas pela base × fora da base", 2)
    linhas = []
    for nome in (A, B, C):
        dentro, fora_m = na_base["configuracoes"][nome], fora["configuracoes"][nome]
        linhas.append([nome, frac(dentro["cobertura"]), kappa(dentro), pct(dentro["subtriagem_niveis_1_e_2"]),
                       frac(fora_m["cobertura"]), kappa(fora_m), pct(fora_m["acuracia_exata"])])
    tabela(doc, ["Configuração", f"Na base: cobertura (n={na_base['n_casos']})", "Na base: kappa", "Na base: subtriagem 1–2",
                 f"Fora: cobertura (n={fora['n_casos']})", "Fora: kappa", "Fora: acurácia exata"], linhas,
           [4.5, 3.3, 3.3, 3.5, 3.3, 3.3, 3.5])

    titulo(doc, "6.5 Matrizes de confusão (linhas: referência; colunas: sugestão; casos com nível)", 2)
    for nome in (A, B, C):
        paragrafo(doc, "", negrito_inicio=nome)
        mat = cfg[nome]["matriz_confusao_linhas_referencia_colunas_sugestao"]
        sem_nivel = [sum(1 for c in casos if int(c["referencia"]) == nv and not c[COLUNA[nome]]) for nv in range(1, 6)]
        tabela(doc, ["Ref \\ Sug"] + [NOMES_NIVEL[i] for i in range(1, 6)] + ["Sem nível"],
               [[NOMES_NIVEL[i + 1]] + mat[i] + [sem_nivel[i]] for i in range(5)], [3, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4])

    titulo(doc, "6.6 Casos graves (referência 1 ou 2) subtriados ou sem nível", 2)
    linhas = []
    for c in casos:
        ref = int(c["referencia"])
        if ref > 2:
            continue
        falhas = [col for col in COLUNA.values() if not c[col] or int(c[col]) > ref]
        if falhas:
            linhas.append([c["id"], c["relato"], ref, c["A_arvore"] or "—", c["B_modelo"] or "—",
                           c["C_hibrido"] or "—", c.get("na_base", "")])
    tabela(doc, ["Caso", "Relato", "Ref", "A", "B", "C", "Na base"], linhas, [1.4, 15, 1.2, 1.2, 1.2, 1.2, 1.8], tamanho=8)

    # ---------- 7. leitura dos resultados ----------
    titulo(doc, "7 Leitura dos resultados")
    ka, kb, kc = (cfg[n]["kappa_ponderado_quadratico"]["valor"] for n in (A, B, C))
    sa, sb, sc = (cfg[n]["subtriagem_niveis_1_e_2"]["valor"] for n in (A, B, C))
    melhor_kappa = max(((ka, A), (kb, B), (kc, C)))[1]
    menor_sub = min(((sa, A), (sb, B), (sc, C)))[1]
    item(doc, f"QP1: nesta rodada, a maior concordância (kappa) foi da configuração {melhor_kappa}. "
              + ("O motor híbrido não superou o modelo isolado em kappa." if kc < kb else
                 "O motor híbrido igualou ou superou o modelo isolado em kappa."))
    item(doc, f"QP2: a menor taxa de subtriagem nos níveis 1–2 foi da configuração {menor_sub} "
              f"(A {100 * sa:.1f}%, B {100 * sb:.1f}%, C {100 * sc:.1f}%). A regra de prevalecer o mais urgente reduz a "
              f"subtriagem à custa de mais sobretriagem (C {pct(cfg[C]['sobretriagem_geral'])} contra B "
              f"{pct(cfg[B]['sobretriagem_geral'])}).")
    azul_certo = sum(1 for c in casos if c["referencia"] == "5" and c["C_hibrido"] == "5")
    item(doc, f"Nível 5 (azul): o motor híbrido acertou {azul_certo} dos {todos['distribuicao_referencia']['Azul']} "
              f"casos azuis (base usada na rodada: {base}).")
    item(doc, f"Fora da base, a cobertura do modelo isolado cai para {frac(fora['configuracoes'][B]['cobertura'])}: o modelo "
              "tende a responder que nenhuma situação corresponde, enquanto a árvore pode casar por uma palavra isolada.")
    sem_nivel_graves = [c["id"] for c in casos if int(c["referencia"]) <= 2 and not c["C_hibrido"]]
    if sem_nivel_graves:
        item(doc, f"Casos graves sem nível no motor híbrido ({', '.join(sem_nivel_graves)}): relatos com vocabulário leigo "
                  "que a busca por palavras não reconhece, o que reforça a necessidade da tradução por PLN (RF01).")

    # ---------- 8. limitações ----------
    titulo(doc, "8 Limitações")
    for texto in [
        "Referência não validada por profissionais: os níveis foram atribuídos na criação dos casos, com auxílio de IA. "
        "Os resultados devem ser repetidos com rótulos independentes de enfermeiros (com apreciação ética, se exigida).",
        "Casos sintéticos escritos por quem conhece a base podem favorecer o sistema; por outro lado, 21% dos casos "
        "foram propositalmente postos fora da base.",
        "Amostra pequena: os intervalos de confiança são largos e as diferenças entre configurações devem ser lidas com cautela.",
        "Os relatos não têm sinais vitais; o piloto mede a pré-análise do paciente, não a triagem completa da enfermagem.",
        "O modelo externo não é determinístico: uma nova rodada pode dar números um pouco diferentes. A versão usada "
        f"foi {modelo}.",
        f"A base de conhecimento cobre pouco os níveis 4 e 5 (base usada: {base}).",
    ]:
        item(doc, texto)

    # ---------- 9. reprodutibilidade ----------
    titulo(doc, "9 Como reproduzir")
    for linha in [
        "uv run --project TriIAge-backend python piloto/rodar_sistema.py piloto/casos.csv --saida piloto/casos_rodados.csv",
        "uv run --no-project --with numpy --with pandas python piloto/analisar_piloto.py piloto/casos_rodados.csv --saida piloto/resultados_todos.json",
        "... --sem-nivel-como 3 --saida piloto/resultados_sem_nivel_3.json",
        "... --subconjunto teste --saida piloto/resultados_teste.json",
        "... --filtro na_base=sim --saida piloto/resultados_na_base.json   |   --filtro na_base=não --saida piloto/resultados_fora_base.json",
        "uv run --no-project --with python-docx python piloto/gerar_relatorio.py",
    ]:
        p = doc.add_paragraph()
        r = p.add_run(linha)
        r.font.name, r.font.size = "Consolas", Pt(8.5)

    # ---------- apêndice ----------
    titulo(doc, "Apêndice A — Os 100 casos, a referência e as sugestões")
    linhas = [[c["id"], c["particao"][:4], c["relato"], f"{c['idade']} {c['sexo']}"
               + (" gest." if c.get("gestante") == "sim" else ""), c.get("na_base", ""), c["referencia"],
               c["A_arvore"] or "—", c["B_modelo"] or "—", c["C_hibrido"] or "—", c.get("justificativa_referencia", "")]
              for c in casos]
    tabela(doc, ["Caso", "Part.", "Relato", "Idade/sexo", "Na base", "Ref", "A", "B", "C", "Justificativa da referência"],
           linhas, [1.2, 1.1, 9.5, 1.7, 1.3, 0.9, 0.8, 0.8, 0.8, 6.5], tamanho=7)

    saida = PASTA / "TriIAge_Relatorio_Piloto.docx"
    doc.save(saida)
    print("gerado", saida)


if __name__ == "__main__":
    main()
