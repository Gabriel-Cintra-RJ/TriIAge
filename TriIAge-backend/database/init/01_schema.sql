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

-- Aqui a API vai guardando cada triagem feita (essa tabela não vem de CSV).
CREATE TABLE triages (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
