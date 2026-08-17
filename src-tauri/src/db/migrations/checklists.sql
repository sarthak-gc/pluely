-- Checklists a user defines once and reuses across calls.
CREATE TABLE IF NOT EXISTS checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  -- JSON array of strings. Kept as text so the whole checklist round-trips in
  -- one row; item order is the display order.
  items TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checklists_updated_at
  ON checklists (updated_at DESC);

-- One row per call. The audio lives on disk; this row points at it so a
-- recording is never orphaned from the checklist it belongs to.
CREATE TABLE IF NOT EXISTS call_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER,
  -- Denormalised so a session still reads correctly after its checklist is
  -- renamed or deleted.
  checklist_name TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  audio_file TEXT,
  -- JSON: [{ "label": ..., "done": bool, "evidence": ... }]
  results TEXT,
  FOREIGN KEY (checklist_id) REFERENCES checklists (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at
  ON call_sessions (started_at DESC);
