-- O Postgres só roda este arquivo na primeira vez que o container sobe (volume vazio).
-- Para recriar do zero: docker compose down -v && docker compose up

-- As duas bases de conhecimento do JEV (explicação em docs/04-database.md).
-- Campo com vários valores fica separado por "|". Dá para virar lista com string_to_array(coluna, '|').

CREATE TABLE symptom_urgency (
    id                   varchar(12)  PRIMARY KEY,   
    main_symptom         text         NOT NULL,
    associated_symptoms  text,
    description          text         NOT NULL,
    warning_signs        text,
    aggravating_factors  text,
    risk_groups          text,
    age_groups           text         NOT NULL,
    urgency_level        varchar(30)  NOT NULL CHECK (urgency_level IN
                             ('emergency', 'very_urgent', 'urgent', 'less_urgent', 'guided_self_care')),
    priority             smallint     NOT NULL CHECK (priority BETWEEN 1 AND 5),  
    guidance             text         NOT NULL,
    care_timeframe       text         NOT NULL,
    clinical_rationale   text         NOT NULL,
    source               text         NOT NULL,
    source_url           text         NOT NULL,
    reference_date       date         NOT NULL       
);

CREATE TABLE medications (
    id                       varchar(12)  PRIMARY KEY,   
    name                     text         NOT NULL,
    active_ingredient        text         NOT NULL,
    brand_names              text,
    pharmacological_class    text         NOT NULL,
    therapeutic_indications  text         NOT NULL,
    related_conditions       text         NOT NULL,
    indication_description   text         NOT NULL,
    mechanism_of_action      text,
    dosage_form              text         NOT NULL,
    administration_routes    text         NOT NULL,
    contraindications        text,
    warnings                 text,
    age_range                text,
    leaflet_source           text         NOT NULL,
    source_url               text         NOT NULL,
    reference_date           date         NOT NULL
);

-- Daqui pra baixo são as tabelas do atendimento (não vêm de CSV, a API vai preenchendo com o uso).
-- Fluxo: paciente descreve os sintomas -> enfermagem completa com sinais vitais -> médico faz diagnóstico e receita.

