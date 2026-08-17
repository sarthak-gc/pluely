import { getDatabase } from "./config";

export interface Checklist {
  id: number;
  name: string;
  items: string[];
  updated_at: string;
}

export interface CallSessionRow {
  id: number;
  checklist_name: string;
  started_at: string;
  ended_at: string | null;
  audio_file: string | null;
  results: string | null;
  transcript: string | null;
}

export interface SessionTranscriptEntry {
  speaker: "me" | "them";
  text: string;
  at: number;
}

export interface SessionResult {
  label: string;
  done: boolean;
  evidence?: string;
  /** The value captured for this item, when it asked for one. */
  answer?: string;
  // Offset into the session's audio file where the evidence was spoken.
  atMs?: number;
  /** True when the verdict was set by hand during the call. */
  manual?: boolean;
}

interface ChecklistDbRow {
  id: number;
  name: string;
  items: string;
  updated_at: string;
}

// Items are stored as a JSON array in one column; a malformed row should not
// break the whole list, so parsing degrades to an empty checklist.
const parseItems = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((i): i is string => typeof i === "string")
      : [];
  } catch {
    return [];
  }
};

// Accepts the "- item" format the editor uses, but tolerates bare lines,
// asterisks and numbered lists so pasted text mostly just works.
export const parseChecklistText = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim().replace(/^([-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

export const formatChecklistText = (items: string[]): string =>
  items.map((i) => `- ${i}`).join("\n");

export const getAllChecklists = async (): Promise<Checklist[]> => {
  const db = await getDatabase();
  const rows = await db.select<ChecklistDbRow[]>(
    "SELECT id, name, items, updated_at FROM checklists ORDER BY updated_at DESC"
  );
  return rows.map((r: ChecklistDbRow) => ({
    id: r.id,
    name: r.name,
    items: parseItems(r.items),
    updated_at: r.updated_at,
  }));
};

export const createChecklist = async (
  name: string,
  items: string[]
): Promise<void> => {
  const db = await getDatabase();
  await db.execute("INSERT INTO checklists (name, items) VALUES (?1, ?2)", [
    name,
    JSON.stringify(items),
  ]);
};

export const updateChecklist = async (
  id: number,
  name: string,
  items: string[]
): Promise<void> => {
  const db = await getDatabase();
  await db.execute(
    "UPDATE checklists SET name = ?1, items = ?2, updated_at = datetime('now') WHERE id = ?3",
    [name, JSON.stringify(items), id]
  );
};

export const deleteChecklist = async (id: number): Promise<void> => {
  const db = await getDatabase();
  await db.execute("DELETE FROM checklists WHERE id = ?1", [id]);
};

export const startCallSession = async (
  checklistId: number,
  checklistName: string
): Promise<number> => {
  const db = await getDatabase();
  const result = await db.execute(
    "INSERT INTO call_sessions (checklist_id, checklist_name) VALUES (?1, ?2)",
    [checklistId, checklistName]
  );
  return Number(result.lastInsertId);
};

export const finishCallSession = async (
  sessionId: number,
  audioFile: string | null,
  results: SessionResult[],
  transcript: SessionTranscriptEntry[] = []
): Promise<void> => {
  const db = await getDatabase();
  await db.execute(
    "UPDATE call_sessions SET ended_at = datetime('now'), audio_file = ?1, results = ?2, transcript = ?3 WHERE id = ?4",
    [audioFile, JSON.stringify(results), JSON.stringify(transcript), sessionId]
  );
};

export const getAllCallSessions = async (): Promise<CallSessionRow[]> => {
  const db = await getDatabase();
  return db.select<CallSessionRow[]>(
    `SELECT id, checklist_name, started_at, ended_at, audio_file, results, transcript
     FROM call_sessions ORDER BY started_at DESC`
  );
};

export const deleteCallSession = async (id: number): Promise<void> => {
  const db = await getDatabase();
  await db.execute("DELETE FROM call_sessions WHERE id = ?1", [id]);
};
