import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// WKWebView (Safari's engine) does not support audio/webm. mp4 is the one that
// actually records here; the rest are fallbacks for other platforms.
const CANDIDATE_TYPES = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/webm",
];

const pickMimeType = (): string | undefined => {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_TYPES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
};

const extensionFor = (mimeType: string | undefined): string =>
  mimeType?.includes("mp4") ? "m4a" : "webm";

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const useSessionRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileNameRef = useRef<string | null>(null);
  // Wall-clock epoch of the first recorded sample. Utterance offsets are
  // measured against this so a checklist tick can seek the saved audio.
  const startedAtRef = useRef<number | null>(null);

  // Records the whole call in one file, independent of the VAD's per-utterance
  // slices — this is its own getUserMedia stream so pausing the VAD never
  // interrupts the recording.
  const start = useCallback(async (label: string) => {
    setError(null);
    try {
      const mimeType = pickMimeType();
      if (!mimeType) {
        setError("Audio recording is not supported in this webview");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000); // timeslice, so a crash still leaves partial chunks
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, 19);
      const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40);
      fileNameRef.current = `${stamp}_${safeLabel}.${extensionFor(mimeType)}`;

      setIsRecording(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to start audio recording"
      );
    }
  }, []);

  // Returns the saved file name so the caller can attach it to the session row.
  const stop = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current;
    const fileName = fileNameRef.current;
    recorderRef.current = null;
    fileNameRef.current = null;
    setIsRecording(false);

    const cleanup = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      startedAtRef.current = null;
    };

    if (!recorder || !fileName) {
      cleanup();
      return null;
    }

    const finalBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
    });

    cleanup();

    if (finalBlob.size === 0) {
      setError("Recording was empty");
      return null;
    }

    try {
      const base64 = await blobToBase64(finalBlob);
      await invoke<string>("save_recording", {
        fileName,
        audioBase64: base64,
      });
      return fileName;
    } catch (e) {
      setError(
        typeof e === "string" ? e : (e as Error)?.message ?? "Failed to save recording"
      );
      return null;
    }
  }, []);

  // Read synchronously by the copilot when an utterance arrives, so the offset
  // is computed against the real recording start rather than session state.
  const getStartedAt = useCallback(() => startedAtRef.current, []);

  return { isRecording, error, start, stop, getStartedAt };
};
