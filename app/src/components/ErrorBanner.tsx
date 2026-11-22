import { useState } from "react";
import type { MemoryStoreState } from "../data/memoryStore";

type ErrorBannerProps = {
  // What failed to load or save, in the plural and as the user knows it: "lists", "binders".
  what: string;
  // Replaces the default sentence, for failures that aren't a memory store's data being untrustworthy (a failed sync:
  // nothing is read-only then, and nothing is lost).
  message?: string;
  state: MemoryStoreState;
  retry: () => Promise<void>;
};

// Shown while a memory store's data can't be trusted (a load or a save failed), and thus the app is read-only for it.
// One banner per store: renders nothing unless that store is in error. Also used for a failed sync (see `message`).
export function ErrorBanner({ what, message, state, retry }: ErrorBannerProps) {
  const [retrying, setRetrying] = useState(false);

  if (state.status !== "error") {
    return null;
  }

  async function handleRetry() {
    setRetrying(true);
    await retry();
    setRetrying(false);
  }

  return (
    <div className="error-banner" role="alert">
      <div>
        <p>{message ?? `Something went wrong when fetching your ${what}, so they can't be changed right now.`}</p>
        {state.error === null ? null : <p className="muted">{state.error}</p>}
      </div>
      <button type="button" className="action-button" disabled={retrying} onClick={handleRetry}>
        Retry
      </button>
    </div>
  );
}