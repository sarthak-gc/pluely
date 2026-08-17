import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  PlayIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components";
import { useWindowResize } from "@/hooks";
import { getAllChecklists, type Checklist } from "@/lib/database";

interface StartCallBarProps {
  onStart: (checklist: Checklist) => void;
  onOpenDashboard: () => void;
}

export const StartCallBar = ({
  onStart,
  onOpenDashboard,
}: StartCallBarProps) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { resizeWindow } = useWindowResize();

  // A portalled dropdown cannot survive here: this window is 54px tall and
  // collapses itself on DOM mutation, and the resize that makes room churns
  // focus enough that the library reads it as a click outside and closes.
  // Rendering the list inline means only this toggle opens or closes it.
  const togglePicker = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      document.body.dataset.pickerOpen = "true";
      void resizeWindow(true, "picker-open");
    } else {
      delete document.body.dataset.pickerOpen;
      void resizeWindow(false, "picker-close");
    }
  };

  const choose = (id: number) => {
    setSelectedId(id);
    setIsOpen(false);
    delete document.body.dataset.pickerOpen;
    void resizeWindow(false, "picker-choose");
  };

  useEffect(
    () => () => {
      delete document.body.dataset.pickerOpen;
    },
    []
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const rows = await getAllChecklists();
      setChecklists(rows);
      // Keep the current pick if it still exists, else fall back to the newest.
      setSelectedId((prev) =>
        prev !== null && rows.some((r) => r.id === prev)
          ? prev
          : rows[0]?.id ?? null
      );
    } catch (e) {
      console.error("Failed to load checklists:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selected = checklists.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="relative flex flex-row items-center gap-2 w-full min-w-0">
      {isLoading ? (
        <span className="text-xs text-muted-foreground">Loading…</span>
      ) : checklists.length === 0 ? (
        <span className="text-xs text-muted-foreground truncate">
          No checklists yet — create one in the app.
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={togglePicker}
            title="Checklist for this call"
            className="flex-1 min-w-0 h-8 flex items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2 text-sm cursor-pointer"
          >
            <span className="truncate">
              {selected
                ? `${selected.name} (${selected.items.length})`
                : "Choose a checklist"}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" />
          </button>

          {isOpen ? (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-md border border-input bg-popover p-1 shadow-md">
              {checklists.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c.id)}
                  className={`w-full text-left truncate rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                    c.id === selectedId ? "bg-accent/50" : ""
                  }`}
                >
                  {c.name} ({c.items.length})
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}

      <Button
        size="icon"
        onClick={() => void load()}
        className="cursor-pointer shrink-0"
        title="Reload checklists"
      >
        <RefreshCwIcon className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        onClick={() => selected && onStart(selected)}
        disabled={!selected || selected.items.length === 0}
        className="cursor-pointer shrink-0"
        title="Start call"
      >
        <PlayIcon className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        onClick={onOpenDashboard}
        className="cursor-pointer shrink-0"
        title="Open app"
      >
        <SparklesIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
