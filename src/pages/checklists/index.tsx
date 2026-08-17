import { useCallback, useEffect, useState } from "react";
import { PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button, Input, Textarea } from "@/components";
import { PageLayout } from "@/layouts";
import {
  createChecklist,
  deleteChecklist,
  formatChecklistText,
  getAllChecklists,
  parseChecklistText,
  updateChecklist,
  type Checklist,
} from "@/lib/database";

const PLACEHOLDER = `- Understood their current process
- Identified a specific pain
- Established budget
- Identified the decision maker
- Agreed a concrete next step`;

interface Draft {
  id: number | null;
  name: string;
  text: string;
}

const emptyDraft: Draft = { id: null, name: "", text: "" };

const Checklists = () => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setChecklists(await getAllChecklists());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checklists");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const items = parseChecklistText(draft.text);

    if (!name) {
      setError("Give the checklist a name");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item");
      return;
    }

    setIsBusy(true);
    try {
      if (draft.id === null) await createChecklist(name, items);
      else await updateChecklist(draft.id, name, items);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save checklist");
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async (id: number) => {
    setIsBusy(true);
    try {
      await deleteChecklist(id);
      if (draft?.id === id) setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete checklist");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <PageLayout
      title="Checklists"
      description="Objectives to track during a call. Pick one from the overlay when you start."
      rightSlot={
        draft === null ? (
          <Button
            onClick={() => setDraft({ ...emptyDraft })}
            className="cursor-pointer"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            New checklist
          </Button>
        ) : null
      }
    >
      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : null}

      {draft ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {draft.id === null ? "New checklist" : "Edit checklist"}
            </p>
            <Button
              size="icon"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              className="cursor-pointer"
              title="Cancel"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>

          <Input
            placeholder="Checklist name, e.g. Sales discovery"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />

          <div className="flex flex-col gap-1">
            <Textarea
              rows={9}
              placeholder={PLACEHOLDER}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              One item per line, starting with <code>-</code>. Bare lines,{" "}
              <code>*</code> and numbered lists are accepted too.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => void save()}
              disabled={isBusy}
              className="cursor-pointer"
            >
              <SaveIcon className="h-4 w-4 mr-1" />
              {draft.id === null ? "Create" : "Save"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {parseChecklistText(draft.text).length} item(s)
            </span>
          </div>
        </div>
      ) : null}

      {checklists.length === 0 && draft === null ? (
        <p className="text-sm text-muted-foreground">
          No checklists yet. Create one to start tracking a call.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {checklists.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.items.length} item(s) · updated {c.updated_at}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      name: c.name,
                      text: formatChecklistText(c.items),
                    })
                  }
                  className="cursor-pointer"
                  title="Edit"
                >
                  <SaveIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={() => void remove(c.id)}
                  disabled={isBusy}
                  className="cursor-pointer"
                  title="Delete"
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ul className="flex flex-col gap-0.5">
              {c.items.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  – {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageLayout>
  );
};

export default Checklists;
