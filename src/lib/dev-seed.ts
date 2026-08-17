// TEMPORARY dev seed — remove before committing.
//
// Writes the Groq Whisper STT config straight into localStorage so the app
// starts with voice input configured, skipping the Dev Space form. Contains a
// live API key in plaintext; rotate it at console.groq.com/keys and delete this
// file when done testing.
//
// To remove: delete this file and its import in src/main.tsx.
import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "@/lib/storage";
const API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const SEED_STT = {
  provider: "groq",
  variables: {
    API_KEY,
    MODEL: "whisper-large-v3-turbo",
  },
};

export const applyDevSeed = () => {
  // Overwrite rather than fill-if-empty: re-seeding on every reload is what
  // makes this useful while testing, and there is no hand-entered config to
  // clobber as long as the provider is still groq.
  const existing = safeLocalStorage.getItem(STORAGE_KEYS.SELECTED_STT_PROVIDER);
  let shouldWrite = true;

  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      // Leave a manually-chosen different provider alone.
      shouldWrite = parsed?.provider === SEED_STT.provider;
    } catch {
      shouldWrite = true;
    }
  }

  if (shouldWrite) {
    safeLocalStorage.setItem(
      STORAGE_KEYS.SELECTED_STT_PROVIDER,
      JSON.stringify(SEED_STT)
    );
  }

  // shouldUsePluelyAPI() routes to the hosted endpoint when this is "true",
  // which fails with the APP_ENDPOINT error in an OSS build.
  safeLocalStorage.setItem(STORAGE_KEYS.PLUELY_API_ENABLED, "false");

  console.info(
    "[dev-seed] STT provider set to Groq Whisper (whisper-large-v3-turbo); Pluely API disabled"
  );
};
