from src.schemas import TriageRequest, VitalSigns
from src.services.decision_tree import affirmed_stems, classify_by_rules


def request(description: str, **overrides) -> TriageRequest:
    return TriageRequest(**({"age": 40, "description": description} | overrides))


def test_negated_words_are_not_counted():
    stems = affirmed_stems("Ardor ao urinar, sem febre e sem dor forte, mas com tosse")

    assert "febre" not in stems and "forte" not in stems
    assert {"ardor", "urina", "tosse"} <= stems


def test_chest_pain_with_shortness_of_breath_is_emergency(symptom_records):
    result = classify_by_rules(request("Dor no peito há 30 minutos, com falta de ar e suor frio"), symptom_records)

    assert result.record.main_symptom == "Dor no peito"
    assert result.record.urgency_level == "emergency"
    assert any("falta" in step.lower() for step in result.path)


def test_strong_headache_goes_to_very_urgent(symptom_records):
    result = classify_by_rules(request("Dor de cabeça forte desde ontem"), symptom_records)

    assert result.record.main_symptom == "Dor de cabeça"
    assert result.record.urgency_level == "very_urgent"


def test_word_shared_by_two_tiers_stays_with_the_milder_one(symptom_records):
    # "febre" aparece na faixa muito urgente (febre alta) e na urgente (com febre); a mais grave precisa do "alta"
    result = classify_by_rules(request("Estou com dor de garganta e febre"), symptom_records)

    assert result.record.main_symptom == "Dor de garganta"
    assert result.record.urgency_level == "urgent"


def test_negation_keeps_mild_urinary_complaint_mild(symptom_records):
    result = classify_by_rules(request("Ardor leve ao urinar desde ontem, sem febre e sem sangue"), symptom_records)

    assert result.record.main_symptom == "Dor ou ardor ao urinar"
    assert result.record.urgency_level == "urgent"


def test_critical_vital_sign_raises_the_level(symptom_records):
    vitals = VitalSigns(oxygen_saturation=85)
    result = classify_by_rules(request("Estou com dor de garganta e febre", vital_signs=vitals), symptom_records)

    assert result.record.urgency_level == "emergency"
    assert any("SpO" in step for step in result.path)


def test_abnormal_vital_sign_gives_at_least_very_urgent(symptom_records):
    vitals = VitalSigns(heart_rate=130)
    result = classify_by_rules(request("Estou com dor de garganta e febre", vital_signs=vitals), symptom_records)

    assert result.record.urgency_level == "very_urgent"


def test_pregnancy_complaint_is_found_for_pregnant_patient(symptom_records):
    result = classify_by_rules(
        request("Estou grávida e com contrações fortes e doloridas", sex="F", pregnant=True), symptom_records
    )

    assert result.record.main_symptom == "Contrações na gestação"


def test_reported_high_fever_goes_up_without_measurement(symptom_records):
    result = classify_by_rules(request("Dor de garganta e febre alta"), symptom_records)

    assert result.record.urgency_level == "very_urgent"


def test_measured_normal_temperature_cancels_the_reported_fever(symptom_records):
    vitals = VitalSigns(temperature=36.5, heart_rate=70, systolic_bp=121, diastolic_bp=80, oxygen_saturation=99)
    payload = request("Dor de garganta e febre alta", symptoms=["Febre", "Tosse"], vital_signs=vitals)

    result = classify_by_rules(payload, symptom_records)

    assert result.record.main_symptom == "Dor de garganta"
    assert result.record.priority >= 3
    assert any("Temperatura medida" in step for step in result.path)


def test_measured_fever_keeps_the_reported_fever(symptom_records):
    result = classify_by_rules(request("Dor de garganta e febre alta", vital_signs=VitalSigns(temperature=38.5)),
                               symptom_records)

    assert result.record.urgency_level == "very_urgent"


def test_measured_normal_pressure_cancels_the_reported_pressure(symptom_records):
    vitals = VitalSigns(systolic_bp=120, diastolic_bp=80)
    result = classify_by_rules(request("Minha pressão deu 19 por 12 e estou com dor de cabeça", vital_signs=vitals),
                               symptom_records)

    assert any("Pressão medida" in step for step in result.path)


def test_common_cold_without_fever_is_self_care(symptom_records):
    result = classify_by_rules(request("Nariz escorrendo e espirrando desde ontem, sem febre"), symptom_records)

    assert result.record.main_symptom == "Sintomas de gripe"
    assert result.record.urgency_level == "guided_self_care"


def test_flu_with_fever_and_cough_is_still_urgent(symptom_records):
    # "tosse" agora também está na faixa de tosse prolongada (pouco urgente); a febre tem que segurar o urgente
    result = classify_by_rules(request("Estou com gripe, febre e tosse há dois dias"), symptom_records)

    assert result.record.main_symptom == "Sintomas de gripe"
    assert result.record.urgency_level == "urgent"


def test_text_outside_the_base_is_not_classified(symptom_records):
    result = classify_by_rules(request("quero renovar minha carteirinha do plano"), symptom_records)

    assert not result.matched and result.record is None
    assert result.path
