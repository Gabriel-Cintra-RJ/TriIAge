-- Contas de demonstração e uma paciente de exemplo com histórico, para a apresentação não começar vazia.
-- Roda depois do 02_seed.sh (ordem alfabética), então já dá para usar os ids das bases de sintomas e bulas.
-- O atendimento de setembro foi montado à mão: a classificação dele não veio do JEV (model = 'exemplo').

DO $$
DECLARE
    maria    bigint;
    ana      bigint;
    ricardo  bigint;
    enc      bigint;
    rx       bigint;
    amox     bigint;
    paracet  bigint;
    vit      bigint;
    cls      bigint;
BEGIN
    INSERT INTO users (name, email, role) VALUES
        ('Juliana Rocha', 'recepcao@triiage.local', 'RECEPCIONISTA'),
        ('Fernanda Castro', 'auditoria@triiage.local', 'AUDITOR'),
        ('Marcos Pereira', 'gestao@triiage.local', 'GESTOR_CLINICO');
    INSERT INTO users (name, email, role) VALUES ('Ana Beatriz Lima', 'enfermagem@triiage.local', 'ENFERMEIRO')
        RETURNING id INTO ana;
    INSERT INTO users (name, email, role) VALUES ('Ricardo Alves', 'medico@triiage.local', 'MEDICO')
        RETURNING id INTO ricardo;
    INSERT INTO users (name, email, role) VALUES ('Maria Aparecida Souza', 'paciente@triiage.local', 'PACIENTE')
        RETURNING id INTO maria;

    INSERT INTO patients (user_id, birth_date, sex, blood_type, phone)
        VALUES (maria, '1981-05-14', 'F', 'O+', '(21) 99999-0000');

    INSERT INTO health_records (patient_id, category, description, started_on, notes) VALUES
        (maria, 'condition', 'Hipertensão arterial', '2019-03-01', 'Acompanhamento na clínica da família'),
        (maria, 'allergy', 'Dipirona', '2015-06-10', 'Teve urticária e inchaço nos olhos'),
        (maria, 'surgery', 'Cesárea', '2012-08-20', NULL);

    INSERT INTO patient_medications (patient_id, name, dosage, frequency, started_on, notes)
        VALUES (maria, 'Losartana potássica', '50 mg', '1 vez ao dia (de manhã)', '2019-03-10', 'Uso contínuo');

    -- medições que ela anotou em casa
    INSERT INTO vital_signs (patient_id, recorded_by, recorded_at, systolic_bp, diastolic_bp, heart_rate, blood_glucose) VALUES
        (maria, maria, '2026-08-02 08:15-03', 132, 86, 78, NULL),
        (maria, maria, '2026-08-20 08:05-03', 138, 88, 80, NULL),
        (maria, maria, '2026-10-05 07:50-03', 126, 80, 74, NULL),
        (maria, maria, '2026-10-25 08:10-03', 124, 79, 72, 98);

    -- atendimento antigo, já finalizado
    INSERT INTO encounters (patient_id, status, created_at, description, symptoms, onset, pain_score, urgency_level,
                            priority, needs_human_review, doctor_id, completed_at)
        VALUES (maria, 'completed', '2026-09-12 10:20-03',
                'Dor de garganta forte há 3 dias, com febre e dificuldade para engolir',
                '["febre", "dor ao engolir"]', 'há 3 dias', 6, 'urgent', 3, false,
                ricardo, '2026-09-12 11:30-03')
        RETURNING id INTO enc;

    INSERT INTO classifications (encounter_id, stage, created_at, input, matched, symptom_urgency_id, urgency_level,
                                 confidence, needs_human_review, model)
        VALUES (enc, 'patient', '2026-09-12 10:20-03', '{"origem": "dados de exemplo"}', true, 'SYM-0023', 'urgent', 0.81, false, 'exemplo');

    -- primeira triagem
    INSERT INTO vital_signs (patient_id, encounter_id, recorded_by, recorded_at, systolic_bp, diastolic_bp, heart_rate,
                             respiratory_rate, temperature, oxygen_saturation, pain_score)
        VALUES (maria, enc, ana, '2026-09-12 10:48-03', 128, 82, 96, 18, 38.4, 97, 6)
        RETURNING id INTO vit;
    INSERT INTO classifications (encounter_id, stage, created_at, input, matched, symptom_urgency_id, urgency_level,
                                 confidence, needs_human_review, model)
        VALUES (enc, 'nursing', '2026-09-12 10:48-03', '{"origem": "dados de exemplo"}', true, 'SYM-0023', 'urgent', 0.86, false, 'exemplo')
        RETURNING id INTO cls;
    INSERT INTO triages (encounter_id, nurse_id, created_at, vital_signs_id, classification_id, urgency_level, notes)
        VALUES (enc, ana, '2026-09-12 10:48-03', vit, cls, 'urgent', 'Amígdalas com placas, sem dificuldade para respirar.');

    -- retriagem: a febre subiu enquanto ela esperava o médico
    INSERT INTO vital_signs (patient_id, encounter_id, recorded_by, recorded_at, systolic_bp, diastolic_bp, heart_rate,
                             respiratory_rate, temperature, oxygen_saturation, pain_score)
        VALUES (maria, enc, ana, '2026-09-12 11:10-03', 126, 80, 104, 20, 39.1, 97, 7)
        RETURNING id INTO vit;
    INSERT INTO classifications (encounter_id, stage, created_at, input, matched, symptom_urgency_id, urgency_level,
                                 confidence, needs_human_review, model)
        VALUES (enc, 'nursing', '2026-09-12 11:10-03', '{"origem": "dados de exemplo"}', true, 'SYM-0023', 'urgent', 0.79, false, 'exemplo')
        RETURNING id INTO cls;
    INSERT INTO triages (encounter_id, nurse_id, created_at, vital_signs_id, classification_id, urgency_level, notes)
        VALUES (enc, ana, '2026-09-12 11:10-03', vit, cls, 'urgent', 'Retriagem: febre subiu na sala de espera. Dada água e orientado repouso.');

    INSERT INTO prescriptions (encounter_id, patient_id, doctor_id, created_at, diagnosis, clinical_notes, recommendations)
        VALUES (enc, maria, ricardo, '2026-09-12 11:30-03', 'Faringoamigdalite bacteriana aguda',
                'Hiperemia e placas em amígdalas, linfonodos cervicais dolorosos. Alergia a dipirona.',
                'Repouso, beber bastante água e preferir alimentos frios e pastosos. Voltar se tiver falta de ar ou se a febre continuar depois de 48 horas de antibiótico.')
        RETURNING id INTO rx;

    INSERT INTO prescription_items (prescription_id, written_name, medication_id, match_method, dosage, frequency, duration, instructions)
        VALUES (rx, 'Amoxicilina 500 mg', 'MED-0004', 'name', '1 cápsula', 'de 8 em 8 horas', '7 dias', 'Tomar até o fim, mesmo se melhorar antes.')
        RETURNING id INTO amox;
    INSERT INTO prescription_items (prescription_id, written_name, medication_id, match_method, dosage, frequency, duration, instructions)
        VALUES (rx, 'Paracetamol 750 mg', 'MED-0080', 'name', '1 comprimido', 'de 6 em 6 horas, se febre ou dor', '3 dias', NULL)
        RETURNING id INTO paracet;

    INSERT INTO health_records (patient_id, category, description, started_on, ended_on, encounter_id)
        VALUES (maria, 'condition', 'Faringoamigdalite bacteriana aguda', '2026-09-12', '2026-09-18', enc);

    INSERT INTO patient_medications (patient_id, name, dosage, frequency, started_on, ended_on, prescription_item_id) VALUES
        (maria, 'Amoxicilina 500 mg', '1 cápsula', 'de 8 em 8 horas', '2026-09-12', '2026-09-18', amox),
        (maria, 'Paracetamol 750 mg', '1 comprimido', 'de 6 em 6 horas, se febre ou dor', '2026-09-12', '2026-09-14', paracet);
END $$;
