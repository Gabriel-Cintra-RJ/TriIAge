#!/usr/bin/env python3
"""TriIAge - análise do piloto de avaliação (Seção 3.3 do documento de software).

Lê um CSV com a classificação de referência e as sugestões de cada configuração
e calcula as métricas do plano de avaliação. Não gera dados: só mede o que for
fornecido. Níveis: 1 = vermelho (imediato) ... 5 = azul (240 min).

Colunas obrigatórias : id, referencia
Colunas de configuração (use as que tiver): A_arvore, B_modelo, C_hibrido, D_base
Colunas opcionais    : avaliador1, avaliador2 (rótulos independentes, antes do consenso)
                       A_ms, B_ms, C_ms (tempo de classificação) e C_revisao, C_origem, C_divergencia,
                       que o rodar_sistema.py preenche

Caso sem nível (o sistema não achou nada na base) entra na cobertura. Por padrão as métricas usam só os casos
com nível; com --sem-nivel-como 3, por exemplo, eles contam como nível 3 (análise de sensibilidade).

Uso:
    python3 analisar_piloto.py casos.csv --saida resultados.json --semente 42
    python3 analisar_piloto.py casos.csv --subconjunto teste   # usa só linhas com particao == teste
    python3 analisar_piloto.py casos.csv --filtro na_base=sim  # qualquer coluna=valor
"""
import argparse
import json
import sys

import numpy as np
import pandas as pd

NIVEIS = [1, 2, 3, 4, 5]
NOMES = {1: "Vermelho", 2: "Laranja", 3: "Amarelo", 4: "Verde", 5: "Azul"}
CONFIGS = {
    "A_arvore": "A - árvore de decisão",
    "B_modelo": "B - modelo (JEV)",
    "C_hibrido": "C - motor híbrido",
    "D_base": "D - linha de base",
}


def qwk(y, p, k=5):
    """Kappa ponderado quadrático (Cohen, 1968) para níveis 1..k."""
    y = np.asarray(y) - 1
    p = np.asarray(p) - 1
    obs = np.zeros((k, k))
    for a, b in zip(y, p):
        obs[a, b] += 1
    n = obs.sum()
    if n == 0:
        return float("nan")
    esp = np.outer(obs.sum(1), obs.sum(0)) / n
    w = np.array([[(i - j) ** 2 for j in range(k)] for i in range(k)], dtype=float) / (k - 1) ** 2
    num = (w * obs).sum()
    den = (w * esp).sum()
    return float("nan") if den == 0 else 1.0 - num / den


def wilson(x, n, z=1.96):
    if n == 0:
        return (float("nan"), float("nan"))
    ph = x / n
    d = 1 + z * z / n
    c = (ph + z * z / (2 * n)) / d
    h = z * np.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def prop(x, n):
    lo, hi = wilson(x, n)
    return {"x": int(x), "n": int(n), "valor": (x / n if n else float("nan")), "ic95": [lo, hi]}