-- Pacientes e equipe ficam na mesma tabela, o que muda é o perfil (role).
-- A senha das contas de demonstração não fica aqui, é o AUTH_DEMO_PASSWORD do front.
CREATE TABLE users (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text         NOT NULL,
    email       text         NOT NULL UNIQUE,
    role        varchar(20)  NOT NULL CHECK (role IN
                    ('PACIENTE', 'RECEPCIONISTA', 'ENFERMEIRO', 'MEDICO', 'AUDITOR', 'GESTOR_CLINICO')),
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE patients (
    user_id     bigint      PRIMARY KEY REFERENCES users (id),
    birth_date  date        NOT NULL,
    sex         varchar(5)  CHECK (sex IN ('F', 'M', 'other')),
    blood_type  varchar(3),
    phone       text
);

CREATE TABLE encounters (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id          bigint       NOT NULL REFERENCES patients (user_id),
    status              varchar(20)  NOT NULL DEFAULT 'waiting_nurse'
                            CHECK (status IN ('waiting_nurse', 'waiting_doctor', 'completed')),
    created_at          timestamptz  NOT NULL DEFAULT now(),
    -- o que o próprio paciente informou
    description         text         NOT NULL,
    symptoms            jsonb        NOT NULL DEFAULT '[]',
    onset               text,
    pain_score          smallint     CHECK (pain_score BETWEEN 0 AND 10),
    pregnant            boolean      NOT NULL DEFAULT false,
    -- nível atual: começa com o da pré-análise e depois vira o da última triagem. É o que ordena a fila
    urgency_level       varchar(30)  CHECK (urgency_level IN
                            ('emergency', 'very_urgent', 'urgent', 'less_urgent', 'guided_self_care')),
    priority            smallint     CHECK (priority BETWEEN 1 AND 5),
    needs_human_review  boolean      NOT NULL DEFAULT true,
    -- médico (as triagens da enfermagem ficam na tabela triages, porque podem ser várias)
    doctor_id           bigint       REFERENCES users (id),
    completed_at        timestamptz
);
CREATE INDEX encounters_status_idx ON encounters (status);
CREATE INDEX encounters_patient_idx ON encounters (patient_id);

-- Cada vez que o JEV classifica um atendimento fica uma linha aqui: uma na pré-análise do paciente e
-- uma em cada triagem da enfermagem. Assim dá para comparar todas depois.
CREATE TABLE classifications (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_id        bigint           NOT NULL REFERENCES encounters (id),
    stage               varchar(10)      NOT NULL CHECK (stage IN ('patient', 'nursing')),
    created_at          timestamptz      NOT NULL DEFAULT now(),
    input               jsonb            NOT NULL,
    matched             boolean          NOT NULL,
    symptom_urgency_id  varchar(12)      REFERENCES symptom_urgency (id),
    urgency_level       varchar(30),
    escalated           boolean          NOT NULL DEFAULT false,
    confidence          double precision,
    probabilities       jsonb,
    needs_human_review  boolean          NOT NULL,
    model               varchar(50)
);

-- Sinais vitais medidos no hospital (encounter_id preenchido) ou anotados pelo paciente em casa.
CREATE TABLE vital_signs (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id         bigint       NOT NULL REFERENCES patients (user_id),
    encounter_id       bigint       REFERENCES encounters (id),
    recorded_by        bigint       NOT NULL REFERENCES users (id),
    recorded_at        timestamptz  NOT NULL DEFAULT now(),
    systolic_bp        smallint,
    diastolic_bp       smallint,
    heart_rate         smallint,
    respiratory_rate   smallint,
    temperature        double precision,
    oxygen_saturation  smallint,
    blood_glucose      smallint,     -- glicemia capilar (mg/dL)
    pain_score         smallint      CHECK (pain_score BETWEEN 0 AND 10)
);
CREATE INDEX vital_signs_patient_idx ON vital_signs (patient_id, recorded_at);

-- Triagens da enfermagem. Enquanto o paciente não passou pelo médico dá para refazer a triagem
-- (ex.: piorou na espera); cada uma vira uma linha nova e as anteriores não são alteradas.
CREATE TABLE triages (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_id       bigint       NOT NULL REFERENCES encounters (id),
    nurse_id           bigint       NOT NULL REFERENCES users (id),
    created_at         timestamptz  NOT NULL DEFAULT now(),
    vital_signs_id     bigint       NOT NULL REFERENCES vital_signs (id),
    classification_id  bigint       NOT NULL REFERENCES classifications (id),
    -- nível que valeu nessa triagem: o do JEV ou o que a enfermagem escolheu
    urgency_level      varchar(30)  CHECK (urgency_level IN
                           ('emergency', 'very_urgent', 'urgent', 'less_urgent', 'guided_self_care')),
    override_reason    text,        -- preenchido quando a enfermagem muda o nível sugerido
    notes              text
);
CREATE INDEX triages_encounter_idx ON triages (encounter_id);

-- Receituário: um por atendimento, ligado ao paciente e ao médico.
CREATE TABLE prescriptions (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_id     bigint       NOT NULL UNIQUE REFERENCES encounters (id),
    patient_id       bigint       NOT NULL REFERENCES patients (user_id),
    doctor_id        bigint       NOT NULL REFERENCES users (id),
    created_at       timestamptz  NOT NULL DEFAULT now(),
    diagnosis        text         NOT NULL,
    clinical_notes   text,
    recommendations  text
);

-- Cada remédio da receita. written_name é como o médico escreveu; medication_id é o que achamos na
-- base de bulas (pelo nome ou pelo JEV). Se não achou fica nulo e o paciente vê só o que foi escrito.
CREATE TABLE prescription_items (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_id  bigint       NOT NULL REFERENCES prescriptions (id),
    written_name     text         NOT NULL,
    medication_id    varchar(12)  REFERENCES medications (id),
    match_method     varchar(10)  NOT NULL CHECK (match_method IN ('name', 'jev', 'none')),
    dosage           text,
    frequency        text,
    duration         text,
    instructions     text
);

-- Histórico de saúde do paciente: doenças, alergias e cirurgias.
CREATE TABLE health_records (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id    bigint       NOT NULL REFERENCES patients (user_id),
    category      varchar(20)  NOT NULL CHECK (category IN ('condition', 'allergy', 'surgery')),
    description   text         NOT NULL,
    started_on    date,
    ended_on      date,
    notes         text,
    encounter_id  bigint       REFERENCES encounters (id),   -- quando veio de um diagnóstico
    created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Remédios que o paciente toma ou já tomou, com o intervalo entre as doses e o período.
CREATE TABLE patient_medications (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id            bigint       NOT NULL REFERENCES patients (user_id),
    name                  text         NOT NULL,
    dosage                text,
    frequency             text,
    started_on            date,
    ended_on              date,
    notes                 text,
    prescription_item_id  bigint       REFERENCES prescription_items (id),   -- quando veio de uma receita
    created_at            timestamptz  NOT NULL DEFAULT now()
);
