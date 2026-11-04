#!/usr/bin/env python3
"""TriIAge - roda os casos do piloto nas três configurações e preenche as colunas para o analisar_piloto.py.

  A_arvore   árvore de decisão sozinha (sem JEV)
  B_modelo   JEV sozinho: escolhe entre todas as situações da base, sem filtro por palavras e sem escalonamento
  C_hibrido  motor híbrido, igual ao da API (UC06): JEV + árvore, prevalece o mais urgente

Não usa o banco: lê as situações direto do CSV do backend. A chave do JEV vem do TriIAge-backend/.env.

Uso (na pasta TCC):
    uv run --project TriIAge-backend python piloto/rodar_sistema.py piloto/casos.csv --saida piloto/casos_rodados.csv
    ... --subconjunto desenvolvimento     # só as linhas com particao == desenvolvimento
    ... --configs A                       # só a árvore (não chama o JEV)

Colunas de entrada: id, relato, idade (obrigatórias); sexo (F/M), gestante (sim/não), condicoes (separadas por ;).
Se a saída já existir, os casos já rodados são pulados (dá para continuar se cair no meio).
"""
import argparse
import csv
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "TriIAge-backend"
sys.path.insert(0, str(BACKEND))

from typesafe_sdk import RetryPolicy, TypeSafeClient, TypeSafeError  # noqa: E402

from src.core.config import Settings  # noqa: E402
from src.db.models import SymptomUrgency  # noqa: E402
from src.schemas import TriageRequest  # noqa: E402
from src.services.decision_tree import classify_by_rules  # noqa: E402
from src.services.encounters import LEVEL_PRIORITY  # noqa: E402
from src.services.hybrid import classify_hybrid  # noqa: E402
from src.services.triage import classify_urgency  # noqa: E402

NOVAS = ["A_arvore", "B_modelo", "C_hibrido", "A_situacao", "B_situacao", "C_situacao", "B_confianca",
         "C_confianca", "C_revisao", "C_origem", "C_divergencia", "A_ms", "B_ms", "C_ms", "modelo", "base"]


def carregar_base() -> list[SymptomUrgency]:
    with open(BACKEND / "database" / "csv" / "symptom_urgency.csv", encoding="utf-8", newline="") as f:
        rows = [SymptomUrgency(**{k: (v or None) for k, v in r.items()}) for r in csv.DictReader(f)]
    for r in rows:
        r.priority = int(r.priority)
    return rows


def montar_pedido(caso: dict) -> TriageRequest:
    sexo = (caso.get("sexo") or "").strip().upper()
    gestante = (caso.get("gestante") or "").strip().lower() in {"sim", "s", "1", "true"}
    condicoes = [c.strip() for c in (caso.get("condicoes") or "").split(";") if c.strip()]
    return TriageRequest(
        age=int(caso["idade"]),
        sex=sexo if sexo in {"F", "M"} else None,
        pregnant=gestante and sexo == "F",
        description=caso["relato"].strip(),
        conditions=condicoes,
    )


def nivel(record) -> str:
    return str(LEVEL_PRIORITY[record.urgency_level]) if record else ""


def cronometrar(funcao):
    inicio = time.perf_counter()
    resultado = funcao()
    return resultado, round((time.perf_counter() - inicio) * 1000)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("casos")
    ap.add_argument("--saida", required=True)
    ap.add_argument("--subconjunto", help="valor da coluna particao (ex.: desenvolvimento ou teste)")
    ap.add_argument("--configs", default="A,B,C", help="quais rodar, separadas por vírgula (padrão A,B,C)")
    ap.add_argument("--limite", type=int, help="roda só os N primeiros casos (para testar)")
    a = ap.parse_args()
    configs = {c.strip().upper() for c in a.configs.split(",")}

    with open(a.casos, encoding="utf-8-sig", newline="") as f:
        casos = list(csv.DictReader(f))
    faltando = [c.get("id", "?") for c in casos if not (c.get("relato") or "").strip() or not (c.get("idade") or "").strip()]
    if faltando:
        sys.exit(f"Casos sem relato ou sem idade: {', '.join(faltando)}")
    if a.subconjunto:
        casos = [c for c in casos if c.get("particao") == a.subconjunto]
    if a.limite:
        casos = casos[: a.limite]

    # retomada: o que já foi rodado numa execução anterior fica como está
    feitos = {}
    if Path(a.saida).exists():
        with open(a.saida, encoding="utf-8", newline="") as f:
            feitos = {r["id"]: r for r in csv.DictReader(f)}

    settings = Settings(_env_file=BACKEND / ".env")
    base = carregar_base()
    # fica registrado em cada linha, para o relatório saber com que base a rodada foi feita
    descricao_base = f"{len(base)} situações ({sum(r.priority == 5 for r in base)} de nível 5)"
    jev = None
    if configs & {"B", "C"}:
        jev = TypeSafeClient(api_key=settings.typesafe_api_key.get_secret_value(), model=settings.jev_model,
                             timeout=settings.jev_timeout,
                             retry=RetryPolicy(max_retries=1, timeout=settings.jev_timeout))

    colunas = list(casos[0].keys()) + [c for c in NOVAS if c not in casos[0]] if casos else NOVAS
    saida = []
    try:
        for i, caso in enumerate(casos, 1):
            linha = {**caso, **feitos.get(caso["id"], {})}
            pedido = montar_pedido(caso)

            if "A" in configs and not linha.get("A_ms"):
                r, ms = cronometrar(lambda: classify_by_rules(pedido, base))
                linha |= {"A_arvore": nivel(r.record), "A_situacao": r.record.id if r.record else "", "A_ms": ms}

            if "B" in configs and not linha.get("B_ms"):
                try:
                    r, ms = cronometrar(lambda: classify_urgency(jev, pedido, base, settings.min_confidence,
                                                                 escalate=False))
                    linha |= {"B_modelo": nivel(r.record), "B_situacao": r.record.id if r.record else "",
                              "B_confianca": r.confidence if r.confidence is not None else "", "B_ms": ms,
                              "modelo": r.model or linha.get("modelo", "")}
                except TypeSafeError as erro:
                    # fica em branco e roda de novo na próxima execução
                    print(f"[{caso['id']}] B falhou: {erro}", file=sys.stderr)

            if "C" in configs and not linha.get("C_ms"):
                r, ms = cronometrar(lambda: classify_hybrid(jev, pedido, base, settings.min_confidence))
                linha |= {"C_hibrido": nivel(r.record), "C_situacao": r.record.id if r.record else "",
                          "C_confianca": r.confidence if r.confidence is not None else "",
                          "C_revisao": int(r.needs_human_review), "C_origem": r.origin,
                          "C_divergencia": int(r.divergent), "C_ms": ms,
                          "modelo": r.model or linha.get("modelo", "")}

            linha["base"] = linha.get("base") or descricao_base
            saida.append(linha)
            print(f"{i}/{len(casos)} {caso['id']}: A={linha.get('A_arvore') or '-'} "
                  f"B={linha.get('B_modelo') or '-'} C={linha.get('C_hibrido') or '-'}")
    finally:
        # grava mesmo se for interrompido, para a retomada aproveitar o que já rodou
        restantes = [{**c, **feitos.get(c["id"], {})} for c in casos[len(saida):]]
        with open(a.saida, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=colunas, extrasaction="ignore")
            w.writeheader()
            w.writerows(saida + restantes)
        if jev is not None:
            jev.close()

    print(f"\nSaída gravada em {a.saida}. Agora: python analisar_piloto.py {a.saida} --subconjunto teste")


if __name__ == "__main__":
    main()