def metricas(ref, sug, rng, n_boot):
    ref = np.asarray(ref, dtype=int)
    sug = np.asarray(sug, dtype=int)
    n = len(ref)
    sub = sug > ref  # menos urgente que a referência
    sob = sug < ref
    grave = ref <= 2
    urgente_ref = ref <= 2
    urgente_sug = sug <= 2
    tp = int((urgente_ref & urgente_sug).sum())
    fn = int((urgente_ref & ~urgente_sug).sum())
    tn = int((~urgente_ref & ~urgente_sug).sum())
    fp = int((~urgente_ref & urgente_sug).sum())

    # bootstrap do kappa
    ks = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        ks.append(qwk(ref[idx], sug[idx]))
    ks = np.array([k for k in ks if not np.isnan(k)])
    ic = [float(np.percentile(ks, 2.5)), float(np.percentile(ks, 97.5))] if len(ks) else [float("nan")] * 2

    conf = np.zeros((5, 5), dtype=int)
    for a, b in zip(ref, sug):
        conf[a - 1, b - 1] += 1

    por_nivel = {}
    for nv in NIVEIS:
        r_pos = ref == nv
        s_pos = sug == nv
        por_nivel[NOMES[nv]] = {
            "sensibilidade": prop(int((r_pos & s_pos).sum()), int(r_pos.sum())),
            "especificidade": prop(int((~r_pos & ~s_pos).sum()), int((~r_pos).sum())),
        }

    return {
        "n": n,
        "kappa_ponderado_quadratico": {"valor": qwk(ref, sug), "ic95_bootstrap": ic},
        "acuracia_exata": prop(int((ref == sug).sum()), n),
        "acuracia_mais_menos_1": prop(int((np.abs(ref - sug) <= 1).sum()), n),
        "subtriagem_geral": prop(int(sub.sum()), n),
        "subtriagem_niveis_1_e_2": prop(int((sub & grave).sum()), int(grave.sum())),
        "sobretriagem_geral": prop(int(sob.sum()), n),
        "urgente_sensibilidade": prop(tp, tp + fn),
        "urgente_especificidade": prop(tn, tn + fp),
        "por_nivel": por_nivel,
        "matriz_confusao_linhas_referencia_colunas_sugestao": conf.tolist(),
    }


