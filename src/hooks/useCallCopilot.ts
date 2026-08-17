import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  finishCallSession,
  startCallSession,
  type Checklist,
} from "@/lib/database";
import { useSessionRecorder } from "./useSessionRecorder";

export type Speaker = "me" | "them";

export interface TranscriptEntry {
  speaker: Speaker;
  text: string;
  at: number;
}

export interface ItemState {
  index: number;
  label: string;
  done: boolean;
  /** The phrase that satisfied the item. */
  evidence?: string;
  /** The value obtained, when the item was a question with an answer. */
  answer?: string;
  /** Offset into the session recording where the evidence was spoken. */
  atMs?: number;
  /** True when the user set this verdict by hand rather than the model. */
  manual: boolean;
}

interface CoveredEntry {
  evidence?: string;
  answer?: string;
  atMs?: number;
}

// Evaluation runs this long after the last utterance, so a normal back-and-forth
// costs one call per pause rather than one per sentence.
const EVAL_DEBOUNCE_MS = 4000;
// Only the tail of the call is sent, which keeps each evaluation cheap.
const TRANSCRIPT_WINDOW = 40;
const COLLAPSED_HEIGHT = 54;
const EXPANDED_HEIGHT = 320;

const SYSTEM_PROMPT = `You decide which checklist items a live conversation has satisfied.

You receive checklist items (each with a stable id) and a numbered transcript.

Each item is shown with its current verdict. Your reply REPLACES all verdicts, so
you must re-list every item that is satisfied — including ones already marked
satisfied whose evidence still holds. Omitting an item marks it not satisfied.
If an existing verdict's quote does not actually satisfy its item, omit that item:
correcting an earlier mistake is expected and welcome.

Rules for marking an item satisfied:
- Cite a verbatim quote from one transcript line, and that line's number.
- The subject must match exactly. An item naming a specific service, person, or document is satisfied only by a quote about that same one. A quote about Facebook does NOT satisfy an item about Gmail, and vice versa.
- The action must match. "Ask for X" requires someone actually requesting X — not merely mentioning X, and not receiving something related to X.
- One line can satisfy several items. If a single quote covers two items, return a separate entry for each.
- If no line clearly satisfies an item, leave it out. Omitting an item is always better than a wrong match.
- Before answering, re-read every entry you drafted and check that the quote names the same subject AND the same action as the item. Delete any entry that fails that check.

Also extract the answer where there is one:
- If the item asks for a piece of information and someone supplied it, put that value in "answer" — just the value, as briefly as possible ("Acme SAS", "three", "150k first year, 300k second").
- The answer may come from a different line than the quote: the quote is the request, the answer is the reply.
- If the item was satisfied but no specific value was given, omit "answer".

Reply with JSON only. No prose, no markdown, no code fences.
{"covered":[{"id":<the id shown for that item>,"line":<transcript line number>,"quote":"<verbatim quote>","answer":"<value, if any>"}]}`;

interface CoveredClaim {
  id: number;
  line?: number;
  quote?: string;
  answer?: string;
}

// Models wrap JSON in fences or prose often enough that locating the object is
// required, not defensive padding.
const parseCovered = (raw: string): CoveredClaim[] => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return [];

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed?.covered)) return [];
    return parsed.covered
      .filter((c: any) => Number.isInteger(c?.id))
      .map((c: any) => ({
        id: c.id as number,
        line: Number.isInteger(c.line) ? (c.line as number) : undefined,
        quote: typeof c.quote === "string" ? c.quote : undefined,
        answer:
          typeof c.answer === "string" && c.answer.trim()
            ? c.answer.trim()
            : undefined,
      }));
  } catch {
    return [];
  }
};

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Trusts the quote over the claimed line number: a verbatim quote can be
// verified against the transcript, whereas a line number cannot. Returns the
// index of the line that actually contains the quote, or -1 if no line does —
// which means the quote was not really said, and the tick is rejected.
const locateQuote = (
  entries: { text: string }[],
  quote: string,
  claimedLine?: number
): number => {
  const q = normalize(quote);
  if (!q) return -1;

  if (
    claimedLine !== undefined &&
    entries[claimedLine] &&
    normalize(entries[claimedLine].text).includes(q)
  ) {
    return claimedLine;
  }
  return entries.findIndex((e) => normalize(e.text).includes(q));
};

