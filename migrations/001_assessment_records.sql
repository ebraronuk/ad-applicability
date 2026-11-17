-- Assessment records.
--
-- Why a database at all, when the corpus and the fleet are committed files:
-- those are read-only reference snapshots. An assessment is different. It is a
-- decision someone has to defend later, so it needs to be queryable and it
-- needs to survive the code that produced it. The parser version on each run is
-- the point: "what did we conclude about this directive, on this date, under
-- which grammar" is the question an audit actually asks.
--
-- Constraints live here rather than only in application code, because the
-- application will eventually contain a path that skips a validation and the
-- database will not.

BEGIN;

CREATE TYPE verdict AS ENUM ('applies', 'does_not_apply', 'undetermined');

CREATE TABLE directive (
    document_number  text PRIMARY KEY,
    title            text        NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
    publication_date date        NOT NULL,
    source_url       text        NOT NULL CHECK (source_url LIKE 'https://%'),
    applicability    text        NOT NULL CHECK (length(applicability) > 0),
    ingested_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aircraft (
    registration     text PRIMARY KEY CHECK (registration ~ '^[A-Z0-9-]{3,12}$'),
    manufacturer     text NOT NULL CHECK (length(manufacturer) > 0),
    model            text NOT NULL CHECK (length(model) > 0),
    serial_number    text NOT NULL CHECK (length(serial_number) > 0),
    type_designator  text
);

-- One evaluation of one directive against the fleet, at a point in time.
CREATE TABLE assessment_run (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_number text        NOT NULL REFERENCES directive ON DELETE CASCADE,
    run_at          timestamptz NOT NULL DEFAULT now(),
    -- The grammar that produced this run. Without it a stored verdict cannot be
    -- reproduced or explained after the parser changes.
    parser_version  text        NOT NULL CHECK (parser_version ~ '^\d+\.\d+\.\d+$'),
    -- Null when the clause could not be parsed at all, which is a real outcome
    -- and distinct from an empty result.
    parsed_clause   jsonb
);

CREATE INDEX assessment_run_directive_idx ON assessment_run (document_number, run_at DESC);

CREATE TABLE assessment (
    run_id       bigint   NOT NULL REFERENCES assessment_run ON DELETE CASCADE,
    registration text     NOT NULL REFERENCES aircraft ON DELETE CASCADE,
    verdict      verdict  NOT NULL,
    -- Why the engine concluded this. Required for a definite verdict, because a
    -- verdict a planner cannot trace back to a criterion is not actionable.
    reasoning    text[]   NOT NULL DEFAULT '{}',
    -- What the engine lacked. Required for an undetermined verdict, for the
    -- same reason in reverse.
    missing      jsonb    NOT NULL DEFAULT '[]',
    PRIMARY KEY (run_id, registration),
    CONSTRAINT definite_verdict_has_reasoning
        CHECK (verdict = 'undetermined' OR cardinality(reasoning) > 0),
    CONSTRAINT undetermined_names_what_is_missing
        CHECK (verdict <> 'undetermined' OR jsonb_array_length(missing) > 0)
);

CREATE INDEX assessment_affected_idx ON assessment (run_id, verdict) WHERE verdict <> 'does_not_apply';

COMMIT;
