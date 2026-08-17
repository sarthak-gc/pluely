import { Card, DragButton, CustomCursor } from "@/components";
import { ChecklistPanel, SpeechTaps, StartCallBar } from "./components";
import { useApp, useCallCopilot } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { invoke } from "@tauri-apps/api/core";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";
import { useCallback } from "react";

const App = () => {
  const { isHidden } = useApp();
  const { customizable } = useAppContext();
  const platform = getPlatform();
  const copilot = useCallCopilot();

  const openDashboard = useCallback(async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  }, []);

  return (
    <ErrorBoundary
      fallbackRender={() => <ErrorLayout isCompact />}
      resetKeys={["app-error"]}
      onReset={() => {
        console.log("Reset");
      }}
    >
      <div
        className={`w-screen h-screen flex overflow-hidden justify-center items-start ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
      >
        {copilot.active ? (
          <Card className="w-full h-full flex flex-col gap-2 p-2 min-h-0">
            {/* Capture is headless — it only feeds utterances to the evaluator. */}
            <SpeechTaps onTranscript={copilot.addUtterance} />
            <ChecklistPanel
              checklistName={copilot.checklistName}
              items={copilot.items}
              isEvaluating={copilot.isEvaluating}
              isRecording={copilot.isRecording}
              isSaving={copilot.isSaving}
              error={copilot.error}
              onStop={() => void copilot.stop()}
              onSetVerdict={copilot.setManualVerdict}
              onClearVerdict={copilot.clearManualVerdict}
            />
            <DragButton />
          </Card>
        ) : (
          <Card className="w-full flex flex-row items-center gap-2 p-2">
            <StartCallBar
              onStart={(checklist) => void copilot.start(checklist)}
              onOpenDashboard={() => void openDashboard()}
            />
            <DragButton />
          </Card>
        )}

        {customizable.cursor.type === "invisible" && platform !== "linux" ? (
          <CustomCursor />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default App;
