import { useState } from "react";
import { refreshLists, useLiveLists } from "../data/lists";

// Shown while the lists can't be trusted (a load or a save failed), and thus the app is read-only
export function ListsErrorBanner() {
  const lists = useLiveLists();
  const [retrying, setRetrying] = useState(false);

  if (lists.status !== "error") {
    return null;
  }

  async function handleRetry() {
    setRetrying(true);
    await refreshLists();
    setRetrying(false);
  }

  return (
    <div className="error-banner" role="alert">
      <div>
        <p>Something went wrong when fetching your lists, so they can't be changed right now.</p>
        {lists.error === null ? null : <p className="muted">{lists.error}</p>}
      </div>
      <button type="button" className="action-button" disabled={retrying} onClick={handleRetry}>
        Retry
      </button>
    </div>
  );
}