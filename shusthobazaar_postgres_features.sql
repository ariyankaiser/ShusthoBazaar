-- ============================================================================
-- ShusthoBazaar: PostgreSQL Feature Extension & Operational Script
-- Features:
--   1. Doctor Profile, Credential Verification (BMDC, Degree) & Availability (inc. After-Hours)
--   2. Distance-Based Delivery Fee Calculation & Delivery Progress Tracking
-- Compatible with: PostgreSQL 14+ / 15+ / 16+
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ENUMS AND EXTENSIONS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE delivery_status AS ENUM ('pending', 'confirmed', 'packaging', 'out_for_delivery', 'delivered', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slot_period') THEN
        CREATE TYPE slot_period AS ENUM ('morning', 'afternoon', 'evening', 'night', 'after_hours');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. FEATURE 1: DOCTORS, CREDENTIALS & AVAILABILITY TABLES
-- ----------------------------------------------------------------------------

-- Ensure Doctor role exists
INSERT INTO roles (name)
VALUES ('doctor')
ON CONFLICT (name) DO NOTHING;

-- Enhanced Doctors table (BMDC reg no, degrees, experience, verification status)
CREATE TABLE IF NOT EXISTS doctors (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name        VARCHAR(150) NOT NULL,
    email            VARCHAR(255) NOT NULL UNIQUE,
    phone            VARCHAR(30),
    degree           VARCHAR(200) NOT NULL DEFAULT 'MBBS',
    specialty        VARCHAR(120) NOT NULL DEFAULT 'General Medicine',
    bmdc_reg_no      VARCHAR(50)  NOT NULL UNIQUE,
    experience_years INT          NOT NULL DEFAULT 1 CHECK (experience_years >= 0),
    bio              TEXT,
    consultation_fee NUMERIC(8,2) NOT NULL DEFAULT 500.00 CHECK (consultation_fee >= 0),
    status           verification_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by      BIGINT REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(status);
CREATE INDEX IF NOT EXISTS idx_doctors_bmdc ON doctors(bmdc_reg_no);

-- Doctor Documents (Degree certificates, BMDC licenses)
CREATE TABLE IF NOT EXISTS doctor_documents (
    id          BIGSERIAL PRIMARY KEY,
    doctor_id   BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    doc_type    VARCHAR(60) NOT NULL, -- e.g. 'BMDC Certificate', 'MBBS Degree', 'Specialist Certificate'
    document_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Doctor Availability (weekly recurring slots, explicitly supporting after_hours)
CREATE TABLE IF NOT EXISTS doctor_availability (
    id         BIGSERIAL PRIMARY KEY,
    doctor_id  BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    weekday    SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
    period     slot_period NOT NULL,                             -- morning, afternoon, evening, after_hours
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time),
    UNIQUE (doctor_id, weekday, start_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_avail_weekday ON doctor_availability(doctor_id, weekday, period);

-- ----------------------------------------------------------------------------
-- 3. FEATURE 2: DISTANCE-BASED DELIVERY FEE & DELIVERY TRACKING
-- ----------------------------------------------------------------------------

-- Tiered delivery fee rules
CREATE TABLE IF NOT EXISTS delivery_fee_rules (
    id         SERIAL PRIMARY KEY,
    min_km     NUMERIC(6,2) NOT NULL CHECK (min_km >= 0),
    max_km     NUMERIC(6,2) NOT NULL,
    base_fee   NUMERIC(8,2) NOT NULL CHECK (base_fee >= 0),
    per_km_fee NUMERIC(8,2) NOT NULL DEFAULT 0.00 CHECK (per_km_fee >= 0),
    CHECK (max_km > min_km)
);

-- Deliveries table tracking order delivery progress
CREATE TABLE IF NOT EXISTS deliveries (
    id             BIGSERIAL PRIMARY KEY,
    order_id       BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    seller_id      BIGINT NOT NULL REFERENCES sellers(id),
    customer_id    BIGINT NOT NULL REFERENCES users(id),
    distance_km    NUMERIC(6,2) NOT NULL CHECK (distance_km >= 0),
    fee            NUMERIC(8,2) NOT NULL CHECK (fee >= 0),
    status         delivery_status NOT NULL DEFAULT 'pending',
    rider_name     VARCHAR(100),
    rider_phone    VARCHAR(30),
    tracking_notes TEXT,
    dispatched_at  TIMESTAMPTZ,
    delivered_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_seller_status ON deliveries(seller_id, status);

-- ----------------------------------------------------------------------------
-- 4. POSTGRESQL STORED FUNCTIONS
-- ----------------------------------------------------------------------------

-- Function 1: Haversine distance calculation in kilometers between two lat/lon pairs
CREATE OR REPLACE FUNCTION calculate_haversine_distance_km(
    lat1 NUMERIC,
    lon1 NUMERIC,
    lat2 NUMERIC,
    lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    r NUMERIC := 6371.0; -- Earth radius in km
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
    rad_lat1 NUMERIC;
    rad_lat2 NUMERIC;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 3.50; -- Default sensible urban distance
    END IF;

    rad_lat1 := radians(lat1);
    rad_lat2 := radians(lat2);
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    a := sin(dlat / 2)^2 + cos(rad_lat1) * cos(rad_lat2) * sin(dlon / 2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));

    RETURN round((r * c)::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function 2: Compute delivery fee from seller to address based on distance
CREATE OR REPLACE FUNCTION calculate_delivery_fee(
    p_seller_id BIGINT,
    p_address_id BIGINT
) RETURNS TABLE(distance_km NUMERIC, delivery_fee NUMERIC) AS $$
DECLARE
    s_lat NUMERIC;
    s_lon NUMERIC;
    a_lat NUMERIC;
    a_lon NUMERIC;
    computed_distance NUMERIC;
    computed_fee NUMERIC;
BEGIN
    SELECT latitude, longitude INTO s_lat, s_lon FROM sellers WHERE id = p_seller_id;
    SELECT latitude, longitude INTO a_lat, a_lon FROM addresses WHERE id = p_address_id;

    computed_distance := calculate_haversine_distance_km(s_lat, s_lon, a_lat, a_lon);

    -- Base fee ৳40 for up to 2 km; +৳15 per additional km
    IF computed_distance <= 2.0 THEN
        computed_fee := 40.00;
    ELSE
        computed_fee := 40.00 + round((computed_distance - 2.0) * 15.00, 2);
    END IF;

    RETURN QUERY SELECT computed_distance, computed_fee;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 3: Admin verifies or rejects a doctor's credentials
CREATE OR REPLACE FUNCTION admin_verify_doctor(
    p_doctor_id BIGINT,
    p_admin_user_id BIGINT,
    p_status verification_status,
    p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    IF p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Status must be approved or rejected';
    END IF;

    UPDATE doctors
    SET status = p_status,
        rejection_reason = CASE WHEN p_status = 'rejected' THEN COALESCE(p_reason, 'Invalid BMDC registration credentials') ELSE NULL END,
        reviewed_by = p_admin_user_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_doctor_id;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Pharmacy staff updates delivery progress
CREATE OR REPLACE FUNCTION update_delivery_progress(
    p_order_id BIGINT,
    p_seller_id BIGINT,
    p_status delivery_status,
    p_rider_name VARCHAR(100) DEFAULT NULL,
    p_rider_phone VARCHAR(30) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_dispatched_at TIMESTAMPTZ := NULL;
    v_delivered_at TIMESTAMPTZ := NULL;
BEGIN
    IF p_status = 'out_for_delivery' THEN
        v_dispatched_at := now();
    ELSIF p_status = 'delivered' THEN
        v_delivered_at := now();
    END IF;

    UPDATE deliveries
    SET status = p_status,
        rider_name = COALESCE(p_rider_name, rider_name),
        rider_phone = COALESCE(p_rider_phone, rider_phone),
        tracking_notes = COALESCE(p_notes, tracking_notes),
        dispatched_at = COALESCE(v_dispatched_at, dispatched_at),
        delivered_at = COALESCE(v_delivered_at, delivered_at),
        updated_at = now()
    WHERE order_id = p_order_id AND seller_id = p_seller_id;

    -- Synchronize with orders status
    IF p_status IN ('out_for_delivery', 'delivered', 'cancelled') THEN
        UPDATE orders
        SET status = p_status::TEXT::order_status
        WHERE id = p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. SEED DATA (POSTGRESQL)
-- ----------------------------------------------------------------------------

-- Seed delivery rules:
INSERT INTO delivery_fee_rules (min_km, max_km, base_fee, per_km_fee)
VALUES
    (0.00, 2.00, 40.00, 0.00),
    (2.01, 5.00, 40.00, 15.00),
    (5.01, 15.00, 85.00, 12.00),
    (15.01, 50.00, 205.00, 10.00)
ON CONFLICT DO NOTHING;

-- Seed verified and pending doctors
INSERT INTO doctors (id, full_name, email, phone, degree, specialty, bmdc_reg_no, experience_years, bio, consultation_fee, status)
VALUES
    (1, 'Dr. Farhana Rahman', 'dr.farhana@shusthobazaar.demo', '01911000001', 'MBBS, FCPS (Internal Medicine)', 'Internal Medicine', 'BMDC-A-54321', 8, 'Senior Consultant with 8+ years specializing in chronic care & diabetes management.', 600.00, 'approved'),
    (2, 'Dr. Tanvir Ahmed',   'dr.tanvir@shusthobazaar.demo',  '01911000002', 'MBBS, MD (Cardiology)',         'Cardiology',        'BMDC-A-98765', 10, 'Cardiologist at National Heart Foundation; active in telemedicine.', 800.00, 'pending'),
    (3, 'Dr. Nusrat Jahan',   'dr.nusrat@shusthobazaar.demo',  '01911000003', 'MBBS, DCH (Pediatrics)',       'Pediatrics',        'BMDC-A-33421', 5, 'Pediatric specialist providing emergency night and after-hours consultations.', 500.00, 'approved')
ON CONFLICT (email) DO UPDATE SET
    degree = EXCLUDED.degree,
    bmdc_reg_no = EXCLUDED.bmdc_reg_no,
    status = EXCLUDED.status;

-- Seed Doctor Availability slots (Morning, Evening, and After-Hours!)
INSERT INTO doctor_availability (doctor_id, weekday, period, start_time, end_time, is_active)
VALUES
    -- Dr. Farhana (Weekdays Morning & Evening)
    (1, 0, 'morning',     '09:00', '12:00', TRUE),
    (1, 1, 'morning',     '09:00', '12:00', TRUE),
    (1, 2, 'evening',     '18:00', '21:00', TRUE),
    (1, 3, 'after_hours', '21:30', '23:30', TRUE), -- After-hours telemedicine slot

    -- Dr. Nusrat Jahan (Specialized in After-Hours & Emergency Pediatric calls)
    (3, 1, 'after_hours', '22:00', '02:00', TRUE), -- Night / After-hours
    (3, 3, 'after_hours', '22:00', '02:00', TRUE), -- Night / After-hours
    (3, 5, 'evening',     '17:00', '21:00', TRUE)
ON CONFLICT (doctor_id, weekday, start_time) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION & DEMO QUERIES FOR PRESENTATION / EVALUATION
-- ============================================================================

-- Query 1: Doctor registering or updating credentials
-- SELECT id, full_name, bmdc_reg_no, degree, specialty, status FROM doctors;

-- Query 2: Doctor setting and listing available time slots (including After-Hours)
-- SELECT d.full_name, a.weekday, a.period, a.start_time, a.end_time
-- FROM doctor_availability a
-- JOIN doctors d ON d.id = a.doctor_id
-- WHERE a.period = 'after_hours';

-- Query 3: Admin reviewing and approving Doctor BMDC credentials
-- SELECT admin_verify_doctor(2, 1, 'approved');

-- Query 4: Calculate distance-based delivery fee for order
-- SELECT * FROM calculate_delivery_fee(1, 1);

-- Query 5: Pharmacy staff updating delivery progress
-- SELECT update_delivery_progress(1, 1, 'out_for_delivery', 'Rider Kabir', '01711223344', 'Parcel handed to Pathao rider');
