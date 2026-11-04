"""Árvore de decisão: classifica sem o JEV, no mesmo formato dos fluxogramas do CAB 28 de onde a base veio.

1. acha a queixa principal (a mesma busca por palavras do triage.py);
2. desce pelas faixas da queixa, da mais grave para a mais leve, e para na primeira que tem algum
   discriminador no relato. Se nenhuma tiver, fica a mais leve;
3. sinais vitais muito alterados garantem um nível mínimo.

É usada sozinha quando o JEV falha (contingência, RNF05) e junto com ele no motor híbrido (UC06).
"""

import re
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from itertools import groupby

from src.db.models import SymptomUrgency, split_list
from src.schemas import TriageRequest, VitalSigns
from src.services.text import STOPWORDS, normalize, stems
from src.services.triage import query_text, rank_complaints

LEVEL_NAMES = {1: "Emergência", 2: "Muito urgente", 3: "Urgente", 4: "Pouco urgente", 5: "Autocuidado orientado"}
NEGATIONS = {"sem", "nao", "nem", "nunca", "nenhum", "nenhuma"}
# palavras genéricas demais para decidir sozinhas ("pele" de "pele fria e suada" pegava queimadura de sol,
# "baixa" de "pressão baixa" pegava "febre baixa")
WEAK = {"pele", "labio", "boca", "rosto", "corpo", "local", "baixa", "baixo", "fria", "frio", "area", "grand",
        "peque", "dific", "anorm", "outro", "parte"}
RESETS = {"com", "mas", "porem"}  # depois disso a frase volta a ser afirmativa ("sem febre, mas com tosse")


@dataclass(frozen=True)
class RulesResult:
    matched: bool
    record: SymptomUrgency | None = None
    path: list[str] = field(default_factory=list)


def _is_complement(record: SymptomUrgency) -> bool:
    return (record.source or "").startswith("Critério do projeto")


def affirmed_words(text: str) -> dict[str, str]:
    """Radical -> palavra, ignorando o que foi negado. "sem febre e sem dor forte" não conta febre nem forte.
    A negação vale até o fim da frase (vírgula, ponto) ou até um "com"/"mas"."""
    words: dict[str, str] = {}
    for clause in re.split(r"[,.;:!?()\n]", text or ""):
        negated = False
        for word in normalize(clause).split():
            if word in NEGATIONS:
                negated = True
            elif word in RESETS:
                negated = False
            elif not negated and len(word) >= 3 and word not in STOPWORDS:
                words.setdefault(word[:5], word)
    return words


def affirmed_stems(text: str) -> set[str]:
    return set(affirmed_words(text))


@dataclass(frozen=True)
class _Tier:
    words: dict[str, str]           # palavras que decidem sozinhas
    pairs: list[dict[str, str]]     # frases com palavra fraca: só valem se duas palavras dela estiverem no relato


def _tiers(rows: list[SymptomUrgency]) -> dict[str, _Tier]:
    """Discriminadores de cada faixa. Se a mesma palavra aparece em mais de um nível da queixa (ex.: "febre" em
    "febre alta" e em "com febre"), ela fica só com o nível mais leve: para cair no mais grave o relato precisa de
    algo a mais ("alta"), como nos discriminadores do Manchester."""
    complaint = stems(rows[0].main_symptom)
    most_severe = min(r.priority for r in rows)
    texts = {}
    for r in rows:
        text = f"{r.description}, {', '.join(split_list(r.associated_symptoms))}"
        # na faixa mais grave os sinais de alerta descrevem a própria faixa; nas outras são sinais para subir
        if r.priority == most_severe:
            text += ", " + ", ".join(split_list(r.warning_signs))
        texts[r.id] = text

    words = {rid: {s: w for s, w in affirmed_words(t).items() if s not in complaint and s not in WEAK}
             for rid, t in texts.items()}
    levels_with = defaultdict(set)
    for r in rows:
        for s in words[r.id]:
            levels_with[s].add(r.priority)

    tiers = {}
    for r in rows:
        strong = {s: w for s, w in words[r.id].items() if max(levels_with[s]) == r.priority}
        phrases = (affirmed_words(part) for part in re.split(r"[,;.()]|\bou\b", texts[r.id]))
        pairs = [{s: w for s, w in p.items() if s not in complaint} for p in phrases]
        tiers[r.id] = _Tier(strong, [p for p in pairs if len(p) >= 2 and p.keys() & WEAK])
    return tiers


def _hits(tier: _Tier, query: set[str]) -> list[str]:
    hits = [tier.words[s] for s in sorted(query & tier.words.keys())]
    for pair in tier.pairs:
        found = query & pair.keys()
        if len(found) >= 2 and found & WEAK:
            hits.append(" ".join(pair[s] for s in pair if s in found))
    return hits


