-- Prescription upload and pharmacy verification.
-- Idempotent: runs on every start so databases created before this feature are upgraded.

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_customer ON prescriptions(customer_id);

-- One active prescription per seller order. Each pharmacy reviews the prescription
-- for its own order, so a multi-vendor checkout gets one review per pharmacy.
CREATE TABLE IF NOT EXISTS order_prescriptions (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_prescriptions_status ON order_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_order_prescriptions_prescription ON order_prescriptions(prescription_id);