export const useCallCopilot = () => {
  const recorder = useSessionRecorder();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [covered, setCovered] = useState<Record<number, CoveredEntry>>({});
  // The user's explicit verdicts. These win over the model and are never
  // revised, so a hand-corrected item stays corrected.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  // Read inside the debounced callback, which would otherwise close over state
  // from when the timer was armed.
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const coveredRef = useRef<Record<number, CoveredEntry>>({});
  const overridesRef = useRef<Record<number, boolean>>({});
  const checklistRef = useRef<Checklist | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  useEffect(() => {
    coveredRef.current = covered;
  }, [covered]);
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);
  useEffect(() => {
    checklistRef.current = checklist;
  }, [checklist]);

  const items: ItemState[] = useMemo(
    () =>
      (checklist?.items ?? []).map((label, index) => {
        const manual = index in overrides;
        return {
          index,
          label,
          done: manual ? overrides[index] : index in covered,
          evidence: covered[index]?.evidence,
          answer: covered[index]?.answer,
          atMs: covered[index]?.atMs,
          manual,
        };
      }),
    [checklist, covered, overrides]
  );

  const evaluate = useCallback(async () => {
    // Skip rather than queue: the next utterance re-arms the timer anyway.
    if (inFlightRef.current) return;

    const active = checklistRef.current;
    const entries = transcriptRef.current;
    if (!active || !entries.length) return;

    const current = coveredRef.current;
    const locked = overridesRef.current;
    // Items the user has decided are withheld entirely — there is nothing for
    // the model to add, and asking would invite it to argue with the user.
    const judgeable = active.items
      .map((label, index) => ({ label, index }))
      .filter((i) => !(i.index in locked));
    if (!judgeable.length) return;

    // Absolute index is kept in the label so the model's answer maps back even
    // when the window has slid past the start of the call.
    const offset = Math.max(0, entries.length - TRANSCRIPT_WINDOW);
    const lines = entries
      .slice(-TRANSCRIPT_WINDOW)
      .map(
        (e, i) =>
          `[${offset + i}] ${e.speaker === "me" ? "ME" : "THEM"}: ${e.text}`
      )
      .join("\n");

    const prompt = [
      `Checklist: ${active.name}`,
      "",
      // "id=N" rather than "N." so there is no way to read the number as a
      // position in this list — the list omits user-locked items, so a
      // positional reading would silently shift ticks onto the wrong item.
      "Items to judge (with current verdict):",
      ...judgeable.map((i) => {
        const verdict = current[i.index];
        return verdict
          ? `id=${i.index} | ${i.label} | currently SATISFIED by: "${
              verdict.evidence ?? ""
            }"`
          : `id=${i.index} | ${i.label} | currently NOT satisfied`;
      }),
      "",
      "Transcript (line numbers in brackets):",
      lines,
    ].join("\n");

    inFlightRef.current = true;
    setIsEvaluating(true);
    setError(null);

    try {
      const raw = await invoke<string>("ask_claude_cli", {
        prompt,
        system: SYSTEM_PROMPT,
      });

      const claims = parseCovered(raw);
      const judgeableIds = new Set(judgeable.map((i) => i.index));
      const accepted: { id: number; entry: CoveredEntry }[] = [];
      const recordingStart = recorder.getStartedAt();

      for (const c of claims) {
        if (!judgeableIds.has(c.id)) {
          console.warn("[copilot] rejected tick for unasked item", c);
          continue;
        }
        if (!c.quote) {
          console.warn("[copilot] rejected tick with no quote", c);
          continue;
        }

        // A quote that appears nowhere in the transcript was not actually said,
        // so the tick is discarded rather than shown as covered.
        const line = locateQuote(entries, c.quote, c.line);
        if (line === -1) {
          console.warn("[copilot] rejected tick, quote not in transcript", c);
          continue;
        }

        accepted.push({
          id: c.id,
          entry: {
            evidence: c.quote,
            answer: c.answer,
            atMs:
              recordingStart !== null
                ? Math.max(0, entries[line].at - recordingStart)
                : undefined,
          },
        });
      }

      // Wholesale replace: the reply is the full verdict set, so an item the
      // model dropped becomes un-ticked. Only applied when the reply parsed —
      // a failed call leaves the previous verdicts untouched.
      const next: Record<number, CoveredEntry> = {};
      for (const a of accepted) next[a.id] = a.entry;

      // Locked items were withheld from the model, so carry their evidence
      // forward rather than letting the replace drop it.
      for (const idStr of Object.keys(locked)) {
        const id = Number(idStr);
        if (current[id] && !(id in next)) next[id] = current[id];
      }

      for (const idStr of Object.keys(current)) {
        const id = Number(idStr);
        if (!(id in next) && !(id in locked)) {
          console.info(
            `[copilot] revised: item ${id} un-ticked (${active.items[id]})`
          );
        }
      }

      setCovered(next);
    } catch (e) {
      setError(
        typeof e === "string" ? e : (e as Error)?.message ?? "Evaluation failed"
      );
    } finally {
      inFlightRef.current = false;
      setIsEvaluating(false);
    }
  }, [recorder]);

  const evaluateRef = useRef(evaluate);
  useEffect(() => {
    evaluateRef.current = evaluate;
  }, [evaluate]);

  const addUtterance = useCallback(
    (speaker: Speaker, text: string, startedAtMs?: number) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setTranscript((prev) => [
        ...prev,
        { speaker, text: trimmed, at: startedAtMs ?? Date.now() },
      ]);

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void evaluateRef.current();
      }, EVAL_DEBOUNCE_MS);
    },
    []
  );

  // Pins an item to the user's verdict. Locked items stop being sent for
  // evaluation, so the model can never argue back.
  const setManualVerdict = useCallback((index: number, done: boolean) => {
    setOverrides((prev) => ({ ...prev, [index]: done }));
  }, []);

  // Hands the item back to the model.
  const clearManualVerdict = useCallback((index: number) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const setWindowHeight = useCallback(async (height: number) => {
    try {
      await invoke("set_window_height", { height });
    } catch (e) {
      console.error("Failed to resize window:", e);
    }
  }, []);

  const start = useCallback(
    async (selected: Checklist) => {
      setChecklist(selected);
      setTranscript([]);
      setCovered({});
      setOverrides({});
      setError(null);

      try {
        sessionIdRef.current = await startCallSession(
          selected.id,
          selected.name
        );
      } catch (e) {
        console.error("Failed to open session row:", e);
        sessionIdRef.current = null;
      }

      void recorder.start(selected.name);
      // Read by useWindowResize to suppress collapse-on-mutation.
      document.body.dataset.copilotActive = "true";
      void setWindowHeight(EXPANDED_HEIGHT);
    },
    [recorder, setWindowHeight]
  );

  const stop = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setIsSaving(true);
    const audioFile = await recorder.stop();

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sessionId !== null) {
      const active = checklistRef.current;
      const locked = overridesRef.current;
      const results = (active?.items ?? []).map((label, index) => {
        const manual = index in locked;
        return {
          label,
          done: manual ? locked[index] : index in coveredRef.current,
          evidence: coveredRef.current[index]?.evidence,
          answer: coveredRef.current[index]?.answer,
          atMs: coveredRef.current[index]?.atMs,
          manual,
        };
      });
      try {
        await finishCallSession(
          sessionId,
          audioFile,
          results,
          transcriptRef.current
        );
      } catch (e) {
        console.error("Failed to close session row:", e);
      }
    }

    setIsSaving(false);
    setChecklist(null);
    delete document.body.dataset.copilotActive;
    void setWindowHeight(COLLAPSED_HEIGHT);
  }, [recorder, setWindowHeight]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      delete document.body.dataset.copilotActive;
    },
    []
  );

  return {
    active: checklist !== null,
    checklistName: checklist?.name ?? "",
    items,
    transcriptCount: transcript.length,
    isEvaluating,
    isRecording: recorder.isRecording,
    isSaving,
    error: error ?? recorder.error,
    start,
    stop,
    addUtterance,
    setManualVerdict,
    clearManualVerdict,
  };
};
