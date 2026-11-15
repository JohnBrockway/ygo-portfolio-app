import { useCallback, useSyncExternalStore } from "react";

// Whether the screen currently matches a CSS media query, re-rendering the component whenever that changes (for
// example when the window is resized past a breakpoint). `query` is the media query as written in CSS, such as
// "(min-width: 1000px)".
export function useLiveMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}