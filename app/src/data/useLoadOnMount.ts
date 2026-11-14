import { useEffect, useState } from "react";

// Runs an async loader once, when the component first mounts, and re-renders when it finishes. While loading both
// fields are null; afterwards exactly one of them is set.
// `load` must be a stable function (one defined at module level, like loadMasterData), or it would reload every render.
export function useLoadOnMount<T>(load: () => Promise<T>): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    load()
      .then((loadedData) => {
        if (!cancelled) {
          setData(loadedData);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  return { data, error };
}