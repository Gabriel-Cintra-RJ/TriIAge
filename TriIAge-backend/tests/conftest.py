import csv
import pathlib
from types import SimpleNamespace

import pytest
from typesafe_sdk import ChoiceAnswer

from src.db.models import Medication, SymptomUrgency

CSV_DIR = pathlib.Path(__file__).resolve().parents[1] / "database" / "csv"


def load(model, filename):
    with open(CSV_DIR / filename, encoding="utf-8", newline="") as fh:
        return [model(**{k: (v or None) for k, v in row.items()}) for row in csv.DictReader(fh)]


class FakeJev:
    """JEV de mentira para os testes: anota o que recebeu e responde a opção que o teste mandar."""

    def __init__(self, pick, confidence=0.9):
        self.pick, self.confidence, self.calls = pick, confidence, []

    def system_one(self, *, state, questions):
        self.calls.append({"state": state, "questions": questions})
        name, question = next(iter(questions.items()))
        choice = self.pick(question.criteria)
        answer = ChoiceAnswer(type="choice", choice=choice, confidence=self.confidence,
                              probabilities={choice: self.confidence})
        return SimpleNamespace(model="jev-test", choices={name: answer})


@pytest.fixture(scope="session")
def symptom_records():
    records = load(SymptomUrgency, "symptom_urgency.csv")
    for r in records:
        r.priority = int(r.priority)
    return records


@pytest.fixture(scope="session")
def medication_records():
    return load(Medication, "medications.csv")
