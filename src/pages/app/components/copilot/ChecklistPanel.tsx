import { useState } from "react";
import {
  CheckCircle2Icon,
  CircleIcon,
  LoaderCircleIcon,
  MicIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { Button, ScrollArea } from "@/components";
import type { ItemState } from "@/hooks/useCallCopilot";

interface ChecklistPanelProps {
  checklistName: string;
  items: ItemState[];
  isEvaluating: boolean;
  isRecording: boolean;
  isSaving: boolean;
  error: string | null;
  onStop: () => void;
  onSetVerdict: (index: number, done: boolean) => void;
  onClearVerdict: (index: number) => void;
}

export const ChecklistPanel = ({
  checklistName,
  items,
  isEvaluating,
  isRecording,
  isSaving,
  error,
  onStop,
  onSetVerdict,
  onClearVerdict,
}: ChecklistPanelProps) => {
  // Which item is mid-uncheck. Ticking is immediate; unticking asks first,
  // because the evidence is worth a second look before discarding it.
  const [confirming, setConfirming] = useState<number | null>(null);
  const done = items.filter((i) => i.done).length;

  const handleClick = (item: ItemState) => {
    if (item.done) setConfirming(item.index);
    else onSetVerdict(item.index, true);
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 gap-2 select-none">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">
            {checklistName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {done}/{items.length}
          </span>
          {isEvaluating ? (
            <LoaderCircleIcon className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRecording ? (
            <span
              className="flex items-center gap-1 text-xs text-red-500"
              title="Recording audio"
            >
              <MicIcon className="h-3 w-3" />
              rec
            </span>
          ) : null}
          <Button
            size="icon"
            onClick={onStop}
            disabled={isSaving}
            title={isSaving ? "Saving recording…" : "End call"}
          >
            {isSaving ? (
              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 pr-2">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This checklist has no items yet.
            </p>
          ) : null}

          {items.map((item) => (
            <div key={item.index} className="flex flex-col">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleClick(item)}
                  className="mt-0.5 shrink-0 cursor-pointer"
                  title={item.done ? "Mark not covered" : "Mark covered"}
                >
                  {item.done ? (
                    <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                  ) : (
                    <CircleIcon className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug ${
                      item.done
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </p>

                  {/* The captured value is the useful part at a glance — shown
                      unstruck even when the item is ticked. */}
                  {item.done && item.answer ? (
                    <p className="text-sm font-medium text-foreground">
                      {item.answer}
                    </p>
                  ) : null}
                </div>

                {item.manual ? (
                  <button
                    onClick={() => onClearVerdict(item.index)}
                    className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="You set this by hand — hand it back to the AI"
                  >
                    <RotateCcwIcon className="h-3 w-3" />
                  </button>
                ) : null}
              </div>

              {confirming === item.index ? (
                <div className="ml-6 mt-1 mb-1 flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                    Are you sure this was not covered?
                  </p>
                  {item.evidence ? (
                    <p className="text-xs text-muted-foreground italic">
                      Marked covered by: “{item.evidence}”
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      You ticked this by hand — there is no captured phrase.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onSetVerdict(item.index, false);
                        setConfirming(null);
                      }}
                      className="text-xs font-medium text-red-500 hover:underline cursor-pointer"
                    >
                      Not covered
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-xs text-muted-foreground hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>

      {error ? (
        <p className="text-xs text-red-500 shrink-0 line-clamp-2" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
};