# o que o paciente relata e a enfermagem consegue medir: se a medida desmente, vale a medida
MEASURED_CLAIMS = [
    ("temperature", re.compile(r"\bfebr(e|il)\w*(\s+(muito\s+)?(alta|alto|forte))?", re.IGNORECASE),
     lambda v: v.temperature < 37.8, lambda v: f"Temperatura medida {v.temperature} °C"),
    ("systolic_bp", re.compile(r"\bpress[aã]o\s+(\w+\s+){0,2}(alta|\d+\s*(por|x|/)\s*\d+)", re.IGNORECASE),
     lambda v: v.diastolic_bp is not None and v.systolic_bp < 140 and v.diastolic_bp < 90,
     lambda v: f"Pressão medida {v.systolic_bp}/{v.diastolic_bp} mmHg"),
    ("blood_glucose", re.compile(r"\b(glicose|glicemia|a[cç][uú]car)\s+(\w+\s+){0,2}(alt[ao]|\d+)", re.IGNORECASE),
     lambda v: 70 <= v.blood_glucose < 200, lambda v: f"Glicemia medida {v.blood_glucose} mg/dL"),
    ("heart_rate", re.compile(r"\b(cora[cç][aã]o|batimentos?)\s+(\w+\s+)?(acelerad|disparad)\w*|\btaquicardia\b",
                              re.IGNORECASE),
     lambda v: 50 <= v.heart_rate <= 100, lambda v: f"Frequência cardíaca medida {v.heart_rate} bpm"),
]


def _drop_contradicted(text: str, v: VitalSigns | None) -> tuple[str, list[str]]:
    """Na triagem, tira do relato o que os sinais vitais desmentem (ex.: "febre alta" com 36,5 °C)."""
    if v is None:
        return text, []
    notes = []
    for field_name, pattern, normal, describe in MEASURED_CLAIMS:
        if getattr(v, field_name) is None or not normal(v):
            continue
        found = [m.group(0) for m in pattern.finditer(text)]
        if found:
            text = pattern.sub(",", text)
            notes.append(f"{describe(v)}: \"{found[0]}\" do relato não foi considerado.")
    return text, notes


def _vital_floor(v: VitalSigns | None) -> tuple[int | None, list[str]]:
    """Nível mínimo pelos sinais vitais. As faixas são as mesmas dos alertas do front e ainda são provisórias."""
    if v is None:
        return None, []
    critical = []
    if v.oxygen_saturation is not None and v.oxygen_saturation < 90:
        critical.append(f"SpO₂ {v.oxygen_saturation}% abaixo de 90")
    if v.systolic_bp is not None and v.systolic_bp < 90:
        critical.append(f"PA sistólica {v.systolic_bp} abaixo de 90")
    if critical:
        return 1, critical

    checks = [
        (v.heart_rate, 50, 120, "FC"),
        (v.respiratory_rate, 10, 24, "FR"),
        (v.temperature, 35, 39, "temperatura"),
        (v.blood_glucose, 70, 250, "glicemia"),
        (v.systolic_bp, None, 180, "PA sistólica"),
        (v.diastolic_bp, None, 120, "PA diastólica"),
    ]
    alerts = [f"{name} {value} fora da faixa" for value, low, high, name in checks
              if value is not None and ((low is not None and value < low) or value > high)]
    return (2, alerts) if alerts else (None, [])


def classify_by_rules(payload: TriageRequest, records: Sequence[SymptomUrgency]) -> RulesResult:
    ranked = rank_complaints(payload, records)
    if not ranked:
        return RulesResult(False, path=["Nenhuma queixa da base parecida com o relato."])

    score, rows = ranked[0]
    path = [f"Queixa principal: {rows[0].main_symptom} (pontuação {score})."]
    text, notes = _drop_contradicted(query_text(payload), payload.vital_signs)
    path += notes
    query = affirmed_stems(text)
    tiers = _tiers(rows)

    chosen = None
    by_level = groupby(sorted(rows, key=lambda r: r.priority), key=lambda r: r.priority)
    for priority, group in by_level:
        group = list(group)
        best = max(group, key=lambda r: len(_hits(tiers[r.id], query)))
        hits = _hits(tiers[best.id], query)
        if hits:
            chosen = best
            path.append(f"{LEVEL_NAMES[priority]} ({best.id}): o relato tem {', '.join(hits)}.")
            break
        path.append(f"{LEVEL_NAMES[priority]}: nenhum discriminador no relato.")

    if chosen is None:
        # as faixas que o projeto acrescentou ao CAB 28 (níveis 4 e 5) só valem com evidência no relato;
        # sem nada, fica a mais leve do próprio CAB 28, como no fluxograma
        cab28 = [r for r in rows if not _is_complement(r)] or rows
        chosen = max(cab28, key=lambda r: r.priority)
        path.append(f"Sem discriminadores: fica a faixa mais leve do fluxograma, {LEVEL_NAMES[chosen.priority]} "
                    f"({chosen.id}).")

    floor, reasons = _vital_floor(payload.vital_signs)
    if floor and chosen.priority > floor:
        allowed = [r for r in rows if r.priority <= floor]
        if allowed:
            chosen = max(allowed, key=lambda r: r.priority)
            path.append(f"Sinais vitais ({'; '.join(reasons)}) pedem no mínimo {LEVEL_NAMES[floor]}: "
                        f"sobe para {LEVEL_NAMES[chosen.priority]} ({chosen.id}).")
        else:
            path.append(f"Sinais vitais ({'; '.join(reasons)}) pedem {LEVEL_NAMES[floor]}, mas a queixa não tem "
                        "faixa tão grave; a enfermagem deve avaliar.")

    return RulesResult(True, chosen, path)
