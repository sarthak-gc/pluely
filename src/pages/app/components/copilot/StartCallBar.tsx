import { useEffect, useState } from "react";
import { PlayIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components";
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
    <div className="flex flex-row items-center gap-2 w-full min-w-0">
      {isLoading ? (
        <span className="text-xs text-muted-foreground">Loading…</span>
      ) : checklists.length === 0 ? (
        <span className="text-xs text-muted-foreground truncate">
          No checklists yet — create one in the app.
        </span>
      ) : (
        // A native <select> opens as a separate system window, which does not
        // inherit this window's content protection and so stays visible while
        // screen sharing.
        <Select
          value={selectedId !== null ? String(selectedId) : ""}
          onValueChange={(value) => setSelectedId(Number(value))}
        >
          <SelectTrigger
            className="flex-1 min-w-0 h-8 text-sm cursor-pointer"
            title="Checklist for this call"
          >
            <SelectValue placeholder="Choose a checklist" />
          </SelectTrigger>
          <SelectContent>
            {checklists.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} ({c.items.length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
