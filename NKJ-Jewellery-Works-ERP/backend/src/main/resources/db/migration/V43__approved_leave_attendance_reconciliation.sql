-- Approved leave is the source of truth for locked ABSENT attendance.
-- Existing attendance is snapshotted before reconciliation so cancellation can
-- restore a prior manual record. Existing records are never silently discarded.

ALTER TABLE staff_attendance
  ADD COLUMN IF NOT EXISTS attendance_source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS leave_id BIGINT REFERENCES staff_leaves(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS previous_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS previous_check_in TIME,
  ADD COLUMN IF NOT EXISTS previous_check_out TIME,
  ADD COLUMN IF NOT EXISTS previous_working_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS previous_remarks TEXT;

ALTER TABLE staff_leaves
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

UPDATE staff_leaves
   SET approved_at = COALESCE(approved_at, created_at)
 WHERE UPPER(status) = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_staff_attendance_leave_id
  ON staff_attendance(leave_id) WHERE leave_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date_source
  ON staff_attendance(staff_id, attendance_date, attendance_source);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff_dates_status
  ON staff_leaves(staff_id, from_date, to_date, status);

-- If historical approved leave overlaps an existing manual attendance row,
-- preserve the original values and create an audit event before relying on the
-- leave-generated absence. The earliest approved leave ID is deterministic.
WITH approved_leave_days AS (
    SELECT DISTINCT ON (l.staff_id, day_value::DATE)
           l.id AS leave_id, l.staff_id, day_value::DATE AS attendance_date,
           l.leave_type, l.from_date, l.to_date
      FROM staff_leaves l
      CROSS JOIN LATERAL generate_series(l.from_date::TIMESTAMP, l.to_date::TIMESTAMP, INTERVAL '1 day') day_value
     WHERE UPPER(l.status) = 'APPROVED'
     ORDER BY l.staff_id, day_value::DATE, l.id
), reconciled AS (
    UPDATE staff_attendance a
       SET previous_status = CASE WHEN a.leave_id IS NULL THEN a.status ELSE a.previous_status END,
           previous_check_in = CASE WHEN a.leave_id IS NULL THEN a.check_in ELSE a.previous_check_in END,
           previous_check_out = CASE WHEN a.leave_id IS NULL THEN a.check_out ELSE a.previous_check_out END,
           previous_working_hours = CASE WHEN a.leave_id IS NULL THEN a.working_hours ELSE a.previous_working_hours END,
           previous_remarks = CASE WHEN a.leave_id IS NULL THEN a.remarks ELSE a.previous_remarks END,
           status = 'ABSENT',
           check_in = NULL,
           check_out = NULL,
           working_hours = 0,
           remarks = 'Automatically marked Absent – Approved Leave',
           attendance_source = 'APPROVED_LEAVE',
           leave_id = d.leave_id,
           is_system_generated = TRUE,
           is_locked = TRUE
      FROM approved_leave_days d
     WHERE a.staff_id = d.staff_id
       AND a.attendance_date = d.attendance_date
       AND a.attendance_source <> 'APPROVED_LEAVE'
 RETURNING a.id, a.staff_id, a.attendance_date, a.previous_status,
           a.previous_check_in, a.previous_check_out, a.previous_working_hours,
           a.previous_remarks, a.leave_id
)
INSERT INTO audit_logs(actor_identity, action, module, record_id, previous_value, new_value, ip_address)
SELECT 'SYSTEM_MIGRATION', 'APPROVED_LEAVE_ATTENDANCE_RECONCILED', 'attendance', id::TEXT,
       jsonb_build_object(
         'status', previous_status, 'checkIn', previous_check_in,
         'checkOut', previous_check_out, 'workingHours', previous_working_hours,
         'remarks', previous_remarks
       ),
       jsonb_build_object(
         'status', 'ABSENT', 'attendanceSource', 'APPROVED_LEAVE',
         'leaveId', leave_id, 'locked', TRUE
       ),
       'database-migration'
  FROM reconciled;

-- Fill approved leave dates that do not have any attendance yet. DISTINCT ON
-- plus the existing unique(staff_id, attendance_date) constraint prevents
-- overlaps or duplicate generated rows.
WITH approved_leave_days AS (
    SELECT DISTINCT ON (l.staff_id, day_value::DATE)
           l.id AS leave_id, l.staff_id, day_value::DATE AS attendance_date
      FROM staff_leaves l
      CROSS JOIN LATERAL generate_series(l.from_date::TIMESTAMP, l.to_date::TIMESTAMP, INTERVAL '1 day') day_value
     WHERE UPPER(l.status) = 'APPROVED'
     ORDER BY l.staff_id, day_value::DATE, l.id
), inserted AS (
    INSERT INTO staff_attendance(
        staff_id, attendance_date, status, working_hours, remarks,
        attendance_source, leave_id, is_system_generated, is_locked
    )
    SELECT staff_id, attendance_date, 'ABSENT', 0,
           'Automatically marked Absent – Approved Leave',
           'APPROVED_LEAVE', leave_id, TRUE, TRUE
      FROM approved_leave_days
    ON CONFLICT (staff_id, attendance_date) DO NOTHING
    RETURNING id, staff_id, attendance_date, leave_id
)
INSERT INTO audit_logs(actor_identity, action, module, record_id, previous_value, new_value, ip_address)
SELECT 'SYSTEM_MIGRATION', 'APPROVED_LEAVE_ATTENDANCE_CREATED', 'attendance', id::TEXT,
       NULL,
       jsonb_build_object(
         'staffId', staff_id, 'attendanceDate', attendance_date,
         'status', 'ABSENT', 'attendanceSource', 'APPROVED_LEAVE',
         'leaveId', leave_id, 'locked', TRUE
       ),
       'database-migration'
  FROM inserted;
