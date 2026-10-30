"""Funções para deixar o texto comparável (sem acento e minúsculo) nas buscas da base."""

import re
import unicodedata

STOPWORDS = {
    "com", "sem", "uma", "uns", "umas", "para", "por", "que", "nao", "estou", "esta", "tenho", "tem", "muito",
    "muita", "mais", "dor", "dores", "sinto", "sentindo", "desde", "dias", "dia", "hoje", "ontem", "como", "minha",
    "meu", "das", "dos", "nas", "nos", "pela", "pelo", "quando", "ate", "isso", "esse", "essa", "ficou", "fica",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def stems(text: str) -> set[str]:
    """Corta cada palavra nas 5 primeiras letras. É simples, mas já faz "vômitos" bater com "vômito"
    e "convulsão" com "convulsiva"."""
    return {w[:5] for w in normalize(text).split() if len(w) >= 3 and w not in STOPWORDS}
