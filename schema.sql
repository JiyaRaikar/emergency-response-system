-- Emergency Response System — PostgreSQL schema
-- Run: psql -U postgres -d emergency_db -f schema.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions & types
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');
CREATE TYPE resource_status AS ENUM ('available', 'dispatched', 'en_route', 'on_scene', 'maintenance', 'offline');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE dispatch_status AS ENUM ('pending', 'acknowledged', 'completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE incidents (
    id              BIGSERIAL PRIMARY KEY,
    type            VARCHAR(100) NOT NULL,
    severity        incident_severity NOT NULL DEFAULT 'medium',
    location_zone   VARCHAR(50) NOT NULL,
    status          incident_status NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
    id              BIGSERIAL PRIMARY KEY,
    type            VARCHAR(100) NOT NULL,
    status          resource_status NOT NULL DEFAULT 'available',
    location_zone   VARCHAR(50) NOT NULL,
    fuel_level      SMALLINT NOT NULL DEFAULT 100
        CHECK (fuel_level >= 0 AND fuel_level <= 100)
);

CREATE TABLE personnel (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    role            VARCHAR(100) NOT NULL,
    resource_id     BIGINT REFERENCES resources (id) ON DELETE SET NULL
);

CREATE TABLE hospitals (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    zone                VARCHAR(50) NOT NULL,
    icu_beds            INTEGER NOT NULL CHECK (icu_beds >= 0),
    total_beds          INTEGER NOT NULL CHECK (total_beds >= icu_beds),
    current_occupancy   INTEGER NOT NULL DEFAULT 0
        CHECK (current_occupancy >= 0 AND current_occupancy <= total_beds)
);

CREATE TABLE shelters (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    zone                VARCHAR(50) NOT NULL,
    capacity            INTEGER NOT NULL CHECK (capacity > 0),
    current_occupancy   INTEGER NOT NULL DEFAULT 0
        CHECK (current_occupancy >= 0 AND current_occupancy <= capacity)
);

CREATE TABLE dispatch_logs (
    id              BIGSERIAL PRIMARY KEY,
    incident_id     BIGINT NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    resource_id     BIGINT NOT NULL REFERENCES resources (id) ON DELETE RESTRICT,
    operator_id     BIGINT NOT NULL REFERENCES personnel (id) ON DELETE RESTRICT,
    action          VARCHAR(200) NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          dispatch_status NOT NULL DEFAULT 'pending'
);

