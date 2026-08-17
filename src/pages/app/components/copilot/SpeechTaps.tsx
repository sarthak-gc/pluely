import { useEffect, useRef, useState } from "react";
import { useMicVAD } from "@ricky0123/vad-react";
import { fetchSTT } from "@/lib";
import { floatArrayToWav } from "@/lib/utils";
import { shouldUsePluelyAPI } from "@/lib/functions/pluely.api";
import { useApp } from "@/contexts";
import type { Speaker } from "@/hooks/useCallCopilot";

// A virtual audio device (BlackHole, Loopback, or an aggregate built on one)
// carries the other party's audio, since macOS gives no direct access to another
// app's output without a system-audio tap.
const TAP_DEVICE_PATTERN = /blackhole|loopback|aggregate|multi-output|soundflower/i;

interface TapProps {
  speaker: Speaker;
  deviceId?: string;
  onTranscript: (speaker: Speaker, text: string, startedAtMs: number) => void;
}

// One VAD instance bound to one input device. Renders nothing.
const Tap = ({ speaker, deviceId, onTranscript }: TapProps) => {
  const { selectedSttProvider, allSttProviders } = useApp();

  useMicVAD({
    userSpeakingThreshold: 0.6,
    startOnLoad: true,
    additionalAudioConstraints:
      deviceId && deviceId !== "default"
        ? { deviceId: { exact: deviceId } }
        : {},
    onSpeechEnd: async (audio) => {
      // onSpeechEnd fires when speech stops, and STT adds another second or so.
      // Deriving the start from the buffer length gives the moment the words
      // actually began, which is what we want to seek the recording to.
      const startedAtMs = Date.now() - (audio.length / 16000) * 1000;
      try {
        const usePluelyAPI = await shouldUsePluelyAPI();
        const providerConfig = allSttProviders.find(
          (p) => p.id === selectedSttProvider.provider
        );

        if (!usePluelyAPI && (!selectedSttProvider.provider || !providerConfig)) {
          console.warn("[copilot] no STT provider configured");
          return;
        }

        const transcription = await fetchSTT({
          provider: usePluelyAPI ? undefined : providerConfig,
          selectedProvider: selectedSttProvider,
          audio: floatArrayToWav(audio, 16000, "wav"),
        });

        if (transcription) {
          onTranscript(speaker, transcription, startedAtMs);
        }
      } catch (error) {
        console.error(`[copilot] ${speaker} transcription failed:`, error);
      }
    },
  });

  return null;
};

interface SpeechTapsProps {
  onTranscript: (speaker: Speaker, text: string, startedAtMs: number) => void;
}

export const SpeechTaps = ({ onTranscript }: SpeechTapsProps) => {
  const [tapDeviceId, setTapDeviceId] = useState<string | null>(null);
  const searchedRef = useRef(false);

  useEffect(() => {
    if (searchedRef.current) return;
    searchedRef.current = true;

    let cancelled = false;

    // Device labels are blank until mic permission is granted, and the mic tap
    // below is what triggers that prompt — so retry until labels appear rather
    // than enumerating once and concluding there is no tap device.
    const findTapDevice = async () => {
      for (let attempt = 0; attempt < 10 && !cancelled; attempt++) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter((d) => d.kind === "audioinput");
          const labelled = inputs.some((d) => d.label);

          if (labelled) {
            const match = inputs.find((d) => TAP_DEVICE_PATTERN.test(d.label));
            if (cancelled) return;
            if (match) {
              setTapDeviceId(match.deviceId);
            } else {
              console.info(
                "[copilot] no virtual audio device found — capturing your side only.",
                "Install BlackHole and route the call through it to capture the other party."
              );
            }
            return;
          }
        } catch (error) {
          console.error("[copilot] failed to enumerate audio devices:", error);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    void findTapDevice();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Tap speaker="me" onTranscript={onTranscript} />
      {tapDeviceId ? (
        <Tap
          key={tapDeviceId}
          speaker="them"
          deviceId={tapDeviceId}
          onTranscript={onTranscript}
        />
      ) : null}
    </>
  );
};