def fmt_p(d):
    if d["n"] == 0:
        return "—"
    return f"{100 * d['valor']:.1f}% ({100 * d['ic95'][0]:.1f}–{100 * d['ic95'][1]:.1f}; {d['x']}/{d['n']})"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--saida", default="resultados.json")
    ap.add_argument("--semente", type=int, default=42)
    ap.add_argument("--bootstrap", type=int, default=2000)
    ap.add_argument("--subconjunto", default=None, help="valor da coluna 'particao' a analisar (ex.: teste)")
    ap.add_argument("--filtro", default=None, help="coluna=valor, ex.: na_base=sim")
    ap.add_argument("--sem-nivel-como", type=int, choices=NIVEIS, default=None,
                    help="nível usado para os casos sem sugestão (padrão: ficam de fora das métricas)")
    a = ap.parse_args()

    df = pd.read_csv(a.csv)
    if a.subconjunto:
        if "particao" not in df.columns:
            sys.exit("A coluna 'particao' não existe no CSV.")
        df = df[df["particao"] == a.subconjunto]
    if a.filtro:
        coluna, _, valor = a.filtro.partition("=")
        if coluna not in df.columns:
            sys.exit(f"A coluna '{coluna}' não existe no CSV.")
        df = df[df[coluna].astype(str) == valor]
    if "referencia" not in df.columns:
        sys.exit("Falta a coluna 'referencia'.")
    df = df.dropna(subset=["referencia"])
    ref = df["referencia"].astype(int).to_numpy()
    if not set(np.unique(ref)) <= set(NIVEIS):
        sys.exit("Os níveis devem ser inteiros de 1 a 5.")

    rng = np.random.default_rng(a.semente)
    res = {"n_casos": int(len(df)), "semente": a.semente, "bootstrap": a.bootstrap,
           "distribuicao_referencia": {NOMES[n]: int((ref == n).sum()) for n in NIVEIS}, "configuracoes": {}}

    cols = [c for c in CONFIGS if c in df.columns]
    if "D_base" not in df.columns:
        moda = int(pd.Series(ref).mode().iloc[0])
        df = df.assign(D_base=moda)
        cols.append("D_base")
        res["aviso_linha_de_base"] = f"D_base calculada como o nível mais frequente da referência ({NOMES[moda]})."
    for c in cols:
        com_nivel = int(df[c].notna().sum())
        col = df[c] if a.sem_nivel_como is None else df[c].fillna(a.sem_nivel_como)
        if a.sem_nivel_como is None and com_nivel != len(df):
            print(f"[aviso] {c}: {len(df) - com_nivel} casos sem nível ficaram fora das métricas.", file=sys.stderr)
        sel = col.notna()
        m = metricas(ref[sel.to_numpy()], col[sel].astype(int).to_numpy(), rng, a.bootstrap)
        m["cobertura"] = prop(com_nivel, len(df))
        tempo = f"{c[0]}_ms"
        if tempo in df.columns and df[tempo].notna().any():
            ms = df[tempo].dropna().astype(float)
            m["tempo_ms"] = {"mediana": float(ms.median()), "p95": float(ms.quantile(0.95))}
        res["configuracoes"][CONFIGS[c]] = m

    # taxas do motor híbrido pedidas no plano (RNF05 e RNF06)
    extras = {"C_revisao": "revisao_humana", "C_divergencia": "divergencia_arvore_modelo"}
    for coluna, nome in extras.items():
        if coluna in df.columns and df[coluna].notna().any():
            v = df[coluna].dropna().astype(int)
            res.setdefault("motor_hibrido", {})[nome] = prop(int(v.sum()), len(v))
    if "C_origem" in df.columns and df["C_origem"].notna().any():
        o = df["C_origem"].dropna()
        res.setdefault("motor_hibrido", {})["contingencia_por_regras"] = prop(int((o == "rules").sum()), len(o))
    if a.sem_nivel_como is not None:
        res["sem_nivel_como"] = a.sem_nivel_como

    s = df.dropna(subset=["avaliador1", "avaliador2"]) if {"avaliador1", "avaliador2"} <= set(df.columns) else df.iloc[:0]
    if len(s):
        r1, r2 = s["avaliador1"].astype(int).to_numpy(), s["avaliador2"].astype(int).to_numpy()
        ks = []
        for _ in range(a.bootstrap):
            idx = rng.integers(0, len(s), len(s))
            ks.append(qwk(r1[idx], r2[idx]))
        res["concordancia_entre_avaliadores"] = {
            "n": int(len(s)), "kappa_ponderado_quadratico": qwk(r1, r2),
            "ic95_bootstrap": [float(np.nanpercentile(ks, 2.5)), float(np.nanpercentile(ks, 97.5))],
            "concordancia_exata": prop(int((r1 == r2).sum()), len(s))}

    with open(a.saida, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    print(f"Casos analisados: {res['n_casos']}  |  distribuição da referência: {res['distribuicao_referencia']}")
    if "concordancia_entre_avaliadores" in res:
        c = res["concordancia_entre_avaliadores"]
        print(f"Concordância entre avaliadores: kappa ponderado = {c['kappa_ponderado_quadratico']:.2f} "
              f"(IC95% {c['ic95_bootstrap'][0]:.2f}–{c['ic95_bootstrap'][1]:.2f}), n = {c['n']}")
    print()
    print("| Configuração | Cobertura | Kappa pond. (IC95%) | Acurácia exata | ±1 nível | Subtriagem (níveis 1–2) | Sobretriagem | Sens. urgente | Espec. urgente | Tempo mediana / p95 |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for nome, m in res["configuracoes"].items():
        k = m["kappa_ponderado_quadratico"]
        t = m.get("tempo_ms")
        tempo = f"{t['mediana']:.0f} / {t['p95']:.0f} ms" if t else "—"
        print(f"| {nome} | {fmt_p(m['cobertura'])} | {k['valor']:.2f} ({k['ic95_bootstrap'][0]:.2f}–{k['ic95_bootstrap'][1]:.2f}) | "
              f"{fmt_p(m['acuracia_exata'])} | {fmt_p(m['acuracia_mais_menos_1'])} | "
              f"{fmt_p(m['subtriagem_niveis_1_e_2'])} | {fmt_p(m['sobretriagem_geral'])} | "
              f"{fmt_p(m['urgente_sensibilidade'])} | {fmt_p(m['urgente_especificidade'])} | {tempo} |")
    if "motor_hibrido" in res:
        print()
        for nome, v in res["motor_hibrido"].items():
            print(f"Motor híbrido – {nome.replace('_', ' ')}: {fmt_p(v)}")
    if a.sem_nivel_como is not None:
        print(f"\n(casos sem nível contados como nível {a.sem_nivel_como})")
    print(f"\nResultados completos (incluindo matrizes 5x5 e métricas por nível) em: {a.saida}")


if __name__ == "__main__":
    main()