CREATE TABLE alerts (
    id              BIGSERIAL PRIMARY KEY,
    type            VARCHAR(100) NOT NULL,
    message         TEXT NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'warning',
    auto_generated  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes (severity & created_at)
-- ---------------------------------------------------------------------------

CREATE INDEX idx_incidents_severity ON incidents (severity);
CREATE INDEX idx_incidents_created_at ON incidents (created_at);

CREATE INDEX idx_alerts_severity ON alerts (severity);
CREATE INDEX idx_alerts_created_at ON alerts (created_at);

CREATE INDEX idx_dispatch_logs_timestamp ON dispatch_logs (timestamp);
CREATE INDEX idx_resources_status ON resources (status);
CREATE INDEX idx_resources_location_zone ON resources (location_zone);
CREATE INDEX idx_incidents_status ON incidents (status);
CREATE INDEX idx_shelters_zone ON shelters (zone);

-- ---------------------------------------------------------------------------
-- Triggers: incidents.updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_incidents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE PROCEDURE set_incidents_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: shelter occupancy > 90% → alert
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_shelter_occupancy_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_threshold NUMERIC;
    v_pct         NUMERIC;
BEGIN
    v_threshold := NEW.capacity * 0.9;

    IF NEW.current_occupancy > v_threshold THEN
        v_pct := ROUND((NEW.current_occupancy::NUMERIC / NEW.capacity) * 100, 1);

        INSERT INTO alerts (type, message, severity, auto_generated)
        VALUES (
            'shelter_capacity',
            format(
                'Shelter "%s" (zone %s) at %s%% occupancy (%s / %s beds).',
                NEW.name,
                NEW.zone,
                v_pct,
                NEW.current_occupancy,
                NEW.capacity
            ),
            CASE
                WHEN NEW.current_occupancy >= NEW.capacity THEN 'critical'::alert_severity
                ELSE 'warning'::alert_severity
            END,
            TRUE
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shelter_occupancy_alert
    AFTER INSERT OR UPDATE OF current_occupancy, capacity ON shelters
    FOR EACH ROW
    WHEN (NEW.current_occupancy > NEW.capacity * 0.9)
    EXECUTE PROCEDURE check_shelter_occupancy_alert();

-- ---------------------------------------------------------------------------
-- Stored procedure: dispatch_resource
-- ---------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE dispatch_resource(
    p_incident_id  BIGINT,
    p_resource_id  BIGINT,
    p_operator_id  BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_incident_status incident_status;
    v_resource_status resource_status;
    v_resource_zone   VARCHAR(50);
    v_incident_zone   VARCHAR(50);
BEGIN
    -- Lock rows to prevent concurrent double-dispatch
    SELECT status, location_zone
    INTO v_incident_status, v_incident_zone
    FROM incidents
    WHERE id = p_incident_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident % not found', p_incident_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_incident_status IN ('resolved', 'closed') THEN
        RAISE EXCEPTION 'Cannot dispatch to incident % (status: %)',
            p_incident_id, v_incident_status
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT status, location_zone
    INTO v_resource_status, v_resource_zone
    FROM resources
    WHERE id = p_resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resource % not found', p_resource_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_resource_status <> 'available' THEN
        RAISE EXCEPTION 'Resource % is not available (status: %)',
            p_resource_id, v_resource_status
            USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM personnel WHERE id = p_operator_id
    ) THEN
        RAISE EXCEPTION 'Operator (personnel) % not found', p_operator_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    UPDATE resources
    SET status = 'dispatched'
    WHERE id = p_resource_id;

    UPDATE incidents
    SET status = 'assigned'
    WHERE id = p_incident_id
      AND status = 'open';

    INSERT INTO dispatch_logs (
        incident_id,
        resource_id,
        operator_id,
        action,
        status
    ) VALUES (
        p_incident_id,
        p_resource_id,
        p_operator_id,
        format(
            'Dispatched resource %s from zone %s to incident %s (zone %s)',
            p_resource_id,
            v_resource_zone,
            p_incident_id,
            v_incident_zone
        ),
        'acknowledged'
    );
    -- Entire procedure runs in one transaction (atomic commit on success).
END;
$$;

-- ---------------------------------------------------------------------------
-- Seed data (5 rows per entity)
-- ---------------------------------------------------------------------------

INSERT INTO incidents (type, severity, location_zone, status, created_at) VALUES
    ('wildfire', 'critical', 'north', 'open', NOW() - INTERVAL '2 hours'),
    ('flood', 'high', 'east', 'assigned', NOW() - INTERVAL '5 hours'),
    ('earthquake', 'critical', 'central', 'in_progress', NOW() - INTERVAL '1 day'),
    ('chemical_spill', 'high', 'south', 'open', NOW() - INTERVAL '30 minutes'),
    ('power_outage', 'medium', 'west', 'resolved', NOW() - INTERVAL '3 days');

INSERT INTO resources (type, status, location_zone, fuel_level) VALUES
    ('ambulance', 'available', 'north', 85),
    ('fire_truck', 'available', 'east', 70),
    ('helicopter', 'available', 'central', 95),
    ('rescue_boat', 'dispatched', 'south', 60),
    ('supply_van', 'maintenance', 'west', 40);

INSERT INTO personnel (name, role, resource_id) VALUES
    ('Alex Rivera', 'paramedic', 1),
    ('Jordan Lee', 'firefighter', 2),
    ('Sam Chen', 'pilot', 3),
    ('Morgan Blake', 'boat_captain', 4),
    ('Taylor Kim', 'dispatcher', NULL);

INSERT INTO hospitals (name, zone, icu_beds, total_beds, current_occupancy) VALUES
    ('Metro General', 'central', 40, 300, 245),
    ('Northside Medical', 'north', 20, 150, 120),
    ('East Bay Hospital', 'east', 15, 120, 98),
    ('South Coast Care', 'south', 25, 200, 175),
    ('West Hills Clinic', 'west', 10, 80, 55);

INSERT INTO shelters (name, zone, capacity, current_occupancy) VALUES
    ('North Community Center', 'north', 200, 150),
    ('East High School Gym', 'east', 500, 400),
    ('Central Arena', 'central', 1000, 850),
    ('South Baptist Hall', 'south', 150, 80),
    ('West Recreation Center', 'west', 300, 250);
-- Trigger demo: UPDATE shelters SET current_occupancy = 460 WHERE id = 2;

INSERT INTO alerts (type, message, severity, auto_generated, created_at) VALUES
    ('weather', 'High wind advisory for northern zones.', 'warning', FALSE, NOW() - INTERVAL '6 hours'),
    ('traffic', 'Highway 101 closed between exits 12–18.', 'info', FALSE, NOW() - INTERVAL '3 hours'),
    ('hospital', 'Metro General ICU at 95% capacity.', 'critical', FALSE, NOW() - INTERVAL '1 hour'),
    ('resource', 'Supply van #5 scheduled for maintenance.', 'info', TRUE, NOW() - INTERVAL '12 hours'),
    ('incident', 'New chemical spill reported in south zone.', 'critical', FALSE, NOW() - INTERVAL '25 minutes');

INSERT INTO dispatch_logs (incident_id, resource_id, operator_id, action, timestamp, status) VALUES
    (2, 4, 5, 'Manual dispatch: rescue boat to flood incident', NOW() - INTERVAL '4 hours', 'completed'),
    (3, 3, 3, 'Helicopter en route to earthquake zone', NOW() - INTERVAL '20 hours', 'acknowledged'),
    (1, 1, 1, 'Ambulance staged for wildfire perimeter', NOW() - INTERVAL '1 hour', 'pending'),
    (4, 2, 2, 'Fire truck requested for chemical spill', NOW() - INTERVAL '15 minutes', 'pending'),
    (2, 4, 4, 'Boat returned to base after flood assist', NOW() - INTERVAL '2 hours', 'completed');

-- Example: CALL dispatch_resource(1, 2, 5);  -- dispatch fire_truck to wildfire

COMMIT;
