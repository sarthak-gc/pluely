-- JSON: [{ "speaker": "me" | "them", "text": ..., "at": <epoch ms> }]
-- Nullable because sessions recorded before this column existed have no
-- transcript to backfill.
ALTER TABLE call_sessions ADD COLUMN transcript TEXT;
