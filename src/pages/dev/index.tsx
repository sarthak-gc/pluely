import { useEffect, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button, Input, Label } from "@/components";
import { useApp } from "@/contexts";
import { PageLayout } from "@/layouts";

const GROQ_PROVIDER = "groq";
const GROQ_STT_MODEL = "whisper-large-v3-turbo";

const DevSpace = () => {
  const { selectedSttProvider, onSetSelectedSttProvider } = useApp();
  const storedKey = selectedSttProvider?.variables?.API_KEY ?? "";

  const [apiKey, setApiKey] = useState(storedKey);
  const [isSaved, setIsSaved] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setApiKey(storedKey);
  }, [storedKey]);

  const save = () => {
    onSetSelectedSttProvider({
      provider: GROQ_PROVIDER,
      variables: {
        ...selectedSttProvider?.variables,
        API_KEY: apiKey.trim(),
        MODEL: selectedSttProvider?.variables?.MODEL ?? GROQ_STT_MODEL,
      },
    });
    setIsSaved(true);
  };

  return (
    <PageLayout
      title="API Keys"
      description="Update the Groq API key this app uses"
    >
      <div className="flex flex-col gap-2 max-w-xl">
        <Label htmlFor="groq-api-key">Groq API key</Label>
        <div className="flex flex-row items-center gap-2">
          <Input
            id="groq-api-key"
            type={isRevealed ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="gsk_…"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsSaved(false);
            }}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsRevealed((prev) => !prev)}
            title={isRevealed ? "Hide key" : "Show key"}
            className="cursor-pointer shrink-0"
          >
            {isRevealed ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={save}
            disabled={!apiKey.trim() || apiKey.trim() === storedKey}
            className="cursor-pointer shrink-0"
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isSaved
            ? "Saved. Speech-to-text now uses this key."
            : storedKey
            ? "A key is set. Paste a new one to replace it after rotating."
            : "No key set yet. Create one at console.groq.com/keys."}
        </p>
      </div>
    </PageLayout>
  );
};

export default DevSpace;
