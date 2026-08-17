import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle2Icon,
  CircleIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components";
import { PageLayout } from "@/layouts";
import {
  deleteCallSession,
  getAllCallSessions,
  type CallSessionRow,
  type SessionResult,
} from "@/lib/database";

const parseResults = (raw: string | null): SessionResult[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatOffset = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Start slightly before the cited words so the moment has some run-up.
const SEEK_LEAD_MS = 1500;

const Recordings = () => {
  const [sessions, setSessions] = useState<CallSessionRow[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  // A seek requested before the element exists; applied on loadedmetadata.
  const pendingSeekRef = useRef<{ file: string; ms: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await getAllCallSessions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    },
    [audioUrls]
  );

  // The webview can't load file:// from its http origin, so audio comes back as
  // base64 and becomes a blob URL here.
  const ensureAudio = async (fileName: string): Promise<boolean> => {
    if (audioUrls[fileName]) return true;
    setLoadingFile(fileName);
    try {
      const base64 = await invoke<string>("read_recording", { fileName });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const type = fileName.endsWith(".m4a") ? "audio/mp4" : "audio/webm";
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      setAudioUrls((prev) => ({ ...prev, [fileName]: url }));
      return true;
    } catch (e) {
      setError(
        typeof e === "string" ? e : (e as Error)?.message ?? "Failed to load audio"
      );
      return false;
    } finally {
      setLoadingFile(null);
    }
  };

  const seekTo = (fileName: string, ms: number) => {
    const el = audioRefs.current[fileName];
    const target = Math.max(0, (ms - SEEK_LEAD_MS) / 1000);
    if (!el) return false;
    el.currentTime = target;
    void el.play().catch(() => {});
    return true;
  };

  // Jump straight to the words that ticked an item, loading the file first if
  // this is the first play for that session.
  const jumpToEvidence = async (fileName: string, ms: number) => {
    const ready = await ensureAudio(fileName);
    if (!ready) return;
    if (!seekTo(fileName, ms)) {
      pendingSeekRef.current = { file: fileName, ms };
    }
  };

  const remove = async (session: CallSessionRow) => {
    try {
      if (session.audio_file) {
        await invoke("delete_recording", { fileName: session.audio_file });
      }
      await deleteCallSession(session.id);
      await load();
    } catch (e) {
      setError(
        typeof e === "string" ? e : (e as Error)?.message ?? "Failed to delete"
      );
    }
  };

  return (
    <PageLayout
      title="Recordings"
      description="Jump straight to the words that ticked each item."
      rightSlot={
        <Button onClick={() => void load()} className="cursor-pointer">
          <RefreshCwIcon className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      }
    >
      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No calls recorded yet. Start one from the overlay.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {sessions.map((s) => {
          const results = parseResults(s.results);
          const done = results.filter((r) => r.done).length;
          const file = s.audio_file;

          return (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {s.checklist_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.started_at}
                    {s.ended_at ? ` → ${s.ended_at}` : " · in progress"}
                    {results.length > 0
                      ? ` · ${done}/${results.length} covered`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {file && !audioUrls[file] ? (
                    <Button
                      size="icon"
                      onClick={() => void ensureAudio(file)}
                      disabled={loadingFile === file}
                      className="cursor-pointer"
                      title="Load audio"
                    >
                      <PlayIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    onClick={() => void remove(s)}
                    className="cursor-pointer"
                    title="Delete session and audio"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {file ? (
                audioUrls[file] ? (
                  <audio
                    ref={(el) => {
                      audioRefs.current[file] = el;
                      const pending = pendingSeekRef.current;
                      if (el && pending?.file === file) {
                        // Metadata may not be ready the instant the ref lands.
                        el.onloadedmetadata = () => {
                          seekTo(file, pending.ms);
                          pendingSeekRef.current = null;
                          el.onloadedmetadata = null;
                        };
                      }
                    }}
                    controls
                    src={audioUrls[file]}
                    className="w-full h-9"
                  />
                ) : null
              ) : (
                <p className="text-xs text-muted-foreground">
                  No audio saved for this session.
                </p>
              )}

              {results.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {results.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {r.done ? (
                        <CheckCircle2Icon className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                      ) : (
                        <CircleIcon className="h-4 w-4 mt-0.5 text-muted-foreground/50 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            r.done
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {r.label}
                        </p>
                        {r.done && r.answer ? (
                          <p className="text-sm font-medium text-foreground">
                            {r.answer}
                          </p>
                        ) : null}
                        {r.evidence ? (
                          <p className="text-xs text-muted-foreground italic">
                            “{r.evidence}”
                          </p>
                        ) : null}
                        {r.manual ? (
                          <p className="text-xs text-muted-foreground">
                            set by hand during the call
                          </p>
                        ) : null}
                      </div>

                      {r.done && r.atMs !== undefined && file ? (
                        <button
                          onClick={() => void jumpToEvidence(file, r.atMs!)}
                          className="flex items-center gap-1 shrink-0 text-xs text-primary hover:underline cursor-pointer"
                          title="Play the moment this was said"
                        >
                          <PlayIcon className="h-3 w-3" />
                          {formatOffset(r.atMs)}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </PageLayout>
  );
};

export default Recordings;
